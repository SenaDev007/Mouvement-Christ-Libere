import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { EgressClient, StreamOutput } from "livekit-server-sdk";

/**
 * POST /api/live/[id]/egress
 *
 * Démarre le multistreaming RTMP vers YouTube/Facebook/TikTok/Instagram.
 * Doit être appelé APRÈS que le studio s'est connecté à LiveKit et publie un track.
 *
 * Body: { } (utilise les clés RTMP configurées sur le serviteur)
 */

const LIVEKIT_URL = process.env.LIVEKIT_URL || "wss://christ-libere.livekit.cloud";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "dev-key";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "dev-secret";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken || !verifySessionToken(sessionToken)) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await params;
    const live = await db.liveStream.findUnique({
      where: { id },
      include: {
        servant: { include: { streamConfig: true } },
      },
    });

    if (!live) {
      return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
    }

    const roomName = (live as Record<string, unknown>).livekitRoomName as string || `live-${id}`;

    if (!live.multistreamEnabled || !live.servant.streamConfig) {
      return NextResponse.json({ error: "Multistreaming non configuré" }, { status: 400 });
    }

    const config = live.servant.streamConfig;
    const destinations: { url: string; name: string }[] = [];

    const streamToYoutube = (live as Record<string, unknown>).streamToYoutube as boolean;
    const streamToFacebook = (live as Record<string, unknown>).streamToFacebook as boolean;
    const streamToTiktok = (live as Record<string, unknown>).streamToTiktok as boolean;
    const streamToInstagram = (live as Record<string, unknown>).streamToInstagram as boolean;

    if (streamToYoutube && config.youtubeRtmpUrl && config.youtubeRtmpKey) {
      destinations.push({ url: `${config.youtubeRtmpUrl}/${config.youtubeRtmpKey}`, name: "youtube" });
    }
    if (streamToFacebook && config.facebookRtmpUrl && config.facebookRtmpKey) {
      destinations.push({ url: `${config.facebookRtmpUrl}/${config.facebookRtmpKey}`, name: "facebook" });
    }
    if (streamToTiktok && config.tiktokRtmpUrl && config.tiktokRtmpKey) {
      destinations.push({ url: `${config.tiktokRtmpUrl}/${config.tiktokRtmpKey}`, name: "tiktok" });
    }
    if (streamToInstagram && config.instagramRtmpUrl && config.instagramRtmpKey) {
      destinations.push({ url: `${config.instagramRtmpUrl}/${config.instagramRtmpKey}`, name: "instagram" });
    }

    if (destinations.length === 0) {
      return NextResponse.json({ error: "Aucune destination RTMP configurée" }, { status: 400 });
    }

    // Démarrer les egress RTMP
    const egressClient = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    const results: { name: string; egressId: string | null; error?: string }[] = [];

    for (const dest of destinations) {
      try {
        const streamOutput = new StreamOutput({ urls: [dest.url] });
        const egressInfo = await egressClient.startRoomCompositeEgress(
          roomName,
          streamOutput,
          "speaker",
        );
        const egressId = egressInfo.egressId || null;
        results.push({ name: dest.name, egressId });
        console.log(`[egress] RTMP started for ${dest.name}: ${egressId}`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Erreur inconnue";
        results.push({ name: dest.name, egressId: null, error: errMsg });
        console.error(`[egress] Failed for ${dest.name}:`, errMsg);
      }
    }

    return NextResponse.json({
      success: true,
      results,
      totalStarted: results.filter((r) => r.egressId).length,
      totalFailed: results.filter((r) => !r.egressId).length,
    });
  } catch (error) {
    console.error("[egress] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur" },
      { status: 500 }
    );
  }
}
