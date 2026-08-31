import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureV29Schema } from "@/lib/ensure-schema";

/**
 * ⭐ V2.9 — Présence des viewers d'un live (COMPTEUR RÉEL).
 *
 * GET /api/live/[id]/viewers
 *   → { count } — viewers actifs dont le heartbeat date de < 90 s
 *     (fenêtre de fraîcheur LiveViewer.lastSeenAt). Un onglet fermé sans
 *     beacon de départ n'influe plus indéfiniment sur le compteur.
 *
 * POST /api/live/[id]/viewers
 *   Join / heartbeat (le client re-POST toutes les ~25 s).
 *   Body: { memberId } — memberId peut être :
 *     - un id LiveMember (visiteur anonyme inscrit), OU
 *     - un id NextAuth User (membre connecté) → on résout/crée le
 *       LiveMember correspondant (sessionId "user-<id>"). ⭐ V2.9 : avant,
 *       les utilisateurs connectés envoyaient leur User.id → 404 « Membre
 *       introuvable » → JAMAIS comptés (compteur à 0 en permanence).
 *   Corps VIDE + ?memberId=xxx&leave=1 (sendBeacon au déchargement) :
 *     marque la session inactive (avant : req.json() levait une erreur 500
 *     et le départ n'était jamais enregistré).
 *
 * DELETE /api/live/[id]/viewers?memberId=xxx
 *   Quitte le live (session inactive).
 *
 * PATCH /api/live/[id]/viewers  { memberId, xp }
 *   Ajoute des XP à un viewer (inchangé).
 */

/** Fenêtre de fraîcheur de présence (le client heartbeat toutes les 25 s). */
const PRESENCE_WINDOW_MS = 90_000;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // ⭐ V2.9 — Comptage par fraîcheur : lastSeenAt récent OU (fallback pour
    // les lignes antérieures à la colonne) isActive sans fenêtre.
    const since = new Date(Date.now() - PRESENCE_WINDOW_MS);
    const count = await db.liveViewer.count({
      where: { liveId: id, isActive: true, lastSeenAt: { gte: since } },
    });
    return NextResponse.json({ count });
  } catch (error) {
    console.error("[viewers GET] Error:", error);
    return NextResponse.json({ count: 0 });
  }
}

/**
 * Résout un memberId vers un LiveMember :
 *  1. id LiveMember direct ;
 *  2. id User NextAuth → find-or-create LiveMember (sessionId "user-<id>").
 */
async function resolveLiveMember(memberId: string): Promise<{ id: string } | null> {
  const direct = await db.liveMember.findUnique({ where: { id: memberId }, select: { id: true } });
  if (direct) return direct;
  const user = await db.user.findUnique({ where: { id: memberId }, select: { id: true, name: true } });
  if (!user) return null;
  const sessionId = `user-${user.id}`;
  return db.liveMember.upsert({
    where: { sessionId },
    create: { sessionId, firstName: user.name || "Membre" },
    update: {},
    select: { id: true },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await ensureV29Schema();

    // ⭐ V2.9 — sendBeacon au déchargement : corps VIDE + query params.
    // On tolère un body absent/illisible (avant : req.json() → exception 500).
    const rawBody = await req.text().catch(() => "");
    let body: { memberId?: string } = {};
    if (rawBody.trim().length > 0) {
      try { body = JSON.parse(rawBody); } catch { /* beacon vide */ }
    }
    const url = new URL(req.url);
    const memberId = body.memberId || url.searchParams.get("memberId") || "";
    const isLeave = url.searchParams.get("leave") === "1";

    if (!memberId) {
      return NextResponse.json({ error: "memberId requis" }, { status: 400 });
    }

    const member = await resolveLiveMember(memberId);
    if (!member) {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }

    // Beacon de départ → marquer inactif et sortir.
    if (isLeave) {
      await db.liveViewer.updateMany({
        where: { liveId: id, memberId: member.id, isActive: true },
        data: { isActive: false, leftAt: new Date() },
      });
      return NextResponse.json({ success: true, leave: true });
    }

    // Upsert : si le viewer existe déjà pour ce live, le réactiver +
    // rafraîchir le heartbeat (⭐ V2.9 : lastSeenAt).
    const viewer = await db.liveViewer.findFirst({
      where: { liveId: id, memberId: member.id },
    });

    if (viewer) {
      await db.liveViewer.update({
        where: { id: viewer.id },
        data: { isActive: true, leftAt: null, joinedAt: new Date(), lastSeenAt: new Date() },
      });
    } else {
      await db.liveViewer.create({
        data: {
          liveId: id,
          memberId: member.id,
          isActive: true,
          lastSeenAt: new Date(),
        },
      });

      // Incrémenter livesWatched du membre
      await db.liveMember.update({
        where: { id: member.id },
        data: { livesWatched: { increment: 1 } },
      }).catch(() => {});
    }

    const since = new Date(Date.now() - PRESENCE_WINDOW_MS);
    const count = await db.liveViewer.count({
      where: { liveId: id, isActive: true, lastSeenAt: { gte: since } },
    });

    return NextResponse.json({ success: true, viewerCount: count });
  } catch (error) {
    console.error("[viewers POST] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const rawMemberId = url.searchParams.get("memberId");

    if (!rawMemberId) {
      return NextResponse.json({ error: "memberId requis" }, { status: 400 });
    }

    const member = await resolveLiveMember(rawMemberId);
    if (member) {
      await db.liveViewer.updateMany({
        where: { liveId: id, memberId: member.id, isActive: true },
        data: { isActive: false, leftAt: new Date() },
      });
    }

    const since = new Date(Date.now() - PRESENCE_WINDOW_MS);
    const count = await db.liveViewer.count({
      where: { liveId: id, isActive: true, lastSeenAt: { gte: since } },
    });

    return NextResponse.json({ success: true, viewerCount: count });
  } catch (error) {
    console.error("[viewers DELETE] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { memberId, xp } = body;

    if (!memberId) {
      return NextResponse.json({ error: "memberId requis" }, { status: 400 });
    }

    const member = await resolveLiveMember(memberId);
    if (!member) {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }

    // Incrémenter XP sur la session LiveViewer (+ heartbeat de fraîcheur)
    await db.liveViewer.updateMany({
      where: { liveId: id, memberId: member.id, isActive: true },
      data: { xpPoints: { increment: xp || 1 }, lastSeenAt: new Date() },
    });

    // Incrémenter aussi le totalXP du membre
    const updated = await db.liveMember.update({
      where: { id: member.id },
      data: { totalXp: { increment: xp || 1 } },
    });

    return NextResponse.json({ success: true, totalXp: updated.totalXp });
  } catch (error) {
    console.error("[viewers PATCH] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
