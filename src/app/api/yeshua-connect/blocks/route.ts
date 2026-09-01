import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { ensureUserBlockTable } from "@/lib/ensure-schema";

/**
 * ⭐ V3.5 — Blocage des membres (sécurité des conversations PRIVÉES).
 *
 * Une ligne UserBlock = « moi → membre bloqué ». Effets (tous côté
 * serveur, vérifiés à CHAQUE requête) :
 *   • POST /conversations/dm        → 403 si blocage dans un sens ou l'autre ;
 *   • envoi de message dans un privé (canal 2 personnes) → 403 ;
 *   • démarrage d'appel (CallSignal start) sur un privé → 403 ;
 *   • les canaux/groupe communs restent OUVERTS (on bloque la personne,
 *     pas la communauté — comme Telegram).
 *
 * Routes :
 *   GET    ?includeBlockedMe=1  → membres que J'AI bloqués (+, optionnel,
 *                                liste d'ids qui m'ont bloqué, pour griser
 *                                discrètement les actions sans révéler qui)
 *   POST   { targetUserId }     → bloque (idempotent)
 *   DELETE ?targetUserId=…      → débloque (idempotent)
 *
 * - 🔒 Authentification NextAuth requise.
 * - 🔒 On ne peut pas se bloquer soi-même.
 * - Audit log : BLOCK_USER / UNBLOCK_USER (modération transparente).
 */

/** Bloque dans UN sens donné ; idempotent (ON CONFLICT DO NOTHING). */
async function blockUser(meId: string, targetId: string) {
  await db.$executeRawUnsafe(
    `INSERT INTO "UserBlock" ("id", "blockerId", "blockedId")
     VALUES (gen_random_uuid()::text, $1, $2)
     ON CONFLICT ("blockerId", "blockedId") DO NOTHING`,
    meId, targetId,
  );
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const meId = session.user.id;
    await ensureUserBlockTable();

    const includeBlockedMe = req.nextUrl.searchParams.get("includeBlockedMe");

    // Membres que j'ai bloqués (fiche complète pour l'interface).
    const iBlocked = await db.$queryRawUnsafe<Array<{
      userId: string; name: string | null; avatarUrl: string | null; blockedAt: Date;
    }>>(`
      SELECT u."id" AS "userId", u."name", u."avatarUrl", b."createdAt" AS "blockedAt"
      FROM "UserBlock" b
      JOIN "User" u ON u."id" = b."blockedId"
      WHERE b."blockerId" = $1
      ORDER BY b."createdAt" DESC
    `, meId);

    // (Optionnel) ids des membres qui m'ont bloqué — utilisé pour griser
    // discrètement les actions « message privé » SANS révéler qui a bloqué.
    let blockedMeIds: string[] = [];
    if (includeBlockedMe) {
      const rows = await db.$queryRawUnsafe<Array<{ blockerId: string }>>(
        `SELECT "blockerId" FROM "UserBlock" WHERE "blockedId" = $1`,
        meId,
      );
      blockedMeIds = rows.map((r) => r.blockerId);
    }

    return NextResponse.json({
      blocked: iBlocked.map((r) => ({
        userId: r.userId,
        name: r.name ?? "Membre",
        avatarUrl: r.avatarUrl ?? undefined,
        blockedAt: new Date(r.blockedAt).toISOString(),
      })),
      blockedMeIds,
    });
  } catch (error) {
    console.error("[yeshua-connect/blocks GET] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des blocages" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const meId = session.user.id;
    await ensureUserBlockTable();

    const { targetUserId } = await req.json();
    if (!targetUserId || typeof targetUserId !== "string") {
      return NextResponse.json({ error: "targetUserId requis" }, { status: 400 });
    }
    if (targetUserId === meId) {
      return NextResponse.json({ error: "Impossible de se bloquer soi-même" }, { status: 400 });
    }

    const target = await db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }

    await blockUser(meId, targetUserId);

    try {
      await db.auditLog.create({
        data: {
          action: "BLOCK_USER",
          userId: meId,
          targetId: targetUserId,
          metadata: { targetName: target.name ?? null },
        },
      });
    } catch (e) {
      console.error("[audit-log/block-user] Error:", e);
    }

    return NextResponse.json({ ok: true, blocked: true });
  } catch (error) {
    console.error("[yeshua-connect/blocks POST] Error:", error);
    return NextResponse.json({ error: "Erreur lors du blocage" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const meId = session.user.id;
    await ensureUserBlockTable();

    // targetUserId : query param (fetch DELETE sans body) OU body JSON.
    let targetUserId: string | undefined =
      req.nextUrl.searchParams.get("targetUserId") ?? undefined;
    if (!targetUserId) {
      try {
        const body = await req.json();
        targetUserId = body?.targetUserId;
      } catch {
        // pas de body — l'erreur 400 ci-dessous s'applique
      }
    }
    if (!targetUserId || typeof targetUserId !== "string") {
      return NextResponse.json({ error: "targetUserId requis" }, { status: 400 });
    }

    await db.$executeRawUnsafe(
      `DELETE FROM "UserBlock" WHERE "blockerId" = $1 AND "blockedId" = $2`,
      meId, targetUserId,
    );

    try {
      await db.auditLog.create({
        data: {
          action: "UNBLOCK_USER",
          userId: meId,
          targetId: targetUserId,
          metadata: {},
        },
      });
    } catch (e) {
      console.error("[audit-log/unblock-user] Error:", e);
    }

    return NextResponse.json({ ok: true, blocked: false });
  } catch (error) {
    console.error("[yeshua-connect/blocks DELETE] Error:", error);
    return NextResponse.json({ error: "Erreur lors du déblocage" }, { status: 500 });
  }
}
