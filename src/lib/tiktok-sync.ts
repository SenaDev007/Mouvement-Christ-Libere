/**
 * lib/tiktok-sync.ts — ⭐ V4.39 Synchronisation AUTOMATIQUE des comptes
 * TikTok liés au back-office, via ScrapingAnt (rendu JavaScript).
 *
 * ============================================================================
 * ARCHITECTURE — une seule stratégie, propre et fiable
 * ============================================================================
 *
 * TikTok sert un shell HTML vide (architecture "serverless") — le HTML ne
 * contient aucune URL vidéo car tout est rendu par JavaScript côté client.
 *
 * ScrapingAnt est un service de rendu JavaScript qui exécute le JS et
 * retourne le HTML rendu (avec toutes les vidéos chargées dans le DOM).
 *
 * Flux :
 *   ① renderPageViaScrapingAnt(profileUrl)
 *      → GET https://api.scrapingant.com/v2/general?url=<url>&x-api-key=<key>
 *      → attend que les éléments vidéo apparaissent (wait_for_selector)
 *      → retourne le HTML rendu
 *   ② extraireVideoIdsDepuisHTML(htmlRendu)
 *      → regex sur les URLs /@username/video/<id>
 *      → tableau d'IDs dédupliqués
 *   ③ resoudreVideoViaTikwm(url) pour chaque vidéo (max 15, garde 1.3s)
 *      → title, cover, play_count, digg_count, create_time
 *   ④ Filtre 10 jours + idempotence + catégorisation + insertion DB
 *
 * Configuration : SCRAPINGANT_API_KEY sur Vercel (variable d'environnement).
 * Offre gratuite : 10 000 crédits/mois ≈ 1 000 pages rendues avec JS.
 *
 * DÉCLENCHEURS :
 *   ① Bouton « Synchroniser TikTok » du module Vidéos (back-office) ;
 *   ② Bouton « Sync maintenant » sur /admin/tiktok-accounts ;
 *   ③ Cron Vercel 2×/jour (/api/cron/sync-tiktok — vercel.json).
 * ============================================================================
 */

import { db } from "@/lib/db";
import { extraireTiktokId } from "@/lib/tiktok";
import { estVideoSupprimee } from "@/lib/suppression-video";
import { devinerCategorieSync } from "@/lib/video-rubrics";

const UA_NAVIGATEUR =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const TIMEOUT_MS = 20_000;
const GARDE_ENTRE_COMPTES_MS = 1500;
const GARDE_TIKWM_MS = 1300;
const MAX_VIDEOS = 15;

const LIMITE_JOURS_TIKTOK = Math.max(
  1,
  Math.min(365, Number(process.env.SYNC_LIMITE_JOURS_TIKTOK) || 10)
);
const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────

export interface ResultatSyncTikTok {
  ajoutees: number;
  ignorees: number;
  sautees: number;
  filtrees: number;
  titres: string[];
  username?: string;
  displayName?: string;
  erreur?: string;
}

interface VideoTiktokScraped {
  video_id: string;
  title: string;
  cover?: string;
  origin_cover?: string;
  play_count?: number;
  digg_count?: number;
  create_time?: number;
}

// ─────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────

function urlTiktokVideo(username: string, videoId: string): string {
  return `https://www.tiktok.com/@${username}/video/${videoId}`;
}

function nettoyerUsername(username: string): string {
  return username.trim().replace(/^@+/, "").replace(/^\/+/, "").replace(/\/.*$/, "").replace(/\s+/g, "");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────
// ① RENDU JAVASCRIPT VIA SCRAPINGANT
// ─────────────────────────────────────────────────────────────────────

/**
 * Rend une page TikTok via ScrapingAnt — exécute le JavaScript et retourne
 * le HTML rendu avec toutes les vidéos chargées dans le DOM.
 *
 * API : GET https://api.scrapingant.com/v2/general?url=<url>&x-api-key=<key>
 * Réponse : HTML brut (pas du JSON)
 *
 * @returns HTML rendu, ou null si ScrapingAnt n'est pas configuré / échoue
 */
async function renderPageViaScrapingAnt(url: string): Promise<string | null> {
  const apiKey = process.env.SCRAPINGANT_API_KEY;
  if (!apiKey) return null;

  // Construction de l'URL ScrapingAnt avec les paramètres :
  // - url : la page TikTok à rendre
  // - x-api-key : clé API (query param)
  // - wait_for_selector : attend que les liens vidéo apparaissent dans le DOM
  //   (CSS selector : a[href*="/video/"])
  const params = new URLSearchParams({
    url,
    "x-api-key": apiKey,
    wait_for_selector: 'a[href*="/video/"]',
  });

  const scrapUrl = `https://api.scrapingant.com/v2/general?${params}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(scrapUrl, {
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`[tiktok-sync] ScrapingAnt HTTP ${res.status}`);
      if (res.status === 403) {
        console.warn("[tiktok-sync] ScrapingAnt 403 — clé API invalide ou crédits épuisés");
      }
      return null;
    }

    // La réponse est du HTML brut (pas du JSON)
    const html = await res.text();
    if (html && html.length > 1000) {
      console.log(`[tiktok-sync] ScrapingAnt : HTML rendu reçu (${html.length} caractères)`);
      return html;
    }
    return null;
  } catch (e) {
    console.warn("[tiktok-sync] ScrapingAnt erreur :", e instanceof Error ? e.message : e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ─────────────────────────────────────────────────────────────────────
// ② EXTRACTION DES IDs VIDÉO DU HTML RENDU
// ─────────────────────────────────────────────────────────────────────

/**
 * Extrait tous les IDs vidéo TikTok présents dans le HTML rendu.
 * Cherche les patterns :
 *   - /@<username>/video/<numeric_id> dans les href et les URLs
 *   - "aweme_id":"<numeric_id>" dans le JSON embarqué
 *   - "item_id":"<numeric_id>" dans le JSON embarqué
 */
function extraireVideoIdsDepuisHTML(html: string): string[] {
  const ids = new Set<string>();
  let match: RegExpExecArray | null;

  const regexUrl = /tiktok\.com\/@[^/"]+\/video\/(\d{5,25})/g;
  while ((match = regexUrl.exec(html)) !== null) {
    if (match[1]) ids.add(match[1]);
  }

  const regexUrlRelative = /\/@[^/"]+\/video\/(\d{5,25})/g;
  while ((match = regexUrlRelative.exec(html)) !== null) {
    if (match[1]) ids.add(match[1]);
  }

  const regexAweme = /"aweme_id"\s*:\s*"(\d{5,25})"/g;
  while ((match = regexAweme.exec(html)) !== null) {
    if (match[1]) ids.add(match[1]);
  }

  const regexItem = /"item_id"\s*:\s*"(\d{5,25})"/g;
  while ((match = regexItem.exec(html)) !== null) {
    if (match[1]) ids.add(match[1]);
  }

  return Array.from(ids);
}

// ─────────────────────────────────────────────────────────────────────
// ③ RÉSOLUTION INDIVIDUELLE VIA TIKWM
// ─────────────────────────────────────────────────────────────────────

interface ReponseTikwmVideo {
  code?: number;
  msg?: string;
  data?: {
    id?: string | number;
    title?: string;
    desc?: string;
    cover?: string;
    origin_cover?: string;
    play_count?: number;
    digg_count?: number;
    create_time?: number;
  };
}

/**
 * Résout une vidéo TikTok individuelle via tikwm.com.
 * tikwm fonctionne pour les vidéos individuelles (pas pour le feed user).
 */
async function resoudreVideoViaTikwm(url: string): Promise<VideoTiktokScraped | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const tikwmUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const res = await fetch(tikwmUrl, {
      headers: { "User-Agent": UA_NAVIGATEUR, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) return null;

    const reponse = (await res.json()) as ReponseTikwmVideo;
    if (reponse.code !== 0 || !reponse.data) return null;

    const d = reponse.data;
    const videoId = String(d.id || "");
    if (!videoId) return null;

    return {
      video_id: videoId,
      title: d.title || d.desc || "",
      cover: d.cover,
      origin_cover: d.origin_cover,
      play_count: d.play_count,
      digg_count: d.digg_count,
      create_time: d.create_time,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ─────────────────────────────────────────────────────────────────────
// SCRAPER PRINCIPAL — ScrapingAnt → extraction IDs → tikwm
// ─────────────────────────────────────────────────────────────────────

async function scraperProfilTiktok(username: string): Promise<{
  nickname?: string;
  videos: VideoTiktokScraped[];
}> {
  const profileUrl = `https://www.tiktok.com/@${username}`;

  // ① Rendu JavaScript via ScrapingAnt
  const htmlRendu = await renderPageViaScrapingAnt(profileUrl);

  if (!htmlRendu) {
    if (!process.env.SCRAPINGANT_API_KEY) {
      throw new Error(
        "SCRAPINGANT_API_KEY n'est pas configuré sur Vercel. Ajoutez cette variable d'environnement (Settings → Environment Variables) pour activer la synchro automatique TikTok."
      );
    }
    throw new Error(
      "ScrapingAnt n'a pas pu rendre la page TikTok. Vérifiez votre clé API et vos crédits sur scrapingant.com."
    );
  }

  // ② Extraction des IDs vidéo du HTML rendu
  const ids = extraireVideoIdsDepuisHTML(htmlRendu);
  if (ids.length === 0) {
    throw new Error(
      `Aucune URL vidéo trouvée dans la page rendue de @${username}. Le compte est peut-être privé, n'a pas de vidéos publiques, ou TikTok a renvoyé une page de captcha.`
    );
  }

  console.log(`[tiktok-sync] ${ids.length} URLs vidéo trouvées pour @${username}`);

  // ③ Résolution individuelle via tikwm (max 15 vidéos, garde 1.3s)
  const idsAResoudre = ids.slice(0, MAX_VIDEOS);
  const videos: VideoTiktokScraped[] = [];

  // Extraire le nickname du HTML rendu
  let nickname: string | undefined;
  const nickMatch = htmlRendu.match(/"nickname"\s*:\s*"([^"]+)"/);
  if (nickMatch?.[1]) nickname = nickMatch[1];

  for (let i = 0; i < idsAResoudre.length; i++) {
    const videoId = idsAResoudre[i];
    const url = urlTiktokVideo(username, videoId);
    const video = await resoudreVideoViaTikwm(url);
    if (video && video.title) {
      videos.push(video);
    }
    if (i < idsAResoudre.length - 1) await delay(GARDE_TIKWM_MS);
  }

  console.log(`[tiktok-sync] ${videos.length}/${idsAResoudre.length} vidéos résolues via tikwm`);

  if (videos.length === 0) {
    throw new Error(
      "Les URLs vidéo ont été trouvées mais tikwm n'a pas pu résoudre les métadonnées. Le service tikwm est peut-être en panne ou rate-limité. Réessayez plus tard."
    );
  }

  return { nickname, videos };
}

// ─────────────────────────────────────────────────────────────────────
// SYNCHRONISATION — fonction principale
// ─────────────────────────────────────────────────────────────────────

export async function syncTikTokAccount(opts: {
  servantCode: string;
}): Promise<ResultatSyncTikTok> {
  const codeServiteur = opts.servantCode;

  const servant = await db.servant.findFirst({
    where: { code: { equals: codeServiteur, mode: "insensitive" } },
    select: { id: true, shortName: true },
  });
  if (!servant) {
    return resultatVide(`Serviteur « ${codeServiteur} » introuvable en base.`);
  }

  const compte = await db.tiktokAccount.findFirst({
    where: {
      actif: true,
      servant: { code: { equals: codeServiteur, mode: "insensitive" } },
    },
    select: { id: true, username: true, displayName: true },
  });
  if (!compte) {
    return resultatVide(
      `Aucun compte TikTok actif lié au serviteur « ${codeServiteur} ». Liez-le via /admin/tiktok-accounts.`
    );
  }

  const username = nettoyerUsername(compte.username);
  if (!username) {
    return resultatVide(`Username TikTok invalide pour « ${codeServiteur} ».`);
  }

  // Scraping via ScrapingAnt + tikwm
  let scraping: { nickname?: string; videos: VideoTiktokScraped[] };
  try {
    scraping = await scraperProfilTiktok(username);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur lors du scraping TikTok.";
    await marquerDerniereErreur(compte.id, msg);
    return resultatVide(msg, username);
  }

  const videos = scraping.videos.filter((v) => v.video_id && v.title);
  if (videos.length === 0) {
    await marquerSucces(compte.id);
    return {
      ajoutees: 0,
      ignorees: 0,
      sautees: 0,
      filtrees: 0,
      titres: [],
      username,
      displayName: scraping.nickname || compte.displayName || undefined,
    };
  }

  // Idempotence
  const existantes = await db.video.findMany({
    where: { videoUrl: { not: null } },
    select: { videoUrl: true },
  });
  const idsExistants = new Set<string>();
  for (const v of existantes) {
    const id = extraireTiktokId(v.videoUrl);
    if (id) idsExistants.add(id);
  }

  let ajoutees = 0;
  let ignorees = 0;
  let sautees = 0;
  let filtrees = 0;
  const titres: string[] = [];

  const dateLimiteMs = Date.now() - LIMITE_JOURS_TIKTOK * MS_PAR_JOUR;

  for (const v of [...videos].reverse()) {
    const videoId = String(v.video_id || "");
    if (!videoId || !v.title) continue;

    // Filtre d'âge
    const datePublication = v.create_time
      ? new Date(v.create_time * 1000)
      : new Date();
    if (datePublication.getTime() < dateLimiteMs) {
      filtrees++;
      continue;
    }

    // Idempotence
    if (idsExistants.has(videoId)) {
      ignorees++;
      continue;
    }

    const url = urlTiktokVideo(username, videoId);

    // Mémoire des suppressions
    if (await estVideoSupprimee(url)) {
      sautees++;
      continue;
    }

    const miniature = v.cover || v.origin_cover || null;
    const description = (v.title || "").slice(0, 5000);

    try {
      await db.video.create({
        data: {
          servantId: servant.id,
          title: v.title,
          description: description || `Vidéo TikTok de ${servant.shortName} — ${v.title}`,
          duration: "",
          videoUrl: url,
          thumbnailUrl: miniature,
          views: v.play_count || 0,
          likes: v.digg_count || 0,
          isLive: false,
          category: devinerCategorieSync(v.title, codeServiteur),
          publishedAt: datePublication,
        },
      });
      idsExistants.add(videoId);
      ajoutees++;
      titres.push(v.title);
    } catch (e) {
      if (e instanceof Error && "code" in e && (e as { code?: string }).code === "P2002") {
        ignorees++;
        idsExistants.add(videoId);
      } else {
        console.warn(
          `[tiktok-sync] Échec insertion vidéo ${videoId} pour ${codeServiteur} :`,
          e instanceof Error ? e.message : e
        );
      }
    }
  }

  await marquerSucces(compte.id);

  return {
    ajoutees,
    ignorees,
    sautees,
    filtrees,
    titres: titres.slice(0, 5),
    username,
    displayName: scraping.nickname || compte.displayName || undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────
// SYNC MULTI-COMPTES (cron)
// ─────────────────────────────────────────────────────────────────────

export interface ResultatSyncMultiTikTok {
  comptes: number;
  ajoutees: number;
  ignorees: number;
  sautees: number;
  filtrees: number;
  details: Array<{
    servantCode: string;
    username?: string;
    displayName?: string;
    ajoutees: number;
    ignorees: number;
    sautees: number;
    filtrees: number;
    titres: string[];
    erreur?: string;
  }>;
}

export async function syncTousComptesTikTok(): Promise<ResultatSyncMultiTikTok> {
  const comptes = await db.tiktokAccount.findMany({
    where: { actif: true },
    include: { servant: { select: { code: true } } },
  });

  if (comptes.length === 0) {
    return { comptes: 0, ajoutees: 0, ignorees: 0, sautees: 0, filtrees: 0, details: [] };
  }

  const details: ResultatSyncMultiTikTok["details"] = [];
  let ajouteesTotal = 0;
  let ignoreesTotal = 0;
  let sauteesTotal = 0;
  let filtreesTotal = 0;

  for (let i = 0; i < comptes.length; i++) {
    const compte = comptes[i];
    if (!compte.servant?.code) continue;

    const r = await syncTikTokAccount({ servantCode: compte.servant.code });
    details.push({
      servantCode: compte.servant.code,
      username: r.username,
      displayName: r.displayName,
      ajoutees: r.ajoutees,
      ignorees: r.ignorees,
      sautees: r.sautees,
      filtrees: r.filtrees,
      titres: r.titres,
      erreur: r.erreur,
    });
    ajouteesTotal += r.ajoutees;
    ignoreesTotal += r.ignorees;
    sauteesTotal += r.sautees;
    filtreesTotal += r.filtrees;

    if (i < comptes.length - 1) await delay(GARDE_ENTRE_COMPTES_MS);
  }

  return {
    comptes: comptes.length,
    ajoutees: ajouteesTotal,
    ignorees: ignoreesTotal,
    sautees: sauteesTotal,
    filtrees: filtreesTotal,
    details,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────────────────────────────

function resultatVide(erreur: string, username?: string): ResultatSyncTikTok {
  return { ajoutees: 0, ignorees: 0, sautees: 0, filtrees: 0, titres: [], erreur, username };
}

async function marquerSucces(compteId: string): Promise<void> {
  try {
    await db.tiktokAccount.update({
      where: { id: compteId },
      data: { dernierSyncAt: new Date(), derniereErreur: null },
    });
  } catch {
    /* best-effort */
  }
}

async function marquerDerniereErreur(compteId: string, message: string): Promise<void> {
  try {
    await db.tiktokAccount.update({
      where: { id: compteId },
      data: { dernierSyncAt: new Date(), derniereErreur: message.slice(0, 2000) },
    });
  } catch {
    /* best-effort */
  }
}
