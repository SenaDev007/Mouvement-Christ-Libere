/**
 * Export iCal (.ics) — calendrier biblique des fêtes.
 *
 * Format iCalendar standard (RFC 5545), importable dans Google Calendar,
 * Outlook, Apple Calendar.
 */

import type { OccurrenceFete } from "./fetes";
import { formaterDateGregorienne } from "./conversion";

/**
 * Formate une date en format iCal (UTC, sans séparateurs).
 * Ex: 20260318T180000Z
 */
function formatICalDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}T180000Z`; // 18:00 UTC (coucher soleil approximatif)
}

/**
 * Formate une date de fin (jour + 1, toute la journée).
 */
function formatICalDateFin(date: Date): string {
  const fin = new Date(date);
  fin.setUTCDate(fin.getUTCDate() + 1);
  const year = fin.getUTCFullYear();
  const month = String(fin.getUTCMonth() + 1).padStart(2, "0");
  const day = String(fin.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}T180000Z`;
}

/**
 * Échappe les caractères spéciaux pour iCal.
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Génère le contenu d'un fichier .ics pour les fêtes d'une année biblique.
 *
 * @param annee Année biblique
 * @param fetes Liste des occurrences de fêtes
 * @returns Contenu du fichier .ics
 */
export function genererICal(
  annee: number,
  fetes: OccurrenceFete[]
): string {
  const lignes: string[] = [];

  // En-tête iCal
  lignes.push("BEGIN:VCALENDAR");
  lignes.push("VERSION:2.0");
  lignes.push("PRODID:-//Christ Libere//Calendrier Biblique 364//FR");
  lignes.push("CALSCALE:GREGORIAN");
  lignes.push("METHOD:PUBLISH");
  lignes.push(`X-WR-CALNAME:Calendrier Biblique ${annee}-${annee + 1}`);
  lignes.push("X-WR-TIMEZONE:UTC");
  lignes.push("X-WR-CALDESC:Calendrier biblique de 364 jours (Hénoch/Qumrân) - Fêtes de l'Éternel");

  // Événements (une entrée par fête)
  for (const occ of fetes) {
    const fete = occ.fete;
    const uid = `${fete.id}-${annee}@mouvementchristlibere.org`;
    const dtstamp = formatICalDate(new Date());

    lignes.push("BEGIN:VEVENT");
    lignes.push(`UID:${uid}`);
    lignes.push(`DTSTAMP:${dtstamp}`);
    lignes.push(`DTSTART:${formatICalDate(occ.dateGregorienne)}`);
    lignes.push(`DTEND:${formatICalDateFin(occ.dateGregorienne)}`);
    lignes.push(`SUMMARY:${escapeICalText(fete.nomFr)}`);
    lignes.push(`DESCRIPTION:${escapeICalText(fete.description)}`);
    lignes.push(`LOCATION:Jérusalem`);
    lignes.push(`CATEGORIES:${escapeICalText(fete.categorie)}`);
    lignes.push("STATUS:CONFIRMED");
    lignes.push("TRANSP:OPAQUE");
    lignes.push("END:VEVENT");
  }

  // Pied iCal
  lignes.push("END:VCALENDAR");

  // Retours à la ligne CRLF (standard iCal)
  return lignes.join("\r\n");
}

/**
 * Génère les en-têtes HTTP pour le téléchargement d'un fichier .ics.
 */
export function headersICal(nomFichier: string): Record<string, string> {
  return {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": `attachment; filename="${nomFichier}"`,
    "Cache-Control": "public, max-age=3600",
  };
}
