import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { ensureCallSignalTable, ensureChannelIsDirectColumn, ensureWebRTCSignalTable } from "@/lib/ensure-schema";

/**
 * ⭐ V3.19 — SIGNALISATION WEBRTC DES APPELS P2P DE SECOURS (Plan C).
 * ============================================================================
 * Si LiveKit (Cloud ou auto-hébergé) est indisponible, les appels DIRECT 1-1
 * basculent en WebRTC peer-to-peer : le média (audio/vidéo) voyage DIRECTEMENT
 * entre les deux navigateurs, sans serveur multimédia. Cette route transporte
 * uniquement la signalisation d'établissement :
 *
 *   POST { callId, type: "offer" | "answer" | "ice", payload }
 *        → l'appelant poste l'offre SDP ; le destinataire poste la réponse ;
 *          les DEUX postent leurs candidats ICE (trickle).
 *
 *   GET ?callId=x
 *        → les signaux de l'appel émis PAR L'AUTRE (fromUserId ≠ moi),
 *          ordonnés du plus ancien au plus récent — chaque côté découvre
 *          l'offre / la réponse / les ICE de l'autre via le polling existant.
 *
 * La sonnerie reste portée par CallSignal (V3.1) : le destinataire voit
 * « appel entrant » AVANT toute signalisation P2P — l'offre n'est lue qu'au
 * moment de décrocher (ou après l'échec LiveKit côté appelant).
 *
 * Purge : les lignes de plus de 5 minutes sont supprimées au passage (la
 * signalisation n'a plus de sens après la fin de l'appel) — table volante,
 * même philosophie que CallSignal.
 *
 * Sécurité : NextAuth requise ; il faut être l'initiateur de l'appel OU
 * membre de la conversation (comme /calls/signal). Payload bornée (200 Ko).
 */

const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);

/** L'utilisateur est-il l'initiateur OU membre du canal de l'appel ? */
async function canAccessCall(callId: string, userId: string, userRole?: string | null): Promise<{ ok: boolean; conversationId?: string }> {
  const rows = await db.$queryRawUnsafe<Array<{ initiatorId: string; conversationId: string }>>(
    `SELECT "initiatorId", "conversationId" FROM "CallSignal" WHERE "id" = $1`,
    callId,
  );
  if (!rows.length) return { ok: false };
  const { initiatorId, conversationId } = rows[0];
  if (initiatorId === userId) return { ok: true, conversationId };
  // ⭐ V3.20 — CONFIDENTIALITÉ DES PRIVÉS : la signalisation WebRTC d'un
  // appel PRIVÉ (isDirect) est réservée à l'initiateur et aux 2 membres —
  // le bypass « rôles privilégiés » ne s'applique pas (directive du
  // pasteur : même les admins ne touchent pas les privés d'autrui).
  await ensureChannelIsDirectColumn();
  const conv = await db.channel.findUnique({
    where: { id: conversationId },
    select: { isDirect: true },
  });
  if (conv?.isDirect) {
    const dm = await db.channelMember.findUnique({
      where: { channelId_userId: { channelId: conversationId, userId } },
      select: { role: true },
    });
    return dm ? { ok: true, conversationId } : { ok: false, conversationId };
  }
  if (PRIVILEGED_ROLES.has(userRole || "")) return { ok: true, conversationId };
  const m = await db.channelMember.findUnique({
    where: { channelId_userId: { channelId: conversationId, userId } },
    select: { role: true },
  });
  if (m) return { ok: true, conversationId };
  return { ok: false, conversationId };
}

/** Purge best-effort des signaux de plus de 5 minutes. */
async function purgeOldSignals(): Promise<void> {
  try {
    await db.$executeRawUnsafe(
      `DELETE FROM "WebRTCSignal" WHERE "createdAt" < now() - interval '5 minutes'`
    );
  } catch {
    // best effort — pas bloquant
  }
}

interface PostBody {
  callId?: string;
  type?: string;
  payload?: unknown;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const userId = session.user.id;
    await ensureCallSignalTable();
    await ensureWebRTCSignalTable();

    const body: PostBody = await req.json();
    const { callId, type, payload } = body;

    if (!callId || !type) {
      return NextResponse.json({ error: "callId et type requis" }, { status: 400 });
    }
    if (type !== "offer" && type !== "answer" && type !== "ice") {
      return NextResponse.json({ error: "type invalide (offer | answer | ice)" }, { status: 400 });
    }
    if (payload === undefined || payload === null) {
      return NextResponse.json({ error: "payload requis" }, { status: 400 });
    }
    const serialized = JSON.stringify(payload);
    if (serialized.length > 200_000) {
      return NextResponse.json({ error: "payload trop volumineux" }, { status: 413 });
    }

    const access = await canAccessCall(callId, userId, (session.user as { role?: string | null }).role);
    if (!access.ok) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    await purgeOldSignals();

    await db.$executeRawUnsafe(
      `INSERT INTO "WebRTCSignal" ("id", "callId", "fromUserId", "type", "payload", "createdAt")
       VALUES ($1, $2, $3, $4, $5::jsonb, now())`,
      randomUUID(), callId, userId, type, serialized,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[calls/webrtc POST] Error:", error);
    return NextResponse.json({ error: "Erreur signalisation" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const userId = session.user.id;
    await ensureCallSignalTable();
    await ensureWebRTCSignalTable();

    const callId = new URL(req.url).searchParams.get("callId");
    if (!callId) {
      return NextResponse.json({ error: "callId requis" }, { status: 400 });
    }

    const access = await canAccessCall(callId, userId, (session.user as { role?: string | null }).role);
    if (!access.ok) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Les signaux de L'AUTRE (jamais les miens), du plus ancien au plus récent
    // (l'offre doit être appliquée avant les ICE qui l'accompagnent).
    const rows = await db.$queryRawUnsafe<Array<{ id: string; type: string; payload: unknown; createdAt: Date }>>(
      `SELECT "id", "type", "payload", "createdAt"
       FROM "WebRTCSignal"
       WHERE "callId" = $1 AND "fromUserId" <> $2
       ORDER BY "createdAt" ASC
       LIMIT 200`,
      callId, userId,
    );

    return NextResponse.json({
      signals: rows.map((r) => ({
        id: r.id,
        type: r.type,
        payload: r.payload,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error("[calls/webrtc GET] Error:", error);
    return NextResponse.json({ error: "Erreur signalisation" }, { status: 500 });
  }
}
