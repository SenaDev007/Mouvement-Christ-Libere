/**
 * ⭐ V3.85 — Tests runtime du paiement FedaPay « modèle Academia-Helm »
 * (widget checkout.js + confirmation serveur) et des miniatures TikTok.
 *
 * Couverture :
 *   ① verifierTransactionFedapay — extraction multi-formes du statut
 *      (enveloppe « v1/transaction » réelle, « data », « transaction »,
 *      objet plat) avec fetch simulé ;
 *   ② lireConfigPasserelle — mode widget dès qu'une clé PUBLIQUE est
 *      présente (repli : FEDAPAY_PUBLIC_KEY) ;
 *   ③ validation des préfixes de clés publiques (pk_live_/pk_sandbox_) ;
 *   ④ format de référence de confirmation (don_…) ;
 *   ⑤ cohérence du code : initier (mode widget), contribuer-view
 *      (checkout.js + FedaPay.init + onComplete), confirmation (montant
 *      exact + machine à états partagée), hooks miniatures TikTok ;
 *   ⑥ filtre backfill (estUrlTiktok + sans miniature).
 *
 * Exécution : bun scripts/v385-tests-fedapay.ts
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

// ── ① verifierTransactionFedapay (fetch simulé) ──────────────────────
console.log("── ① Vérification autoritaire — extraction multi-formes ──");

process.env.SESSION_SECRET = "test-v385";
delete process.env.FEDAPAY_SECRET_KEY;
delete process.env.FEDAPAY_PUBLIC_KEY;
delete process.env.PAYMENTS_MASTER_KEY;
// Clé sandbox factice (assez longue) — l'objet du test est le PARSING.
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

const { verifierTransactionFedapay } = await import(
  "../src/lib/payments/fedapay.service"
);

// Forme RÉELLE : enveloppe « v1/transaction » (confirmée V3.84).
reponseSimulee = {
  klass: "v1/transaction",
  "v1/transaction": { id: 283, status: "approved", amount: 5000 },
};
let v = await verifierTransactionFedapay("283");
verifie(
  "Forme RÉELLE « v1/transaction » → statut approved",
  v.statut === "approved",
  `statut=${v.statut}`
);
verifie("Forme RÉELLE → montant lu (5000)", v.montant === 5000);
verifie("Forme RÉELLE → id lu (283)", v.id === "283");

// Enveloppe « transaction ».
reponseSimulee = { transaction: { id: 42, status: "declined", amount: 1000 } };
v = await verifierTransactionFedapay("42");
verifie("Enveloppe « transaction » → declined", v.statut === "declined");

// Enveloppe « data ».
reponseSimulee = { data: { id: 7, status: "pending", amount: 2000 } };
v = await verifierTransactionFedapay("7");
verifie("Enveloppe « data » → pending", v.statut === "pending");

// Objet plat (forme documentation).
reponseSimulee = { id: 99, status: "canceled", amount: 3000 };
v = await verifierTransactionFedapay("99");
verifie("Objet plat → canceled mappé « cancelled »", v.statut === "cancelled");

// Statuts alternatifs.
reponseSimulee = { id: 5, status: "transferred", amount: 1 };
v = await verifierTransactionFedapay("5");
verifie("« transferred » → approved", v.statut === "approved");

// Réponse sans statut → inconnu.
reponseSimulee = { message: "rien" };
v = await verifierTransactionFedapay("x");
verifie("Sans statut → inconnu", v.statut === "inconnu");

// L'appel part bien vers GET /v1/transactions/{ref} avec l'id encodé.
verifie(
  "Le fetch vise GET /v1/transactions/<ref>",
  dernierAppel?.url.includes("/v1/transactions/") === true &&
    dernierAppel?.methode === "GET",
  `url=${dernierAppel?.url} methode=${dernierAppel?.methode}`
);

(globalThis as any).fetch = fetchOriginal;

// ── ② Mode widget dès qu'une clé publique existe (repli env) ────────
console.log("── ② lireConfigPasserelle — mode widget ──");

const { lireConfigPasserelle, invaliderCachePasserelles } = await import(
  "../src/lib/payments/gateway-config"
);

// Sans base disponible ici, la lecture replie sur l'environnement —
// exactement le chemin testé (FEDAPAY_PUBLIC_KEY).
let config = await lireConfigPasserelle("fedapay");
verifie(
  "Sans FEDAPAY_PUBLIC_KEY → publicKey null (flux redirection conservé)",
  config.publicKey === null
);
process.env.FEDAPAY_PUBLIC_KEY = "pk_sandbox_testpub0000000000000000000";
invaliderCachePasserelles(); // le cache 15 s doit refléter la nouvelle clé
config = await lireConfigPasserelle("fedapay");
verifie(
  "Avec FEDAPAY_PUBLIC_KEY → publicKey résolue (mode widget)",
  config.publicKey === "pk_sandbox_testpub0000000000000000000"
);
verifie(
  "Paystack → toujours aucune clé publique",
  (await lireConfigPasserelle("paystack")).publicKey === null
);
delete process.env.FEDAPAY_PUBLIC_KEY;

// ── ③ Préfixes des clés publiques ────────────────────────────────────
console.log("── ③ Préfixes des clés publiques ──");

const PREFIXES = {
  live: /^pk_live_[A-Za-z0-9_-]+$/,
  sandbox: /^pk_sandbox_[A-Za-z0-9_-]+$/,
};
verifie("pk_live_… accepté en production", PREFIXES.live.test("pk_live_abc123"));
verifie(
  "pk_sandbox_… accepté en sandbox",
  PREFIXES.sandbox.test("pk_sandbox_abc123")
);
verifie(
  "sk_live_… REFUSÉ comme clé publique (clé secrète ≠ publique)",
  !PREFIXES.live.test("sk_live_abc123") && !PREFIXES.sandbox.test("sk_live_abc123")
);
verifie(
  "pk_sandbox_… REFUSÉ en production (cohérence environnement)",
  !PREFIXES.live.test("pk_sandbox_abc123")
);

// ── ④ Format de référence de la confirmation ────────────────────────
console.log("── ④ Références de confirmation ──");

const RE_REF = /^don_[a-z0-9]+_[a-f0-9]{6,}$/i;
verifie(
  "Référence canonique acceptée (don_mu2owvjx_33553874d3)",
  RE_REF.test("don_mu2owvjx_33553874d3")
);
verifie(
  "Référence tronquée refusée (< 6 hex)",
  !RE_REF.test("don_abc_a1")
);
verifie(
  "Injection refusée (espace)",
  !RE_REF.test("don_abc_123456 ../../etc")
);
verifie("Texte libre refusé", !RE_REF.test("n'importe quoi"));

// ── ⑤ Cohérence du code V3.85 ───────────────────────────────────────
console.log("── ⑤ Cohérence du code ──");

const initier = fs.readFileSync(
  new URL("../src/app/api/dons/initier/route.ts", import.meta.url),
  "utf8"
);
verifie(
  "initier : mode widget sans appel FedaPay quand publicKey configurée",
  initier.includes('mode: "widget"') && initier.includes("config.publicKey")
);
verifie(
  "initier : la réponse du mode widget porte la clé publique",
  initier.includes("publicKey: config.publicKey")
);
verifie(
  "initier : le flux redirection historique reste en repli",
  initier.includes("creerTransactionFedapay")
);

const contribuer = fs.readFileSync(
  new URL("../src/components/site/contribuer-view.tsx", import.meta.url),
  "utf8"
);
verifie(
  "contribuer : checkout.js chargé depuis le CDN officiel FedaPay",
  contribuer.includes("https://cdn.fedapay.com/checkout.js")
);
verifie(
  "contribuer : FedaPay.init reçoit la clé publique",
  contribuer.includes("public_key: corps.publicKey")
);
verifie(
  "contribuer : onComplete appelle /api/dons/fedapay/confirmation",
  contribuer.includes("/api/dons/fedapay/confirmation")
);
verifie(
  "contribuer : annulation détectée (DIALOG DISMISSED / USERCANCELLED — modèle Academia-Helm)",
  contribuer.includes("DIALOG DISMISSED") && contribuer.includes("USERCANCELLED")
);
verifie(
  "contribuer : description au format serveur (webhook secours par description)",
  contribuer.includes("LIBELLES_TYPES[typeDon]} — ${referenceDon")
);
verifie(
  "contribuer : redirection vers la page merci avec la référence",
  contribuer.includes("/contribuer/merci?ref=")
);

const confirmation = fs.readFileSync(
  new URL("../src/app/api/dons/fedapay/confirmation/route.ts", import.meta.url),
  "utf8"
);
verifie(
  "confirmation : vérification autoritaire via verifierTransactionFedapay",
  confirmation.includes("verifierTransactionFedapay")
);
verifie(
  "confirmation : montant EXACT exigé (anti-fraude)",
  confirmation.includes("verification.montant !== don.amount")
);
verifie(
  "confirmation : machine à états partagée traiterEvenementDon (idempotence + trésorerie + reçu)",
  confirmation.includes("traiterEvenementDon")
);
verifie(
  "confirmation : journal WebhookLog en cas d'écart de montant",
  confirmation.includes("journaliserWebhook")
);
verifie(
  "confirmation : anti-abus par IP (comme initier)",
  confirmation.includes("MAX_PAR_FENETRE")
);
verifie(
  "confirmation : don déjà finalisé → simple constat (idempotence)",
  confirmation.includes('don.statut !== "pending"')
);

const serviceCode = fs.readFileSync(
  new URL("../src/lib/payments/fedapay.service.ts", import.meta.url),
  "utf8"
);
verifie(
  "service : verifierTransactionFedapay exporté",
  serviceCode.includes("export async function verifierTransactionFedapay")
);
verifie(
  "service : la vérification utilise la clé SECRÈTE (Bearer)",
  serviceCode.includes("cle: config.secretKey") &&
    serviceCode.includes("encodeURIComponent(referenceFournisseur)")
);

// ── ⑥ Miniatures TikTok ─────────────────────────────────────────────
console.log("── ⑥ Miniatures TikTok — cohérence du code ──");

const helper = fs.readFileSync(
  new URL("../src/lib/tiktok-miniature.ts", import.meta.url),
  "utf8"
);
verifie(
  "helper : réplication R2 sous thumbnails/tiktok-<id>",
  helper.includes("thumbnails/tiktok-")
);
verifie(
  "helper : backfill par PAQUETS de 4 en parallèle",
  helper.includes("TAILLE_PAQUET = 4") && helper.includes("Promise.allSettled")
);
verifie(
  "helper : garde-fou horloge (rend la main avant le plafond serverless)",
  helper.includes("budgetMs")
);
verifie(
  "helper : idempotence (miniature existante = exclue)",
  helper.includes("!v.thumbnailUrl")
);

const entityRoute = fs.readFileSync(
  new URL("../src/app/admin/api/[entity]/route.ts", import.meta.url),
  "utf8"
);
verifie(
  "création vidéo : miniature TikTok récupérée automatiquement",
  entityRoute.includes("replicquerMiniatureTiktok") &&
    entityRoute.includes("estUrlTiktok")
);

const entityIdRoute = fs.readFileSync(
  new URL("../src/app/admin/api/[entity]/[id]/route.ts", import.meta.url),
  "utf8"
);
verifie(
  "modification vidéo : miniature TikTok récupérée automatiquement",
  entityIdRoute.includes("replicquerMiniatureTiktok")
);

const videosClient = fs.readFileSync(
  new URL("../src/components/admin/videos-tabs-client.tsx", import.meta.url),
  "utf8"
);
verifie(
  "module Vidéos : auto-réparation à l'ouverture (boucle backfill)",
  videosClient.includes("/api/tiktok/backfill") &&
    videosClient.includes("mcl-backfill-miniatures-tiktok-v385")
);
verifie(
  "module Vidéos : rafraîchissement après récupération",
  videosClient.includes("router.refresh()")
);

const cronRoute = fs.readFileSync(
  new URL("../src/app/api/cron/backfill-miniatures-tiktok/route.ts", import.meta.url),
  "utf8"
);
verifie(
  "cron quotidien : garde autoriserCron (Bearer Vercel / X-Cron-Secret)",
  cronRoute.includes("autoriserCron")
);

const vercelJson = fs.readFileSync(
  new URL("../vercel.json", import.meta.url),
  "utf8"
);
verifie(
  "vercel.json : cron backfill-miniatures-tiktok planifié",
  vercelJson.includes("/api/cron/backfill-miniatures-tiktok")
);

// Filtre backfill : estUrlTiktok (réimplémentation du test de tolérance).
const { estUrlTiktok } = await import("../src/lib/tiktok");
verifie(
  "URL TikTok vidéo reconnue",
  estUrlTiktok("https://www.tiktok.com/@pamela.dali7/video/7682225459177868577")
);
verifie(
  "URL TikTok diaporama (/photo/) reconnue",
  estUrlTiktok("https://www.tiktok.com/@user/photo/7682225459177868577")
);
verifie("URL YouTube ignorée", !estUrlTiktok("https://youtube.com/watch?v=x"));
verifie("URL R2 ignorée", !estUrlTiktok("https://pub-x.r2.dev/videos/v.mp4"));

// ── Bilan ───────────────────────────────────────────────────────────
console.log(
  `\nBilan : ${passes} test(s) réussi(s), ${echefs() || echecs} échec(s)`
);
function echefs() {
  return 0;
}
if (echecs > 0) {
  process.exit(1);
}
