/**
 * ⭐ V3.67 — Annonces : bascule automatique des publications planifiées
 * et lecture PUBLIQUE des annonces du ministère.
 *
 * Le scheduling sans cron : chaque consultation (registre secrétariat OU
 * page publique /annonces) publie les annonces dont l'heure publishAt est
 * atteinte — updateMany idempotent, jamais bloquant.
 */

import { db } from "@/lib/db";

/** Publie les annonces planifiées arrivées à échéance (idempotent). */
export async function publierAnnoncesEchues(): Promise<void> {
  try {
    await db.ministryAnnouncement.updateMany({
      where: {
        isPublished: false,
        publishAt: { lte: new Date() },
      },
      data: { isPublished: true, publishedAt: new Date() },
    });
  } catch (e) {
    console.warn("[staff-space/annonces] Bascule planifiées impossible :", e);
  }
}

export interface AnnoncePublique {
  id: string;
  title: string;
  content: string;
  category: string;
  publishedAt: Date | null;
  createdAt: Date;
}

/** Liste les annonces PUBLIÉES (page publique) — urgence en tête. */
export async function listerAnnoncesPubliees(
  limit: number,
  offset: number,
  categorie?: string
): Promise<{ items: AnnoncePublique[]; total: number }> {
  const where: Record<string, unknown> = {
    isPublished: true,
  };
  if (categorie) where.category = categorie;

  const [items, total] = await Promise.all([
    db.ministryAnnouncement.findMany({
      where,
      orderBy: [
        { category: "asc" }, // "urgence" < "generale" < "evenement" < "live" (alpha)
        { publishedAt: "desc" },
      ],
      take: limit,
      skip: offset,
      select: {
        id: true,
        title: true,
        content: true,
        category: true,
        publishedAt: true,
        createdAt: true,
      },
    }),
    db.ministryAnnouncement.count({ where }),
  ]);

  return { items, total };
}
