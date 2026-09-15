#!/usr/bin/env node
/**
 * ⭐ V3.77 — Insérer les vidéos TikTok @soeur_afrika dans la catégorie
 * « Enseignements & Prédications » avec leurs TITRES RÉELS.
 *
 * Demande : « nous allons intégrer de nouvelles vidéos tiktok pour PAM
 * [Afrika], mais nous allons les mettre dans la catégorie enseignement.
 * Il faut que ces vidéos aient des titres précis. »
 *
 * Différence avec V3.63 (336 vidéos « Saint-Esprit réponds-moi » avec
 * titres génériques « rubrique — date ») : ici les titres PRÉCIS sont
 * récupérés via le PROXY oEmbed de production
 * (GET /api/tiktok/oembed?url=… — le bac local est dans une région que
 * TikTok bloque, la production (Vercel, cdg1) joint TikTok normalement).
 *
 * Usage : node scripts/inserer-tiktok-enseignement-v377.mjs
 *   (idempotent : dédoublonnage par videoUrl contre la base + cache des
 *    titres dans scripts/titres-tiktok-enseignement-v377.json — une
 *    exécution interrompue reprend où elle s'était arrêtée)
 *
 * Principe :
 *  ① connexion admin (cookie de session) ;
 *  ② serviteur Afrika (/admin/api/servants, code « afrika » — repli
 *     « pam » par sécurité) ;
 *  ③ dédoublonnage contre les videoUrl existants (/admin/api/videos) ;
 *  ④ pour chaque URL de scripts/urls-tiktok-enseignement-v377.txt :
 *     - TITRE RÉEL via le proxy oEmbed (2 essais, cache disque) — repli
 *       « Enseignement TikTok — <date> » ;
 *     - date de publication DÉCODÉE de l'identifiant TikTok (snowflake :
 *       id >> 32 = secondes epoch) ;
 *     - POST /admin/api/videos (rubrique explicite
 *       « Enseignements & Prédications »).
 *  ⑤ rapport + vérification finale.
 */
import fs from "node:fs";
import path from "node:path";

const BASE = "https://www.mouvementchristlibere.com";
const FICHIER_URLS = path.resolve(import.meta.dirname, "urls-tiktok-enseignement-v377.txt");
const FICHIER_TITRES = path.resolve(import.meta.dirname, "titres-tiktok-enseignement-v377.json");
const RUBRIQUE = "Enseignements & Prédications";
const IDENTIFIANTS = { name: "pam@christ-libere.org", password: "PamChristLibere2026!" };

const cookieJar = new Map();

function retenirCookies(res) {
  const brutes = res.headers.getSetCookie?.() || [];
  for (const c of brutes) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) cookieJar.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
}

async function jsonFetch(url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (cookieJar.size > 0 && !headers.cookie) {
    headers.cookie = [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  const res = await fetch(url, { ...opts, headers });
  retenirCookies(res);
  return res;
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/** Date de publication décodée de l'identifiant TikTok (snowflake). */
function dateDepuisId(id) {
  try {
    const s = Number(BigInt(id) >> 32n);
    if (!Number.isFinite(s) || s < 1_400_000_000 || s > 4_000_000_000) return null;
    return new Date(s * 1000);
  } catch {
    return null;
  }
}

const fmtDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/** Titre « précis » nettoyé : espaces/retours à la ligne normalisés, ≤ 200 car. */
function nettoyerTitre(brut) {
  const t = (brut || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= 200) return t;
  return t.slice(0, 197).trimEnd() + "…";
}

/** Cache disque des titres (reprise après interruption sans re-frapper TikTok). */
function chargerTitres() {
  try {
    return JSON.parse(fs.readFileSync(FICHIER_TITRES, "utf8"));
  } catch {
    return {};
  }
}

function sauverTitres(cache) {
  fs.writeFileSync(FICHIER_TITRES, JSON.stringify(cache, null, 2));
}

/** Titre réel via le proxy oEmbed de production (2 essais). */
async function titreReel(url) {
  const prox = `${BASE}/api/tiktok/oembed?url=${encodeURIComponent(url)}`;
  for (let essai = 1; essai <= 2; essai++) {
    try {
      const res = await fetch(prox, { signal: AbortSignal.timeout(12000) });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && typeof data.titre === "string") {
          return { titre: nettoyerTitre(data.titre), source: "oembed" };
        }
      }
    } catch {
      /* nouvel essai */
    }
    if (essai < 2) await attendre(900);
  }
  return { titre: "", source: "echec" };
}

async function main() {
  console.log("── ① Connexion admin ──");
  const login = await jsonFetch(`${BASE}/admin/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(IDENTIFIANTS),
  });
  if (!login.ok) throw new Error(`login refusé : ${login.status}`);
  console.log("  ✅ session admin ouverte");

  console.log("── ② Serviteur Afrika ──");
  const resServ = await jsonFetch(`${BASE}/admin/api/servants?limit=100`);
  const servs = (await resServ.json()).items || [];
  const serviteur = servs.find((s) => s.code === "afrika") || servs.find((s) => s.code === "pam");
  if (!serviteur) throw new Error("serviteur « afrika » introuvable");
  console.log(`  ✅ ${serviteur.shortName} (${serviteur.code}) : ${serviteur.id}`);

  console.log("── ③ Vidéos existantes (dédoublonnage) ──");
  const existantes = new Set();
  let offset = 0;
  for (;;) {
    const r = await jsonFetch(`${BASE}/admin/api/videos?limit=1000&offset=${offset}`);
    if (!r.ok) throw new Error(`liste vidéos : ${r.status}`);
    const data = await r.json();
    for (const v of data.items || []) if (v.videoUrl) existantes.add(v.videoUrl);
    offset += (data.items || []).length;
    if (offset >= (data.total || 0) || (data.items || []).length === 0) break;
  }
  console.log(`  ✅ ${existantes.size} URLs vidéo déjà en base`);

  console.log("── ④ Analyse de la liste TikTok ──");
  const lignes = fs.readFileSync(FICHIER_URLS, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
  const vues = new Map(); // dédoublonnage intra-fichier
  for (const url of lignes) {
    const m = url.match(/^https:\/\/www\.tiktok\.com\/@([^/]+)\/(video|photo)\/(\d{5,25})\/?$/);
    if (!m) {
      console.log(`  ⚠️ URL ignorée (format inconnu) : ${url}`);
      continue;
    }
    if (vues.has(m[3])) continue;
    vues.set(m[3], { url, auteur: m[1], genre: m[2] === "photo" ? "diaporama" : "vidéo" });
  }
  const cibles = [...vues.entries()];
  console.log(`  ${lignes.length} lignes → ${cibles.length} médias uniques`);

  const aCreer = cibles.filter(([, v]) => !existantes.has(v.url));
  const dejaLa = cibles.length - aCreer.length;
  console.log(`  ${dejaLa} déjà en base (ignorés) · ${aCreer.length} à insérer`);

  if (aCreer.length === 0) {
    console.log("── Rien à insérer — base déjà à jour ──");
  } else {
    console.log("── ⑤ Titres réels (proxy oEmbed production) + insertion ──");
    const titres = chargerTitres();
    let ok = 0, ko = 0, titresReels = 0, titresRepli = 0, supprimees = 0;
    const erreurs = [];
    for (let i = 0; i < aCreer.length; i++) {
      const [id, v] = aCreer[i];
      const date = dateDepuisId(id);

      // Titre précis : cache disque d'abord, puis proxy oEmbed.
      let titre;
      if (typeof titres[v.url] === "string" && titres[v.url]) {
        titre = titres[v.url];
        titresReels++;
      } else {
        const { titre: t, source } = await titreReel(v.url);
        if (t) {
          titre = t;
          titres[v.url] = t;
          titresReels++;
        } else {
          titres[v.url] = "";
          titre = `Enseignement TikTok — ${date ? fmtDate.format(date) : "publication récente"}`;
          titresRepli++;
        }
        sauverTitres(titres); // persister au fil de l'eau (reprise sûre)
      }

      const corps = {
        servantId: serviteur.id,
        title: titre,
        description: `${v.genre === "diaporama" ? "Diaporama" : "Vidéo"} TikTok d'Afrika (@${v.auteur})${date ? " — " + fmtDate.format(date) : ""}.\nVoir sur TikTok : ${v.url}`,
        duration: "",
        videoUrl: v.url,
        category: RUBRIQUE,
        isLive: false,
        ...(date ? { publishedAt: date.toISOString() } : {}),
      };
      try {
        const r = await jsonFetch(`${BASE}/admin/api/videos`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(corps),
        });
        if (r.status === 201) {
          ok++;
          if (ok % 25 === 0 || i === aCreer.length - 1) {
            console.log(`  … ${ok}/${aCreer.length} insérés (${titresReels} titres réels, ${titresRepli} replis)`);
          }
        } else if (r.status === 409) {
          // ⭐ V3.86 — mémoire des suppressions : média VOLONTAIREMENT
          // supprimé du back-office → ne JAMAIS le ré-insérer.
          supprimees++;
        } else {
          ko++;
          const msg = await r.text().catch(() => "");
          erreurs.push(`${v.url} → HTTP ${r.status} ${msg.slice(0, 120)}`);
        }
      } catch (e) {
        ko++;
        erreurs.push(`${v.url} → ${e.message}`);
      }
      await attendre(120);
    }

    console.log(`── Résultat insertion ──`);
    console.log(`  ✅ insérées : ${ok} · titres réels : ${titresReels} · replis : ${titresRepli}`);
    if (supprimees > 0) {
      console.log(`  🚫 supprimées volontairement (ignorées — mémoire V3.86) : ${supprimees}`);
    }
    if (ko > 0) {
      console.log(`  ❌ échecs : ${ko}`);
      for (const e of erreurs.slice(0, 10)) console.log(`     ${e}`);
    }
  }

  // ⑥ Vérification finale : la rubrique est-elle peuplée ?
  console.log("── ⑥ Vérification ──");
  const verif = await jsonFetch(`${BASE}/api/videos?servant=afrika`);
  const data = await verif.json();
  const videos = data.videos || [];
  const rubrique = videos.filter((x) => x.category === RUBRIQUE);
  const extraits = rubrique
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, 5)
    .map((x) => `« ${x.title} »`);
  console.log(`  rubrique « ${RUBRIQUE} » (Afrika) : ${rubrique.length} épisodes`);
  console.log(`  total vidéos Afrika : ${videos.length}`);
  for (const t of extraits) console.log(`    • ${t}`);
  console.log("  (relancer le script est SÛR : les URLs insérées seront ignorées)");
}

main().catch((e) => {
  console.error("ÉCHEC :", e.message);
  process.exit(1);
});
