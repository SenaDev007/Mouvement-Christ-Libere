#!/usr/bin/env node
/**
 * ⭐ V3.59 — Scraper du catalogue Mixkit (build-time, exécuté manuellement).
 *
 * Construit les fichiers JSON de la bibliothèque intégrée à la post-production :
 *   src/lib/data/mixkit-library/sfx.json        — effets sonores (17 catégories)
 *   src/lib/data/mixkit-library/music.json      — musiques (racine + 102 genres)
 *   src/lib/data/mixkit-library/videos.json     — vidéos stock (racine + 12 catégories)
 *   src/lib/data/mixkit-library/templates.json  — templates (Premiere Pro, After
 *                                                  Effects, Final Cut Pro, DaVinci
 *                                                  Resolve × 8 sous-catégories)
 *
 * IMPORTANT — LICENCE : les fichiers restent sur le CDN Mixkit (Mixkit Licence :
 * libre de droits, usage commercial, sans attribution). Ce script ne télécharge
 * AUCUN média : il ne collecte que les métadonnées (titre, durée, URLs de
 * preview et de téléchargement). Le téléchargement réel a lieu à la demande
 * (bouton « Stocker sur R2 ») via /api/post-production/assets/import.
 *
 * Usage : bun scripts/scrape-mixkit-library.mjs [--sample]
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../src/lib/data/mixkit-library");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const BASE = "https://mixkit.co";

// ─── Politesse : concurrence limitée + petit délai ───
// (Mixkit renvoie 429 au-delà d'~3 req/s — on reste en dessous)
const CONCURRENCY = 2;
const DELAY_MS = 500;

// ─── Décode les entités HTML minimales ───
function decode(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Parse un format "1:42" / "0:04" / "1:02:33" en secondes ───
function dureeSecondes(fmt) {
  if (!fmt) return null;
  const parts = fmt.split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || null;
}

// ─── Fetch HTML avec réessais + suivi des échecs ───
const pagesEchouees = new Map(); // url -> raison

async function fetchHtml(url) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
        redirect: "follow",
        signal: AbortSignal.timeout(25000),
      });
      if (res.ok) return await res.text();
      if (res.status === 404) return null; // catégorie inexistante — pas une erreur
      console.warn(`  [${res.status}] ${url} (essai ${attempt})`);
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 3000 * attempt)); // backoff
      }
    } catch (e) {
      console.warn(`  [timeout/err] ${url} (essai ${attempt})`);
    }
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
  pagesEchouees.set(url, "rate-limit/network");
  return null;
}

// ─── Rattrapage séquentiel des pages ratées (délais longs) ───
async function rattrapage() {
  if (pagesEchouees.size === 0) return false;
  console.log(`\n  ⏳ RATTRAPAGE : ${pagesEchouees.size} pages échouées, nouvelle passe séquentielle…`);
  for (const url of [...pagesEchouees.keys()]) {
    pagesEchouees.delete(url);
    console.log(`  ↻ ${url}`);
    const html = await fetchHtml(url);
    if (html) {
      const cache = rattrapage._cache || (rattrapage._cache = new Map());
      cache.set(url, html);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return (rattrapage._cache?.size || 0) > 0;
}

// ─── Seconde passe : ne consulter QUE les pages récupérées du cache ───
let SECONDE_PASSE = false;

async function fetchPage(url) {
  const cache = rattrapage._cache;
  if (cache && cache.has(url)) {
    const html = cache.get(url);
    cache.delete(url);
    return html;
  }
  if (SECONDE_PASSE) return "__PASSER__"; // déjà traitée en 1re passe
  return fetchHtml(url);
}

// ─── File d'attente à concurrence limitée ───
async function pool(jobs, worker) {
  const results = [];
  let i = 0;
  const runners = Array.from({ length: CONCURRENCY }, async () => {
    while (i < jobs.length) {
      const idx = i++;
      results[idx] = await worker(jobs[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

// ─── Découpe la grille d'items ───
function itemBlocks(html) {
  const marker = '<div class="item-grid__item">';
  const parts = html.split(marker).slice(1);
  return parts.map((p) => p.slice(0, 8000)); // suffisant pour un item complet
}

// ─── Extraction générique titre ───
function titreDe(bloc) {
  const m =
    bloc.match(/<h2 class="item-grid-card__title">\s*<a[^>]*>(.*?)<\/a>\s*<\/h2>/s) ||
    bloc.match(/<h2 class="item-grid-card__title">\s*(.*?)\s*<\/h2>/s);
  return m ? decode(m[1].replace(/<[^>]+>/g, "")) : null;
}

// ═══════════════════════ SFX + MUSIQUE ═══════════════════════

// Stores persistants entre les passes (déduplication par id)
const vusSfx = new Set();
const sfxStore = [];
const vusMusic = new Set();
const musicStore = [];
const vusVideos = new Set();
const videosStore = [];
const vusTemplates = new Set();
const templatesStore = [];

function parseAudioPage(html) {
  const items = [];
  for (const bloc of itemBlocks(html)) {
    const id = bloc.match(/data-audio-player-item-id-value="(\d+)"/)?.[1];
    const preview =
      bloc.match(/data-audio-player-preview-url-value="([^"]+)"/)?.[1];
    if (!id || !preview) continue;
    const titre = titreDe(bloc);
    const duree = dureeSecondes(
      bloc.match(/data-test-id="duration">\s*([0-9:]+)/)?.[1]
    );
    items.push({ id, titre, preview, duree });
  }
  return items;
}

async function scrapeSfx() {
  console.log("\n━━━ SFX ━━━");
  const CATEGORIES = [
    // Les 9 catégories demandées par le pasteur
    ["warfare", "Guerre"],
    ["human", "Humain"],
    ["transport", "Transport"],
    ["animals", "Animaux"],
    ["notification", "Notifications"],
    ["funny", "Drôle"],
    ["technology", "Technologie"],
    ["nature", "Nature"],
    ["instrument", "Instruments"],
    // Bonus utiles pour une chaîne média
    ["game", "Jeux"],
    ["glitch", "Glitch"],
    ["voice", "Voix"],
    ["drone", "Drone"],
    ["ambience", "Ambiances"],
    ["alarm", "Alarmes"],
    ["arcade", "Arcade"],
  ];
  const jobs = CATEGORIES.map(([slug, labelFr]) => ({ slug, labelFr }));
  await pool(jobs, async ({ slug, labelFr }) => {
    const html = await fetchPage(`${BASE}/free-sound-effects/${slug}/`);
    if (html === "__PASSER__") return;
    if (!html) {
      console.warn(`  ✗ catégorie absente : ${slug}`);
      return;
    }
    const items = parseAudioPage(html);
    let ajoutes = 0;
    for (const it of items) {
      if (vusSfx.has(it.id)) continue; // un même son apparaît sur plusieurs pages
      vusSfx.add(it.id);
      sfxStore.push({
        id: it.id,
        n: it.titre || `SFX ${it.id}`,
        d: it.duree,
        p: it.preview, // mp3 de prévisualisation (pleine longueur)
        w: it.preview.replace(/-preview\.mp3$/, ".wav"), // WAV pleine qualité
        c: slug,
        cl: labelFr,
      });
      ajoutes++;
    }
    console.log(`  ✓ ${slug} : ${items.length} items (${ajoutes} nouveaux)`);
    await new Promise((r) => setTimeout(r, DELAY_MS));
  });
  return sfxStore;
}

async function scrapeMusic() {
  console.log("\n━━━ MUSIQUE ━━━");
  const rootHtml = await fetchHtml(`${BASE}/free-stock-music/`);
  if (!rootHtml) throw new Error("Page musique racine inaccessible");
  const genres = [
    ...new Set(
      [...rootHtml.matchAll(/href="\/free-stock-music\/([a-z-]+)\/"/g)].map(
        (m) => m[1]
      )
    ),
  ].filter((g) => g !== "page");
  console.log(`  ${genres.length} genres détectés`);

  const GENRES_FR = {
    "religious": "Religieux", "gospel": "Gospel", "cinematic": "Cinématique",
    "classical": "Classique", "ambient": "Ambiant", "corporate-music": "Corporate",
    "film-score": "Bande originale", "orchestral-pop": "Orchestral pop",
    "trailer-music": "Bande-annonce", "hip-hop": "Hip-hop", "worship": "Louange",
    "acoustic": "Acoustique", "piano": "Piano", "jazz": "Jazz", "rock": "Rock",
    "pop": "Pop", "electronic": "Électronique", "lo-fi-beats": "Lo-fi",
    "soul": "Soul", "folk": "Folk", "reggae": "Reggae", "blues": "Blues",
    "orchestral-hybrid": "Orchestal hybride", "percussion-trailer": "Percussions",
    "gregorian-chant": "Chant grégorien", "medieval": "Médiéval",
    "traditional": "Traditionnel", "world": "Monde", "march-and-military": "Marches",
    " underscore": "Soutien", "underscore": "Soutien", "drum-and-bass": "Drum & bass",
    "edm": "EDM", "house": "House", "techno": "Techno", "trap": "Trap",
    "chiptune": "Chiptune", "children": "Enfants", "lounge": "Lounge",
    "new-age": "New age", "swing": "Swing", "funk": "Funk", "disco": "Disco",
  };

  const out = musicStore;
  const jobs = ["", ...genres]; // "" = racine (populaires)
  await pool(jobs, async (genre) => {
    const html = await fetchPage(
      genre ? `${BASE}/free-stock-music/${genre}/` : `${BASE}/free-stock-music/`
    );
    if (html === "__PASSER__") return;
    if (!html) {
      console.warn(`  ✗ genre inaccessible : ${genre || "(racine)"}`);
      return;
    }
    const items = parseAudioPage(html);
    let ajoutes = 0;
    for (const it of items) {
      if (vusMusic.has(it.id)) continue;
      vusMusic.add(it.id);
      out.push({
        id: it.id,
        n: it.titre || `Musique ${it.id}`,
        d: it.duree,
        p: it.preview, // pour la musique, le mp3 de preview EST le téléchargement
        g: genre || "populaires",
        gl: genre === "" ? "Populaires" : genre
      });
      ajoutes++;
    }
    console.log(`  ✓ ${genre || "(racine)"} : ${items.length} (${ajoutes} nouveaux)`);
    await new Promise((r) => setTimeout(r, DELAY_MS));
  });
  return out;
}

// ═══════════════════════ VIDÉOS ═══════════════════════

function parseVideoPage(html) {
  // ⚠ Les pages vidéo ont DEUX grilles : la grille standard (item-grid__item)
  // et une grille masonry verticale SANS ce conteneur. On découpe donc sur les
  // marqueurs de player eux-mêmes, présents dans les deux grilles.
  const items = [];
  const positions = [...html.matchAll(/data-item-grid--video-player-item-id-value="(\d+)"/g)];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index;
    const end =
      i + 1 < positions.length ? positions[i + 1].index : Math.min(html.length, start + 12000);
    const bloc = html.slice(start, end);
    const id = positions[i][1];
    const mp4 = bloc.match(/<video[^>]*\ssrc="(https:\/\/[^"]+\.mp4)"/)?.[1];
    const thumb = bloc.match(/<img[^>]*\ssrc="(https:\/\/[^"]+\.jpg)"/)?.[1];
    if (!mp4) continue;
    // Titre : h2 (grille standard) → span overlay (masonry) → alt de l'image
    const titre =
      titreDe(bloc) ||
      bloc.match(/class="item-grid-video-player__overlay-video-title"[^>]*>\s*(?:<a[^>]*>)?(.*?)(?:<\/a>)?\s*<\/span>/s)?.[1]?.replace(/<[^>]+>/g, "") ||
      bloc.match(/<img[^>]*\salt="([^"]+)"/)?.[1] ||
      null;
    const page = bloc.match(
      /class="item-grid-video-player__overlay-link"[^>]*href="([^"]+)"/
    )?.[1];
    // URL pleine qualité : -360.mp4 → -1080.mp4 (validé sur les 2 patterns CDN)
    const full = mp4.replace(/-360\.mp4$/, "-1080.mp4");
    items.push({
      id,
      titre: titre ? decode(titre) : null,
      mp4,
      thumb,
      full,
      page,
    });
  }
  return items;
}

async function scrapeVideos() {
  console.log("\n━━━ VIDÉOS ━━━");
  const CATEGORIES = [
    ["", "Populaires"],
    ["nature", "Nature"],
    ["city", "Villes"],
    ["people", "Personnes"],
    ["business", "Business"],
    ["technology", "Technologie"],
    ["background", "Fonds"],
    ["abstract", "Abstrait"],
    ["fire", "Feu"],
    ["water", "Eau"],
    ["earth", "Terre"],
    ["space", "Espace"],
    ["forest", "Forêt"],
    ["church", "Église"],
    ["worship", "Louange"],
  ];
  const out = videosStore;
  await pool(CATEGORIES, async ([slug, labelFr]) => {
    const html = await fetchPage(
      slug ? `${BASE}/free-stock-video/${slug}/` : `${BASE}/free-stock-video/`
    );
    if (html === "__PASSER__") return;
    if (!html) {
      console.warn(`  ✗ catégorie vidéo absente : ${slug || "(racine)"}`);
      return;
    }
    const items = parseVideoPage(html);
    let ajoutes = 0;
    for (const it of items) {
      if (vusVideos.has(it.id)) continue;
      vusVideos.add(it.id);
      out.push({
        id: it.id,
        n: it.titre || `Vidéo ${it.id}`,
        p: it.mp4,
        th: it.thumb || null,
        f: it.full,
        u: it.page ? `${BASE}${it.page}` : null,
        c: slug || "populaires",
        cl: labelFr,
      });
      ajoutes++;
    }
    console.log(`  ✓ vidéo ${slug || "(racine)"} : ${items.length} (${ajoutes} nouveaux)`);
    await new Promise((r) => setTimeout(r, DELAY_MS));
  });
  return out;
}

// ═══════════════════════ TEMPLATES ═══════════════════════

const LOGICIELS = [
  ["free-premiere-pro-templates", "premiere-pro", "Premiere Pro"],
  ["free-after-effects-templates", "after-effects", "After Effects"],
  ["free-final-cut-pro-templates", "final-cut-pro", "Final Cut Pro"],
  ["free-davinci-resolve-templates", "davinci-resolve", "DaVinci Resolve"],
];
const SOUS_CATS = [
  ["titles", "Titres"],
  ["transitions", "Transitions"],
  ["lower-thirds", "Tiers inférieurs"],
  ["openers", "Intros"],
  ["logo", "Logos"],
  ["slideshow", "Diaporamas"],
  ["social-media", "Réseaux sociaux"],
  ["countdown", "Comptes à rebours"],
];

async function scrapeTemplates() {
  console.log("\n━━━ TEMPLATES ━━━");
  const jobs = [];
  for (const [slug, code, label] of LOGICIELS) {
    jobs.push({ page: slug, code, label, sousCat: "", sousCatLabel: "Populaires" });
    for (const [sc, scl] of SOUS_CATS) {
      jobs.push({ page: `${slug}/${sc}`, code, label, sousCat: sc, sousCatLabel: scl });
    }
  }
  const out = templatesStore;
  await pool(jobs, async ({ page, code, label, sousCat, sousCatLabel }) => {
    const html = await fetchPage(`${BASE}/${page}/`);
    if (html === "__PASSER__") return;
    if (!html) {
      console.warn(`  ✗ page template absente : ${page}`);
      return;
    }
    let items = [];
    for (const bloc of itemBlocks(html)) {
      const id = bloc.match(
        /data-item-grid--video-player-item-id-value="(\d+)"/
      )?.[1];
      if (!id) continue;
      const mp4 = bloc.match(
        /<video[^>]*\ssrc="(https:\/\/[^"]+\.mp4)"/
      )?.[1];
      const thumb = bloc.match(/<img[^>]*\ssrc="(https:\/\/[^"]+\.jpg)"/)?.[1];
      const titre = titreDe(bloc);
      const kind = decode(
        bloc.match(/class="item-grid-card__sub-title">\s*(.*?)\s*<\/p>/s)?.[1] || ""
      );
      const description = decode(
        (bloc.match(/class="item-grid-card__description">\s*(.*?)\s*<\/p>/s)?.[1] || "").replace(/<[^>]+>/g, "")
      );
      const pageUrl = bloc.match(/<a href="(\/free\/[a-z-]+-templates\/[a-z0-9-]+\/)"/)?.[1];
      if (!mp4) continue;
      if (vusTemplates.has(id)) continue;
      vusTemplates.add(id);
      items.push({
        id,
        n: titre || `Template ${id}`,
        s: code, // premiere-pro | after-effects | final-cut-pro | davinci-resolve
        sl: label,
        k: kind || "", // ex: "Premiere Pro / mogrt"
        x: description,
        p: mp4, // preview 360 mp4
        th: thumb || null,
        z: mp4.replace(/-360\.mp4$/, ".zip"), // zip du template
        u: pageUrl ? `${BASE}${pageUrl}` : null,
        c: sousCat || "populaires",
        cl: sousCatLabel,
      });
    }
    out.push(...items);
    console.log(`  ✓ ${page} : ${items.length}`);
    await new Promise((r) => setTimeout(r, DELAY_MS));
  });
  return out;
}

// ═══════════════════════ MAIN ═══════════════════════

const SAMPLE = process.argv.includes("--sample");

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const sfx = await scrapeSfx();
  const music = await scrapeMusic();
  const videos = await scrapeVideos();
  const templates = await scrapeTemplates();

  // ⏳ Rattrapage des pages 429/timeout puis seconde passe idempotente
  const recupere = await rattrapage();
  if (recupere) {
    SECONDE_PASSE = true;
    await scrapeSfx();
    await scrapeMusic();
    await scrapeVideos();
    await scrapeTemplates();
  }
  if (pagesEchouees.size > 0) {
    console.warn(`\n  ⚠ ${pagesEchouees.size} pages définitivement inaccessibles :`);
    for (const u of pagesEchouees.keys()) console.warn(`    - ${u}`);
  }

  const durs = (arr) => arr.filter((x) => x.d).length;
  const ecrire = (nom, data) => {
    const chemin = resolve(OUT_DIR, nom);
    writeFileSync(chemin, JSON.stringify(data));
    console.log(
      `  💾 ${nom} : ${data.length} items (${durs(data)} avec durée) — ${(
        JSON.stringify(data).length / 1024
      ).toFixed(0)} Ko`
    );
  };

  console.log("\n━━━ SAUVEGARDE ━━━");
  if (!SAMPLE) {
    ecrire("sfx.json", sfx);
    ecrire("music.json", music);
    ecrire("videos.json", videos);
    ecrire("templates.json", templates);
  } else {
    ecrire("sfx.sample.json", sfx.slice(0, 30));
    ecrire("music.sample.json", music.slice(0, 30));
    ecrire("videos.sample.json", videos.slice(0, 30));
    ecrire("templates.sample.json", templates.slice(0, 30));
  }

  // Statistiques
  const parCat = {};
  for (const s of sfx) parCat[s.c] = (parCat[s.c] || 0) + 1;
  console.log("\n━━━ STATS ━━━");
  console.log("SFX par catégorie :", JSON.stringify(parCat));
  console.log(
    `TOTAL : ${sfx.length} SFX, ${music.length} musiques, ${videos.length} vidéos, ${templates.length} templates`
  );
  const sansTitre = [...sfx, ...music, ...videos, ...templates].filter((x) => !x.n).length;
  console.log(`Items sans titre : ${sansTitre}`);
}

main().catch((e) => {
  console.error("ÉCHEC :", e);
  process.exit(1);
});
