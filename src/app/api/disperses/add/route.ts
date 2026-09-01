import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * POST /api/disperses/add
 * Enregistre un nouveau membre dispersé dans la base de données.
 * ⭐ V3.11 — Session requise : les inscriptions anonymes sont terminées
 * (on figure sur la carte en créant son compte via /register).
 * Body: { pseudonyme, pays, ville?, langue, niveau, message?, latitude, longitude }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        {
          error:
            "Un compte est requis pour figurer sur la carte. Créez votre compte depuis la page d'inscription.",
        },
        { status: 401 },
      );
    }

    const body = await req.json();

    const { pseudonyme, pays, ville, langue, niveau, message, latitude, longitude } = body;

    if (!pseudonyme || !pays || !langue || !latitude || !longitude) {
      return NextResponse.json(
        { error: "Pseudonyme, pays, langue, latitude et longitude sont requis" },
        { status: 400 },
      );
    }

    // Arrondir les coordonnées à 0.1° pour anonymat
    const latRounded = Math.round(latitude * 10) / 10;
    const lngRounded = Math.round(longitude * 10) / 10;

    const member = await db.disperseMember.create({
      data: {
        pseudonyme,
        pays,
        ville: ville || null,
        langue,
        niveau: niveau || "chercheur",
        message: message || null,
        latitude: latRounded,
        longitude: lngRounded,
        isPublic: true,
      },
    });

    return NextResponse.json({ success: true, id: member.id });
  } catch (error) {
    console.error("[disperses/add] Error:", error);
    return NextResponse.json({ error: "Erreur lors de l'enregistrement" }, { status: 500 });
  }
}
