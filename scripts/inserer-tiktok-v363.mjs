#!/usr/bin/env node
/**
 * ⭐ V3.63 — Insérer les vidéos TikTok dans la rubrique
 * « Saint-Esprit réponds-moi » (même schéma que YouTube : l'URL TikTok
 * complète est stockée dans videoUrl, l'API publique extrait l'id).
 *
 * Usage : node scripts/inserer-tiktok-v363.mjs
 *
 * Principe :
 *  ① connexion admin (cookie de session) ;
 *  ② serviteur Pam récupéré (/admin/api/servants) ;
 *  ③ dédoublonnage contre les videoUrl existants (/admin/api/videos) ;
 *  ④ pour chaque URL TikTok de scripts/urls-tiktok.txt :
 *     - id extrait (@auteur/video|photo/<id>) ;
 *     - date de publication DÉCODÉE de l'identifiant TikTok (snowflake :
 *       id >> 32 = secondes epoch — dates réelles, tri chronologique réel) ;
 *     - titre « Saint-Esprit réponds-moi — <date> » ;
 *     - POST /admin/api/videos (rubrique explicite « Saint-Esprit réponds-moi »).
 *  Idempotent : relancer ne duplique rien (dédoublonnage par videoUrl).
 */
import fs from "node:fs";
import path from "node:path";

const BASE = "https://www.mouvementchristlibere.com";
const FICHIER_URLS = path.resolve(import.meta.dirname, "urls-tiktok.txt");
const RUBRIQUE = "Saint-Esprit réponds-moi";
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

function entetes(json = false) {
  const h = {};
  if (cookieJar.size > 0) h.cookie = [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  if (json) h["content-type"] = "application/json";
  return h;
}

async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, opts);
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

async function main() {
  console.log("── ① Connexion admin ──");
  const login = await jsonFetch(`${BASE}/admin/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(IDENTIFIANTS),
  });
  if (!login.ok) throw new Error(`login refusé : ${login.status}`);
  console.log("  ✅ session admin ouverte");

  console.log("── ② Serviteur Pam ──");
  const resServ = await jsonFetch(`${BASE}/admin/api/servants?limit=100`);
  const servs = (await resServ.json()).items || [];
  const pam = servs.find((s) => s.code === "pam");
  if (!pam) throw new Error("serviteur « pam » introuvable");
  console.log(`  ✅ Pam : ${pam.id} (${pam.shortName || "Pam"})`);

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
  let profilsSeuls = 0;
  for (const url of lignes) {
    const m = url.match(/^https:\/\/www\.tiktok\.com\/@([^/]+)\/(video|photo)\/(\d{5,25})\/?$/);
    if (!m) {
      if (/^https:\/\/www\.tiktok\.com\/@[^/]+\/?$/.test(url)) profilsSeuls++;
      else console.log(`  ⚠️ URL ignorée (format inconnu) : ${url}`);
      continue;
    }
    if (vues.has(m[3])) continue;
    vues.set(m[3], { url, auteur: m[1], genre: m[2] === "photo" ? "diaporama" : "vidéo" });
  }
  const cibles = [...vues.entries()];
  console.log(`  ${lignes.length} lignes → ${cibles.length} médias uniques (${profilsSeuls} profils sans vidéo ignorés)`);

  const aCreer = cibles.filter(([, v]) => !existantes.has(v.url));
  const dejaLa = cibles.length - aCreer.length;
  console.log(`  ${dejaLa} déjà en base (ignorés) · ${aCreer.length} à insérer`);

  console.log("── ⑤ Insertion ──");
  let ok = 0, ko = 0;
  const erreurs = [];
  for (let i = 0; i < aCreer.length; i++) {
    const [id, v] = aCreer[i];
    const date = dateDepuisId(id);
    const titre = `${RUBRIQUE} — ${date ? fmtDate.format(date) : "épisode TikTok"}`;
    const corps = {
      servantId: pam.id,
      title: titre,
      description: `${v.genre === "diaporama" ? "Diaporama" : "Vidéo"} TikTok de Pam (@${v.auteur})${date ? " — " + fmtDate.format(date) : ""}.\nVoir sur TikTok : ${v.url}`,
      duration: "",
      videoUrl: v.url,
      category: RUBRIQUE,
      isLive: false,
      ...(date ? { publishedAt: date.toISOString() } : {}),
    };
    try {
      const r = await jsonFetch(`${BASE}/admin/api/videos`, {
        method: "POST",
        headers: entetes(true),
        body: JSON.stringify(corps),
      });
      if (r.status === 201) {
        ok++;
        if (ok % 25 === 0 || i === aCreer.length - 1) {
          console.log(`  … ${ok}/${aCreer.length} insérés`);
        }
      } else {
        ko++;
        const msg = await r.text().catch(() => "");
        erreurs.push(`${v.url} → HTTP ${r.status} ${msg.slice(0, 120)}`);
      }
    } catch (e) {
      ko++;
      erreurs.push(`${v.url} → ${e.message}`);
    }
    await attendre(150);
  }

  console.log(`── Résultat ──`);
  console.log(`  ✅ insérées : ${ok}`);
  if (ko > 0) {
    console.log(`  ❌ échecs : ${ko}`);
    for (const e of erreurs.slice(0, 10)) console.log(`     ${e}`);
  }
  console.log(`  (relancer le script est SÛR : les ${ok} URLs insérées seront ignorées)`);

  // ⑥ Vérification finale : la rubrique est-elle peuplée ?
  const verif = await jsonFetch(`${BASE}/api/videos?servant=pam`);
  const data = await verif.json();
  const rubrique = (data.videos || []).filter((x) => x.category === RUBRIQUE);
  const tiktok = (data.videos || []).filter((x) => /tiktok\.com/.test(x.videoUrl || ""));
  console.log(`  rubrique « ${RUBRIQUE} » : ${rubrique.length} épisodes`);
  console.log(`  vidéos TikTok (toutes rubriques) : ${tiktok.length}`);
  process.exit(ko === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("ÉCHEC :", e.message);
  process.exit(1);
});
