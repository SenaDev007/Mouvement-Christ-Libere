"use client";

/**
 * ⭐ V3.10 — Navigation CONTINUE entre années bibliques.
 *
 * Avant : le composant recevait 3 années pré-générées (précédente /
 * courante / suivante) et les chevrons étaient désactivés aux bornes —
 * « limité à 2027-2028 ».
 *
 * Maintenant : le hook garde un cache d'années déjà consultées et, quand
 * l'utilisateur sort des années chargées, va chercher l'année manquante
 * via /api/calendrier-biblique/[annee] (format identique). La navigation
 * est bornée uniquement par les limites de l'API (1900-2100).
 *
 * Le composant consomme `annee` (l'année courante) et la passe à TOUTES
 * les vues (Aujourd'hui, Année, Mois, Fêtes, Équivalence) : le switch
 * impacte chaque onglet.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface AnneeBibliqueClient {
  annee: number;
  libelle: string;
  debut: string;
  fin: string;
  nombreJours: number;
  jours: Array<{
    jourDeAnnee: number;
    mois: number;
    nomMois: string;
    jourDuMois: number;
    jourDeSemaine: number;
    nomJourSemaine: string;
    estShabbat: boolean;
    dateGregorienne: string;
    trimestre: number;
  }>;
  fetes: Array<{
    id: string;
    nomFr: string;
    nomHebrew: string | null;
    referenceEcritures: string;
    description: string;
    categorie: string;
    couleur: string;
    travailInterdit: boolean;
    dureeJours: number;
    jourDeSemaineFixe: number;
    dateBiblique: string;
    dateGregorienne: string;
    jourDeSemaine: number;
    joursRestants: number;
  }>;
}

export const ANNEE_MIN = 1900;
export const ANNEE_MAX = 2100;

interface RetourUseAnneesBibliques {
  /** Années chargées, triées. */
  annees: AnneeBibliqueClient[];
  /** Année biblique courante (sélectionnée) — null pendant le 1er chargement. */
  annee: AnneeBibliqueClient | null;
  /** Année civile couramment sélectionnée (ex: 2026 pour 2026-2027). */
  anneeCourante: number;
  /** Une année est en cours de chargement (nav au-delà du cache). */
  chargement: boolean;
  anneePrecedente: () => void;
  anneeSuivante: () => void;
  peutPrecedente: boolean;
  peutSuivante: boolean;
}

export function useAnneesBibliques(
  anneesInitiales: AnneeBibliqueClient[],
  indexInitial: number
): RetourUseAnneesBibliques {
  const [annees, setAnnees] = useState<AnneeBibliqueClient[]>(anneesInitiales);
  const [anneeCourante, setAnneeCourante] = useState<number>(
    anneesInitiales[Math.min(indexInitial, anneesInitiales.length - 1)]?.annee ?? new Date().getUTCFullYear()
  );
  const [chargement, setChargement] = useState(false);

  // Cache des années en cours de fetch (évite les requêtes dupliquées)
  const enCoursRef = useRef<Set<number>>(new Set());
  const cacheRef = useRef<Map<number, AnneeBibliqueClient>>(
    new Map(anneesInitiales.map((a) => [a.annee, a]))
  );

  // Synchroniser le cache si les props initiales changent (rare) —
  // la prop est un tableau littéral rendu à chaque render côté serveur,
  // on garde une ref stable et on ne resynchronise que si le CONTENU change.
  const initialesRef = useRef(anneesInitiales);
  useEffect(() => {
    const identiques =
      initialesRef.current.length === anneesInitiales.length &&
      initialesRef.current.every((a, i) => a.annee === anneesInitiales[i].annee);
    if (identiques) return;
    initialesRef.current = anneesInitiales;
    for (const a of anneesInitiales) {
      if (!cacheRef.current.has(a.annee)) {
        cacheRef.current.set(a.annee, a);
        setAnnees((prev) =>
          prev.some((p) => p.annee === a.annee) ? prev : [...prev, a].sort((x, y) => x.annee - y.annee)
        );
      }
    }
  }, [anneesInitiales]);

  /** Charge (une seule fois) une année hors cache. */
  const assurerAnnee = useCallback(async (cible: number) => {
    if (cible < ANNEE_MIN || cible > ANNEE_MAX) return;
    if (cacheRef.current.has(cible) || enCoursRef.current.has(cible)) return;
    enCoursRef.current.add(cible);
    setChargement(true);
    try {
      const res = await fetch(`/api/calendrier-biblique/${cible}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as AnneeBibliqueClient;
      if (data && typeof data.annee === "number" && Array.isArray(data.jours)) {
        cacheRef.current.set(data.annee, data);
        setAnnees((prev) =>
          prev.some((p) => p.annee === data.annee)
            ? prev
            : [...prev, data].sort((x, y) => x.annee - y.annee)
        );
      }
    } catch {
      /* hors-ligne : le clic suivant retentera */
    } finally {
      enCoursRef.current.delete(cible);
      setChargement(false);
    }
  }, []);

  const anneePrecedente = useCallback(() => {
    setAnneeCourante((a) => {
      const cible = a - 1;
      if (cible < ANNEE_MIN) return a;
      void assurerAnnee(cible);
      return cible;
    });
  }, [assurerAnnee]);

  const anneeSuivante = useCallback(() => {
    setAnneeCourante((a) => {
      const cible = a + 1;
      if (cible > ANNEE_MAX) return a;
      void assurerAnnee(cible);
      return cible;
    });
  }, [assurerAnnee]);

  const annee = cacheRef.current.get(anneeCourante) ?? annees.find((a) => a.annee === anneeCourante) ?? null;

  return {
    annees,
    annee,
    anneeCourante,
    chargement,
    anneePrecedente,
    anneeSuivante,
    peutPrecedente: anneeCourante > ANNEE_MIN,
    peutSuivante: anneeCourante < ANNEE_MAX,
  };
}
