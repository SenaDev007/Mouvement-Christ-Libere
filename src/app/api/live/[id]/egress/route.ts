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
 * ⭐ V2.6.2 — Idempotent et économe en quota :
 *  1. NETTOYAGE GLOBAL : arrête les egress RTMP « zombies » — les egress
 *     encore actifs dont le live correspondant n'est PLUS en statut LIVE
 *     (studio fermé sans /stop, onglet crashé…). Ce sont eux qui épuisent
 *     le quota de minutes d'egress LiveKit Cloud et provoquent l'erreur
 *     « egress minutes exceeded ».
 *  2. DÉDUPLICATION : si un egress ACTIF existe déjà pour cette room et
 *     cette URL de destination, on le RÉUTILISE au lieu d'en démarrer un
 *     second (une reconnexion du studio ne crée plus de doublon).
 *  3. ERREURS CLAIRES : l'erreur quota LiveKit est traduite en français
 *     avec un plan d'action (upgrade du plan / reset mensuel / mode OBS).
 *
 * Body: { } (utilise les clés RTMP configurées sur le serviteur)
 */

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL || "wss://christ-libere.livekit.cloud";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "dev-key";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "dev-secret";

/** Traduit les erreurs LiveKit Cloud (quota) en message français actionnable. */
function translateEgressError(errMsg: string): string {
  if (/egress minutes exceeded|egress minutes|minutes? exceeded/i.test(errMsg)) {
    return (
      "Quota d'egress LiveKit Cloud dépassé (minutes de streaming sortant épuisées). " +
      "Le stream ne peut pas partir vers YouTube. Solutions : " +
      "1) patientez jusqu'à la réinitialisation mensuelle du quota ; " +
      "2) passez à un plan supérieur sur livekit.io (Dashboard → Billing → Usage) ; " +
      "3) en attendant, utilisez le mode « Encodeur externe (OBS) » du studio, " +
      "qui pousse le RTMP directement vers YouTube sans consommer d'egress LiveKit."
    );
  }
  if (/not found|room.*not/i.test(errMsg) && /permission|denied/i.test(errMsg)) {
    return `Accès LiveKit refusé : ${errMsg}`;
  }
  return errMsg;
}

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
      // Diagnoser pourquoi aucune destination n'est configurée
      const diag: string[] = [];
      if (streamToYoutube) {
        diag.push(`YouTube: RTMP URL=${config.youtubeRtmpUrl ? "✓" : "✗ (manquant)"}, Key=${config.youtubeRtmpKey ? "✓" : "✗ (manquant)"}`);
      } else { diag.push("YouTube: non activé sur ce live"); }
      if (streamToFacebook) {
        diag.push(`Facebook: RTMP URL=${config.facebookRtmpUrl ? "✓" : "✗"}, Key=${config.facebookRtmpKey ? "✓" : "✗"}`);
      }
      if (streamToTiktok) {
        diag.push(`TikTok: RTMP URL=${config.tiktokRtmpUrl ? "✓" : "✗"}, Key=${config.tiktokRtmpKey ? "✓" : "✗"}`);
      }
      if (streamToInstagram) {
        diag.push(`Instagram: RTMP URL=${config.instagramRtmpUrl ? "✓" : "✗"}, Key=${config.instagramRtmpKey ? "✓" : "✗"}`);
      }
      return NextResponse.json({
        error: "Aucune destination RTMP configurée",
        diagnostic: diag,
        multistreamEnabled: live.multistreamEnabled,
        streamConfigExists: !!live.servant.streamConfig,
      }, { status: 400 });
    }

    const egressClient = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    // ─── ⭐ V2.6.2 — 1. NETTOYAGE GLOBAL des egress zombies (best effort) ───
    // Les egress encore actifs dont le live n'est PLUS « LIVE » consomment
    // du quota LiveKit Cloud pour rien (studio fermé sans passer par /stop).
    try {
      const allEgresses = await egressClient.listEgress({ active: true });
      for (const eg of allEgresses) {
        const egRoom = (eg as unknown as { roomName?: string }).roomName;
        if (!egRoom || egRoom === roomName) continue; // notre room : traitée au point 2
        const relatedLive = await db.liveStream.findFirst({
          where: { livekitRoomName: egRoom },
          select: { id: true, status: true },
        });
        if (!relatedLive || relatedLive.status !== "LIVE") {
          try {
            await egressClient.stopEgress(eg.egressId);
            console.log(`[egress] Zombie arrêté (${egRoom}, live ${
              relatedLive ? relatedLive.status : "introuvable"
            }) : ${eg.egressId}`);
          } catch { /* déjà arrêté */ }
        }
      }
    } catch (e) {
      console.warn("[egress] Nettoyage global impossible (non bloquant):", e instanceof Error ? e.message : e);
    }

    // ─── ⭐ V2.6.2 — 2. DÉDUPLICATION : réutiliser les egress actifs de CETTE room ───
    let existing: Array<{ egressId: string; url: string; status: number }> = [];
    try {
      const roomEgresses = await egressClient.listEgress({ roomName });
      existing = roomEgresses.flatMap((eg) => {
        const results = (eg as unknown as { streamResults?: Array<{ url?: string; status?: number }> }).streamResults || [];
        return results
          .filter((r) => r.url)
          .map((r) => ({ egressId: eg.egressId, url: r.url as string, status: (eg as unknown as { status: number }).status }));
      });
    } catch (e) {
      console.warn("[egress] listEgress impossible (non bloquant):", e instanceof Error ? e.message : e);
    }
    // Statuts LiveKit : 0 = STARTING, 1 = ACTIVE, 2 = ENDED/COMPLETE…
    const isReusable = (status: number) => status === 0 || status === 1;

    // Démarrer (ou réutiliser) les egress RTMP
    const results: { name: string; egressId: string | null; error?: string; reused?: boolean; quotaExceeded?: boolean }[] = [];

    for (const dest of destinations) {
      // Un egress ACTIF existe déjà pour cette URL → le réutiliser (zéro minute en plus)
      const already = existing.find((e) => e.url === dest.url && isReusable(e.status));
      if (already) {
        results.push({ name: dest.name, egressId: already.egressId, reused: true });
        console.log(`[egress] Réutilisé pour ${dest.name}: ${already.egressId} (déjà actif)`);
        continue;
      }
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
        const rawMsg = err instanceof Error ? err.message : "Erreur inconnue";
        const translated = translateEgressError(rawMsg);
        results.push({
          name: dest.name,
          egressId: null,
          error: translated,
          quotaExceeded: /quota d'egress/i.test(translated),
        });
        console.error(`[egress] Failed for ${dest.name}:`, rawMsg);
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
      { error: error instanceof Error ? translateEgressError(error.message) : "Erreur" },
      { status: 500 }
    );
  }
}
