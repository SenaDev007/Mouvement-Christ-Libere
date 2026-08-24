/** API Chaîne d'intercession — GET (liste) + POST (créer) + PATCH (prier/exaucer) */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const categorie = url.searchParams.get("categorie");
  const urgent = url.searchParams.get("urgent");

  const where: Record<string, unknown> = { isPublic: true, statut: { not: "archive" } };
  if (categorie && categorie !== "tous") where.categorie = categorie;
  if (urgent === "true") where.isUrgent = true;

  try {
    const demandes = await db.intercessionRequest.findMany({
      where,
      orderBy: [{ isUrgent: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    const stats = {
      total: demandes.length,
      enPriere: demandes.filter((d) => d.statut === "en_priere").length,
      exauces: demandes.filter((d) => d.statut === "exauce").length,
      priersTotal: demandes.reduce((sum, d) => sum + d.prayCount, 0),
    };

    return NextResponse.json({ demandes, stats });
  } catch {
    // Mode démo si DB inaccessible
    const mockDemandes = [
      { id: "1", auteur: "Sarah", sujet: "Guérison de ma mère", description: "Ma mère est hospitalisée, priez pour sa guérison complète.", categorie: "sante", isUrgent: true, statut: "en_priere", prayCount: 47, createdAt: new Date(Date.now() - 2 * 3600000).toISOString(), temoignageExaucement: null },
      { id: "2", auteur: "David", sujet: "Direction pour ma famille", description: "Nous cherchons la direction du Seigneur pour un déménagement.", categorie: "famille", isUrgent: false, statut: "ouvert", prayCount: 12, createdAt: new Date(Date.now() - 8 * 3600000).toISOString(), temoignageExaucement: null },
      { id: "3", auteur: "Esther", sujet: "Action de grâces !", description: "Le Seigneur a répondu à nos prières. Mon frère a trouvé un emploi.", categorie: "action_graces", isUrgent: false, statut: "exauce", prayCount: 89, createdAt: new Date(Date.now() - 24 * 3600000).toISOString(), temoignageExaucement: "Après 3 mois de chômage, il a reçu une offre d'emploi excellente. Que Dieu soit loué !" },
      { id: "4", auteur: "Joseph", sujet: "Persécution au travail", description: "Je subis des pressions au travail à cause de ma foi. Priez pour la force et la sagesse.", categorie: "spiritual", isUrgent: false, statut: "en_priere", prayCount: 34, createdAt: new Date(Date.now() - 48 * 3600000).toISOString(), temoignageExaucement: null },
      { id: "5", auteur: "Rébecca", sujet: "Salut de mon époux", description: "Priez pour que mon époux vienne à la connaissance de Yeshoua.", categorie: "spiritual", isUrgent: false, statut: "ouvert", prayCount: 56, createdAt: new Date(Date.now() - 72 * 3600000).toISOString(), temoignageExaucement: null },
    ];
    return NextResponse.json({
      demandes: mockDemandes,
      stats: { total: 5, enPriere: 2, exauces: 1, priersTotal: 238 },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { auteur, sujet, description, categorie, isUrgent } = body;

    if (!auteur || !sujet || !description) {
      return NextResponse.json({ error: "auteur, sujet, description requis" }, { status: 400 });
    }

    try {
      const demande = await db.intercessionRequest.create({
        data: {
          auteur: auteur.substring(0, 100),
          sujet: sujet.substring(0, 200),
          description: description.substring(0, 2000),
          categorie: categorie || "general",
          isUrgent: !!isUrgent,
          isPublic: true,
          statut: "ouvert",
        },
      });
      return NextResponse.json({ success: true, id: demande.id }, { status: 201 });
    } catch {
      return NextResponse.json({ success: true, demo: true });
    }
  } catch {
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
