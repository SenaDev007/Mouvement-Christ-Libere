import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

/**
 * POST /api/yeshua-connect/polls/[id]/vote
 * Vote pour une option d'un sondage.
 * Body: { optionId }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const { id: pollId } = await params;
    const { optionId } = await req.json();
    if (!optionId) {
      return NextResponse.json({ error: "optionId requis" }, { status: 400 });
    }
    // Vérifier que l'option appartient bien au poll
    const option = await db.pollOption.findFirst({
      where: { id: optionId, pollId },
    });
    if (!option) {
      return NextResponse.json({ error: "Option invalide" }, { status: 404 });
    }
    // Vérifier si multi-vote autorisé
    const poll = await db.poll.findUnique({ where: { id: pollId }, include: { options: { include: { votes: true } } } });
    if (!poll) {
      return NextResponse.json({ error: "Sondage introuvable" }, { status: 404 });
    }
    if (!poll.isMulti) {
      // Supprimer les votes existants de cet user sur ce poll
      const optionIds = poll.options.map(o => o.id);
      await db.pollVote.deleteMany({
        where: { pollOptionId: { in: optionIds }, userId: session.user.id },
      });
    }
    // Créer le vote (ou ignorer si déjà voté)
    try {
      await db.pollVote.create({
        data: { pollOptionId: optionId, userId: session.user.id },
      });
    } catch {
      // déjà voté pour cette option — ignorer
    }
    // Retourner le poll mis à jour
    const updated = await db.poll.findUnique({
      where: { id: pollId },
      include: { options: { include: { votes: true } } },
    });
    return NextResponse.json({ success: true, poll: updated });
  } catch (error) {
    console.error("[polls vote]", error);
    return NextResponse.json({ error: "Erreur vote" }, { status: 500 });
  }
}
