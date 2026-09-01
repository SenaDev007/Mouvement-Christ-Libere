import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { ensureCallSignalTable, ensureUserBlockTable } from "@/lib/ensure-schema";

/**
 * ⭐ V3.1 — SIGNALISATION DES APPELS AUDIO/VIDÉO Yeshua Connect.
 *
 * AVANT la V3.1 : l'appelant rejoignait une room LiveKit `yeshua-call-<convId>`
 * et entendait sa propre sonnerie — mais AUCUN signal n'alertait les autres
 * membres. Résultat : « ça sonne mais l'appel ne vient pas au niveau de
 * l'utilisateur, sur PC ni smartphone ». Ce route comble ce trou.
 *
 *   POST { action: "start", conversationId, type: "audio"|"video" }
 *        → crée un signal "ringing" (annule les anciens signaux ringings du
 *          canal) + renvoie le contexte (nom du canal, photo, appelant).
 *          Appelé par le bouton 📞/🎥 du header de conversation.
 *
 *   POST { action: "accept", callId }
 *        → un destinataire décroche : status "accepted" + acceptedAt.
 *
 *   POST { action: "decline", callId }
 *        → refuse. En DIRECT : termine l'appel (status "declined" + journal).
 *          En canal/groupe : le signal continue de sonner pour les autres
 *          (comme WhatsApp en appel de groupe) ; le refus est purement local.
 *
 *   POST { action: "end", callId }
 *        → raccroche (appelant ou participant accepté) :
 *          ringing → "cancelled" (journal « Appel annulé »),
 *          accepted → "ended" + durée (journal « Appel terminé · 3 min 12 s »).
 *
 *   GET ?incoming=1  (polling 3 s par chaque membre connecté)
 *        → appels qui sonnent POUR MOI (membre, non-initiateur) avec la
 *          PHOTO du canal + le nom/photo de l'appelant. Balayage « manqué » :
 *          tout signal ringing de plus de 45 s devient "missed" + journal
 *          « Appel manqué » dans le chat.
 *
 *   GET ?callId=x    (polling 2 s par les parties en cours d'appel)
 *        → { status, duration } pour refléter refusé / manqué / terminé
 *          à distance (l'autre a raccroché).
 *
 * ⭐ Journaux d'appel : chaque issue (manqué / refusé / annulé / terminé
 *   avec durée) est insérée comme message type CALL_LOG dans la conversation
 *   — demande explicite : « il faut que ça s'affiche dans le chat qu'il y a
 *   eu appel manqué ou un appel qui a duré tel nombre de minutes ».
 *   - content  = texte lisible (aperçu de la sidebar) ;
 *   - verseRef = JSON structuré { callType, status, durationSec, byName }
 *     (colonne recyclée pour éviter une migration — jamais utilisée hors VERSE).
 *
 * 🔒 Authentification NextAuth requise partout ; membership vérifié.
 */

/** Rôles site pouvant appeler/lire tous les canaux (modération). */
const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);

type CallMeta = {
  callType: "audio" | "video";
  status: "missed" | "declined" | "cancelled" | "ended";
  durationSec?: number;
  byName: string;
};

/** 192 s → « 3 min 12 s » ; 45 s → « 45 s » ; 3700 s → « 1 h 1 min ». */
function formatDurationFr(sec: number): string {
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s > 0 ? `${m} min ${s} s` : `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

/** Insère le message CALL_LOG dans la conversation (SQL brut : l'enum
 *  Prisma client de prod ne connaît pas encore CALL_LOG au premier déploiement). */
async function insertCallLogMessage(
  conversationId: string,
  initiatorId: string,
  meta: CallMeta,
): Promise<void> {
  const typeLabel = meta.callType === "video" ? "Appel vidéo" : "Appel audio";
  let text: string;
  switch (meta.status) {
    case "missed": text = `${typeLabel} manqué`; break;
    case "declined": text = `${typeLabel} refusé`; break;
    case "cancelled": text = `${typeLabel} annulé`; break;
    default: text = `${typeLabel} terminé · ${formatDurationFr(meta.durationSec ?? 0)}`;
  }
  await db.$executeRawUnsafe(
    `INSERT INTO "Message" ("id", "channelId", "userId", "content", "type", "verseRef", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, 'CALL_LOG', $5, now(), now())`,
    randomUUID(), conversationId, initiatorId, text, JSON.stringify(meta),
  );
}

/** Marque « manqués » tous les signaux ringing expirés (+ journal d'appel). */
async function sweepMissedCalls(): Promise<void> {
  const stale = await db.$queryRawUnsafe<Array<{ id: string; conversationId: string; initiatorId: string; type: string; initiatorName: string | null }>>(
    `SELECT s."id", s."conversationId", s."initiatorId", s."type", u."name" AS "initiatorName"
     FROM "CallSignal" s LEFT JOIN "User" u ON u."id" = s."initiatorId"
     WHERE s."status" = 'ringing' AND s."createdAt" < now() - interval '45 seconds'`,
  );
  for (const s of stale) {
    const updated = await db.$executeRawUnsafe(
      `UPDATE "CallSignal" SET "status" = 'missed', "endedAt" = now()
       WHERE "id" = $1 AND "status" = 'ringing'`,
      s.id,
    );
    if (updated > 0) {
      await insertCallLogMessage(s.conversationId, s.initiatorId, {
        callType: s.type === "video" ? "video" : "audio",
        status: "missed",
        byName: s.initiatorName || "Membre",
      }).catch((e) => console.error("[calls/signal] log missed:", e));
    }
  }
}

/** L'utilisateur est-il membre du canal (ou rôle privilégié) ? */
async function isMemberOrPrivileged(conversationId: string, userId: string, userRole?: string | null): Promise<boolean> {
  if (PRIVILEGED_ROLES.has(userRole || "")) return true;
  const m = await db.channelMember.findUnique({
    where: { channelId_userId: { channelId: conversationId, userId } },
    select: { role: true },
  });
  return !!m;
}

// ═════════════════════════════════════════════════════════════════════
//  GET — polling : appels entrants POUR MOI + statut d'un appel en cours
// ═════════════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const userId = session.user.id;
    await ensureCallSignalTable();

    const url = new URL(req.url);
    const callId = url.searchParams.get("callId");

    // ─── Statut d'un appel précis (appelant / participants en cours) ──
    if (callId) {
      const rows = await db.$queryRawUnsafe<Array<{
        status: string; initiatorId: string; conversationId: string; type: string;
        acceptedAt: Date | null; endedAt: Date | null;
      }>>(
        `SELECT "status", "initiatorId", "conversationId", "type", "acceptedAt", "endedAt"
         FROM "CallSignal" WHERE "id" = $1`,
        callId,
      );
      if (!rows.length) {
        return NextResponse.json({ error: "Appel introuvable" }, { status: 404 });
      }
      const row = rows[0];
      if (row.initiatorId !== userId) {
        const member = await isMemberOrPrivileged(row.conversationId, userId, (session.user as { role?: string | null }).role);
        if (!member) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
      // Balayage « manqué » pour CE signal s'il sonne depuis trop longtemps.
      if (row.status === "ringing") {
        await sweepMissedCalls();
        const fresh = await db.$queryRawUnsafe<Array<{ status: string }>>(
          `SELECT "status" FROM "CallSignal" WHERE "id" = $1`, callId,
        );
        if (fresh.length) row.status = fresh[0].status;
      }
      let duration: number | null = null;
      if (row.status === "ended" && row.acceptedAt && row.endedAt) {
        duration = Math.max(0, Math.round((new Date(row.endedAt).getTime() - new Date(row.acceptedAt).getTime()) / 1000));
      }
      return NextResponse.json({ status: row.status, duration, type: row.type });
    }

    // ─── Appels entrants qui sonnent pour moi ─────────────────────────
    await sweepMissedCalls();
    const incoming = await db.$queryRawUnsafe<Array<{
      callId: string; conversationId: string; callType: string; createdAt: Date;
      convName: string | null; convAvatarUrl: string | null; convType: string | null;
      initiatorId: string; initiatorName: string | null; initiatorAvatarUrl: string | null;
    }>>(
      `SELECT s."id" AS "callId", s."conversationId", s."type" AS "callType", s."createdAt",
              c."name" AS "convName", c."avatarUrl" AS "convAvatarUrl", c."type" AS "convType",
              s."initiatorId", u."name" AS "initiatorName", u."avatarUrl" AS "initiatorAvatarUrl"
       FROM "CallSignal" s
       JOIN "Channel" c ON c."id" = s."conversationId"
       LEFT JOIN "User" u ON u."id" = s."initiatorId"
       WHERE s."status" = 'ringing'
         AND s."initiatorId" <> $1
         AND EXISTS (
           SELECT 1 FROM "ChannelMember" m
           WHERE m."channelId" = s."conversationId" AND m."userId" = $1
         )
       ORDER BY s."createdAt" DESC
       LIMIT 5`,
      userId,
    );

    return NextResponse.json({
      incoming: incoming.map((c) => ({
        callId: c.callId,
        conversationId: c.conversationId,
        convName: c.convName || "Conversation",
        convAvatarUrl: c.convAvatarUrl || undefined,
        convType: c.convType || "CHANNEL",
        callType: c.callType === "video" ? "video" : "audio",
        initiatorId: c.initiatorId,
        initiatorName: c.initiatorName || "Membre",
        initiatorAvatarUrl: c.initiatorAvatarUrl || undefined,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    console.error("[calls/signal GET] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// ═════════════════════════════════════════════════════════════════════
//  POST — start / accept / decline / end
// ═════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const userId = session.user.id;
    // ( rôle parfois absent du typage NextAuth — cast, même pattern que voice-mode )
    const userRole = (session.user as { role?: string | null }).role;
    await ensureCallSignalTable();

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    // ─── START : je lance un appel dans une conversation ─────────────
    if (action === "start") {
      const conversationId: string | undefined = body?.conversationId;
      const type: string = body?.type === "video" ? "video" : "audio";
      if (!conversationId) {
        return NextResponse.json({ error: "conversationId requis" }, { status: 400 });
      }
      const member = await isMemberOrPrivileged(conversationId, userId, userRole);
      if (!member) {
        return NextResponse.json({ error: "Vous n'êtes pas membre de cette conversation" }, { status: 403 });
      }

      // ─── 🔒 V3.5 — Blocage : un appel PRIVÉ (conversation à 2 personnes)
      // ne doit pas SONNER chez un membre qui vous a bloqué (et vous ne
      // pouvez pas appeler quelqu'un que VOUS avez bloqué). Les appels de
      // canal/groupe (3+ membres) ne sont pas concernés.
      const callConvMembers = await db.channelMember.findMany({
        where: { channelId: conversationId },
        select: { userId: true },
        take: 3,
      });
      if (callConvMembers.length === 2) {
        const otherMember = callConvMembers.find((m) => m.userId !== userId);
        if (otherMember) {
          await ensureUserBlockTable();
          const blockRows = await db.$queryRawUnsafe<Array<{ blockerId: string }>>(
            `SELECT "blockerId" FROM "UserBlock"
             WHERE ("blockerId" = $1 AND "blockedId" = $2)
                OR ("blockerId" = $2 AND "blockedId" = $1)`,
            userId, otherMember.userId,
          );
          if (blockRows.length > 0) {
            return NextResponse.json(
              { error: "Impossible d'appeler ce membre en privé" },
              { status: 403 },
            );
          }
        }
      }

      const callId = randomUUID();
      // Remplace tout signal ringing antérieur du même canal (un seul
      // appel simultané par conversation — évite les sonneries fantômes).
      await db.$executeRawUnsafe(
        `UPDATE "CallSignal" SET "status" = 'cancelled', "endedAt" = now()
         WHERE "conversationId" = $1 AND "status" = 'ringing' AND "id" <> $2`,
        conversationId, callId,
      );
      await db.$executeRawUnsafe(
        `INSERT INTO "CallSignal" ("id", "conversationId", "initiatorId", "type", "status", "createdAt")
         VALUES ($1, $2, $3, $4, 'ringing', now())`,
        callId, conversationId, userId, type,
      );
      const conv = await db.channel.findUnique({
        where: { id: conversationId },
        select: { name: true, avatarUrl: true, type: true },
      });
      return NextResponse.json({
        callId,
        conversation: conv
          ? { name: conv.name, avatarUrl: conv.avatarUrl ?? undefined, type: conv.type }
          : null,
      });
    }

    // ─── ACCEPT / DECLINE / END : agissent sur un signal existant ────
    const callId: string | undefined = body?.callId;
    if (!callId) {
      return NextResponse.json({ error: "callId requis" }, { status: 400 });
    }
    const rows = await db.$queryRawUnsafe<Array<{
      status: string; initiatorId: string; conversationId: string; type: string;
      convType: string | null; acceptedAt: Date | null; initiatorName: string | null;
    }>>(
      `SELECT s."status", s."initiatorId", s."conversationId", s."type",
              s."acceptedAt", c."type" AS "convType", u."name" AS "initiatorName"
       FROM "CallSignal" s
       LEFT JOIN "Channel" c ON c."id" = s."conversationId"
       LEFT JOIN "User" u ON u."id" = s."initiatorId"
       WHERE s."id" = $1`,
      callId,
    );
    if (!rows.length) {
      return NextResponse.json({ error: "Appel introuvable" }, { status: 404 });
    }
    const call = rows[0];
    const member = await isMemberOrPrivileged(call.conversationId, userId, userRole);
    if (!member) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    const callType = call.type === "video" ? "video" : "audio";
    const byName = call.initiatorName || "Membre";

    if (action === "accept") {
      if (call.initiatorId === userId) {
        return NextResponse.json({ error: "Vous êtes l'appelant" }, { status: 400 });
      }
      if (call.status === "ringing") {
        await db.$executeRawUnsafe(
          `UPDATE "CallSignal" SET "status" = 'accepted', "acceptedAt" = now() WHERE "id" = $1`,
          callId,
        );
      }
      return NextResponse.json({ ok: true, status: "accepted" });
    }

    if (action === "decline") {
      if (call.initiatorId === userId) {
        return NextResponse.json({ error: "Vous êtes l'appelant" }, { status: 400 });
      }
      // En conversation DIRECT, un refus termine l'appel pour tout le monde.
      // En canal/groupe, l'appel continue de sonner pour les autres membres.
      if (call.convType === "DIRECT" && call.status === "ringing") {
        await db.$executeRawUnsafe(
          `UPDATE "CallSignal" SET "status" = 'declined', "endedAt" = now() WHERE "id" = $1`,
          callId,
        );
        await insertCallLogMessage(call.conversationId, call.initiatorId, {
          callType, status: "declined", byName,
        }).catch((e) => console.error("[calls/signal] log declined:", e));
        return NextResponse.json({ ok: true, status: "declined" });
      }
      return NextResponse.json({ ok: true, status: call.status, groupIgnored: call.convType !== "DIRECT" });
    }

    if (action === "end") {
      const isInitiator = call.initiatorId === userId;
      // Raccrocher un appel accepté : initiateur OU participant (membre).
      if (call.status !== "accepted" && !isInitiator) {
        return NextResponse.json({ error: "Seul l'appelant peut annuler l'appel" }, { status: 403 });
      }
      if (call.status === "ringing") {
        await db.$executeRawUnsafe(
          `UPDATE "CallSignal" SET "status" = 'cancelled', "endedAt" = now() WHERE "id" = $1`,
          callId,
        );
        await insertCallLogMessage(call.conversationId, call.initiatorId, {
          callType, status: "cancelled", byName,
        }).catch((e) => console.error("[calls/signal] log cancelled:", e));
        return NextResponse.json({ ok: true, status: "cancelled" });
      }
      if (call.status === "accepted") {
        await db.$executeRawUnsafe(
          `UPDATE "CallSignal" SET "status" = 'ended', "endedAt" = now() WHERE "id" = $1`,
          callId,
        );
        const fresh = await db.$queryRawUnsafe<Array<{ acceptedAt: Date | null; endedAt: Date | null }>>(
          `SELECT "acceptedAt", "endedAt" FROM "CallSignal" WHERE "id" = $1`, callId,
        );
        const acceptedAt = fresh[0]?.acceptedAt ? new Date(fresh[0].acceptedAt).getTime() : null;
        const endedAt = fresh[0]?.endedAt ? new Date(fresh[0].endedAt).getTime() : Date.now();
        const durationSec = acceptedAt ? Math.max(0, Math.round((endedAt - acceptedAt) / 1000)) : 0;
        await insertCallLogMessage(call.conversationId, call.initiatorId, {
          callType, status: "ended", durationSec, byName,
        }).catch((e) => console.error("[calls/signal] log ended:", e));
        return NextResponse.json({ ok: true, status: "ended", durationSec });
      }
      // Déjà terminal (missed/declined/ended/cancelled) → idempotent.
      return NextResponse.json({ ok: true, status: call.status });
    }

    return NextResponse.json({ error: "action inconnue" }, { status: 400 });
  } catch (error) {
    console.error("[calls/signal POST] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
