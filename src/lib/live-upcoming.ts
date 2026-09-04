"use client";

/**
 * ⭐ V3.28 — Cache partagé + dédoublonnage de /api/live/upcoming.
 * ============================================================================
 *
 * AVANT : deux composants montés SIMULTANÉMENT sur la même page
 * (LiveAnnouncementBar rendu par LayoutShell sur toutes les pages +
 * UpcomingLiveFloat dans le hero de l'accueil et de /videos)
 * interrogeaient CHACUN l'API au montage → 2 requêtes × ~61 Ko de JSON
 * sur chaque chargement de page (~11 % du poids total de l'accueil),
 * plus deux réponses distinctes à parser.
 *
 * MAINTENANT : ce module partage la promesse EN VOL (si un appel est en
 * cours, le second reçoit la MÊME réponse) et un cache de courte durée
 * (10 s). Les polls périodiques des deux composants (30 s / 60 s)
 * tombent toujours hors TTL → ils rafraîchissent les données comme
 * avant, seule la salve initiale est dédupliquée.
 *
 * En cas d'échec réseau, la promesse partagée est rejetée : chaque
 * appelant conserve alors son état précédent (comportement d'origine,
 * où chaque composant catchait sa propre erreur).
 */

import { apiFetch } from "@/lib/api-client";

export interface UpcomingLiveItem {
  id: string;
  title: string;
  scheduledAt: string;
  status: "SCHEDULED" | "LIVE" | string;
  servantName: string;
  servantCode?: string;
  thumbnailUrl?: string | null;
  youtubeUrl?: string | null;
}

/** Durée de vie du cache partagé (court : les polls restent frais). */
const CACHE_TTL_MS = 10_000;

let cache: { at: number; lives: UpcomingLiveItem[] } | null = null;
let inFlight: Promise<UpcomingLiveItem[]> | null = null;

export async function fetchUpcomingLives(): Promise<UpcomingLiveItem[]> {
  // Cache frais → réponse immédiate sans requête.
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.lives;
  }

  // Requête déjà en vol → tout le monde attend la MÊME promesse.
  if (!inFlight) {
    inFlight = apiFetch("/api/live/upcoming")
      .then(async (res) => {
        if (!res.ok) throw new Error(`upcoming ${res.status}`);
        const data = await res.json();
        const lives: UpcomingLiveItem[] = Array.isArray(data?.lives)
          ? data.lives
          : [];
        cache = { at: Date.now(), lives };
        return lives;
      })
      .finally(() => {
        inFlight = null;
      });
  }

  return inFlight;
}
