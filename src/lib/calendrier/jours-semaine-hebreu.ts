/**
 * Noms hébreux des jours de la semaine.
 *
 * Genèse 1 nomme les jours par leur rang : « jour un », « jour deux »…
 * Le septième jour reçoit un nom propre : Shabbat (repos).
 *
 * Indexation : numero 1 = Dimanche (Yom Rishon, « premier jour »),
 * numero 7 = Samedi (Shabbat) — cohérent avec le calendrier de 364 jours
 * où le jour de semaine 7 est toujours le Shabbat.
 *
 * Deux formes hébraïques :
 * - `hebreu` : forme complète sans niquoud (יום ראשון) — lisible en petit
 * - `hebreuNiqoud` : forme vocalisée (יוֹם רִאשׁוֹן) — affichage soigné
 */

export interface JourSemaineHebreu {
  numero: number; // 1 = Dimanche … 7 = Samedi
  fr: string; // nom français complet
  frAbbr: string; // abréviation française (en-têtes de colonnes)
  translit: string; // translittération latine
  hebreu: string; // hébreu sans niquoud
  hebreuNiqoud: string; // hébreu vocalisé
}

export const JOURS_SEMAINE_HEBREU: readonly JourSemaineHebreu[] = [
  {
    numero: 1,
    fr: "Dimanche",
    frAbbr: "Dim",
    translit: "Yom Rishon",
    hebreu: "יום ראשון",
    hebreuNiqoud: "יוֹם רִאשׁוֹן",
  },
  {
    numero: 2,
    fr: "Lundi",
    frAbbr: "Lun",
    translit: "Yom Sheni",
    hebreu: "יום שני",
    hebreuNiqoud: "יוֹם שֵׁנִי",
  },
  {
    numero: 3,
    fr: "Mardi",
    frAbbr: "Mar",
    translit: "Yom Shlishi",
    hebreu: "יום שלישי",
    hebreuNiqoud: "יוֹם שְׁלִישִׁי",
  },
  {
    numero: 4,
    fr: "Mercredi",
    frAbbr: "Mer",
    translit: "Yom Revi'i",
    hebreu: "יום רביעי",
    hebreuNiqoud: "יוֹם רְבִיעִי",
  },
  {
    numero: 5,
    fr: "Jeudi",
    frAbbr: "Jeu",
    translit: "Yom Chamichi",
    hebreu: "יום חמישי",
    hebreuNiqoud: "יוֹם חֲמִישִׁי",
  },
  {
    numero: 6,
    fr: "Vendredi",
    frAbbr: "Ven",
    translit: "Yom Shishi",
    hebreu: "יום שישי",
    hebreuNiqoud: "יוֹם שִׁשִּׁי",
  },
  {
    numero: 7,
    fr: "Samedi",
    frAbbr: "Sam",
    translit: "Shabbat",
    hebreu: "שבת",
    hebreuNiqoud: "שַׁבָּת",
  },
];

/**
 * Retourne les infos hébraïques d'un jour de semaine (1-7).
 * Hors bornes → null.
 */
export function jourSemaineHebreu(numero: number): JourSemaineHebreu | null {
  if (numero < 1 || numero > 7) return null;
  return JOURS_SEMAINE_HEBREU[numero - 1] ?? null;
}
