/**
 * ⭐ V3.33 — PERSISTANCE DE L'ÉTAT OVERLAY DU STUDIO LIVE.
 * ============================================================================
 *
 * Anomalie remontée par le pasteur : « le overlay se désactive, même si je
 * ne l'ai pas fait moi-même. Ça se désactive quand la page se recharge,
 * par exemple s'il y a un problème de connexion. »
 *
 * Cause : l'état de l'overlay (bouton ON/OFF, images, slides, texte) vivait
 * uniquement dans le state React de <MediaOverlay> — un rechargement de page
 * le réinitialisait à OFF avec un contenu vide.
 *
 * Solution : une table dédiée `LiveOverlayState` (même approche que
 * `LiveMediaProvider` : CREATE TABLE IF NOT EXISTS au runtime + requêtes
 * brutes — AUCUNE modification du modèle Prisma `LiveStream`, donc zéro
 * risque de casser les requêtes existantes qui sélectionnent toutes les
 * colonnes de LiveStream).
 *
 * Le studio :
 *  - RESTAURE l'état au chargement (page serveur → props initiales) ;
 *  - PERSISTE chaque modification (débounce 900 ms côté <MediaOverlay>) via
 *    POST /api/live/[id]/overlay.
 *
 * Garanties : idempotent, mémoïsé par process, échec DDL purement loggué
 * (comme ensure-schema.ts) — la diffusion ne doit JAMAIS être bloquée par
 * la persistance.
 */
import { db } from "@/lib/db";

import type { MediaOverlayPersistPayload } from "@/components/live/media-overlay";

let liveOverlayTableEnsured = false;

/** Crée la table si absente (idempotent, mémoïsé par process). */
export async function ensureLiveOverlayTable(): Promise<void> {
  if (liveOverlayTableEnsured) return;
  await db.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "LiveOverlayState" (
       "liveId"     TEXT PRIMARY KEY,
       "enabled"    BOOLEAN NOT NULL DEFAULT false,
       "stateJson"  TEXT,
       "updatedAt"  TIMESTAMP NOT NULL DEFAULT now()
     )`,
  );
  liveOverlayTableEnsured = true;
}

/** État overlay persisté d'un live (null si aucun état enregistré). */
export async function getLiveOverlayState(
  liveId: string,
): Promise<{ enabled: boolean; state: MediaOverlayPersistPayload | null } | null> {
  try {
    await ensureLiveOverlayTable();
    const rows = await db.$queryRawUnsafe<Array<{ enabled: boolean; stateJson: string | null }>>(
      `SELECT "enabled", "stateJson" FROM "LiveOverlayState" WHERE "liveId" = $1`,
      liveId,
    );
    const row = rows[0];
    if (!row) return null;
    let state: MediaOverlayPersistPayload | null = null;
    if (row.stateJson) {
      try {
        state = JSON.parse(row.stateJson) as MediaOverlayPersistPayload;
      } catch {
        state = null; // JSON corrompu → on repart de zéro, sans faire échouer le studio
      }
    }
    return { enabled: !!row.enabled, state };
  } catch (e) {
    // Table impossible à créer (DDL refusé, etc.) — le studio fonctionne
    // SANS restauration plutôt que de crasher.
    console.error("[live-overlay-state] getLiveOverlayState:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Écrit (upsert) l'état overlay d'un live. */
export async function saveLiveOverlayState(
  liveId: string,
  enabled: boolean,
  state: MediaOverlayPersistPayload | null,
): Promise<void> {
  await ensureLiveOverlayTable();
  await db.$executeRawUnsafe(
    `INSERT INTO "LiveOverlayState" ("liveId", "enabled", "stateJson", "updatedAt")
     VALUES ($1, $2, $3, now())
     ON CONFLICT ("liveId")
     DO UPDATE SET "enabled" = $2, "stateJson" = $3, "updatedAt" = now()`,
    liveId,
    enabled,
    state ? JSON.stringify(state) : null,
  );
}
