/** API Chaîne d'intercession — GET (liste, réservée à l'administration) + POST (créer, public)
 *
 * ⭐ V3.2 — CONFIDENTIALITÉ (demande explicite) : les demandes de prière
 * contiennent le nom de la personne, son sujet et sa description → elles
 * ne doivent PLUS être publiques. Le GET est désormais réservé aux membres
 * de l'administration (session NextAuth, rôle ADMIN+). Le public ne voit
 * que le formulaire de dépôt (page /intercession) ; les demandes arrivent
 * directement dans le back-office (/admin/intercession).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Rôles autorisés à consulter / gérer les demandes d'intercession. */
const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR", "PASTOR", "ANIMATOR"]);

export async function GET(request: NextRequest) {
  // ⭐ V3.2 — Réservé à l'administration : aucune demande n'est publique.
  const session = await auth();
  if (!session?.user?.id || !PRIVILEGED_ROLES.has((session.user as { role?: string }).role || "")) {
    return NextResponse.json({ error: "Accès réservé à l'administration" }, { status: 401 });
  }

  const url = new URL(request.url);
  const categorie = url.searchParams.get("categorie");
  const urgent = url.searchParams.get("urgent");
  const statut = url.searchParams.get("statut");

  const where: Record<string, unknown> = {};
  if (categorie && categorie !== "tous") where.categorie = categorie;
  if (urgent === "true") where.isUrgent = true;
  if (statut && statut !== "tous") where.statut = statut;

  try {
    const demandes = await db.intercessionRequest.findMany({
      where,
      orderBy: [{ isUrgent: "desc" }, { createdAt: "desc" }],
      take: 500,
    });

    const all = await db.intercessionRequest.findMany({ select: { statut: true, prayCount: true } });
    const stats = {
      total: all.length,
      enPriere: all.filter((d) => d.statut === "en_priere").length,
      exauces: all.filter((d) => d.statut === "exauce").length,
      priersTotal: all.reduce((sum, d) => sum + d.prayCount, 0),
    };

    return NextResponse.json({ demandes, stats });
  } catch {
    return NextResponse.json({ error: "Erreur de base de données" }, { status: 500 });
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
          // ⭐ V3.2 — isPublic: false : la demande arrive DIRECTEMENT dans le
          // back-office, elle n'est plus affichée sur la page publique.
          isPublic: false,
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
