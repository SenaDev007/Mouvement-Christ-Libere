/**
 * lib/tiktok-sync.ts — ⭐ V4.26/V4.31 Synchronisation AUTOMATIQUE des comptes
 * TikTok liés au back-office.
 *
 * ============================================================================
 * POURQUOI CE FICHIER
 * ============================================================================
 * TikTok n'expose AUCUNE API publique pour lister les vidéos d'un créateur.
 * La Content Posting API sert à POSTER vers TikTok, pas à lire. La Login Kit
 * Display API ne donne accès qu'au profil de l'utilisateur connecté.
 *
 * ⭐ V4.31 — CHANGEMENT D'APPROCHE : on scrape directement la page profil
 * publique TikTok (https://www.tiktok.com/@<username>) au lieu d'utiliser
 * tikwm.com (qui ne supportait PAS le listing des vidéos d'un user — erreur
 * "'url' is required").
 *
 * La page profil contient un tag <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">
 * avec un JSON complet incluant la liste des vidéos récentes dans
 * __DEFAULT_SCOPE__["webapp.user-detail"].itemList.
 *
 * Le code existant src/lib/tiktok-video.ts confirme que ce scraping fonctionne
 * en production (Vercel Paris / cdg1) — les IP datacenter de Vercel ne sont
 * pas bloquées par TikTok pour les pages profil publiques.
 *
 * Garde-fous (alignés sur youtube-sync.ts) :
 *   - Idempotent : pas de doublon par ID TikTok (toutes formes d'URL);
 *   - ⭐ V3.86 (mémoire des suppressions) : une vidéo volontairement
 *     supprimée n'est JAMAIS ré-importée ;
 *   - ⭐ V4.29 : filtre d'âge (≤ 10 jours par défaut);
 *   - ⭐ V4.30 : index unique DB sur Video.videoUrl + gestion P2002;
 *   - Best-effort : TikTok peut bloquer → on retourne un compte-rendu,
 *     jamais d'exception non gérée.
 *
 * DÉCLENCHEURS :
 *   ① Bouton « Synchroniser TikTok » du module Vidéos (back-office) ;
 *   ② Cron Vercel 2×/jour (/api/cron/sync-tiktok — vercel.json).
 * ============================================================================
 */

import { db } from "@/lib/db";
import { extraireTiktokId } from "@/lib/tiktok";
import { estVideoSupprimee } from "@/lib/suppression-video";
import { devinerCategorieSync } from "@/lib/video-rubrics";

const UA_NAVIGATEUR =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const TIMEOUT_MS = 15_000;
const GARDE_ENTRE_COMPTES_MS = 1500; // ~1 req/1.5s (prudent avec TikTok)

// ⭐ V4.29 — Limite d'âge des vidéos TikTok importées (en jours).
const LIMITE_JOURS_TIKTOK = Math.max(
  1,
  Math.min(365, Number(process.env.SYNC_LIMITE_JOURS_TIKTOK) || 10)
);
const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

export interface ResultatSyncTikTok {
  /** Vidéos importées (nouvelles, absentes du module). */
  ajoutees: number;
  /** Vidéos déjà présentes en base. */
  ignorees: number;
  /** Vidéos volontairement supprimées — non ré-importées. */
  sautees: number;
  /** ⭐ V4.29 — Vidéos filtrées par le filtre d'âge (> LIMITE_JOURS_TIKTOK jours). */
  filtrees: number;
  /** Titres des vidéos importées (compte-rendu). */
  titres: string[];
  /** Username TikTok synchronisé (sans le @). */
  username?: string;
  /** Nom affichable (résolu depuis la page profil si disponible). */
  displayName?: string;
  /** Message d'erreur (TikTok bloque, username invalide…) */
  erreur?: string;
}

// ─────────────────────────────────────────────────────────────────────
// TYPES — structure des vidéos extraites du scraping
// ─────────────────────────────────────────────────────────────────────

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

/** Construit l'URL canonique TikTok d'une vidéo à partir du username + id. */
function urlTiktokVideo(username: string, videoId: string): string {
  return `https://www.tiktok.com/@${username}/video/${videoId}`;
}

/** Nettoie un username (sans @, sans espaces, sans slash). */
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
// ⭐ V4.31 — SCRAPING DE LA PAGE PROFIL TIKTOK
// ─────────────────────────────────────────────────────────────────────

/**
 * Extrait le JSON de __UNIVERSAL_DATA_FOR_REHYDRATION__ du HTML de la page
 * profil TikTok. Retourne null si le tag n'est pas trouvé.
 *
 * On utilise indexOf plutôt qu'une regex pour éviter les pièges liés aux
 * caractères spéciaux dans le JSON (le JSON peut contenir des </script>
 * dans des valeurs string — très rare mais possible).
 */
function extraireUniversalData(html: string): unknown | null {
  const MARKER_DEBUT = '<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">';
  const idxDebut = html.indexOf(MARKER_DEBUT);
  if (idxDebut === -1) return null;
  const idxJsonDebut = idxDebut + MARKER_DEBUT.length;
  const idxFin = html.indexOf("</script>", idxJsonDebut);
  if (idxFin === -1) return null;
  const jsonStr = html.slice(idxJsonDebut, idxFin).trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Extrait le JSON de __SIGI_STATE__ (ancien format TikTok, pré-2023).
 * Fallback si __UNIVERSAL_DATA_FOR_REHYDRATION__ n'est pas présent.
 */
function extraireSigiState(html: string): unknown | null {
  const MARKER_DEBUT = '<script id="SIGI_STATE" type="application/json">';
  const idxDebut = html.indexOf(MARKER_DEBUT);
  if (idxDebut === -1) return null;
  const idxJsonDebut = idxDebut + MARKER_DEBUT.length;
  const idxFin = html.indexOf("</script>", idxJsonDebut);
  if (idxFin === -1) return null;
  const jsonStr = html.slice(idxJsonDebut, idxFin).trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Recherche récursive d'un tableau qui ressemble à une liste de vidéos
 * TikTok dans une structure JSON arbitraire. Chaque élément doit avoir un
 * identifiant (id/aweme_id/item_id) ET un champ desc ou video.
 *
 * Profondeur limitée à 6 pour éviter les boucles infinies et les
 * performances catastrophiques sur des JSON très profonds.
 */
function chercherItemListeVideos(o: unknown, profondeur = 0): VideoTiktokScraped[] | null {
  if (profondeur > 6 || !o) return null;

  if (Array.isArray(o)) {
    if (o.length > 0 && typeof o[0] === "object" && o[0] !== null) {
      const premier = o[0] as Record<string, unknown>;
      const aUnId = "id" in premier || "aweme_id" in premier || "item_id" in premier;
      const aDescOuVideo = "desc" in premier || "video" in premier;
      if (aUnId && aDescOuVideo) {
        // C'est probablement une liste de vidéos — on extrait chaque item.
        const videos: VideoTiktokScraped[] = [];
        for (const item of o) {
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
        if (videos.length > 0) return videos;
      }
    }
    // Sinon, recurse dans les éléments du tableau
    for (const item of o) {
      const result = chercherItemListeVideos(item, profondeur + 1);
      if (result && result.length > 0) return result;
    }
    return null;
  }

  if (typeof o === "object") {
    const obj = o as Record<string, unknown>;
    // Chercher les clés communes qui contiennent des listes de vidéos
    for (const key of ["itemList", "items", "aweme_list", "posts", "videos"]) {
      if (key in obj) {
        const result = chercherItemListeVideos(obj[key], profondeur + 1);
        if (result && result.length > 0) return result;
      }
    }
    // Sinon, recurse dans toutes les valeurs
    for (const key of Object.keys(obj)) {
      const result = chercherItemListeVideos(obj[key], profondeur + 1);
      if (result && result.length > 0) return result;
    }
  }

  return null;
}

/**
 * Recherche récursive d'un nickname dans une structure JSON.
 * Retourne le premier nickname trouvé dans un objet qui ressemble à un user.
 */
function chercherNickname(o: unknown, profondeur = 0): string | undefined {
  if (profondeur > 5 || !o || typeof o !== "object") return undefined;
  const obj = o as Record<string, unknown>;
  // Si l'objet a une clé "uniqueId" ou "sec_uid" → c'est probablement un user
  if ("uniqueId" in obj || "sec_uid" in obj || "secUid" in obj) {
    if (typeof obj.nickname === "string" && obj.nickname) return obj.nickname;
  }
  for (const key of Object.keys(obj)) {
    const result = chercherNickname(obj[key], profondeur + 1);
    if (result) return result;
  }
  return undefined;
}

/**
 * Scrap la page profil publique TikTok d'un utilisateur et extrait la liste
 * de ses vidéos récentes.
 *
 * @param username  username TikTok SANS le @
 * @returns { nickname?, videos[] } — ou lance une Error si le scraping échoue
 */
async function scraperProfilTiktok(username: string): Promise<ResultatScrapingProfil> {
  const url = `https://www.tiktok.com/@${username}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA_NAVIGATEUR,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.tiktok.com/",
        "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
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
      throw new Error(`HTTP ${res.status} en scrapant la page profil TikTok.`);
    }

    const html = await res.text();

    // ① Essayer __UNIVERSAL_DATA_FOR_REHYDRATION__ (format récent, post-2023)
    const universalData = extraireUniversalData(html);
    if (universalData) {
      const scopes = (universalData as Record<string, unknown>).__DEFAULT_SCOPE as
        | Record<string, unknown>
        | undefined;
      const userDetail = scopes?.["webapp.user-detail"] as Record<string, unknown> | undefined;

      // Chemin direct : webapp.user-detail.itemList
      if (userDetail?.itemList && Array.isArray(userDetail.itemList)) {
        const videos = chercherItemListeVideos(userDetail.itemList);
        if (videos && videos.length > 0) {
          const userInfo = userDetail.userInfo as Record<string, unknown> | undefined;
          const user = userInfo?.user as Record<string, unknown> | undefined;
          return {
            nickname: (user?.nickname as string | undefined) || chercherNickname(universalData),
            videos,
          };
        }
      }

      // Fallback : recherche récursive dans tout le JSON
      const videos = chercherItemListeVideos(universalData);
      if (videos && videos.length > 0) {
        return {
          nickname: chercherNickname(universalData),
          videos,
        };
      }
    }

    // ② Fallback : __SIGI_STATE__ (ancien format, pré-2023)
    const sigiState = extraireSigiState(html);
    if (sigiState) {
      const videos = chercherItemListeVideos(sigiState);
      if (videos && videos.length > 0) {
        return {
          nickname: chercherNickname(sigiState),
          videos,
        };
      }
    }

    // ③ Aucun JSON exploitable trouvé
    throw new Error(
      "Format de page TikTok inattendu — le JSON de profil n'a pas pu être extrait. " +
        "TikTok a peut-être changé sa structure ou bloque la requête."
    );
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`Timeout (${TIMEOUT_MS}ms) en scrapant la page profil TikTok.`);
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

// ─────────────────────────────────────────────────────────────────────
// SYNCHRONISATION — fonction principale
// ─────────────────────────────────────────────────────────────────────

/**
 * Synchronise un compte TikTok : scrape la page profil publique et importe
 * les vidéos récentes qui manquent au module Vidéos.
 *
 * @param opts.servantCode  code du serviteur auquel attribuer les vidéos.
 */
export async function syncTikTokAccount(opts: {
  servantCode: string;
}): Promise<ResultatSyncTikTok> {
  const codeServiteur = opts.servantCode;

  // ① Résolution du serviteur + compte TikTok en base.
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

  // ② Scraping de la page profil publique TikTok
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

  // ③ Vidéos déjà présentes en base (par ID TikTok).
  const existantes = await db.video.findMany({
    where: { videoUrl: { not: null } },
    select: { videoUrl: true },
  });
  const idsExistants = new Set<string>();
  for (const v of existantes) {
    const id = extraireTiktokId(v.videoUrl);
    if (id) idsExistants.add(id);
  }

  // ④ Insertion des nouvelles vidéos
  let ajoutees = 0;
  let ignorees = 0;
  let sautees = 0;
  let filtrees = 0;
  const titres: string[] = [];

  // ⭐ V4.29 — Filtre d'âge : on ne synchronise que les vidéos publiées
  // dans les LIMITE_JOURS_TIKTOK derniers jours (défaut : 10).
  const dateLimiteMs = Date.now() - LIMITE_JOURS_TIKTOK * MS_PAR_JOUR;

  // Ordre chronologique (TikTok renvoie plus récent d'abord — on inverse).
  for (const v of [...videos].reverse()) {
    const videoId = String(v.video_id || "");
    if (!videoId || !v.title) continue;

    // ⭐ V4.29 — Filtre d'âge (AVANT l'idempotence, pour économiser un
    // lookup DB). create_time est un epoch seconde côté TikTok.
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

    // ⭐ V3.86 — respect de la mémoire des suppressions.
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
          duration: "", // TikTok ne fournit pas la durée dans le profil
          videoUrl: url,
          thumbnailUrl: miniature,
          views: v.play_count || 0,
          likes: v.digg_count || 0,
          isLive: false,
          // ⭐ V4.28 — Catégorisation intelligente par titre.
          category: devinerCategorieSync(v.title, codeServiteur),
          publishedAt: datePublication,
        },
      });
      idsExistants.add(videoId);
      ajoutees++;
      titres.push(v.title);
    } catch (e) {
      // ⭐ V4.30 — Distinguer le P2002 (unique constraint violation) des
      // autres erreurs. L'index unique sur Video.videoUrl garantit qu'aucun
      // doublon ne peut exister en base.
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

/**
 * Synchronise TOUS les comptes TikTok actifs en base.
 */
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

    // Garde entre les comptes (prudent avec TikTok — évite le rate limit).
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
