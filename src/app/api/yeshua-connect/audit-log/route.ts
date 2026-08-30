import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

/** Rôles autorisés à consulter l'audit log (modération). */
const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);

/**
 * GET /api/yeshua-connect/audit-log?channelId=xxx&limit=100
 *
 * Récupère les entrées d'audit log pour un canal (ou tous si pas de channelId).
 *
 * - 🔒 Authentification NextAuth requise.
 * - 🔒 Réservé aux rôles SUPER_ADMIN / ADMIN / MODERATOR.
 *
 * Response: Array<{
 *   id, action, userId, targetId?, channelId?, metadata?, createdAt,
 *   user?: { id, name, avatarUrl, role }
 * }>
 */
export async function GET(req: NextRequest) {
  try {
    // 🔒 Authentification NextAuth
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const userRole = session.user.role;

    // 🔒 Seuls les rôles privilégiés peuvent consulter l'audit log
    if (!PRIVILEGED_ROLES.has(userRole || "")) {
      return NextResponse.json(
        { error: "Accès refusé — rôle modérateur requis" },
        { status: 403 },
      );
    }

    const url = new URL(req.url);
    const channelId = url.searchParams.get("channelId");
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "100", 10),
      500,
    );

    const entries = await db.auditLog.findMany({
      where: channelId ? { channelId } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true, role: true },
        },
      },
    });

    const formatted = entries.map((e) => ({
      id: e.id,
      action: e.action,
      userId: e.userId,
      targetId: e.targetId ?? undefined,
      channelId: e.channelId ?? undefined,
      metadata: e.metadata ?? undefined,
      createdAt: e.createdAt.toISOString(),
      user: e.user
        ? {
            id: e.user.id,
            name: e.user.name ?? "Membre",
            avatarUrl: e.user.avatarUrl ?? undefined,
            role: e.user.role,
          }
        : undefined,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("[yeshua-connect/audit-log] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'audit log" },
      { status: 500 },
    );
  }
}
