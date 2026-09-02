import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import {
  buildLiveViewerBundle,
  buildLivePublisherBundle,
  advanceLiveProvider,
  ensureHlsEgress,
  liveProvidersHealth,
} from "@/lib/live-media";
import type { MediaProviderName } from "@/lib/call-providers";

/**
 * ⭐ V3.22 — GET /api/live/[id]/stream  (PUBLIC — les viewers du site)
 *
 * Décide COMMENT un viewer regarde le live :
 *   - { mode: "hls",   hls: { urls } }      → mode YouTube : 0 participant
 *     (egress HLS côté serveur, lecteur <video>, zéro room LiveKit) ;
 *   - { mode: "webrtc", livekit: {...} }    → repli si l'egress HLS échoue
 *     (spectateur WebRTC, compté — dégradé volontairement temporaire) ;
 *   - { mode: "agora", agora: {...} }       → LiveKit indisponible : les
 *     viewers regardent Agora en rôle AUDIENCE (reçoivent, n'interagissent
 *     pas) ;
 *   - { mode: "daily", daily: {...} }       → dernier repli.
 *
 * Les viewers POLLent cette route (~12 s) : si le fournisseur change (bascule
 * décidée par le studio, la source du flux), tous les viewers suivent.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const live = await db.liveStream.findUnique({
      where: { id },
      select: { id: true, status: true, livekitRoomName: true },
    });
    if (!live) {
      return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
    }
    if (live.status !== "LIVE") {
      return NextResponse.json({ mode: "off", reason: "Le live n'est pas en cours" });
    }
    if (!live.livekitRoomName) {
      return NextResponse.json({ mode: "off", reason: "Aucune room de diffusion" });
    }
    const bundle = await buildLiveViewerBundle(
      { id: live.id, livekitRoomName: live.livekitRoomName },
      "Visiteur",
    );
    return NextResponse.json(bundle);
  } catch (error) {
    console.error("[live/stream] GET:", error);
    return NextResponse.json({ error: "Erreur stream" }, { status: 500 });
  }
}

/**
 * ⭐ V3.22 — POST /api/live/[id]/stream  (ADMIN studio)
 *
 * Body :
 *   { role: "publisher" }                    → bundle de diffusion du studio
 *     (LiveKit canPublish / Agora host / Daily owner) ;
 *   { action: "failover", from: "livekit" | "agora" | "daily" }
 *                                             → fait AVANCER la chaîne du
 *     live (LiveKit → Agora → Daily) et renvoie le nouveau bundle studio ;
 *   { action: "hls-start" }                   → démarre l'egress HLS dès que
 *     le studio publie (la playlist est prête AVANT l'arrivée des viewers).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Auth admin (même garde que /api/livekit/token publisher studio)
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken || !verifySessionToken(sessionToken)) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    let publisherId = "serviteur";
    try {
      const parts = sessionToken.split(".");
      const data = JSON.parse(Buffer.from(parts[0], "base64url").toString());
      const userParts = String(data.user || "").split(":");
      if (userParts.length >= 2) publisherId = userParts[1];
    } catch { /* garde par défaut */ }

    const { id } = await params;
    const live = await db.liveStream.findUnique({
      where: { id },
      select: { id: true, status: true, livekitRoomName: true },
    });
    if (!live || !live.livekitRoomName) {
      return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));

    // ─── Démarrage anticipé de l'egress HLS (après publication studio) ───
    if (body?.action === "hls-start") {
      try {
        const hls = await ensureHlsEgress(live.livekitRoomName, live.id);
        return NextResponse.json({ success: true, mode: "hls", urls: hls.urls, egressId: hls.egressId });
      } catch (e) {
        return NextResponse.json(
          {
            success: false,
            mode: "webrtc",
            reason: "Egress HLS indisponible (quota ou plan) — les viewers passeront en WebRTC",
            detail: e instanceof Error ? e.message : "erreur",
          },
          { status: 200 },
        );
      }
    }

    // ─── Bascule de chaîne (échec constaté par le studio) ───
    if (body?.action === "failover") {
      const from = body.from as MediaProviderName;
      if (!["livekit", "agora", "daily"].includes(from)) {
        return NextResponse.json({ error: "from invalide" }, { status: 400 });
      }
      const next = await advanceLiveProvider(live.id, from, `studio: échec ${from} sur le live`);
      if (!next) {
        return NextResponse.json({
          provider: null,
          providersHealth: await liveProvidersHealth(),
          error: "Tous les fournisseurs sont épuisés — utilisez le mode Encodeur externe (OBS)",
        });
      }
      const bundle = await buildLivePublisherBundle(
        { id: live.id, livekitRoomName: live.livekitRoomName },
        publisherId,
        "Serviteur",
      );
      return NextResponse.json({ ...bundle, failoverFrom: from });
    }

    // ─── Bundle publisher (défaut) ───
    const bundle = await buildLivePublisherBundle(
      { id: live.id, livekitRoomName: live.livekitRoomName },
      publisherId,
      "Serviteur",
    );
    return NextResponse.json(bundle);
  } catch (error) {
    console.error("[live/stream] POST:", error);
    return NextResponse.json({ error: "Erreur stream" }, { status: 500 });
  }
}
