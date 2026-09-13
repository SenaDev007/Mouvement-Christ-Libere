/**
 * Moteur des événements « shofar » — Shabbats et fêtes de l'Éternel.
 *
 * Rôle : produire, pour un instant donné, la liste des prochaines
 * SONNERIES DE SHOFAR (entrée du Shabbat, entrée de chaque solennité)
 * et des JALONS DE NOTIFICATION (7 jours, 3 jours, 24 heures avant
 * chaque grande solennité).
 *
 * Le jour biblique commence au coucher du soleil (Genèse 1:5) :
 * - l'entrée du Shabbat = coucher du soleil du VENDREDI à Jérusalem ;
 * - l'entrée d'une fête  = coucher du soleil de la VEILLE grégorienne
 *   de sa date biblique (ex. Souccot 15 Éthanim, un mercredi, commence
 *   au coucher du soleil du mardi).
 *
 * Le coucher de soleil réel est calculé via astronomy-engine (à Jérusalem,
 * 31.7683°N 35.2137°E — le lieu où l'Éternel a mis son nom), cohérent
 * avec le reste du moteur calendaire.
 */

import { genererAnnee } from "./generation";
import { calculerFetesPourAnnee, type OccurrenceFete } from "./fetes";
import { determinerAnneeBibliqueEnCours } from "./ancrage";
import { libelleAnneeBiblique } from "./conversion";
import { calculerCoucherSoleilJerusalem } from "./coucherSoleil";

const JOUR_MS = 24 * 60 * 60 * 1000;

// Jalons de notification pour les grandes solennités (demande : 7 j, 3 j, 24 h)
const JALONS_DEFS: Array<{ cle: "j7" | "j3" | "j24h"; jours: number; label: string }> = [
  { cle: "j7", jours: 7, label: "7 jours" },
  { cle: "j3", jours: 3, label: "3 jours" },
  { cle: "j24h", jours: 1, label: "24 heures" },
];

export type CleJalon = "j7" | "j3" | "j24h";

export interface JalonNotification {
  cle: CleJalon;
  date: string; // ISO — instant exact du déclenchement
  label: string; // "7 jours", "3 jours", "24 heures"
}

export interface EvenementShofar {
  id: string;
  type: "shabbat" | "fete";
  titre: string; // "Shabbat" ou "Pessah (Pâque)"
  titreHebreu: string | null; // פֶּסַח…
  couleur: string;
  dateBiblique: string | null; // "14 Aviv"
  dateGregorienne: string; // ISO (minuit UTC du jour biblique)
  entree: string; // ISO — coucher de soleil marquant l'entrée
  sortie: string; // ISO — coucher de soleil marquant la fin
  dureeJours: number;
  description: string | null;
  reference: string | null; // Lévitique 23:5…
  travailInterdit: boolean;
  /** Jalons J-7 / J-3 / J-24h — uniquement pour les solennités */
  jalons: JalonNotification[];
}

function ajouterJours(date: Date, jours: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + jours);
  return d;
}

/** Coucher de soleil du jour grégorien donné (recherche à partir de 12:00 UTC). */
function coucherDuJour(date: Date): Date {
  const depart = new Date(date);
  // Partir de midi UTC : garantit de trouver le coucher du MÊME jour
  // (rechercher depuis minuit UTC trouverait aussi le coucher du jour même,
  //  mais midi écarte tout cas limite autour de minuit).
  depart.setUTCHours(12, 0, 0, 0);
  return calculerCoucherSoleilJerusalem(depart);
}

/**
 * Génère les événements shofar à partir de `maintenant`.
 *
 * - Shabbats : les 10 prochains (≈ 70 jours de couverture hebdomadaire)
 * - Fêtes : toutes celles qui se terminent dans le futur (jusqu'à ~400 jours
 *   pour couvrir l'année biblique complète, année suivante incluse)
 *
 * Les événements légèrement passés (fin < maintenant - 12 h) sont exclus.
 * Un doublon d'entrée (fête tombant à l'heure d'un Shabbat) est résolu
 * en faveur de la fête.
 */
export function calculerEvenementsShofar(maintenant: Date = new Date()): EvenementShofar[] {
  const evenements: EvenementShofar[] = [];

  // ── 1. Les 10 prochains Shabbats ─────────────────────────────────────
  // Le Shabbat biblique est le samedi (jour de semaine 7 du calendrier 364).
  // On cherche le prochain samedi >= aujourd'hui, puis on itère.
  const samedi = new Date(maintenant);
  samedi.setUTCHours(0, 0, 0, 0);
  const deltaVersSamedi = (6 - samedi.getUTCDay() + 7) % 7; // 0=Dim … 6=Sam
  samedi.setUTCDate(samedi.getUTCDate() + deltaVersSamedi);

  for (let i = 0; i < 10; i++) {
    const ceSamedi = ajouterJours(samedi, i * 7);
    const vendredi = ajouterJours(ceSamedi, -1);
    const entree = coucherDuJour(vendredi); // coucher du vendredi soir
    const sortie = coucherDuJour(ceSamedi); // coucher du samedi soir
    if (sortie.getTime() < maintenant.getTime() - 12 * 60 * 60 * 1000) continue; // entièrement passé

    evenements.push({
      id: `shabbat-${ceSamedi.toISOString().slice(0, 10)}`,
      type: "shabbat",
      titre: "Shabbat",
      titreHebreu: "שַׁבָּת",
      couleur: "#2A0E3D",
      dateBiblique: null,
      dateGregorienne: ceSamedi.toISOString(),
      entree: entree.toISOString(),
      sortie: sortie.toISOString(),
      dureeJours: 1,
      description: "Le septième jour, jour de repos et de sainte convocation (Exode 20:8-11). Le shofar retentit à l'entrée, au coucher du soleil.",
      reference: "Lévitique 23:3",
      travailInterdit: true,
      jalons: [], // pas de jalons pour le Shabbat hebdomadaire
    });
  }

  // ── 2. Les fêtes de l'Éternel (année courante + suivante) ────────────
  const anneeCourante = determinerAnneeBibliqueEnCours(maintenant);
  const occurrences: Array<{ occ: OccurrenceFete; nomMois: string }> = [];
  for (const annee of [anneeCourante, anneeCourante + 1]) {
    const anneeGeneree = genererAnnee(annee);
    for (const occ of calculerFetesPourAnnee(annee, anneeGeneree.jours, maintenant)) {
      occurrences.push({
        occ,
        nomMois: anneeGeneree.jours.find((j) => j.mois === occ.fete.mois)?.nomMois ?? "",
      });
    }
  }

  for (const { occ, nomMois } of occurrences) {
    const fete = occ.fete;
    const jourFete = new Date(occ.dateGregorienne); // minuit UTC
    jourFete.setUTCHours(0, 0, 0, 0);

    const veille = ajouterJours(jourFete, -1);
    const entree = coucherDuJour(veille); // entrée au coucher de la veille
    const dernierJour = ajouterJours(jourFete, fete.dureeJours - 1);
    const sortie = coucherDuJour(dernierJour); // fin au coucher du dernier jour

    if (sortie.getTime() < maintenant.getTime() - 12 * 60 * 60 * 1000) continue;

    evenements.push({
      id: `fete-${fete.id}-${jourFete.getUTCFullYear()}`,
      type: "fete",
      titre: fete.nomFr,
      titreHebreu: fete.nomHebrew,
      couleur: fete.couleur,
      dateBiblique: `${fete.jourDuMois} ${nomMois}`,
      dateGregorienne: jourFete.toISOString(),
      entree: entree.toISOString(),
      sortie: sortie.toISOString(),
      dureeJours: fete.dureeJours,
      description: fete.description,
      reference: fete.referenceEcritures,
      travailInterdit: fete.travailInterdit,
      jalons: JALONS_DEFS.map(({ cle, jours, label }) => ({
        cle,
        date: new Date(entree.getTime() - jours * JOUR_MS).toISOString(),
        label,
      })),
    });
  }

  // ── 3. Dédoublonnage (même instant d'entrée → la fête prime) ─────────
  const vus = new Set<string>();
  const deDoublonnes: EvenementShofar[] = [];
  for (const ev of evenements) {
    const cle = ev.entree;
    if (vus.has(cle)) continue;
    vus.add(cle);
    deDoublonnes.push(ev);
  }

  // ── 4. Tri chronologique ─────────────────────────────────────────────
  return deDoublonnes.sort((a, b) => a.entree.localeCompare(b.entree));
}

// ─────────────────────────────────────────────────────────────────────────
// Sérialisation des années bibliques (format identique à la page publique
// /calendrier-biblique — consommé par les composants calendrier-biblique/*)
// ─────────────────────────────────────────────────────────────────────────

export interface JourBibliqueClient {
  jourDeAnnee: number;
  mois: number;
  nomMois: string;
  jourDuMois: number;
  jourDeSemaine: number;
  nomJourSemaine: string;
  estShabbat: boolean;
  dateGregorienne: string;
  trimestre: number;
}

export interface FeteClient {
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
}

export interface AnneeBibliqueClient {
  annee: number;
  libelle: string;
  debut: string;
  fin: string;
  nombreJours: number;
  jours: JourBibliqueClient[];
  fetes: FeteClient[];
}

export function serialiserAnneePourClient(anneeBiblique: number, maintenant: Date = new Date()): AnneeBibliqueClient {
  const annee = genererAnnee(anneeBiblique);
  const fetes = calculerFetesPourAnnee(anneeBiblique, annee.jours, maintenant);

  return {
    annee: annee.annee,
    libelle: libelleAnneeBiblique(annee.annee),
    debut: annee.debut.toISOString(),
    fin: annee.fin.toISOString(),
    nombreJours: annee.jours.length,
    jours: annee.jours.map((j) => ({
      ...j,
      dateGregorienne: j.dateGregorienne.toISOString(),
    })),
    fetes: fetes.map((f) => ({
      id: f.fete.id,
      nomFr: f.fete.nomFr,
      nomHebrew: f.fete.nomHebrew,
      referenceEcritures: f.fete.referenceEcritures,
      description: f.fete.description,
      categorie: f.fete.categorie,
      couleur: f.fete.couleur,
      travailInterdit: f.fete.travailInterdit,
      dureeJours: f.fete.dureeJours,
      jourDeSemaineFixe: f.fete.jourDeSemaineFixe,
      dateBiblique: `${f.fete.jourDuMois} ${annee.jours.find((j) => j.mois === f.fete.mois)?.nomMois ?? ""}`,
      dateGregorienne: f.dateGregorienne.toISOString(),
      jourDeSemaine: f.jourDeSemaine,
      joursRestants: f.joursRestants,
    })),
  };
}
