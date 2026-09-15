#!/usr/bin/env node
/**
 * ⭐ V3.78 (correction) — Rubrique « Saint-Esprit réponds-moi » (Afrika) :
 * donner à chaque média TikTok un titre PRÉCIS et UNIQUE, et récupérer
 * les 48 médias de la liste du pasteur perdus lors de l'insertion V3.63.
 *
 * RÉPONSE À LA QUESTION DU PASTEUR (« pourquoi pas le titre précis ? ») :
 * le scan V3.78 (verifier-titres-tiktok-v378.mjs) prouve que 331/336
 * médias @pamela.dali7 n'ont AUCUNE légende sur TikTok (oEmbed titre
 * vide) — le « titre précis » n'existe pas sur la plateforme. 5 médias
 * ont une légende (hashtags) : elle devient leur titre.
 *
 * Schéma de titre :
 *  - légende TikTok présente : « <légende> — <date> à <heure> »
 *  - sinon : « Saint-Esprit réponds-moi — <date> à <heure> »
 *  (date/heure RÉELLES décodées de l'identifiant TikTok, tz Porto-Novo —
 *   chaque titre est UNIQUE : fin des 11 doublons « 9 juin 2025 » etc.)
 *
 * ① connexion admin ; ② serviteur afrika ; ③ titres réels (cache scan) ;
 * ④ vidéos existantes (dédoublonnage) ; ⑤ INSERT des 48 manquantes ;
 * ⑥ PATCH des 288 existantes (titre + description avec heure) ;
 * ⑦ vérification : plus AUCUN doublon de titre dans la rubrique.
 *
 * Usage : node scripts/corriger-titres-saint-esprit-v378.mjs
 *   (idempotent : relancer ne duplique rien, ne réécrit rien d'identique)
 */
import fs from "node:fs";
import path from "node:path";

const BASE = "https://www.mouvementchristlibere.com";
const FICHIER_URLS = path.resolve(import.meta.dirname, "urls-tiktok.txt");
const FICHIER_TITRES = path.resolve(import.meta.dirname, "titres-tiktok-saint-esprit-v378.json");
const RUBRIQUE = "Saint-Esprit réponds-moi";
const COMPTE = "pamela.dali7";
const IDENTIFIANTS = { name: "pam@christ-libere.org", password: "PamChristLibere2026!" };
const TZ = "Africa/Porto-Novo";

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

const fmtDateHeure = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric", month: "long", year: "numeric",
  hour: "2-digit", minute: "2-digit", timeZone: TZ,
});

/** « 9 juin 2025 à 14h32 » — heure locale Bénin réelle. */
function quand(id) {
  const d = dateDepuisId(id);
  if (!d) return "";
  const partie = fmtDateHeure.format(d); // « 9 juin 2025 à 14:32 »
  return partie.replace(/(\d{2}):(\d{2})$/, "$1h$2"); // → « … à 14h32 »
}

/** Légende réelle nettoyée. */
function nettoyerTitre(brut) {
  return (brut || "").replace(/\s+/g, " ").trim();
}

/**
 * Titre final d'un média : légende TikTok si elle existe (les 5 chanceuses),
 * sinon le préfixe de la rubrique — TOUJOURS suffixé de l'instant précis.
 * Égalité parfaite d'instant (2 médias publiés la même minute) : suffixe
 * « · n°2 » par ordre chronologique d'identifiant — unicité garantie.
 */
function suffixesInstant(cibles) {
  const groupes = new Map(); // quand() -> [ids]
  for (const m of cibles) {
    const q = quand(m.id);
    if (!q) continue;
    if (!groupes.has(q)) groupes.set(q, []);
    groupes.get(q).push(m.id);
  }
  const suffixe = new Map(); // id -> " · n°N" (uniquement si collision)
  for (const [, ids] of groupes) {
    if (ids.length < 2) continue;
    ids.sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
    ids.forEach((id, i) => suffixe.set(id, ` · n°${i + 1}`));
  }
  return suffixe;
}

function titreFinal(legende, id, suffixe = "") {
  const t = nettoyerTitre(legende);
  const q = quand(id) + suffixe;
  if (t) return q ? `${t} — ${q}` : t;
  return q ? `${RUBRIQUE} — ${q}` : `${RUBRIQUE} — épisode TikTok`;
}

function descriptionFinale(url, id, auteur, genre) {
  const q = quand(id);
  return `${genre === "photo" ? "Diaporama" : "Vidéo"} TikTok d'Afrika (@${auteur})${q ? " — " + q : ""}.\nVoir sur TikTok : ${url}`;
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

  console.log("── ③ Légendes réelles (cache du scan V3.78) ──");
  const legendes = JSON.parse(fs.readFileSync(FICHIER_TITRES, "utf8"));
  const nLegendes = Object.values(legendes).filter((t) => (t || "").trim()).length;
  console.log(`  ✅ ${Object.keys(legendes).length} médias scannés · ${nLegendes} légendes TikTok réelles`);

  console.log("── ④ Vidéos existantes ──");
  const existantes = new Map(); // videoUrl -> {id, title, description}
  let offset = 0, total = 0;
  for (;;) {
    const r = await jsonFetch(`${BASE}/admin/api/videos?limit=1000&offset=${offset}`);
    if (!r.ok) throw new Error(`liste vidéos : ${r.status}`);
    const data = await r.json();
    total = data.total || total;
    for (const v of data.items || []) if (v.videoUrl) existantes.set(v.videoUrl, v);
    offset += (data.items || []).length;
    if (offset >= total || (data.items || []).length === 0) break;
  }
  console.log(`  ✅ ${existantes.size} URLs vidéo en base (total ${total})`);

  // Médias de la liste du pasteur
  const lignes = fs.readFileSync(FICHIER_URLS, "utf8")
    .split("\n").map((l) => l.trim()).filter(Boolean);
  const medias = lignes
    .map((url) => url.match(/^https:\/\/www\.tiktok\.com\/@([^/]+)\/(video|photo)\/(\d{5,25})\/?$/))
    .filter(Boolean)
    .map((m) => ({ url: m[0], auteur: m[1], genre: m[2], id: m[3] }));
  const dedup = new Map();
  for (const m of medias) if (!dedup.has(m.id)) dedup.set(m.id, m);
  const cibles = [...dedup.values()];
  const suffixe = suffixesInstant(cibles);
  console.log(`  liste pasteur : ${cibles.length} médias uniques (${lignes.length - medias.length} profils sans vidéo ignorés) · ${suffixe.size} égalités d'instant résolues (n°)`);

  // ⑤ INSERT des manquantes
  const aInserer = cibles.filter((m) => !existantes.has(m.url));
  console.log(`── ⑤ Insertion des ${aInserer.length} médias manquants ──`);
  let insereOk = 0, insereKo = 0, ignoreesSupprimees = 0;
  for (const m of aInserer) {
    const corps = {
      servantId: serviteur.id,
      title: titreFinal(legendes[m.url], m.id, suffixe.get(m.id) || ""),
      description: descriptionFinale(m.url, m.id, m.auteur, m.genre),
      duration: "",
      videoUrl: m.url,
      category: RUBRIQUE,
      isLive: false,
      ...(dateDepuisId(m.id) ? { publishedAt: dateDepuisId(m.id).toISOString() } : {}),
    };
    try {
      const r = await jsonFetch(`${BASE}/admin/api/videos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corps),
      });
      if (r.status === 201) insereOk++;
      else if (r.status === 409) {
        // ⭐ V3.86 — mémoire des suppressions : ce média a été VOLONTAIREMENT
        // supprimé du back-office → ne JAMAIS le ré-insérer (c'est la cause
        // historique des « vidéos supprimées qui reviennent »).
        ignoreesSupprimees++;
      }
      else insereKo++;
    } catch {
      insereKo++;
    }
    await attendre(150);
  }
  console.log(`  ✅ insérés : ${insereOk} · supprimés volontairement (ignorés) : ${ignoreesSupprimees} · échecs : ${insereKo}`);

  // ⑥ PATCH des existantes de la rubrique (@pamela.dali7)
  console.log(`── ⑥ Titres précis des médias déjà en base ──`);
  const aCorriger = cibles
    .filter((m) => existantes.has(m.url))
    .map((m) => ({ ...m, video: existantes.get(m.url) }));
  let patchOk = 0, patchKo = 0, inchanges = 0;
  for (const m of aCorriger) {
    const titre = titreFinal(legendes[m.url], m.id, suffixe.get(m.id) || "");
    const desc = descriptionFinale(m.url, m.id, m.auteur, m.genre);
    if (m.video.title === titre && m.video.description === desc) {
      inchanges++;
      continue;
    }
    try {
      const r = await jsonFetch(`${BASE}/admin/api/videos/${m.video.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: titre, description: desc }),
      });
      if (r.ok) patchOk++;
      else patchKo++;
    } catch {
      patchKo++;
    }
    await attendre(150);
  }
  console.log(`  ✅ corrigés : ${patchOk} · inchangés : ${inchanges} · échecs : ${patchKo}`);

  // ⑦ Vérification : unicité des titres + comptes
  console.log(`── ⑦ Vérification ──`);
  const verif = await jsonFetch(`${BASE}/api/videos?servant=afrika`);
  const dataV = await verif.json();
  const videos = dataV.videos || [];
  const rubrique = videos.filter((x) => x.category === RUBRIQUE && /tiktok\.com/.test(x.videoUrl || ""));
  const compte = {};
  for (const v of rubrique) compte[v.title] = (compte[v.title] || 0) + 1;
  const doublons = Object.entries(compte).filter(([, n]) => n > 1);
  console.log(`  rubrique « ${RUBRIQUE} » (TikTok) : ${rubrique.length} médias`);
  console.log(`  titres DOUBLONS restants : ${doublons.length}`);
  for (const [t, n] of doublons.slice(0, 5)) console.log(`    ⚠️ ×${n} « ${t} »`);
  const extraits = rubrique
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, 5)
    .map((x) => x.title);
  console.log(`  5 plus récents :`);
  for (const t of extraits) console.log(`    • ${t}`);
}

main().catch((e) => {
  console.error("ÉCHEC :", e.message);
  process.exit(1);
});
