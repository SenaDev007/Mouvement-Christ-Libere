/**
 * POST /api/arweave/ancrer
 *
 * Ancre un contenu sur Arweave (ou génère un hash SHA-256 en mode démo).
 *
 * Corps : { type, titre, contenu, auteur, dateCreation? }
 * Réponse : { ancre } avec hash, arweaveTxId (null en démo), verified
 */

import { NextRequest, NextResponse } from "next/server";
import { ancrerContenu, genererIdContenu, type ContenuAncrable } from "@/lib/arweave/coffre-fort";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, titre, contenu, auteur, dateCreation } = body;

    if (!type || !titre || !contenu || !auteur) {
      return NextResponse.json(
        { error: "type, titre, contenu, auteur sont requis" },
        { status: 400 }
      );
    }

    const typesValides = ["temoignage", "enseignement", "video", "biographie"];
    if (!typesValides.includes(type)) {
      return NextResponse.json(
        { error: `type invalide. Valeurs acceptées : ${typesValides.join(", ")}` },
        { status: 400 }
      );
    }

    const contenuAncrable: ContenuAncrable = {
      id: genererIdContenu(type, titre),
      type,
      titre,
      contenu,
      auteur,
      dateCreation: dateCreation || new Date().toISOString(),
    };

    const ancre = await ancrerContenu(contenuAncrable);

    return NextResponse.json({
      success: true,
      contenu: contenuAncrable,
      ancre,
    });
  } catch (error) {
    console.error("[api/arweave/ancrer] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'ancrage" },
      { status: 500 }
    );
  }
}
