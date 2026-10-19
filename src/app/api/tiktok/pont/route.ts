/**
 * POST /api/tiktok/pont — Pont de sauvegarde TikTok via un client
 * externe authentifié (poste de travail du ministère).
 *
 * ⭐ V4.17 — CONTEXTE : le CDN TikTok (tiktokcdn) refuse désormais les
 * téléchargements depuis les IP Vercel (403) alors que la RÉSOLUTION
 * tikwm fonctionne — le backfill serveur (/api/tiktok/backfill-videos)
 * ne peut donc plus rapatrier les ~500 MP4 restants. En revanche, le
 * téléchargement fonctionne depuis une connexion résidentielle /
 * classique. Ce pont permet à un client externe de :
 *
 *   ① mode "presign" — { videoId, tiktokId }
 *        → URL pré-signée PUT pour la clé R2 `videos/tiktok-<id>.mp4`
 *          + URL publique de destination (AUCUN fichier ne transite
 *          par Vercel — pas de limite de body 4,5 Mo).
 *   ② mode "commit" — { videoId, url, playCount?, diggCount? }
 *        → persiste Video.tiktokMp4Url = url (+ vues/likes réels TikTok,
 *          likes = max(nôtre, digg_count) — jamais diminué).
 *
 * Sécurité : session back-office obligatoire (même pattern que les
 * autres routes de maintenance) ; l'URL commitée doit pointer sur NOTRE
 * stockage public R2 (préfixe vérifié).
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { isR2Configured, getPresignedUploadUrl, getPublicUrl, usagePrefixeR2 } from "@/lib/r2";
import { ensureTiktokMp4UrlColumn } from "@/lib/ensure-schema";
import { db } from "@/lib/db";
import { extraireTiktokId } from "@/lib/tiktok";
import {
  PREFIXE_MP4_TIKTOK,
  PLAFOND_MP4_TIKTOK_OCTETS,
} from "@/lib/tiktok-video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // Auth : session back-office obligatoire.
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken || !verifySessionToken(sessionToken)) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "R2 non configuré — impossible de stocker les vidéos" },
      { status: 503 }
    );
  }

  await ensureTiktokMp4UrlColumn().catch(() => {});

  let body: {
    mode?: string;
    videoId?: string;
    tiktokId?: string;
    url?: string;
    playCount?: number;
    diggCount?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const videoId = typeof body.videoId === "string" ? body.videoId : "";
  if (!videoId) {
    return NextResponse.json({ error: "videoId manquant" }, { status: 400 });
  }

  const video = await db.video.findUnique({ where: { id: videoId } });
  if (!video) {
    return NextResponse.json({ error: "Vidéo introuvable" }, { status: 404 });
  }

  // ─── Mode ① : presign ───
  if (body.mode === "presign") {
    // ⭐ V4.18 — PLAFOND DU STOCKAGE GRATUIT (10 Go Cloudflare, marge 1 Go)
    // plus de presign au-delà de 9 Go de MP4 TikTok.
    const usage = await usagePrefixeR2(PREFIXE_MP4_TIKTOK).catch(() => null);
    if (!usage || usage.octets >= PLAFOND_MP4_TIKTOK_OCTETS) {
      return NextResponse.json(
        {
          error:
            "Plafond du stockage gratuit Cloudflare atteint — plus de copie TikTok possible (le repli iframe reste disponible)",
        },
        { status: 503 }
      );
    }
    const tiktokId =
      (typeof body.tiktokId === "string" && body.tiktokId) ||
      extraireTiktokId(video.videoUrl) ||
      "";
    if (!tiktokId) {
      return NextResponse.json(
        { error: "tiktokId manquant et non dérivable de la vidéo" },
        { status: 400 }
      );
    }
    const cle = `videos/tiktok-${tiktokId}.mp4`;
    const uploadUrl = await getPresignedUploadUrl(cle, "video/mp4", 7200);
    const publicUrl = getPublicUrl(cle);
    return NextResponse.json({ uploadUrl, publicUrl, cle });
  }

  // ─── Mode ② : commit ───
  if (body.mode === "commit") {
    const url = typeof body.url === "string" ? body.url : "";
    if (!url || !url.startsWith("http")) {
      return NextResponse.json({ error: "url manquante/invalide" }, { status: 400 });
    }
    // Garde : l'URL commitée doit être NOTRE stockage public R2 (le même
    // préfixe que getPublicUrl) — on refuse tout autre domaine.
    const attendu = getPublicUrl("videos/tiktok-x.mp4").replace(
      "tiktok-x.mp4",
      ""
    );
    if (!attendu || !url.startsWith(attendu)) {
      return NextResponse.json(
        { error: "URL non autorisée — seul notre stockage R2 est accepté" },
        { status: 403 }
      );
    }

    const data: { tiktokMp4Url: string; views?: number; likes?: number } = {
      tiktokMp4Url: url,
    };
    const playCount =
      typeof body.playCount === "number" && body.playCount > 0
        ? Math.trunc(body.playCount)
        : null;
    const diggCount =
      typeof body.diggCount === "number" && body.diggCount > 0
        ? Math.trunc(body.diggCount)
        : null;
    if (playCount && playCount > (video.views || 0)) data.views = playCount;
    if (diggCount) {
      const likesActuels = (video as unknown as { likes?: number }).likes ?? 0;
      if (diggCount > likesActuels) data.likes = diggCount;
    }

    await db.video.updateMany({ where: { id: videoId }, data });
    console.log(
      `[tiktok/pont] Commit vidéo ${videoId} → ${url}` +
        (data.views ? ` (vues: ${data.views})` : "") +
        (data.likes ? ` (likes: ${data.likes})` : "")
    );
    return NextResponse.json({
      success: true,
      vues: data.views ?? video.views,
      likes: data.likes ?? (video as unknown as { likes?: number }).likes ?? 0,
    });
  }

  return NextResponse.json(
    { error: "mode inconnu (presign | commit)" },
    { status: 400 }
  );
}
