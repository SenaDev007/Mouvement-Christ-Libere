/**
 * ⭐ V3.12 — Purge des positions de la carte des dispersés créées SANS
 * compte officiel (application à la base).
 *
 * La classification (fonction pure) vit dans classification-purge.ts ;
 * ce module l'applique à la base :
 *   - idempotente (une fois les positions anonymes supprimées, les appels
 *     suivants ne trouvent plus rien) ;
 *   - mémoïsée par instance serverless (un seul passage par lambda) ;
 *   - non bloquante (échec purement loggué, la carte fonctionne comme
 *     avant et la purge sera retentée au prochain cold start) ;
 *   - branchée sur GET /api/disperses : le premier visiteur de la page
 *     déclenche la purge, la carte n'affiche plus jamais les positions
 *     anonymes (le pasteur voit la carte nettoyée dès sa première visite).
 */
import { db } from "@/lib/db";
import { ensureDisperseUserIdColumn } from "@/lib/ensure-schema";
import { classerDisperses } from "./classification-purge";

export {
  classerDisperses,
  normaliser,
  paysCoherent,
  FENETRE_REGISTER_MS,
} from "./classification-purge";
export type {
  DisperseLite,
  UtilisateurLite,
  ClassificationPurge,
} from "./classification-purge";

export interface ResultatPurge {
  supprimes: number;
  conserves: number;
  detail: Array<{ id: string; pseudonyme: string; raison: string }>;
}

const RESULTAT_VIDE: ResultatPurge = { supprimes: 0, conserves: 0, detail: [] };

let purgeEnCours: Promise<ResultatPurge> | null = null;
let purgeFaite = false;

/** Exécute la purge une seule fois par instance (mémoïsée + concurrentielle). */
export function purgerDispersesAnonymes(): Promise<ResultatPurge> {
  if (purgeFaite) return Promise.resolve(RESULTAT_VIDE);
  if (purgeEnCours) return purgeEnCours;

  purgeEnCours = (async (): Promise<ResultatPurge> => {
    // La colonne userId doit exister avant toute sélection Prisma (le
    // findMany la sélectionne via le modèle du schéma V3.12).
    await ensureDisperseUserIdColumn();

    const membres = await db.disperseMember.findMany({
      select: {
        id: true,
        pseudonyme: true,
        pays: true,
        liveMemberId: true,
        userId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
    if (membres.length === 0) {
      purgeFaite = true;
      return RESULTAT_VIDE;
    }

    const utilisateurs = await db.user.findMany({
      select: { id: true, name: true, email: true, country: true, createdAt: true },
    });

    const { aSupprimer, aConserver, raisons } = classerDisperses(membres, utilisateurs);

    if (aSupprimer.length > 0) {
      await db.disperseMember.deleteMany({ where: { id: { in: aSupprimer } } });
      const detail = membres
        .filter((m) => aSupprimer.includes(m.id))
        .map((m) => ({
          id: m.id,
          pseudonyme: m.pseudonyme,
          raison: raisons.get(m.id) ?? "position anonyme",
        }));
      console.log(
        `[disperses/purge V3.12] ${aSupprimer.length} position(s) anonyme(s) supprimée(s), ` +
          `${aConserver.length} inscription(s) officielle(s) conservée(s)`
      );
      for (const d of detail) {
        console.log(`[disperses/purge V3.12]   ✗ ${d.pseudonyme} — ${d.raison}`);
      }
      purgeFaite = true;
      return { supprimes: aSupprimer.length, conserves: aConserver.length, detail };
    }

    purgeFaite = true;
    return { supprimes: 0, conserves: aConserver.length, detail: [] };
  })().catch((e: unknown) => {
    // Non bloquant : la carte fonctionne comme avant si la purge échoue.
    console.error(
      "[disperses/purge V3.12] impossible :",
      e instanceof Error ? e.message : e
    );
    return RESULTAT_VIDE;
  }).finally(() => {
    purgeEnCours = null;
  });

  return purgeEnCours;
}
