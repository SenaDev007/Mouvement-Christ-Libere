/**
 * lib/tiktok-sync.ts — ⭐ V4.26/V4.31/V4.32 Synchronisation AUTOMATIQUE
 * des comptes TikTok liés au back-office.
 *
 * ============================================================================
 * ⭐ V4.32 — APPROCHE DEUX-ÉTAPES (fix du "Format de page inattendu")
 * ============================================================================
 * La page profil TikTok contient bien __UNIVERSAL_DATA_FOR_REHYDRATION__,
 * mais ce JSON ne contient QUE les infos utilisateur (username, nickname,
 * secUid) — PAS la liste des vidéos. Celle-ci est chargée séparément via
 * l'API interne TikTok :
 *
 *   GET https://www.tiktok.com/api/post/item_list/
 *     ?aid=1988&count=35&cursor=0&device_platform=web_pc&secUid=<sec_uid>
 *
 * Étapes :
 *   ① Fetch la page profil https://www.tiktok.com/@<username>
 *   ② Extraire __UNIVERSAL_DATA_FOR_REHYDRATION__ du HTML
 *   ③ Naviguer à __DEFAULT_SCOPE__["webapp.user-detail"].userInfo.user
 *      → récupérer secUid + nickname
 *   ④ Récupérer les cookies de la réponse ① (TikTok exige une session)
 *   ⑤ Appeler /api/post/item_list/ avec secUid + cookies + headers
 *   ⑥ Parser la liste des vidéos (itemList dans la réponse JSON)
 *
 * Si l'étape ⑤ retourne une réponse vide (TikTok exige parfois une signature
 * X-Bogus), on fallback sur la recherche récursive dans le HTML de la page
 * profil (au cas où TikTok aurait inclus certaines vidéos dans le HTML initial).
 *
 * Références :
 *   - https://dev.to/hasdata_com/scraping-tiktok-profiles-and-videos-with-python-part-1-4o8i
 *   - https://webscraping.ai/blog/how-to-scrape-tiktok
 * ============================================================================
 */

import { db } from "@/lib/db";
import { extraireTiktokId } from "@/lib/tiktok";
import { estVideoSupprimee } from "@/lib/suppression-video";
import { devinerCategorieSync } from "@/lib/video-rubrics";

const UA_NAVIGATEUR =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const TIMEOUT_MS = 15_000;
const GARDE_ENTRE_COMPTES_MS = 1500;

const LIMITE_JOURS_TIKTOK = Math.max(
  1,
  Math.min(365, Number(process.env.SYNC_LIMITE_JOURS_TIKTOK) || 10)
);
const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

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

interface ResultatScrapingProfil {
  nickname?: string;
  videos: VideoTiktokScraped[];
}

// ─────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────

function urlTiktokVideo(username: string, videoId: string): string {
  return `https://www.tiktok.com/@${username}/video/${videoId}`;
}

function nettoyerUsername(username: string): string {
  return username
    .trim()
    .replace(/^@+/, "")
    .replace(/^\/+/, "")
    .replace(/\/.*$/, "")
    .replace(/\s+/g, "");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────
// ÉTAPE ①②③ — Scraping de la page profil → extraction secUid
// ─────────────────────────────────────────────────────────────────────

/** Extrait le JSON de __UNIVERSAL_DATA_FOR_REHYDRATION__ du HTML. */
function extraireUniversalData(html: string): Record<string, unknown> | null {
  const MARKER = '<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">';
  const idxDebut = html.indexOf(MARKER);
  if (idxDebut === -1) return null;
  const idxJson = idxDebut + MARKER.length;
  const idxFin = html.indexOf("</script>", idxJson);
  if (idxFin === -1) return null;
  try {
    return JSON.parse(html.slice(idxJson, idxFin).trim()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Extrait les cookies de l'en-tête set-cookie pour les forwarder. */
function extraireCookies(setCookie: string | string[] | null): string {
  if (!setCookie) return "";
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  return cookies
    .map((c) => c.split(";")[0])
    .filter((c) => c.includes("="))
    .join("; ");
}

interface InfosUserTiktok {
  secUid: string;
  nickname?: string;
  html: string;
  cookies: string;
}

/**
 * Étape 1 : fetch la page profil, extrait secUid + nickname + cookies.
 */
async function scraperProfilPourSecUid(username: string): Promise<InfosUserTiktok> {
  const url = `https://www.tiktok.com/@${username}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA_NAVIGATEUR,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.google.com/",
        "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "cross-site",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
      },
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`Username TikTok @${username} introuvable (404). Vérifiez l'orthographe.`);
      }
      if (res.status === 403 || res.status === 429) {
        throw new Error(
          `TikTok bloque la requête (HTTP ${res.status} — captcha ou rate limit). Réessayez dans quelques minutes.`
        );
      }
      throw new Error(`HTTP ${res.status} sur la page profil TikTok.`);
    }

    const html = await res.text();
    const cookies = extraireCookies(res.headers.get("set-cookie"));

    const universalData = extraireUniversalData(html);
    if (!universalData) {
      throw new Error(
        `Tag __UNIVERSAL_DATA_FOR_REHYDRATION__ introuvable dans le HTML de la page profil. ` +
          `TikTok a peut-être changé sa structure ou renvoyé une page de captcha. ` +
          `Taille HTML reçue : ${html.length} caractères.`
      );
    }

    const scopes = universalData.__DEFAULT_SCOPE as Record<string, unknown> | undefined;
    const userDetail = scopes?.["webapp.user-detail"] as Record<string, unknown> | undefined;
    const userInfo = userDetail?.userInfo as Record<string, unknown> | undefined;
    const user = userInfo?.user as Record<string, unknown> | undefined;

    const secUid = (user?.secUid as string | undefined) || (user?.sec_uid as string | undefined);
    if (!secUid) {
      throw new Error(
        "secUid introuvable dans le JSON de la page profil. " +
          "Le compte est peut-être privé, ou TikTok a changé la structure du JSON."
      );
    }

    return {
      secUid,
      nickname: (user?.nickname as string | undefined) || undefined,
      html,
      cookies,
    };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`Timeout (${TIMEOUT_MS}ms) sur la page profil TikTok.`);
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

// ─────────────────────────────────────────────────────────────────────
// ÉTAPE ④⑤⑥ — Appel à /api/post/item_list/ avec secUid
// ─────────────────────────────────────────────────────────────────────

/** Extrait les vidéos d'une réponse /api/post/item_list/. */
function extraireVideosDeItemApi(data: unknown): VideoTiktokScraped[] | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;

  const listeBrute = obj.itemList || obj.aweme_list || obj.items || obj.posts;
  if (!Array.isArray(listeBrute)) return null;

  const videos: VideoTiktokScraped[] = [];
  for (const item of listeBrute) {
    if (!item || typeof item !== "object") continue;
    const v = item as Record<string, unknown>;
    const videoId = String(v.id || v.aweme_id || v.item_id || "");
    if (!videoId) continue;
    const stats = (v.stats || v.statistics) as Record<string, unknown> | undefined;
    const video = v.video as Record<string, unknown> | undefined;
    videos.push({
      video_id: videoId,
      title: String(v.desc || ""),
      cover: video?.cover as string | undefined,
      origin_cover:
        (video?.originCover as string | undefined) ||
        (video?.origin_cover as string | undefined),
      play_count:
        (stats?.playCount as number | undefined) ||
        (stats?.play_count as number | undefined),
      digg_count:
        (stats?.diggCount as number | undefined) ||
        (stats?.digg_count as number | undefined),
      create_time:
        (v.createTime as number | undefined) ||
        (v.create_time as number | undefined),
    });
  }
  return videos.length > 0 ? videos : null;
}

/**
 * Étape 2 : appelle /api/post/item_list/ pour récupérer la liste des vidéos.
 * Retourne null si l'API retourne une réponse vide (X-Bogus manquant).
 */
async function fetchItemList(
  secUid: string,
  username: string,
  cookies: string
): Promise<VideoTiktokScraped[] | null> {
  const url = new URL("https://www.tiktok.com/api/post/item_list/");
  url.searchParams.set("aid", "1988");
  url.searchParams.set("count", "35");
  url.searchParams.set("cursor", "0");
  url.searchParams.set("device_platform", "web_pc");
  url.searchParams.set("secUid", secUid);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      "User-Agent": UA_NAVIGATEUR,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: `https://www.tiktok.com/@${username}`,
      "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
    };
    if (cookies) {
      headers["Cookie"] = cookies;
    }

    const res = await fetch(url.toString(), {
      headers,
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`[tiktok-sync] /api/post/item_list/ HTTP ${res.status} — fallback HTML`);
      return null;
    }

    const text = await res.text();
    if (!text || text.trim() === "") {
      console.warn("[tiktok-sync] /api/post/item_list/ réponse vide — fallback HTML");
      return null;
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      console.warn("[tiktok-sync] /api/post/item_list/ réponse non-JSON — fallback HTML");
      return null;
    }

    return extraireVideosDeItemApi(data);
  } catch (e) {
    console.warn(
      "[tiktok-sync] Erreur /api/post/item_list/ :",
      e instanceof Error ? e.message : e,
      "— fallback HTML"
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ─────────────────────────────────────────────────────────────────────
// FALLBACK — recherche récursive dans le HTML
// ─────────────────────────────────────────────────────────────────────

function chercherItemListeVideos(o: unknown, profondeur = 0): VideoTiktokScraped[] | null {
  if (profondeur > 6 || !o) return null;

  if (Array.isArray(o)) {
    if (o.length > 0 && typeof o[0] === "object" && o[0] !== null) {
      const premier = o[0] as Record<string, unknown>;
      const aUnId = "id" in premier || "aweme_id" in premier || "item_id" in premier;
      const aDescOuVideo = "desc" in premier || "video" in premier;
      if (aUnId && aDescOuVideo) {
        return extraireVideosDeItemApi(o);
      }
    }
    for (const item of o) {
      const result = chercherItemListeVideos(item, profondeur + 1);
      if (result && result.length > 0) return result;
    }
    return null;
  }

  if (typeof o === "object") {
    const obj = o as Record<string, unknown>;
    for (const key of ["itemList", "items", "aweme_list", "posts", "videos"]) {
      if (key in obj) {
        const result = chercherItemListeVideos(obj[key], profondeur + 1);
        if (result && result.length > 0) return result;
      }
    }
    for (const key of Object.keys(obj)) {
      const result = chercherItemListeVideos(obj[key], profondeur + 1);
      if (result && result.length > 0) return result;
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────
// FONCTION PRINCIPALE — scraping deux-étapes + fallback
// ─────────────────────────────────────────────────────────────────────

async function scraperProfilTiktok(username: string): Promise<ResultatScrapingProfil> {
  // Étape 1 : page profil → secUid + cookies
  const infos = await scraperProfilPourSecUid(username);

  // Étape 2 : /api/post/item_list/ avec secUid + cookies
  const videosApi = await fetchItemList(infos.secUid, username, infos.cookies);
  if (videosApi && videosApi.length > 0) {
    return {
      nickname: infos.nickname,
      videos: videosApi,
    };
  }

  // Fallback : recherche récursive dans le JSON de la page profil
  const universalData = extraireUniversalData(infos.html);
  if (universalData) {
    const videosFallback = chercherItemListeVideos(universalData);
    if (videosFallback && videosFallback.length > 0) {
      console.log(
        `[tiktok-sync] /api/post/item_list/ a échoué — ${videosFallback.length} vidéos trouvées via fallback HTML`
      );
      return {
        nickname: infos.nickname,
        videos: videosFallback,
      };
    }
  }

  throw new Error(
    "Aucune vidéo récupérée. L'API interne TikTok (/api/post/item_list/) retourne une réponse vide " +
      "(elle exige parfois une signature X-Bogus que nous ne générons pas). " +
      "Le secUid a bien été extrait mais la liste des vidéos n'est pas accessible sans signature. " +
      "Solution alternative : importez manuellement les URLs TikTok via le module Vidéos."
  );
}

// ─────────────────────────────────────────────────────────────────────
// SYNCHRONISATION
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

  let scraping: ResultatScrapingProfil;
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

    const datePublication = v.create_time
      ? new Date(v.create_time * 1000)
      : new Date();
    if (datePublication.getTime() < dateLimiteMs) {
      filtrees++;
      continue;
    }

    if (idsExistants.has(videoId)) {
      ignorees++;
      continue;
    }

    const url = urlTiktokVideo(username, videoId);

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
          description:
            description || `Vidéo TikTok de ${servant.shortName} — ${v.title}`,
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
      if (
        e instanceof Error &&
        "code" in e &&
        (e as { code?: string }).code === "P2002"
      ) {
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
    return {
      comptes: 0,
      ajoutees: 0,
      ignorees: 0,
      sautees: 0,
      filtrees: 0,
      details: [],
    };
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

    if (i < comptes.length - 1) {
      await delay(GARDE_ENTRE_COMPTES_MS);
    }
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
