/**
 * lib/tiktok-sync.ts — ⭐ V4.26 Synchronisation AUTOMATIQUE des comptes
 * TikTok liés au back-office.
 *
 * ============================================================================
 * POURQUOI CE FICHIER
 * ============================================================================
 * TikTok n'expose AUCUNE API publique pour lister les vidéos d'un créateur.
 * La Content Posting API sert à POSTER vers TikTok, pas à lire. La Login Kit
 * Display API ne donne accès qu'au profil de l'utilisateur connecté.
 *
 * LA PARADE : on scrape le feed public via le service tiers `tikwm.com`
 * (déjà utilisé pour la résolution MP4 dans src/lib/tiktok-video.ts — pas
 * de nouvelle dépendance externe).
 *
 *   GET https://www.tikwm.com/api/?user=<username>&count=50
 *
 * Renvoie un JSON { data: { videos: [...] } } avec pour chaque vidéo :
 *   - video_id (string numérique)
 *   - title (string)
 *   - play_addr (URL .mp4 — non utilisée ici, résolue à la demande par
 *     src/lib/tiktok-video.ts)
 *   - cover (URL miniature)
 *   - play_count / digg_count (vues / likes)
 *   - create_time (epoch)
 *
 * On insère chaque vidéo dans `Video` avec videoUrl =
 *   `https://www.tiktok.com/@<username>/video/<video_id>`
 *
 * Garde-fous (alignés sur youtube-sync.ts) :
 *   - Idempotent : pas de doublon par ID TikTok (toutes formes d'URL);
 *   - ⭐ V3.86 (mémoire des suppressions) : une vidéo volontairement
 *     supprimée n'est JAMAIS ré-importée ;
 *   - Best-effort : tikwm peut être en panne ou rate-limit → on retourne
 *     un compte-rendu, jamais d'exception non gérée ;
 *   - Rate limit tikwm ~1 req/s → 1,2s de garde entre les comptes.
 *
 * DÉCLENCHEURS :
 *   ① Bouton « Synchroniser TikTok » du module Vidéos (back-office) ;
 *   ② Cron Vercel 2×/jour (/api/cron/sync-tiktok — vercel.json).
 * ============================================================================
 */

import { db } from "@/lib/db";
import { extraireTiktokId } from "@/lib/tiktok";
import { estVideoSupprimee } from "@/lib/suppression-video";
import { rubriquesDe } from "@/lib/video-rubrics";

const TIKWM_ENDPOINT = "https://www.tikwm.com/api/";
const UA_NAVIGATEUR =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const TIMEOUT_MS = 12_000;
const GARDE_ENTRE_COMPTES_MS = 1200; // ~1 req/s

export interface ResultatSyncTikTok {
  /** Vidéos importées (nouvelles, absentes du module). */
  ajoutees: number;
  /** Vidéos déjà présentes en base. */
  ignorees: number;
  /** Vidéos volontairement supprimées — non ré-importées. */
  sautees: number;
  /** Titres des vidéos importées (compte-rendu). */
  titres: string[];
  /** Username TikTok synchronisé (sans le @). */
  username?: string;
  /** Nom affichable (résolu depuis tikwm si disponible). */
  displayName?: string;
  /** Message d'erreur (tikwm en panne, rate-limit, username invalide…) */
  erreur?: string;
}

/**
 * Type partiel de la réponse de tikwm — on ne déclare que les champs
 * utilisés. Toute structure supplémentaire est ignorée.
 */
interface ReponseTikwmUser {
  code?: number;
  msg?: string;
  data?: {
    userInfo?: {
      uniqueId?: string;
      nickname?: string;
    };
    videos?: Array<{
      video_id?: string | number;
      title?: string;
      cover?: string;
      origin_cover?: string;
      play_count?: number;
      digg_count?: number;
      create_time?: number;
    }>;
  };
}

/** Construit l'URL canonique TikTok d'une vidéo à partir du username + id. */
function urlTiktokVideo(username: string, videoId: string): string {
  return `https://www.tiktok.com/@${username}/video/${videoId}`;
}

/** Garde-bien : retourne un username nettoyé (sans @, sans espaces, sans slash). */
function nettoyerUsername(username: string): string {
  return username
    .trim()
    .replace(/^@+/, "")
    .replace(/^\/+/, "")
    .replace(/\/.*$/, "")
    .replace(/\s+/g, "");
}

/** Pause non-bloquante. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Synchronise un compte TikTok : récupère les dernières vidéos publiées via
 * tikwm et importe celles qui manquent au module Vidéos.
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

  // ② Appel à tikwm : GET /api/?user=<username>&count=50
  let reponse: ReponseTikwmUser;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const url = `${TIKWM_ENDPOINT}?user=${encodeURIComponent(username)}&count=50`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": UA_NAVIGATEUR,
        Accept: "application/json",
      },
      signal: controller.signal,
      // On force le cache désactivé (sinon Vercel peut cacher une réponse
      // d'erreur et on ne se rend pas compte que tikwm est en panne).
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!res.ok) {
      await marquerDerniereErreur(compte.id, `tikwm HTTP ${res.status}`);
      return resultatVide(
        `Service tikwm indisponible (HTTP ${res.status}). Réessayez plus tard.`,
        username
      );
    }

    reponse = (await res.json()) as ReponseTikwmUser;
  } catch (e) {
    const msg = e instanceof Error ? `Erreur réseau tikwm : ${e.message}` : "Erreur réseau tikwm.";
    await marquerDerniereErreur(compte.id, msg);
    return resultatVide(msg, username);
  }

  // ③ Validation de la réponse
  if (reponse.code !== 0 || !reponse.data?.videos) {
    const msg =
      reponse.msg ||
      (reponse.code === -1
        ? "Username TikTok introuvable ou compte privé."
        : `Réponse tikwm inattendue (code=${reponse.code ?? "?"}).`);
    await marquerDerniereErreur(compte.id, msg);
    return resultatVide(msg, username);
  }

  const videos = reponse.data.videos.filter((v) => v.video_id && v.title);
  if (videos.length === 0) {
    await marquerSucces(compte.id);
    return {
      ajoutees: 0,
      ignorees: 0,
      sautees: 0,
      titres: [],
      username,
      displayName: reponse.data.userInfo?.nickname || compte.displayName || undefined,
    };
  }

  // ④ Vidéos déjà présentes en base (par ID TikTok).
  const existantes = await db.video.findMany({
    where: { videoUrl: { not: null } },
    select: { videoUrl: true },
  });
  const idsExistants = new Set<string>();
  for (const v of existantes) {
    const id = extraireTiktokId(v.videoUrl);
    if (id) idsExistants.add(id);
  }

  // ⑤ Insertion des nouvelles vidéos
  let ajoutees = 0;
  let ignorees = 0;
  let sautees = 0;
  const titres: string[] = [];

  // ⭐ V4.26 — Catégorie par défaut = rubrique SIGNATURE du serviteur,
  // pour garantir qu'aucune vidéo TikTok d'Afrika ne se retrouve dans la
  // section Pasteur Kongo (et inverse versa). Cf. commentaire équivalent
  // dans youtube-sync.ts.
  //   · Afrika       → "Saint-Esprit réponds-moi"
  //   · Pasteur Kongo → "Rhema du matin"
  const rubriqueParDefaut = rubriquesDe(codeServiteur)[0] || null;

  // Ordre chronologique (tikwm renvoie plus récent d'abord — on inverse).
  for (const v of [...videos].reverse()) {
    const videoId = String(v.video_id || "");
    if (!videoId || !v.title) continue;

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

    const datePublication = v.create_time
      ? new Date(v.create_time * 1000)
      : new Date();

    const miniature = v.cover || v.origin_cover || null;
    const description = (v.title || "").slice(0, 5000);

    try {
      await db.video.create({
        data: {
          servantId: servant.id,
          title: v.title,
          description:
            description || `Vidéo TikTok de ${servant.shortName} — ${v.title}`,
          duration: "", // tikwm ne fournit pas la durée côté user feed
          videoUrl: url,
          thumbnailUrl: miniature,
          views: v.play_count || 0,
          likes: v.digg_count || 0,
          isLive: false,
          // ⭐ V4.26 — Rubrique signature du serviteur (cf. commentaire plus haut).
          category: rubriqueParDefaut,
          publishedAt: datePublication,
        },
      });
      idsExistants.add(videoId);
      ajoutees++;
      titres.push(v.title);
    } catch (e) {
      // Une insertion peut échouer si, par exemple, deux vidéos ont le
      // même ID (très rare) — on continue sans tout casser.
      console.warn(
        `[tiktok-sync] Échec insertion vidéo ${videoId} pour ${codeServiteur} :`,
        e instanceof Error ? e.message : e
      );
    }
  }

  await marquerSucces(compte.id);

  return {
    ajoutees,
    ignorees,
    sautees,
    titres: titres.slice(0, 5),
    username,
    displayName: reponse.data.userInfo?.nickname || compte.displayName || undefined,
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
  details: Array<{
    servantCode: string;
    username?: string;
    displayName?: string;
    ajoutees: number;
    ignorees: number;
    sautees: number;
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
      details: [],
    };
  }

  const details: ResultatSyncMultiTikTok["details"] = [];
  let ajouteesTotal = 0;
  let ignoreesTotal = 0;
  let sauteesTotal = 0;

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
      titres: r.titres,
      erreur: r.erreur,
    });
    ajouteesTotal += r.ajoutees;
    ignoreesTotal += r.ignorees;
    sauteesTotal += r.sautees;

    // Garde entre les comptes (rate limit tikwm).
    if (i < comptes.length - 1) {
      await delay(GARDE_ENTRE_COMPTES_MS);
    }
  }

  return {
    comptes: comptes.length,
    ajoutees: ajouteesTotal,
    ignorees: ignoreesTotal,
    sautees: sauteesTotal,
    details,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────────────────────────────

function resultatVide(erreur: string, username?: string): ResultatSyncTikTok {
  return { ajoutees: 0, ignorees: 0, sautees: 0, titres: [], erreur, username };
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
