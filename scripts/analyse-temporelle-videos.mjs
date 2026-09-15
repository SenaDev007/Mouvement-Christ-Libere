#!/usr/bin/env node
/**
 * ⭐ ANALYSE TEMPORELLE — si des vidéos supprimées « revenaient », les lignes
 * re-créées porteraient des createdAt RÉCENTS (après les imports historiques).
 * On regroupe les vidéos par jour de création + type d'URL.
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

async function req(url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (cookieJar.size > 0 && !headers.cookie) {
    headers.cookie = [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  const res = await fetch(url, { ...opts, headers });
  retenirCookies(res);
  return res;
}

const type = (u) => {
  if (!u) return "sans-url";
  if (/tiktok\.com/.test(u)) return "tiktok";
  if (/youtube|youtu\.be/.test(u)) return "youtube";
  if (u.startsWith("data:")) return "data-url";
  return "autre";
};

async function main() {
  const login = await req(`${BASE}/admin/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(IDENTIFIANTS),
  });
  if (login.status !== 200) {
    console.error(`Login échoué (${login.status})`);
    process.exit(1);
  }

  let videos = [];
  let offset = 0;
  const limite = 200;
  let total = Infinity;
  while (offset < total) {
    const res = await req(`${BASE}/admin/api/videos?limit=${limite}&offset=${offset}`);
    const data = await res.json();
    total = data.total;
    videos = videos.concat(data.items);
    offset += limite;
  }

  // ─── Par JOUR ───
  const parJour = new Map();
  for (const v of videos) {
    const jour = new Date(v.createdAt).toISOString().slice(0, 10);
    if (!parJour.has(jour)) parJour.set(jour, { total: 0, tiktok: 0, youtube: 0, autre: 0, sans: 0, data: 0 });
    const e = parJour.get(jour);
    e.total++;
    const t = type(v.videoUrl);
    if (t === "tiktok") e.tiktok++;
    else if (t === "youtube") e.youtube++;
    else if (t === "data-url") e.data++;
    else if (t === "sans-url") e.sans++;
    else e.autre++;
  }
  console.log("Vidéos par jour de création (createdAt) :");
  console.log("jour        | total | tiktok | youtube | autre | data | sans-url");
  for (const [jour, e] of [...parJour.entries()].sort()) {
    console.log(`${jour} | ${String(e.total).padStart(5)} | ${String(e.tiktok).padStart(6)} | ${String(e.youtube).padStart(7)} | ${String(e.autre).padStart(5)} | ${String(e.data).padStart(4)} | ${String(e.sans).padStart(7)}`);
  }

  // ─── Détail des 5 jours les plus récents ───
  console.log("\n─── Détail des vidéos créées depuis le 2026-09-13 ───");
  const recentes = videos
    .filter((v) => new Date(v.createdAt) >= new Date("2026-09-13T00:00:00Z"))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  console.log(`Nombre : ${recentes.length}`);
  for (const v of recentes.slice(0, 40)) {
    console.log(`${new Date(v.createdAt).toISOString().slice(0, 16).replace("T", " ")}  [${type(v.videoUrl).padEnd(7)}]  ${(v.title || "").slice(0, 55).padEnd(55)}  ${(v.videoUrl || "").slice(0, 70)}`);
  }
}

main().catch((e) => {
  console.error("Erreur :", e);
  process.exit(1);
});
