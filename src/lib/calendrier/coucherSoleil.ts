/**
 * Coucher de soleil à Jérusalem — frontière de jour biblique.
 *
 * Le jour biblique commence au coucher du soleil (Genèse 1:5, Lévitique 23:32).
 * On utilise le coucher de soleil à Jérusalem (31.7683°N, 35.2137°E) comme
 * référence théologique (le Temple, le lieu où l'Éternel a mis son nom).
 *
 * Calcul via astronomy-engine (JS pur, sans appel réseau, sans coût).
 */

import { Body, Observer, SearchRiseSet } from "astronomy-engine";

// Coordonnées de Jérusalem
export const JERUSALEM_LAT = 31.7683;
export const JERUSALEM_LON = 35.2137;

// Fuseau horaire d'Israël (UTC+2 en hiver, UTC+3 en été — DST)
// Pour simplifier, on calcule en UTC puis on convertit
const JERUSALEM_TZ = "Asia/Jerusalem";

/**
 * Calcule l'heure du coucher de soleil à Jérusalem pour une date donnée.
 *
 * @param date Date grégorienne (le jour concerné)
 * @returns Date UTC du coucher de soleil
 */
export function calculerCoucherSoleilJerusalem(date: Date): Date {
  const observer = new Observer(
    JERUSALEM_LAT,
    JERUSALEM_LON,
    0 // altitude (mètres) — Jérusalem ~750m mais négligeable pour le calcul
  );

  // SearchRiseSet cherche le prochain événement après la date donnée
  // direction = -1 pour le coucher (vers l'ouest, sous l'horizon)
  const result = SearchRiseSet(
    Body.Sun,
    observer,
    -1, // -1 = coucher (set), +1 = lever (rise)
    date,
    1 // stepDays : précision de recherche
  );

  if (!result) {
    // Fallback : 18:00 UTC si le calcul échoue (cas polaires, ne s'applique pas ici)
    const fallback = new Date(date);
    fallback.setUTCHours(18, 0, 0, 0);
    return fallback;
  }

  return result.date;
}

/**
 * Convertit une date UTC en heure locale de Jérusalem (Asia/Jerusalem).
 */
export function formatHeureJerusalem(dateUtc: Date): string {
  return dateUtc.toLocaleTimeString("fr-FR", {
    timeZone: JERUSALEM_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Détermine le "jour biblique en cours" en fonction du coucher de soleil
 * à Jérusalem.
 *
 * Si l'heure actuelle est après le coucher de soleil, on est dans le jour
 * biblique suivant.
 *
 * @param maintenant Date actuelle (UTC)
 * @param datesBibliques Liste des jours bibliques avec dates grégoriennes
 * @returns Le jour biblique en cours
 */
export function determinerJourBibliqueEnCours<T extends { dateGregorienne: Date | string }>(
  maintenant: Date,
  datesBibliques: T[]
): T | null {
  const maintenantUtc = maintenant.getTime();

  for (let i = 0; i < datesBibliques.length; i++) {
    const jour = datesBibliques[i];
    const dateGreg = new Date(jour.dateGregorienne);

    // Coucher de soleil du jour courant
    const coucherCeJour = calculerCoucherSoleilJerusalem(dateGreg);

    // Si on est AVANT le coucher de soleil du jour grégorien J,
    // on est encore dans le jour biblique J-1 (qui a commencé au coucher de J-1)
    if (maintenantUtc < coucherCeJour.getTime()) {
      // On est dans le jour biblique précédent (qui a commencé au coucher de la veille)
      return datesBibliques[i - 1] || jour;
    }

    // Si c'est le dernier jour et on est après le coucher,
    // on est dans le jour suivant (premier jour de l'année suivante)
    if (i === datesBibliques.length - 1 && maintenantUtc >= coucherCeJour.getTime()) {
      return jour; // Frontier case, à gérer côté appelant
    }
  }

  return datesBibliques[0] || null;
}

/**
 * Calcule le temps restant avant le prochain coucher de soleil à Jérusalem.
 *
 * @returns Objet avec heures, minutes, secondes
 */
export function compteAReboursProchainCoucher(): {
  heures: number;
  minutes: number;
  secondes: number;
  totalSecondes: number;
  prochainCoucher: Date;
} {
  const maintenant = new Date();
  const prochainCoucher = calculerCoucherSoleilJerusalem(maintenant);

  // Si le coucher est déjà passé aujourd'hui, calculer celui de demain
  let coucher = prochainCoucher;
  if (coucher.getTime() <= maintenant.getTime()) {
    const demain = new Date(maintenant);
    demain.setDate(demain.getDate() + 1);
    coucher = calculerCoucherSoleilJerusalem(demain);
  }

  const diff = coucher.getTime() - maintenant.getTime();
  const totalSecondes = Math.floor(diff / 1000);
  const heures = Math.floor(totalSecondes / 3600);
  const minutes = Math.floor((totalSecondes % 3600) / 60);
  const secondes = totalSecondes % 60;

  return {
    heures,
    minutes,
    secondes,
    totalSecondes,
    prochainCoucher: coucher,
  };
}
