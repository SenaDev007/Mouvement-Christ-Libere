/**
 * Chargeur de données bibliques — Vercel-compatible
 *
 * ⭐ V4.20 — CHARGEMENT PARESSEUX (RAM Railway) : les 66 Mo de JSON
 * bibliques (6 versions + Strong hébreu/grec + morphhb + Peshitta)
 * étaient importés STATIQUEMENT → analysés en objets JS au DÉMARRAGE du
 * process Railway, ~247 Mo de RSS 24 h/24, pour des routes bibliques
 * quasi inutilisées côté Railway (le web sert sa propre API Vercel ;
 * l'app mobile aussi). Facturation Railway = RAM + CPU consommés.
 *
 * Désormais : require() paresseux AU PREMIER APPEL + cache — le process
 * démarre léger, une version/lexicon n'occupe de la mémoire QUE si
 * quelqu'un la demande vraiment (et y reste en cache pour les appels
 * suivants : re-parsing évité).
 *
 * NOTE BUILD : plus aucun import statique de JSON → tsc ne les copie plus
 * dans dist/. Le script build de package.json copie src/data → dist/data
 * (fs.cpSync, multiplateforme) pour que les require() résolvent en prod.
 * En dev (tsx), les require() résolvent directement dans src/.
 */

// require() paresseux — CommonJS ("type": "commonjs" + module: CommonJS),
// résout aussi bien sous tsx (src/) qu'en prod (dist/, grâce à la copie
// du script build). Aucun import statique : c'est le but (RAM au démarrage).

const CHEMINS_VERSIONS: Record<string, { chemin: string; langue: string; nom: string }> = {
  "fr-apee": { chemin: "../../data/bible/versions/fr-apee.json", langue: "fr", nom: "Bible de l'Épée (Français)" },
  "en-kjv": { chemin: "../../data/bible/versions/en-kjv.json", langue: "en", nom: "King James Version (English)" },
  "en-bbe": { chemin: "../../data/bible/versions/en-bbe.json", langue: "en", nom: "Bible in Basic English" },
  "es-rvr": { chemin: "../../data/bible/versions/es-rvr.json", langue: "es", nom: "Reina Valera (Español)" },
  "pt-acf": { chemin: "../../data/bible/versions/pt-acf.json", langue: "pt", nom: "Almeida Corrigida Fiel (Português)" },
  "ar-svd": { chemin: "../../data/bible/versions/ar-svd.json", langue: "ar", nom: "Arabic Bible (العربية)" },
};

export interface LivreBible {
  id: string;
  nom: string;
  chapters: string[][];
}

export interface VersionBible {
  code: string;
  langue: string;
  nom: string;
  livres: LivreBible[];
}

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

const VERSIONS_DATA = CHEMINS_VERSIONS;

const cacheVersions: Record<string, VersionBible> = {};

export function chargerVersion(code: string): VersionBible | null {
  if (cacheVersions[code]) return cacheVersions[code];
  const config = VERSIONS_DATA[code];
  if (!config) return null;

  // ⭐ V4.20 — require paresseux : la version n'entre en mémoire qu'ici.
  const livres = require(config.chemin) as LivreBible[];
  for (const livre of livres) {
    livre.nom = ID_VERS_NOM[livre.id] || livre.id;
  }

  const version: VersionBible = { code, langue: config.langue, nom: config.nom, livres };
  cacheVersions[code] = version;
  return version;
}

export function getVerset(versionCode: string, livreId: string, chapitre: number, verset: number): string | null {
  const version = chargerVersion(versionCode);
  if (!version) return null;
  const livre = version.livres.find((l) => l.id === livreId);
  if (!livre) return null;
  return livre.chapters[chapitre - 1]?.[verset - 1] || null;
}

export function getChapitre(versionCode: string, livreId: string, chapitre: number): string[] | null {
  const version = chargerVersion(versionCode);
  if (!version) return null;
  const livre = version.livres.find((l) => l.id === livreId);
  if (!livre) return null;
  return livre.chapters[chapitre - 1] || null;
}

export function listerVersions() {
  return Object.entries(VERSIONS_DATA).map(([code, v]) => ({ code, langue: v.langue, nom: v.nom }));
}

export function rechercherVersets(versionCode: string, recherche: string, limite = 50) {
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
          resultats.push({ livre: livre.nom, livreId: livre.id, chapitre: c + 1, verset: v + 1, texte: chap[v] });
          if (resultats.length >= limite) return resultats;
        }
      }
    }
  }
  return resultats;
}

// === STRONG ===
export interface EntreeStrong {
  numero: string; langue: "hebrew" | "greek";
  lemma?: string; xlit?: string; pron?: string; translit?: string;
  derivation?: string; strongs_def?: string; kjv_def?: string;
}

// ⭐ V4.20 — Strong hébreu/grec (6 Mo de JSON) chargés AU PREMIER usage.
let _strongHebreu: Record<string, Omit<EntreeStrong, "numero" | "langue">> | null = null;
let _strongGrec: Record<string, Omit<EntreeStrong, "numero" | "langue">> | null = null;

function strongHebrewData(): Record<string, Omit<EntreeStrong, "numero" | "langue">> {
  if (!_strongHebreu) {
    _strongHebreu = require("../../data/bible/strongs/hebrew.json") as Record<
      string,
      Omit<EntreeStrong, "numero" | "langue">
    >;
  }
  return _strongHebreu;
}

function strongGreekData(): Record<string, Omit<EntreeStrong, "numero" | "langue">> {
  if (!_strongGrec) {
    _strongGrec = require("../../data/bible/strongs/greek.json") as Record<
      string,
      Omit<EntreeStrong, "numero" | "langue">
    >;
  }
  return _strongGrec;
}

export function chercherStrong(numero: string): EntreeStrong | null {
  const num = numero.toUpperCase();
  if (num.startsWith("H")) {
    const entry = strongHebrewData()[num];
    return entry ? { ...entry, numero: num, langue: "hebrew" as const } : null;
  }
  if (num.startsWith("G")) {
    const entry = strongGreekData()[num];
    return entry ? { ...entry, numero: num, langue: "greek" as const } : null;
  }
  return null;
}

// === MORPHHB ===
export interface MotHebreu { mot: string; lemme: string; morphologie: string; }

// ⭐ V4.20 — morphhb (19 Mo) chargé AU PREMIER usage.
let _morphhb: Record<string, string[][][][]> | null = null;

function morphhbData(): Record<string, string[][][][]> {
  if (!_morphhb) {
    _morphhb = require("../../data/bible/morphhb/index.json") as Record<string, string[][][][]>;
  }
  return _morphhb;
}

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

export function getVersetHebreu(livreNom: string, chapitre: number, verset: number): { mots: MotHebreu[] } | null {
  const livre = morphhbData()[livreNom];
  if (!livre) return null;
  const vers = livre[chapitre - 1]?.[verset - 1];
  if (!vers) return null;
  return { mots: vers.map((mot: string[]) => ({ mot: mot[0], lemme: mot[1], morphologie: mot[2] })) };
}

export function oshbVersId(nomOshb: string): string | null { return OSHB_VERS_ID[nomOshb] || null; }
export function listerLivresHebreu(): string[] { return Object.keys(morphhbData()); }

export function concordanceStrong(numero: string, limite = 50) {
  const num = numero.toUpperCase();
  if (!num.startsWith("H")) return [];
  const strongNum = num.substring(1);
  const resultats: Array<{ livre: string; livreId: string; chapitre: number; verset: number; mots: MotHebreu[] }> = [];
  for (const [nomLivre, livre] of Object.entries(morphhbData())) {
    const livreId = OSHB_VERS_ID[nomLivre] || nomLivre;
    for (let c = 0; c < livre.length; c++) {
      for (let v = 0; v < livre[c].length; v++) {
        const vers = livre[c][v];
        const contient = vers.some((mot: string[]) => {
          const lemmes = mot[1].split("/");
          return lemmes.some((l: string) => l.replace(/^H[a-z]*/, "") === strongNum);
        });
        if (contient) {
          resultats.push({
            livre: nomLivre, livreId, chapitre: c + 1, verset: v + 1,
            mots: vers.map((mot: string[]) => ({ mot: mot[0], lemme: mot[1], morphologie: mot[2] })),
          });
          if (resultats.length >= limite) return resultats;
        }
      }
    }
  }
  return resultats;
}

// === PESHITTA ===
interface PeshittaChapitre {
  livre: string;
  chapitre: number;
  versets: Array<{ numero: number; texte: string }>;
}

// ⭐ V4.20 — Peshitta (15 Mo) chargée AU PREMIER usage.
let _peshitta: PeshittaChapitre[] | null = null;

function peshittaCache(): PeshittaChapitre[] {
  if (!_peshitta) {
    _peshitta = require("../../data/bible/peshitta/peshitta.json") as unknown as PeshittaChapitre[];
  }
  return _peshitta;
}

export function getChapitrePeshitta(livre: string, chapitre: number) {
  return peshittaCache().find((c) => c.livre === livre && c.chapitre === chapitre)?.versets || null;
}

export function listerLivresPeshitta(): string[] {
  return Array.from(new Set(peshittaCache().map((c) => c.livre)));
}
