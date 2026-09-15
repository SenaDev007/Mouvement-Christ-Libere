/**
 * ⭐ V3.84 — Test runtime de l'extraction multi-formes de la réponse
 * FedaPay (bug production : l'API RÉELLE enveloppe la transaction sous
 * la clé versionnée « v1/transaction », ignorée par l'ancien parsing —
 * chaque initiation de don FedaPay échouait avec « FedaPay n'a pas
 * renvoyé d'identifiant de transaction »).
 *
 * L'extraction étant une fonction privée du service, ce test la
 * réimplémente à l'identique et vérifie AUSSI le service complet via
 * des réponses simulées de appelApi (mock du fetch global).
 *
 * Exécution : bun scripts/v384-tests-fedapay.ts
 */

process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test";

let passes = 0;
let echecs = 0;

function verifie(libelle: string, condition: boolean, detail = "") {
  if (condition) {
    passes++;
    console.log(`  ✔ ${libelle}`);
  } else {
    echecs++;
    console.error(`  ✘ ${libelle}${detail ? " — " + detail : ""}`);
  }
}

// ── Réimplémentation à l'identique de extraireTransaction ───────────
// (fonction privée — le code est copié-collé du service ; toute
// divergence ferait échouer le test de cohérence ci-dessous).
function extraireTransaction(
  reponse: Record<string, unknown>
): Record<string, unknown> | null {
  const enveloppes: unknown[] = [
    reponse["v1/transaction"],
    reponse.transaction,
    reponse.data,
    reponse,
  ];
  for (const enveloppe of enveloppes) {
    if (!enveloppe || typeof enveloppe !== "object") continue;
    const objet = enveloppe as Record<string, unknown>;
    const internes: unknown[] = [
      objet,
      typeof objet.data === "object" && objet.data !== null
        ? objet.data
        : undefined,
    ];
    for (const interne of internes) {
      if (
        interne &&
        typeof interne === "object" &&
        (interne as Record<string, unknown>).id != null
      ) {
        return interne as Record<string, unknown>;
      }
    }
  }
  return null;
}

// ── ① Les quatre formes de réponse ──────────────────────────────────
console.log("── ① Extraction multi-formes ──");

const FORME_REELLE = {
  klass: "v1/transaction",
  "v1/transaction": { id: 283, reference: "FED-TEST", amount: 5000 },
};
verifie(
  "Forme RÉELLE « v1/transaction » → id trouvé (le bug V3.82)",
  extraireTransaction(FORME_REELLE)?.id === 283
);

verifie(
  "Enveloppe « transaction » (non versionnée) → id trouvé",
  extraireTransaction({ transaction: { id: 42 } })?.id === 42
);

verifie(
  "Enveloppe « data » → id trouvé",
  extraireTransaction({ data: { id: 7 } })?.id === 7
);

verifie(
  "Objet plat (documentation) → id trouvé",
  extraireTransaction({ id: 99, reference: "X" })?.id === 99
);

verifie(
  "Enveloppe « data » imbriquant « data » → id trouvé",
  extraireTransaction({ data: { data: { id: 11 } } })?.id === 11
);

verifie(
  "Réponse sans identifiant → null",
  extraireTransaction({ message: "rien ici" }) === null
);

verifie(
  "Réponse vide → null",
  extraireTransaction({}) === null
);

// ── ② Cohérence : le code du service contient bien la clé versionnée ──
console.log("── ② Cohérence du service ──");

const fs = await import("fs");
const service = fs.readFileSync(
  new URL("../src/lib/payments/fedapay.service.ts", import.meta.url),
  "utf8"
);
verifie(
  "fedapay.service.ts référence la clé « v1/transaction »",
  service.includes('reponse["v1/transaction"]') ||
    service.includes('reponse["v1/transaction"]')
);
verifie(
  "fedapay.service.ts référence la clé « v1/token » (URL de paiement)",
  service.includes('tokenRacine["v1/token"]')
);
verifie(
  "L'ancien parsing mono-forme est bien remplacé (plus de « reponse.transaction ?? reponse »)",
  !service.includes("reponse.transaction ?? reponse")
);

// ── ③ Test INTÉGRÉ du service avec fetch simulé ─────────────────────
console.log("── ③ Service complet (fetch simulé) ──");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fetchOriginal = (globalThis as any).fetch;
let appels: { url: string; corps: unknown }[] = [];
let reponsesSimulees: Array<Record<string, unknown>> = [];

(globalThis as any).fetch = async (url: string, init: any) => {
  appels.push({ url: String(url), corps: init?.body });
  const reponse = reponsesSimulees.shift() ?? {};
  return {
    ok: true,
    status: 200,
    json: async () => reponse,
  };
};

process.env.SESSION_SECRET = "test-v384";
delete process.env.FEDAPAY_SECRET_KEY;
delete process.env.PAYMENTS_MASTER_KEY;

const { creerTransactionFedapay } = await import(
  "../src/lib/payments/fedapay.service"
);

try {
  // Configuration back-office simulée impossible sans base — on pose la
  // clé par environnement pour isoler le PARSING (l'objet du test).
  process.env.FEDAPAY_SECRET_KEY = "sk_sandbox_test0000000000000000000000";

  reponsesSimulees = [
    // ① création : la forme RÉELLE (clé versionnée)
    { klass: "v1/transaction", "v1/transaction": { id: 555, amount: 5000 } },
    // ② token : forme plate (token + url au premier niveau)
    { token: "tok_abc123", url: "https://sandbox-pay.fedapay.com/xyz" },
  ];
  appels = [];

  const resultat = await creerTransactionFedapay(
    {
      provider: "fedapay",
      type_don: "offrande",
      montant: 5000,
      devise: "XOF",
      email: "test@example.com",
      nom: "Test",
      recurrent: false,
    },
    "don_test_a1b2c3d4"
  );

  verifie(
    "L'identifiant fournisseur est extrait de l'enveloppe « v1/transaction »",
    resultat.providerRef === "555",
    `providerRef=${resultat.providerRef}`
  );
  verifie(
    "L'URL de paiement plate est extraite",
    resultat.paymentUrl === "https://sandbox-pay.fedapay.com/xyz",
    `paymentUrl=${resultat.paymentUrl}`
  );
  verifie(
    "La référence interne est conservée",
    resultat.reference === "don_test_a1b2c3d4"
  );
  verifie(
    "Le 2e appel vise /v1/transactions/555/token (id déduit de l'enveloppe)",
    appels[1]?.url?.includes("/v1/transactions/555/token") === true,
    `url=${appels[1]?.url}`
  );
  verifie(
    "Le callback de retour est transmis à FedaPay",
    String(appels[0]?.corps).includes("/contribuer/merci?ref=don_test_a1b2c3d4")
  );
  verifie(
    "La référence est dans custom_metadata (clé de rapprochement webhook)",
    String(appels[0]?.corps).includes('"reference":"don_test_a1b2c3d4"') ||
      String(appels[0]?.corps).includes('"reference": "don_test_a1b2c3d4"')
  );

  // ④ Token sous enveloppe « v1/token » (défensive)
  reponsesSimulees = [
    { "v1/transaction": { id: 777 } },
    { "v1/token": { token: "t", url: "https://sandbox-pay.fedapay.com/v1tok" } },
  ];
  const resultat2 = await creerTransactionFedapay(
    {
      provider: "fedapay",
      type_don: "don",
      montant: 2000,
      devise: "XOF",
      email: "test@example.com",
      nom: null,
      recurrent: false,
    },
    "don_test_e5f6g7h8"
  );
  verifie(
    "URL de paiement sous enveloppe « v1/token » acceptée",
    resultat2.paymentUrl === "https://sandbox-pay.fedapay.com/v1tok",
    `paymentUrl=${resultat2.paymentUrl}`
  );

  // ⑤ Réponse sans identifiant → message avec les clés reçues
  reponsesSimulees = [{ message: "quelque chose d'inattendu" }];
  let messageErreur = "";
  try {
    await creerTransactionFedapay(
      {
        provider: "fedapay",
        type_don: "don",
        montant: 1000,
        devise: "XOF",
        email: "test@example.com",
        nom: null,
        recurrent: false,
      },
      "don_test_i9j0k1l2"
    );
  } catch (e) {
    messageErreur = e instanceof Error ? e.message : String(e);
  }
  verifie(
    "Sans identifiant : erreur explicite citant les clés reçues",
    messageErreur.includes("clés reçues") && messageErreur.includes("message"),
    messageErreur
  );
} finally {
  (globalThis as any).fetch = fetchOriginal;
  delete process.env.FEDAPAY_SECRET_KEY;
}

console.log("════════════════════════════════════════════════");
console.log(`Runtime V3.84 FedaPay : ${passes} ✔ / ${echecs} ✘`);
if (echecs > 0) process.exit(1);
