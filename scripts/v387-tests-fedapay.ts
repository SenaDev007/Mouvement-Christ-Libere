/**
 * ⭐ V3.87 — Tests runtime du correctif « boucle de vérification infinie ».
 *
 * CONTEXTE : le widget FedaPay checkout.js (v1.1.7) appelle onComplete avec
 * { reason, transaction: { id, status } } — l'ancien code lisait
 * retour.reference / retour.id (TOUJOURS absents) → la confirmation ne
 * vérifiait rien → don « pending » à vie + page merci en boucle.
 *
 * Couverture :
 *   ① FORME RÉELLE du callback onComplete — lecture de retour.transaction.id
 *      (simulation exacte du source checkout.js) + statut widget ;
 *   ② listerTransactionsFedapayRecentes — extraction multi-formes de la
 *      liste (v1/transactions, data, transactions, tableau plat) avec
 *      fetch simulé ;
 *   ③ rapprochement par description (extraireReferenceDescription) ;
 *   ④ statut du don : ne lève JAMAIS quand la base est injoignable
 *      (retenterVerificationDon → « pending ») ;
 *   ⑤ cohérence du code V3.87 des 7 fichiers touchés ;
 *   ⑥ vercel.json : cron récupération programmé.
 *
 * Exécution : bun scripts/v387-tests-fedapay.ts
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

const fs = await import("fs");

// ── ① FORME RÉELLE du callback onComplete (source checkout.js v1.1.7) ─
console.log("── ① Lecture du callback onComplete (forme réelle checkout.js) ──");

// Reproduction EXACTE de la logique de contribuer-view.tsx (V3.87).
function extraireDuWidget(retour: {
  reason?: string;
  transaction?: { id?: string | number; status?: string };
  reference?: string | number;
  id?: string | number;
}): { fedapayRef: string | null; statutWidget: string | null } {
  const transactionWidget = retour?.transaction;
  const fedapayRef =
    transactionWidget?.id !== undefined && transactionWidget?.id !== null
      ? String(transactionWidget.id).slice(0, 120)
      : null;
  const statutWidget =
    typeof transactionWidget?.status === "string"
      ? transactionWidget.status.slice(0, 40)
      : null;
  return { fedapayRef, statutWidget };
}

// Forme RÉELLE : { reason: "CHECKOUT_COMPLETED", transaction: { id, status } }
let extrait = extraireDuWidget({
  reason: "CHECKOUT_COMPLETED",
  transaction: { id: 2847, status: "approved" },
});
verifie(
  "Paiement approuvé → fedapayRef lu depuis transaction.id (2847)",
  extrait.fedapayRef === "2847",
  `fedapayRef=${extrait.fedapayRef}`
);
verifie(
  "Statut du widget lu (approved)",
  extrait.statutWidget === "approved",
  `statutWidget=${extrait.statutWidget}`
);

// Statut « transferred » (variante FedaPay d'un paiement abouti).
extrait = extraireDuWidget({
  reason: "CHECKOUT_COMPLETED",
  transaction: { id: "txn_991", status: "transferred" },
});
verifie(
  "« transferred » → id lu (« txn_991 »)",
  extrait.fedapayRef === "txn_991" && extrait.statutWidget === "transferred"
);

// Id numérique long / chaîne longue → tronqué à 120.
extrait = extraireDuWidget({
  transaction: { id: "x".repeat(200), status: "approved" },
});
verifie(
  "Id anormalement long → tronqué à 120 caractères",
  extrait.fedapayRef !== null && extrait.fedapayRef.length === 120
);

// ANCIENNE LECTURE (bug) : transaction absente → null (plus jamais undefined).
extrait = extraireDuWidget({
  reason: "CHECKOUT_COMPLETED",
  reference: "don_inconnu",
});
verifie(
  "Ancienne forme (reference au 1er niveau) → fedapayRef null propre",
  extrait.fedapayRef === null
);

// Annulation : DIALOG DISMISSED (valeur exacte du source checkout.js).
const raison = "DIALOG DISMISSED";
verifie(
  "Annulation : reason « DIALOG DISMISSED » reconnue",
  raison === "DIALOG DISMISSED"
);

// ── ② listerTransactionsFedapayRecentes (fetch simulé) ───────────────
console.log("── ② Liste des transactions récentes — extraction multi-formes ──");

process.env.SESSION_SECRET = "test-v387";
delete process.env.FEDAPAY_PUBLIC_KEY;
delete process.env.PAYMENTS_MASTER_KEY;
process.env.FEDAPAY_SECRET_KEY = "sk_sandbox_test0000000000000000000000";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fetchOriginal = (globalThis as any).fetch;
let reponseSimulee: Record<string, unknown> = {};
let dernierAppel: { url: string; methode: string } | null = null;

(globalThis as any).fetch = async (url: string, init: any) => {
  dernierAppel = { url: String(url), methode: String(init?.method || "GET") };
  return {
    ok: true,
    status: 200,
    json: async () => reponseSimulee,
  };
};

const { listerTransactionsFedapayRecentes } = await import(
  "../src/lib/payments/fedapay.service"
);

// Forme probable : enveloppe « v1/transactions ».
reponseSimulee = {
  "v1/transactions": [
    { id: 11, status: "approved", description: "Dîme — don_abc_111", amount: 5000 },
    { id: 12, status: "pending", description: "Don — don_def_222", amount: 2000 },
  ],
  meta: { total: 2 },
};
let liste = await listerTransactionsFedapayRecentes(25);
verifie(
  "Enveloppe « v1/transactions » → 2 transactions",
  liste.length === 2,
  `longueur=${liste.length}`
);
verifie(
  "Transactions exploitables (id + description)",
  liste[0].id === 11 && liste[0].description === "Dîme — don_abc_111"
);

// Enveloppe « data ».
reponseSimulee = {
  data: [{ id: 21, status: "approved", description: "Don — don_xyz_333" }],
};
liste = await listerTransactionsFedapayRecentes(25);
verifie("Enveloppe « data » → 1 transaction", liste.length === 1);

// Enveloppe « transactions ».
reponseSimulee = {
  transactions: [{ id: 31 }, { id: 32 }],
};
liste = await listerTransactionsFedapayRecentes(25);
verifie("Enveloppe « transactions » → 2 transactions", liste.length === 2);

// Tableau plat.
reponseSimulee = { inattendu: true };
liste = await listerTransactionsFedapayRecentes(25);
verifie("Forme inconnue → liste vide (jamais d'exception)", liste.length === 0);

// L'appel porte la limite et la méthode GET.
verifie(
  "Le fetch vise GET /v1/transactions?limit=…",
  dernierAppel?.url.includes("/v1/transactions?limit=") === true &&
    dernierAppel?.methode === "GET",
  `url=${dernierAppel?.url} methode=${dernierAppel?.methode}`
);

// La clé secrète est exigée.
delete process.env.FEDAPAY_SECRET_KEY;
const { invaliderCachePasserelles } = await import(
  "../src/lib/payments/gateway-config"
);
invaliderCachePasserelles(); // le cache 15 s masquerait la suppression
let erreurSecrete = false;
try {
  await listerTransactionsFedapayRecentes(25);
} catch {
  erreurSecrete = true;
}
verifie(
  "Sans clé secrète → ErreurPasserelle explicite",
  erreurSecrete === true
);
process.env.FEDAPAY_SECRET_KEY = "sk_sandbox_test0000000000000000000000";

(globalThis as any).fetch = fetchOriginal;

// ── ③ Rapprochement par description ─────────────────────────────────
console.log("── ③ Rapprochement par description ──");

const { extraireReferenceDescription } = await import(
  "../src/lib/payments/dons-webhook"
);
verifie(
  "Description widget « Dîme — don_abc_111 » → don_abc_111",
  extraireReferenceDescription("Dîme — don_abc_111") === "don_abc_111"
);
verifie(
  "Description serveur « Don — don_def_222 » → don_def_222",
  extraireReferenceDescription("Don — don_def_222") === "don_def_222"
);
verifie(
  "Offrande (accentuée) → référence extraite",
  extraireReferenceDescription("Offrande — don_off_9a7f") === "don_off_9a7f"
);
verifie(
  "Description sans référence → null",
  extraireReferenceDescription("Paiement quelconque") === null
);

// ── ④ retenterVerificationDon ne lève jamais (base injoignable) ────
console.log("── ④ Robustesse — ne jamais lever ──");

const { retenterVerificationDon } = await import(
  "../src/lib/payments/recuperation-dons"
);
let statutRobuste: string | null = null;
try {
  statutRobuste = await retenterVerificationDon("don_test_abcdef1234", "statut");
} catch {
  statutRobuste = "LEVE";
}
verifie(
  "Base injoignable → « pending », aucune exception",
  statutRobuste === "pending",
  `statut=${statutRobuste}`
);

// ── ⑤ Cohérence du code V3.87 ────────────────────────────────────────
console.log("── ⑤ Cohérence du code ──");

const contribuer = fs.readFileSync(
  new URL("../src/components/site/contribuer-view.tsx", import.meta.url),
  "utf8"
);
verifie(
  "contribuer : lit retour.transaction.id (forme réelle checkout.js)",
  contribuer.includes("transactionWidget?.id") &&
    contribuer.includes("retour?.transaction")
);
verifie(
  "contribuer : l'ancienne lecture reference/id au 1er niveau a DISPARU",
  !contribuer.includes("retour?.reference ?? retour?.id")
);
verifie(
  "contribuer : statut widget transmis (journalisation serveur)",
  contribuer.includes("statutWidget")
);
verifie(
  "contribuer : phase « Confirmation de votre paiement… » affichée",
  contribuer.includes("Confirmation de votre paiement…")
);
verifie(
  "contribuer : annulation DIALOG DISMISSED conservée",
  contribuer.includes("DIALOG DISMISSED")
);

const confirmation = fs.readFileSync(
  new URL("../src/app/api/dons/fedapay/confirmation/route.ts", import.meta.url),
  "utf8"
);
verifie(
  "confirmation : providerRef PERSISTÉ AVANT la vérification (re-vérifiable)",
  confirmation.includes("PERSISTÉ AVANT la vérification") &&
    confirmation.includes("data: { providerRef: String(fedapayRef).slice(0, 120) }")
);
verifie(
  "confirmation : persistance conditionnelle (statut pending + providerRef null)",
  confirmation.includes("statut: \"pending\", providerRef: null")
);
verifie(
  "confirmation : montant EXACT toujours exigé",
  confirmation.includes("verification.montant !== don.amount")
);
verifie(
  "confirmation : statut widget journalisé (jamais cru)",
  confirmation.includes("statutWidget: (corps.statutWidget || \"\").toString()")
);

const statutRoute = fs.readFileSync(
  new URL("../src/app/api/dons/statut/[reference]/route.ts", import.meta.url),
  "utf8"
);
verifie(
  "statut : re-vérification auto pour un don FedaPay pending",
  statutRoute.includes("retenterVerificationDon(reference, \"statut\")")
);
verifie(
  "statut : fenêtre 30 min (le cron couvre au-delà)",
  statutRoute.includes("30 * 60 * 1000")
);
verifie(
  "statut : relecture du don après re-vérification",
  statutRoute.includes("don = await db.donation.findUnique")
);

const serviceCode = fs.readFileSync(
  new URL("../src/lib/payments/fedapay.service.ts", import.meta.url),
  "utf8"
);
verifie(
  "service : listerTransactionsFedapayRecentes exporté",
  serviceCode.includes("export async function listerTransactionsFedapayRecentes")
);
verifie(
  "service : limite bornée 1..100",
  serviceCode.includes("Math.min(Math.max(limite, 1), 100)")
);

const recuperation = fs.readFileSync(
  new URL("../src/lib/payments/recuperation-dons.ts", import.meta.url),
  "utf8"
);
verifie(
  "récupération : colonne runtime providerVerifiedAt (pattern youtubeVerifyLastAt)",
  recuperation.includes("ADD COLUMN IF NOT EXISTS \"providerVerifiedAt\"")
);
verifie(
  "récupération : throttle 8 s par don (claim atomique UPDATE)",
  recuperation.includes("interval '8 seconds'")
);
verifie(
  "récupération : montant exact exigé avant approbation",
  recuperation.includes("verification.montant !== don.amount")
);
verifie(
  "récupération : machine à états partagée traiterEvenementDon",
  recuperation.includes("traiterEvenementDon")
);
verifie(
  "récupération : rapprochement par description via extraireReferenceDescription",
  recuperation.includes("extraireReferenceDescription")
);
verifie(
  "récupération : fenêtre cron 48 h",
  recuperation.includes("48 * 60 * 60 * 1000")
);
verifie(
  "récupération : budget horloge du passage cron",
  recuperation.includes("budgetMs")
);

const cronRoute = fs.readFileSync(
  new URL(
    "../src/app/api/cron/recuperer-dons-fedapay/route.ts",
    import.meta.url
  ),
  "utf8"
);
verifie(
  "cron : route protégée par autoriserCron",
  cronRoute.includes("autoriserCron")
);
verifie(
  "cron : appelle recupererDonsPendantsFedapay (budget 25 s)",
  cronRoute.includes("recupererDonsPendantsFedapay({ budgetMs: 25_000 })")
);

const vercel = fs.readFileSync(
  new URL("../vercel.json", import.meta.url),
  "utf8"
);
verifie(
  "vercel.json : cron récupération programmé toutes les 30 min",
  vercel.includes("/api/cron/recuperer-dons-fedapay") &&
    vercel.includes("\"*/30 * * * *\"")
);

// ── Résultat ─────────────────────────────────────────────────────────
console.log(
  `\n${passes} ✔ / ${echecs} ✘ — ${echecs === 0 ? "V3.87 TOUT EST VERT" : "DES TESTS ÉCHOUENT"}`
);
if (echecs > 0) process.exit(1);
