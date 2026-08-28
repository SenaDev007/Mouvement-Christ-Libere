import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/live-members/register
 *
 * Inscription unique d'un membre sur la plateforme.
 * Si le sessionId existe déjà, on met à jour les infos.
 * Body: { sessionId, firstName, lastName?, country?, city?, contact? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, firstName, lastName, country, city, contact } = body;

    if (!sessionId || !firstName) {
      return NextResponse.json(
        { error: "sessionId et firstName requis" },
        { status: 400 }
      );
    }

    // Upsert : si le membre existe déjà (même sessionId), on met à jour
    const member = await db.liveMember.upsert({
      where: { sessionId },
      create: {
        sessionId,
        firstName: firstName.trim(),
        lastName: lastName?.trim() || null,
        country: country || null,
        city: city?.trim() || null,
        contact: contact?.trim() || null,
      },
      update: {
        firstName: firstName.trim(),
        lastName: lastName?.trim() || null,
        country: country || null,
        city: city?.trim() || null,
        contact: contact?.trim() || null,
      },
    });

    return NextResponse.json({
      success: true,
      member: {
        id: member.id,
        sessionId: member.sessionId,
        firstName: member.firstName,
        lastName: member.lastName,
        country: member.country,
        city: member.city,
        contact: member.contact,
        totalXp: member.totalXp,
        livesWatched: member.livesWatched,
      },
    });
  } catch (error) {
    console.error("[live-members/register] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
