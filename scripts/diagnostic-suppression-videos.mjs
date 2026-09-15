#!/usr/bin/env node
/**
 * ⭐ DIAGNOSTIC SUPPRESSION VIDÉOS — pourquoi les vidéos supprimées
 * « reviennent » dans le back-office et sur le site public.
 *
 * Hypothèses à vérifier empiriquement (production) :
 *  A) DOUBLONS en base : la même URL YouTube/TikTok présente dans PLUSIEURS
 *     lignes Video (imports successifs V3.63/V3.77/V3.78, re-runs de
 *     scripts) → supprimer une ligne laisse l'autre → « la vidéo revient ».
 *  B) RÉSURRECTION DES REPLAYS : la Passe 1 de recupererReplaysManquants()
 *     (src/lib/live-replay-recovery.ts) recrée l'entrée « X (Replay) » pour
 *     TOUT live ENDED diffusé vers YouTube avec URL connue — SANS fenêtre
 *     temporelle → un replay supprimé est recréé à CHAQUE ouverture du
 *     module Vidéos OU appel de /api/videos (site public).
 *  C) ÉCHEC SILENCIEUX DU DELETE (redirection proxy) — à tester séparément.
 *
 * Usage : node scripts/diagnostic-suppression-videos.mjs
 */
const BASE = "https://www.mouvementchristlibere.com";
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
  const headers = { ...(opts.headers || {}) };
  if (cookieJar.size > 0 && !headers.cookie) {
    headers.cookie = [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  const res = await fetch(url, { ...opts, headers, redirect: "manual" });
  retenirCookies(res);
  return res;
}

const fmtDateCourt = (d) => (d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "?");

async function main() {
  console.log("── ① Connexion admin ──");
  const login = await jsonFetch(`${BASE}/admin/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(IDENTIFIANTS),
  });
  if (login.status !== 200) {
    console.error(`Échec login (status ${login.status}) — impossible de continuer.`);
    process.exit(1);
  }
  console.log("Connecté ✓\n");

  // ─── ② Toutes les vidéos (pagination) ───
  console.log("── ② Récupération de TOUTES les vidéos ──");
  let videos = [];
  let offset = 0;
  const limite = 200;
  let total = Infinity;
  while (offset < total) {
    const res = await jsonFetch(`${BASE}/admin/api/videos?limit=${limite}&offset=${offset}`);
    if (res.status !== 200) {
      console.error(`GET /admin/api/videos offset=${offset} → status ${res.status}`);
      process.exit(1);
    }
    const data = await res.json();
    total = data.total;
    videos = videos.concat(data.items);
    offset += limite;
  }
  console.log(`Total vidéos en base : ${videos.length} (total annoncé : ${total})\n`);

  const host = (u) => {
    if (!u) return "(aucune URL)";
    try {
      return new URL(u).hostname.replace(/^www\./, "");
    } catch {
      return u.startsWith("data:") ? "(data URL)" : u.slice(0, 40);
    }
  };
  const parHote = {};
  for (const v of videos) {
    const h = host(v.videoUrl);
    parHote[h] = (parHote[h] || 0) + 1;
  }
  console.log("Répartition par hébergeur d'URL :");
  for (const [h, n] of Object.entries(parHote).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(n).padStart(5)}  ${h}`);
  }
  console.log("");

  // ─── ③ DOUBLONS par videoUrl exacte ───
  console.log("── ③ Doublons par videoUrl EXACTE ──");
  const parUrl = new Map();
  for (const v of videos) {
    if (!v.videoUrl) continue;
    if (!parUrl.has(v.videoUrl)) parUrl.set(v.videoUrl, []);
    parUrl.get(v.videoUrl).push(v);
  }
  const doublonsUrl = [...parUrl.entries()].filter(([, vs]) => vs.length > 1);
  console.log(`URLs présentes dans PLUSIEURS lignes : ${doublonsUrl.length}`);
  for (const [url, vs] of doublonsUrl.slice(0, 15)) {
    console.log(`\n   ×${vs.length}  ${url.slice(0, 100)}`);
    for (const v of vs) {
      console.log(`      • id=${v.id}  titre="${(v.title || "").slice(0, 60)}"  créé=${fmtDateCourt(v.createdAt)}  rubrique=${v.category || "-"}`);
    }
  }
  console.log("");

  // ─── ④ DOUBLONS par identifiant de média (YouTube id / TikTok id) ───
  console.log("── ④ Doublons par IDENTIFIANT de média (URLs équivalentes) ──");
  const extraireId = (u) => {
    if (!u) return null;
    const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (yt) return `yt:${yt[1]}`;
    const tt = u.match(/tiktok\.com\/[^/]+\/(video|photo)\/(\d+)/);
    if (tt) return `tt:${tt[2]}`;
    return null;
  };
  const parId = new Map();
  for (const v of videos) {
    const id = extraireId(v.videoUrl);
    if (!id) continue;
    if (!parId.has(id)) parId.set(id, []);
    parId.get(id).push(v);
  }
  const doublonsId = [...parId.entries()].filter(([, vs]) => vs.length > 1);
  console.log(`Identifiants de média présents dans PLUSIEURS lignes : ${doublonsId.length}`);
  for (const [id, vs] of doublonsId.slice(0, 20)) {
    console.log(`\n   ×${vs.length}  ${id}`);
    for (const v of vs) {
      console.log(`      • id=${v.id}  titre="${(v.title || "").slice(0, 60)}"  créé=${fmtDateCourt(v.createdAt)}  rubrique=${v.category || "-"}`);
      console.log(`        url=${(v.videoUrl || "").slice(0, 110)}`);
    }
  }
  console.log("");

  // ─── ⑤ SOURCES DE RÉSURRECTION : lives ENDED + YouTube ───
  console.log("── ⑤ Lives ENDED diffusés vers YouTube (sources de résurrection de replays) ──");
  let lives = [];
  let offsetL = 0;
  let totalL = Infinity;
  while (offsetL < totalL) {
    const res = await jsonFetch(`${BASE}/admin/api/lives?limit=${limite}&offset=${offsetL}`);
    if (res.status !== 200) {
      console.error(`GET /admin/api/lives → status ${res.status}`);
      break;
    }
    const data = await res.json();
    totalL = data.total;
    lives = lives.concat(data.items);
    offsetL += limite;
  }
  console.log(`Total lives en base : ${lives.length}`);
  const ended = lives.filter((l) => (l.status || "").toUpperCase() === "ENDED");
  const endedYT = ended.filter((l) => l.streamToYoutube && l.youtubeUrl);
  const endedYTSansUrl = ended.filter((l) => l.streamToYoutube && !l.youtubeUrl);
  console.log(`Lives ENDED : ${ended.length} — dont diffusés vers YouTube AVEC URL : ${endedYT.length}, SANS URL : ${endedYTSansUrl.length}`);

  // Pour chaque live ENDED+YT avec URL : le replay existe-t-il ?
  let replaysManquants = 0;
  const echantillonResurrection = [];
  for (const l of endedYT) {
    const prefixe = `${l.title} (Replay)`;
    const replay = videos.find(
      (v) => v.servantId === l.servantId && (v.title || "").startsWith(prefixe)
    );
    if (!replay || !replay.videoUrl) {
      replaysManquants++;
      if (echantillonResurrection.length < 10) {
        echantillonResurrection.push({ live: l.title, url: l.youtubeUrl, replayAbsent: !replay });
      }
    }
  }
  console.log(`Lives ENDED+YouTube dont le replay est ABSENT ou sans URL (→ sera recréé par la Passe 1 à chaque visite !) : ${replaysManquants}`);
  for (const e of echantillonResurrection) {
    console.log(`   ⚠️  live "${e.live.slice(0, 60)}" → replay ${e.replayAbsent ? "ABSENT (sera CRÉÉ)" : "sans videoUrl (sera RE-CRÉÉ/patché)"} depuis ${e.url.slice(0, 80)}`);
  }
  console.log("");

  // ─── ⑥ Vidéos « (Replay) » actuelles ───
  const replays = videos.filter((v) => /\(Replay\)\s*$/.test(v.title || ""));
  console.log(`Vidéos « (Replay) » actuellement en base : ${replays.length}`);

  // ─── ⑦ DOUBLONS par titre (toutes causes confondues) ───
  console.log("\n── ⑦ Doublons par TITRE exact (même intitulé, lignes distinctes) ──");
  const parTitre = new Map();
  for (const v of videos) {
    const cle = `${v.servantId}::${(v.title || "").trim().toLowerCase()}`;
    if (!parTitre.has(cle)) parTitre.set(cle, []);
    parTitre.get(cle).push(v);
  }
  const doublonsTitre = [...parTitre.entries()].filter(([, vs]) => vs.length > 1);
  console.log(`Titres identiques partagés par plusieurs lignes : ${doublonsTitre.length}`);
  for (const [cle, vs] of doublonsTitre.slice(0, 12)) {
    console.log(`\n   ×${vs.length}  "${(vs[0].title || "").slice(0, 70)}"`);
    for (const v of vs) {
      console.log(`      • id=${v.id}  créé=${fmtDateCourt(v.createdAt)}  url=${(v.videoUrl || "-").slice(0, 80)}`);
    }
  }

  console.log("\n═══ FIN DU DIAGNOSTIC ═══");
}

main().catch((e) => {
  console.error("Erreur inattendue :", e);
  process.exit(1);
});
