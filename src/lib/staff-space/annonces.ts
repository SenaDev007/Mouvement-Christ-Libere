/**
 * ⭐ V3.67 — Annonces : bascule automatique des publications planifiées
 * et lecture PUBLIQUE des annonces du ministère.
 *
 * Le scheduling sans cron : chaque consultation (registre secrétariat OU
 * page publique /annonces) publie les annonces dont l'heure publishAt est
 * atteinte — updateMany idempotent, jamais bloquant.
 *
 * ⭐ V3.120 — Chaque annonce que CET appel fait basculer déclenche une
 * NOTIFICATION PUSH mobile (directive du pasteur) — le updateMany par
 * id (et non en masse) garantit qu'UN SEUL appelant notifie, même si
 * deux consultations arrivent simultanément.
 */

import { after } from "next/server";

import { db } from "@/lib/db";
import { notifierPublicationAnnonce } from "@/lib/staff-space/annonce-relay";

/**
 * Publie les annonces planifiées arrivées à échéance (idempotent).
 *
 * ⭐ V3.120 — Chaque bascule effectuée PAR CET APPEL déclenche la
 * notification push mobile (l'updateMany filtré sur isPublished: false
 * rend la bascule atomique : si un autre appelant a déjà publié entre-
temps, count = 0 et AUCUNE notification n'est envoyée deux fois).
 */
export async function publierAnnoncesEchues(): Promise<void> {
  try {
    const echues = await db.ministryAnnouncement.findMany({
      where: {
        isPublished: false,
        publishAt: { lte: new Date() },
      },
      select: {
        id: true,
        title: true,
        content: true,
        category: true,
      },
      take: 20,
    });

    for (const annonce of echues) {
      const basculee = await db.ministryAnnouncement.updateMany({
        where: { id: annonce.id, isPublished: false },
        data: { isPublished: true, publishedAt: new Date() },
      });
      if (basculee.count !== 1) continue; // déjà basculée par un autre appel

      // Notification push mobile — APRÈS la réponse (jamais bloquant).
      after(async () => {
        await notifierPublicationAnnonce({
          titre: annonce.title,
          contenu: annonce.content,
          categorie: annonce.category,
        });
      });
    }
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
