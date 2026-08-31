/**
 * lib/youtube-live-chat.ts — Sync chat/réactions/stats avec YouTube Live Chat.
 *
 * Fonctions :
 *  - getLiveChatId(videoId) : récupère le liveChatId d'un live YouTube actif
 *  - sendToYouTubeLiveChat(liveChatId, message) : envoie un message sur YouTube
 *  - sendReactionToYouTube(liveChatId, emoji, userName) : envoie une réaction emoji
 *  - fetchYouTubeStats(videoId) : récupère viewCount, likeCount, commentCount
 *  - fetchYouTubeComments(videoId) : récupère les commentaires YouTube
 *  - syncYouTubeStatsToVideo(videoId, videoDbId) : persiste les stats en DB
 *
 * Quota API :
 *  - liveChatMessages.insert : 5 unités/message (10 000/jour = 2000 msg)
 *  - videos.list(part=statistics) : 1 unité
 *  - commentThreads.list : 1 unité/page (100 commentaires/page)
 */

import { google } from "googleapis";
import { db } from "@/lib/db";
import { isYouTubeOAuthConfigured, extractYoutubeId } from "@/lib/youtube";

/**
 * Crée un client OAuth2 YouTube authentifié.
 */
function getYouTubeClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob"
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
  });
  return google.youtube({ version: "v3", auth: oauth2Client });
}

/**
 * Récupère le liveChatId d'une vidéo YouTube en cours de live.
 *
 * @param videoId L'ID vidéo YouTube (11 caractères)
 * @returns Le liveChatId ou null si pas un live actif
 */
export async function getLiveChatId(videoId: string): Promise<string | null> {
  if (!isYouTubeOAuthConfigured()) return null;
  try {
    const youtube = getYouTubeClient();
    const response = await youtube.videos.list({
      part: ["liveStreamingDetails"],
      id: [videoId],
    });
    const liveChatId = response.data.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
    return liveChatId || null;
  } catch (error) {
    console.error("[youtube-live-chat] getLiveChatId error:", error);
    return null;
  }
}

/**
 * Envoie un message texte sur le YouTube Live Chat.
 *
 * @param liveChatId L'ID du live chat YouTube
 * @param message Le texte à envoyer (max 200 chars)
 * @returns true si succès, false sinon
 */
export async function sendToYouTubeLiveChat(
  liveChatId: string,
  message: string
): Promise<boolean> {
  if (!isYouTubeOAuthConfigured()) return false;
  try {
    const youtube = getYouTubeClient();
    // Limiter à 200 caractères (limite YouTube)
    const truncated = message.substring(0, 200);
    await youtube.liveChatMessages.insert({
      part: ["snippet"],
      requestBody: {
        snippet: {
          liveChatId,
          type: "textMessage",
          textMessageDetails: {
            messageText: truncated,
          },
        },
      },
    });
    return true;
  } catch (error) {
    console.error("[youtube-live-chat] sendMessage error:", error);
    return false;
  }
}

/**
 * Envoie une réaction emoji sur le YouTube Live Chat.
 *
 * @param liveChatId L'ID du live chat YouTube
 * @param emoji L'emoji à envoyer (ex: "❤️", "👍", "🔥")
 * @param userName Nom de l'utilisateur (optionnel, pour le contexte)
 * @returns true si succès
 */
export async function sendReactionToYouTube(
  liveChatId: string,
  emoji: string,
  userName?: string
): Promise<boolean> {
  // YouTube ne supporte que les textMessage — on envoie l'emoji comme texte
  const message = userName ? `${userName} ${emoji}` : emoji;
  return sendToYouTubeLiveChat(liveChatId, message);
}

/**
 * Récupère les statistiques d'une vidéo YouTube (vues, likes, commentaires).
 *
 * @param videoId L'ID vidéo YouTube
 * @returns { viewCount, likeCount, commentCount } ou null
 */
export async function fetchYouTubeStats(videoId: string): Promise<{
  viewCount: number;
  likeCount: number;
  commentCount: number;
} | null> {
  if (!isYouTubeOAuthConfigured()) return null;
  try {
    const youtube = getYouTubeClient();
    const response = await youtube.videos.list({
      part: ["statistics"],
      id: [videoId],
    });
    const stats = response.data.items?.[0]?.statistics;
    if (!stats) return null;
    return {
      viewCount: parseInt(stats.viewCount || "0"),
      likeCount: parseInt(stats.likeCount || "0"),
      commentCount: parseInt(stats.commentCount || "0"),
    };
  } catch (error) {
    console.error("[youtube-live-chat] fetchStats error:", error);
    return null;
  }
}

/**
 * Récupère les commentaires YouTube d'une vidéo et les persiste en DB
 * Christ Libère (table LiveChatMessage) pour qu'ils apparaissent dans le
 * module chat du replay.
 *
 * @param videoId L'ID vidéo YouTube
 * @param liveId L'ID du live Christ Libère (pour lier les messages)
 * @returns Le nombre de commentaires synchronisés
 */
export async function syncYouTubeCommentsToDb(
  videoId: string,
  liveId: string
): Promise<number> {
  if (!isYouTubeOAuthConfigured()) return 0;
  try {
    const youtube = getYouTubeClient();
    const response = await youtube.commentThreads.list({
      part: ["snippet"],
      videoId,
      maxResults: 100,
      order: "time",
    });

    const comments = response.data.items || [];
    let synced = 0;

    for (const comment of comments) {
      const snippet = comment.snippet?.topLevelComment?.snippet;
      if (!snippet) continue;

      const authorName = snippet.authorDisplayName || "YouTube";
      const text = snippet.textDisplay || snippet.textOriginal || "";
      const youtubeCommentId = comment.id;
      if (!youtubeCommentId) continue;

      // Vérifier si le commentaire existe déjà en DB (par YouTube ID)
      const existing = await db.liveChatMessage.findFirst({
        where: {
          liveId,
          type: "youtube_comment",
          // Pas de champ youtubeCommentId dédié — on utilise le content pour détecter
          content: { startsWith: `[YT] ${text.substring(0, 50)}` },
        },
        select: { id: true },
      });

      if (!existing) {
        await db.liveChatMessage.create({
          data: {
            liveId,
            userName: authorName,
            content: text,
            type: "youtube_comment",
          },
        });
        synced++;
      }
    }

    return synced;
  } catch (error) {
    console.error("[youtube-live-chat] syncComments error:", error);
    return 0;
  }
}

/**
 * Synchronise les stats YouTube (vues, likes, commentaires) vers la DB
 * Christ Libère.
 *
 * @param youtubeUrl L'URL YouTube de la vidéo
 * @param videoDbId L'ID de la vidéo dans la DB Christ Libère
 * @param liveDbId L'ID du live (optionnel, pour sync les commentaires)
 * @returns Les stats synchronisées ou null
 */
export async function syncYouTubeStatsToVideo(
  youtubeUrl: string,
  videoDbId: string,
  liveDbId?: string
): Promise<{ viewCount: number; likeCount: number; commentCount: number; commentsSynced: number } | null> {
  const videoId = extractYoutubeId(youtubeUrl);
  if (!videoId) return null;

  const stats = await fetchYouTubeStats(videoId);
  if (!stats) return null;

  // Mettre à jour la vidéo en DB avec les vues YouTube
  await db.video.update({
    where: { id: videoDbId },
    data: {
      views: stats.viewCount,
    },
  });

  // Si on a un liveId, sync les commentaires YouTube en DB
  let commentsSynced = 0;
  if (liveDbId) {
    commentsSynced = await syncYouTubeCommentsToDb(videoId, liveDbId);
  }

  // Mettre à jour le viewerCount du live si le live existe
  if (liveDbId) {
    await db.liveStream.update({
      where: { id: liveDbId },
      data: { viewerCount: stats.viewCount },
    }).catch(() => {});
  }

  return { ...stats, commentsSynced };
}
