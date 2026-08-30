/**
 * lib/youtube.ts — Intégration YouTube Data API v3.
 *
 * Fournit :
 *  - extractYoutubeId(url) : helper partagé (refactorisé depuis 4 copies inline)
 *  - isYouTubeOAuthConfigured() : vérifie si les variables d'env sont présentes
 *  - findLatestBroadcastVideoId(since) : récupère l'ID vidéo du dernier live terminé
 *
 * Variables d'environnement requises (OAuth 2.0) :
 *  - YOUTUBE_CLIENT_ID
 *  - YOUTUBE_CLIENT_SECRET
 *  - YOUTUBE_REFRESH_TOKEN  (obtenu via un one-time OAuth consent flow)
 *  - YOUTUBE_CHANNEL_ID     (optionnel, pour le fallback search.list)
 *
 * Stratégie de coût API :
 *  - liveBroadcasts.list (OAuth) = 1 unité/appel → 10 000 appels/jour
 *  - search.list (API key) = 100 unités/appel → 100 appels/jour seulement
 *  On privilégie liveBroadcasts.list (OAuth) qui est 100x moins cher.
 */

import { google } from "googleapis";

/**
 * Extrait l'ID vidéo YouTube (11 caractères) d'une URL.
 * Accepte les formats :
 *  - https://www.youtube.com/watch?v=XXXXXXXXXXX
 *  - https://youtu.be/XXXXXXXXXXX
 *  - https://www.youtube.com/embed/XXXXXXXXXXX
 *  - https://www.youtube.com/shorts/XXXXXXXXXXX
 */
export function extractYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

/**
 * Construit l'URL canonique YouTube d'une vidéo.
 */
export function getYoutubeVideoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Construit l'URL de la miniature haute qualité d'une vidéo YouTube.
 */
export function getYoutubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Vérifie si l'OAuth YouTube est configuré.
 */
export function isYouTubeOAuthConfigured(): boolean {
  return !!(
    process.env.YOUTUBE_CLIENT_ID &&
    process.env.YOUTUBE_CLIENT_SECRET &&
    process.env.YOUTUBE_REFRESH_TOKEN
  );
}

/**
 * Crée un client OAuth2 YouTube authentifié.
 * Utilise le refresh token pour obtenir automatiquement un access token.
 */
function getYouTubeOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob" // redirect URI pour les tokens hors navigateur
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
  });

  return oauth2Client;
}

/**
 * Récupère l'ID vidéo YouTube du dernier live terminé.
 *
 * Utilise liveBroadcasts.list (OAuth, 1 unité/appel) pour lister les
 * broadcasts du canal, filtre ceux dont le lifeCycleStatus est "complete"
 * et dont la date de fin est après `since`.
 *
 * @param since Date minimale de fin du broadcast (typiquement: live.startedAt)
 * @returns { videoId, url } ou null si aucun broadcast trouvé
 */
export async function findLatestBroadcastVideoId(
  since: Date
): Promise<{ videoId: string; url: string } | null> {
  if (!isYouTubeOAuthConfigured()) {
    console.warn("[youtube] OAuth non configuré — impossible de récupérer le video ID");
    return null;
  }

  try {
    const auth = getYouTubeOAuthClient();
    const youtube = google.youtube({ version: "v3", auth });

    // Lister les broadcasts (max 50, triés par date de fin décroissante)
    const response = await youtube.liveBroadcasts.list({
      part: ["snippet,status"],
      broadcastType: "all",
      mine: true,
      maxResults: 50,
    });

    const broadcasts = response.data.items || [];
    if (broadcasts.length === 0) {
      console.log("[youtube] Aucun broadcast trouvé");
      return null;
    }

    // Filtrer : broadcasts terminés après la date `since`
    const sinceMs = since.getTime();
    const completedBroadcasts = broadcasts.filter((b) => {
      const status = b.status;
      const snippet = b.snippet;
      const isComplete =
        status?.lifeCycleStatus === "complete" ||
        status?.recordingStatus === "stopped";
      // actualEndTime est dans snippet, pas dans status
      const endTime = snippet?.actualEndTime
        ? new Date(snippet.actualEndTime).getTime()
        : 0;
      return isComplete && endTime >= sinceMs;
    });

    if (completedBroadcasts.length === 0) {
      console.log("[youtube] Aucun broadcast terminé trouvé après", since.toISOString());
      return null;
    }

    // Prendre le plus récent
    const latest = completedBroadcasts[0];
    const videoId = latest.id;
    if (!videoId) {
      console.warn("[youtube] Broadcast trouvé sans ID vidéo");
      return null;
    }

    console.log(`[youtube] Broadcast trouvé: ${latest.snippet?.title} → videoId=${videoId}`);
    return {
      videoId,
      url: getYoutubeVideoUrl(videoId),
    };
  } catch (error) {
    console.error("[youtube] Erreur findLatestBroadcastVideoId:", error);
    return null;
  }
}

/**
 * Récupère l'ID vidéo YouTube en utilisant search.list (fallback, API key).
 *
 * ATTENTION : coûte 100 unités/appel (quota = 10 000/jour = 100 appels max).
 * À utiliser uniquement si OAuth échoue.
 */
export async function findVideoIdBySearch(
  title: string,
  since: Date
): Promise<{ videoId: string; url: string } | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;

  if (!apiKey || !channelId) {
    console.warn("[youtube] API key ou channel ID manquant pour search.list");
    return null;
  }

  try {
    const auth = getYouTubeOAuthClient();
    const youtube = google.youtube({ version: "v3", auth });

    const response = await youtube.search.list({
      part: ["snippet"],
      channelId,
      type: ["video"],
      q: title,
      publishedAfter: since.toISOString(),
      maxResults: 5,
      order: "date",
    });

    const items = response.data.items || [];
    if (items.length === 0) {
      console.log("[youtube] Aucune vidéo trouvée via search.list");
      return null;
    }

    const videoId = items[0].id?.videoId;
    if (!videoId) return null;

    return {
      videoId,
      url: getYoutubeVideoUrl(videoId),
    };
  } catch (error) {
    console.error("[youtube] Erreur findVideoIdBySearch:", error);
    return null;
  }
}

/**
 * Tente de récupérer l'URL YouTube du replay d'un live.
 *
 * Stratégie :
 *  1. Si l'URL YouTube est déjà connue (définie manuellement), la retourner
 *  2. Sinon, utiliser findLatestBroadcastVideoId (OAuth, 1 unité)
 *  3. En fallback, utiliser findVideoIdBySearch (API key, 100 unités)
 *
 * @param liveStartedAt Date de début du live
 * @param existingYoutubeUrl URL YouTube déjà connue (optionnel)
 * @param liveTitle Titre du live (pour le fallback search)
 */
export async function resolveYoutubeReplayUrl(
  liveStartedAt: Date,
  existingYoutubeUrl?: string | null,
  liveTitle?: string
): Promise<{ videoId: string; url: string; source: "existing" | "oauth" | "search" } | null> {
  // 1. URL déjà connue
  if (existingYoutubeUrl) {
    const videoId = extractYoutubeId(existingYoutubeUrl);
    if (videoId) {
      return { videoId, url: existingYoutubeUrl, source: "existing" };
    }
  }

  // 2. OAuth liveBroadcasts.list (préféré : 1 unité)
  const oauthResult = await findLatestBroadcastVideoId(liveStartedAt);
  if (oauthResult) {
    return { ...oauthResult, source: "oauth" };
  }

  // 3. Fallback search.list (100 unités — utilisé uniquement si OAuth échoue)
  if (liveTitle) {
    const searchResult = await findVideoIdBySearch(liveTitle, liveStartedAt);
    if (searchResult) {
      return { ...searchResult, source: "search" };
    }
  }

  return null;
}
