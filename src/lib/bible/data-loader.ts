/**
 * Chargeur de données bibliques — Mouvement Christ Libère (V3+)
 *
 * Lit les données bibliques depuis les fichiers locaux (src/data/bible/).
 * Aucun fetch externe — tout est intégré localement pour la souveraineté.
 *
 * Sources intégrées :
 * 1. Bible multilingue (FR, EN, ES, PT, AR) — MaatheusGois/bible
 * 2. Dictionnaires Strong (hébreu 8674 entrées + grec 5523 entrées) — openscriptures/strongs
 * 3. Bible hébraïque morphologique (40 livres AT) — openscriptures/morphhb
 * 4. Peshitta araméenne + lexique SEDRA — machshev/bible-modules
 */

import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "src", "data", "bible");

// ============================================================
// 1. BIBLE MULTILINGUE
// ============================================================

export interface LivreBible {
  id: string; // "gn", "ex", "1co", etc.
  nom: string; // "Genèse"
  chapters: string[][]; // [chapitre][verset] = texte
}

export interface VersionBible {
  code: string; // "fr-apee"
  langue: string; // "fr"
  nom: string; // "Bible de l'Épée"
  livres: LivreBible[];
}

const VERSIONS_DISPONIBLES: Array<{ code: string; langue: string; nom: string; fichier: string }> = [
  { code: "fr-apee", langue: "fr", nom: "Bible de l'Épée (Français)", fichier: "fr-apee.json" },
  { code: "en-kjv", langue: "en", nom: "King James Version (English)", fichier: "en-kjv.json" },
  { code: "en-bbe", langue: "en", nom: "Bible in Basic English", fichier: "en-bbe.json" },
  { code: "es-rvr", langue: "es", nom: "Reina Valera (Español)", fichier: "es-rvr.json" },
  { code: "pt-acf", langue: "pt", nom: "Almeida Corrigida Fiel (Português)", fichier: "pt-acf.json" },
  { code: "ar-svd", langue: "ar", nom: "Arabic Bible (العربية)", fichier: "ar-svd.json" },
];

// Mapping IDs courts → noms français
const ID_VERS_NOM: Record<string, string> = {
  gn: "Genèse", ex: "Exode", lv: "Lévitique", nb: "Nombres", dt: "Deutéronome",
  js: "Josué", jg: "Juges", rt: "Ruth", "1sm": "1 Samuel", "2sm": "2 Samuel",
  "1kg": "1 Rois", "2kg": "2 Rois", "1ch": "1 Chroniques", "2ch": "2 Chroniques",
  er: "Esdras", ne: "Néhémie", est: "Esther", jb: "Job", ps: "Psaumes",
  pv: "Proverbes", ec: "Ecclésiaste", ct: "Cantique", es: "Ésaïe", je: "Jérémie",
  lm: "Lamentations", ez: "Ézéchiel", dn: "Daniel", os: "Osée", jl: "Joël",
  am: "Amos", ob: "Abdias", jn: "Jonas", mi: "Michée", na: "Nahum",
  hb: "Habacuc", so: "Sophonie", ag: "Aggée", za: "Zacharie", ml: "Malachie",
  mt: "Matthieu", mc: "Marc", lc: "Luc", jo: "Jean", ac: "Actes",
  rm: "Romains", "1co": "1 Corinthiens", "2co": "2 Corinthiens", ga: "Galates",
  ep: "Éphésiens", ph: "Philippiens", cl: "Colossiens",
  "1th": "1 Thessaloniciens", "2th": "2 Thessaloniciens",
  "1tm": "1 Timothée", "2tm": "2 Timothée", tt: "Tite", pm: "Philémon",
  he: "Hébreux", jq: "Jacques", "1pe": "1 Pierre", "2pe": "2 Pierre",
  "1jo": "1 Jean", "2jo": "2 Jean", "3jo": "3 Jean", jd: "Jude", ap: "Apocalypse",
};

const cacheVersions: Record<string, VersionBible> = {};

/**
 * Charge une version biblique complète depuis le fichier local.
 */
export function chargerVersion(code: string): VersionBible | null {
  if (cacheVersions[code]) return cacheVersions[code];

  const config = VERSIONS_DISPONIBLES.find((v) => v.code === code);
  if (!config) return null;

  const filePath = path.join(DATA_DIR, "versions", config.fichier);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const livres: LivreBible[] = JSON.parse(raw);

  // Enrichir avec les noms français
  for (const livre of livres) {
    livre.nom = ID_VERS_NOM[livre.id] || livre.id;
  }

  const version: VersionBible = {
    code: config.code,
    langue: config.langue,
    nom: config.nom,
    livres,
  };

  cacheVersions[code] = version;
  return version;
}

/**
 * Récupère un verset précis.
 */
export function getVerset(
  versionCode: string,
  livreId: string,
  chapitre: number,
  verset: number
): string | null {
  const version = chargerVersion(versionCode);
  if (!version) return null;

  const livre = version.livres.find((l) => l.id === livreId);
  if (!livre) return null;

  const chap = livre.chapters[chapitre - 1];
  if (!chap) return null;

  return chap[verset - 1] || null;
}

/**
 * Récupère un chapitre complet.
 */
export function getChapitre(
  versionCode: string,
  livreId: string,
  chapitre: number
): string[] | null {
  const version = chargerVersion(versionCode);
  if (!version) return null;

  const livre = version.livres.find((l) => l.id === livreId);
  if (!livre) return null;

  return livre.chapters[chapitre - 1] || null;
}

/**
 * Liste toutes les versions disponibles.
 */
export function listerVersions() {
  return VERSIONS_DISPONIBLES;
}

/**
 * Recherche plein texte dans une version.
 */
export function rechercherVersets(
  versionCode: string,
  recherche: string,
  limite = 50
): Array<{ livre: string; livreId: string; chapitre: number; verset: number; texte: string }> {
  const version = chargerVersion(versionCode);
  if (!version) return [];

  const q = recherche.toLowerCase().trim();
  if (!q) return [];

  const resultats: Array<{ livre: string; livreId: string; chapitre: number; verset: number; texte: string }> = [];

  for (const livre of version.livres) {
    for (let c = 0; c < livre.chapters.length; c++) {
      const chap = livre.chapters[c];
      for (let v = 0; v < chap.length; v++) {
        if (chap[v].toLowerCase().includes(q)) {
          resultats.push({
            livre: livre.nom,
            livreId: livre.id,
            chapitre: c + 1,
            verset: v + 1,
            texte: chap[v],
          });
          if (resultats.length >= limite) return resultats;
        }
      }
    }
  }

  return resultats;
}

// ============================================================
// 2. DICTIONNAIRES STRONG
// ============================================================

export interface EntreeStrong {
  numero: string; // "H1" ou "G1615"
  langue: "hebrew" | "greek";
  lemma?: string;
  xlit?: string;
  pron?: string;
  translit?: string;
  derivation?: string;
  strongs_def?: string;
  kjv_def?: string;
}

const cacheStrongHebrew: Record<string, EntreeStrong> | null = null;
const cacheStrongGreek: Record<string, EntreeStrong> | null = null;

let strongHebrewCache: Record<string, EntreeStrong> | null = null;
let strongGreekCache: Record<string, EntreeStrong> | null = null;

/**
 * Charge le dictionnaire Strong hébreu.
 */
export function chargerStrongHebreu(): Record<string, EntreeStrong> {
  if (strongHebrewCache) return strongHebrewCache;

  const filePath = path.join(DATA_DIR, "strongs", "hebrew.dat");
  const raw = fs.readFileSync(filePath, "utf-8");

  // Le fichier est : var strongsHebrewDictionary = {...};
  const jsonStr = raw.substring(raw.indexOf("{"));
  const data = JSON.parse(jsonStr);

  strongHebrewCache = {};
  for (const [key, value] of Object.entries(data)) {
    strongHebrewCache[key] = { ...(value as object), numero: key, langue: "hebrew" } as EntreeStrong;
  }

  return strongHebrewCache;
}

/**
 * Charge le dictionnaire Strong grec.
 */
export function chargerStrongGrec(): Record<string, EntreeStrong> {
  if (strongGreekCache) return strongGreekCache;

  const filePath = path.join(DATA_DIR, "strongs", "greek.dat");
  const raw = fs.readFileSync(filePath, "utf-8");

  const jsonStr = raw.substring(raw.indexOf("{"));
  const data = JSON.parse(jsonStr);

  strongGreekCache = {};
  for (const [key, value] of Object.entries(data)) {
    strongGreekCache[key] = { ...(value as object), numero: key, langue: "greek" } as EntreeStrong;
  }

  return strongGreekCache;
}

/**
 * Cherche une entrée Strong par numéro (ex: "H1", "G2424").
 */
export function chercherStrong(numero: string): EntreeStrong | null {
  const num = numero.toUpperCase().startsWith("H") || numero.toUpperCase().startsWith("G")
    ? numero.toUpperCase()
    : numero.toUpperCase().startsWith("0")
      ? "H" + parseInt(numero)
      : numero.toUpperCase();

  if (num.startsWith("H")) {
    const hebrew = chargerStrongHebreu();
    return hebrew[num] || null;
  }
  if (num.startsWith("G")) {
    const greek = chargerStrongGrec();
    return greek[num] || null;
  }

  return null;
}

// ============================================================
// 3. BIBLE HÉBRAÏQUE MORPHOLOGIQUE (OSHB)
// ============================================================

export interface MotHebreu {
  mot: string; // "ו/יהי"
  lemme: string; // "Hc/H1961" (numéros Strong)
  morphologie: string; // "HC/Vqw3ms"
}

export interface VersetHebreu {
  mots: MotHebreu[];
}

let morphhbCache: Record<string, string[][][][]> | null = null;

// Mapping nom livre OSHB → ID court
const OSHB_VERS_ID: Record<string, string> = {
  Gen: "gn", Exod: "ex", Lev: "lv", Num: "nb", Deut: "dt",
  Josh: "js", Judg: "jg", Ruth: "rt", "1Sam": "1sm", "2Sam": "2sm",
  "1Kgs": "1kg", "2Kgs": "2kg", "1Chr": "1ch", "2Chr": "2ch",
  Ezra: "er", Neh: "ne", Esth: "est", Job: "jb", Ps: "ps",
  Prov: "pv", Eccl: "ec", Song: "ct", Isa: "es", Jer: "je",
  Lam: "lm", Ezek: "ez", Dan: "dn", Hos: "os", Joel: "jl",
  Amos: "am", Obad: "ob", Jonah: "jn", Mic: "mi", Nah: "na",
  Hab: "hb", Zeph: "so", Hag: "ag", Zech: "za", Mal: "ml",
};

/**
 * Charge la Bible hébraïque morphologique.
 */
function chargerMorphhb(): Record<string, string[][][][]> {
  if (morphhbCache) return morphhbCache;

  const filePath = path.join(DATA_DIR, "morphhb", "index.dat");
  const raw = fs.readFileSync(filePath, "utf-8");

  // Le fichier est : var morphhb = {...};
  const jsonStr = raw.substring(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  const parsed: Record<string, string[][][][]> = JSON.parse(jsonStr);
  morphhbCache = parsed;

  return parsed;
}

/**
 * Récupère un verset hébraïque avec analyse morphologique.
 */
export function getVersetHebreu(
  livreNom: string,
  chapitre: number,
  verset: number
): VersetHebreu | null {
  const data = chargerMorphhb();
  const livre = data[livreNom];
  if (!livre) return null;

  const chap = livre[chapitre - 1];
  if (!chap) return null;

  const vers = chap[verset - 1];
  if (!vers) return null;

  return {
    mots: vers.map((mot: string[]) => ({
      mot: mot[0],
      lemme: mot[1],
      morphologie: mot[2],
    })),
  };
}

/**
 * Liste les livres disponibles dans l'OSHB.
 */
export function listerLivresHebreu(): string[] {
  const data = chargerMorphhb();
  return Object.keys(data);
}

/**
 * Récupère l'ID court d'un livre OSHB.
 */
export function oshbVersId(nomOshb: string): string | null {
  return OSHB_VERS_ID[nomOshb] || null;
}

// ============================================================
// 4. PESHITTA ARAMÉENNE
// ============================================================

let peshittaCache: Array<{ livre: string; chapitre: number; versets: Array<{ numero: number; texte: string }> }> | null = null;

/**
 * Parse le fichier Peshitta (format markdown) et le met en cache.
 */
function chargerPeshitta() {
  if (peshittaCache) return peshittaCache;

  const filePath = path.join(DATA_DIR, "peshitta", "syriac.md");
  const raw = fs.readFileSync(filePath, "utf-8");

  const livres: Array<{ livre: string; chapitre: number; versets: Array<{ numero: number; texte: string }> }> = [];
  let livreCourant = "";
  let chapitreCourant = 0;
  let versetsCourants: Array<{ numero: number; texte: string }> = [];

  const lignes = raw.split("\n");
  for (const ligne of lignes) {
    // Titre de livre : "# Genesis"
    if (ligne.startsWith("# ") && !ligne.startsWith("## ")) {
      if (versetsCourants.length > 0) {
        livres.push({ livre: livreCourant, chapitre: chapitreCourant, versets: versetsCourants });
      }
      livreCourant = ligne.substring(2).trim();
      chapitreCourant = 0;
      versetsCourants = [];
    }
    // Titre de chapitre : "## Chapter 1"
    else if (ligne.startsWith("## ")) {
      if (versetsCourants.length > 0) {
        livres.push({ livre: livreCourant, chapitre: chapitreCourant, versets: versetsCourants });
      }
      chapitreCourant = parseInt(ligne.match(/\d+/)?.[0] || "0");
      versetsCourants = [];
    }
    // Verset : "*1* texte..."
    else if (ligne.match(/^\*\d+\*/)) {
      const match = ligne.match(/^\*(\d+)\*\s*(.*)/);
      if (match) {
        versetsCourants.push({ numero: parseInt(match[1]), texte: match[2].trim() });
      }
    }
  }

  if (versetsCourants.length > 0) {
    livres.push({ livre: livreCourant, chapitre: chapitreCourant, versets: versetsCourants });
  }

  peshittaCache = livres;
  return peshittaCache;
}

/**
 * Récupère un verset de la Peshitta araméenne.
 */
export function getVersetPeshitta(
  livre: string,
  chapitre: number,
  verset: number
): string | null {
  const data = chargerPeshitta();
  const chap = data.find((c) => c.livre === livre && c.chapitre === chapitre);
  if (!chap) return null;

  const vers = chap.versets.find((v) => v.numero === verset);
  return vers?.texte || null;
}

/**
 * Récupère un chapitre complet de la Peshitta.
 */
export function getChapitrePeshitta(
  livre: string,
  chapitre: number
): Array<{ numero: number; texte: string }> | null {
  const data = chargerPeshitta();
  const chap = data.find((c) => c.livre === livre && c.chapitre === chapitre);
  return chap?.versets || null;
}

/**
 * Liste les livres disponibles dans la Peshitta.
 */
export function listerLivresPeshitta(): string[] {
  const data = chargerPeshitta();
  return Array.from(new Set(data.map((c) => c.livre)));
}

// ============================================================
// 5. CONCORDANCE STRONG
// ============================================================

/**
 * Cherche tous les versets où apparaît un numéro Strong donné.
 * Parcourt la Bible hébraïque morphologique (AT) pour les numéros H.
 */
export function concordanceStrong(
  numero: string,
  limite = 50
): Array<{ livre: string; livreId: string; chapitre: number; verset: number; mots: MotHebreu[] }> {
  const num = numero.toUpperCase();
  if (!num.startsWith("H")) return []; // Concordance AT seulement pour l'instant

  const strongNum = num.substring(1); // "1961" depuis "H1961"
  const data = chargerMorphhb();
  const resultats: Array<{ livre: string; livreId: string; chapitre: number; verset: number; mots: MotHebreu[] }> = [];

  for (const [nomLivre, livre] of Object.entries(data)) {
    const livreId = OSHB_VERS_ID[nomLivre] || nomLivre;
    for (let c = 0; c < livre.length; c++) {
      const chap = livre[c];
      for (let v = 0; v < chap.length; v++) {
        const vers = chap[v];
        const contient = vers.some((mot: string[]) => {
          // lemme peut être "Hc/H1961" — on cherche "1961" dans les segments
          const lemmes = mot[1].split("/");
          return lemmes.some((l: string) => {
            const clean = l.replace(/^H/, "").replace(/^a/, "").replace(/^c/, "").replace(/^d/, "").replace(/^l/, "").replace(/^m/, "").replace(/^p/, "").replace(/^r/, "");
            return clean === strongNum;
          });
        });

        if (contient) {
          resultats.push({
            livre: nomLivre,
            livreId,
            chapitre: c + 1,
            verset: v + 1,
            mots: vers.map((mot: string[]) => ({
              mot: mot[0],
              lemme: mot[1],
              morphologie: mot[2],
            })),
          });
          if (resultats.length >= limite) return resultats;
        }
      }
    }
  }

  return resultats;
}
