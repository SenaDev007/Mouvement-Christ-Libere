/**
 * Chargeur de données bibliques — Vercel-compatible
 *
 * Importe tous les fichiers JSON directement comme modules ES.
 * Pas de fs.readFileSync, pas de raw-loader, pas de fallback.
 * Les données sont bundlées dans le code JavaScript.
 */

import frApee from "@/data/bible/versions/fr-apee.json";
import enKjv from "@/data/bible/versions/en-kjv.json";
import enBbe from "@/data/bible/versions/en-bbe.json";
import esRvr from "@/data/bible/versions/es-rvr.json";
import ptAcf from "@/data/bible/versions/pt-acf.json";
import arSvd from "@/data/bible/versions/ar-svd.json";
import strongHebrew from "@/data/bible/strongs/hebrew.json";
import strongGreek from "@/data/bible/strongs/greek.json";
import morphhb from "@/data/bible/morphhb/index.json";

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

const VERSIONS_DATA: Record<string, { data: LivreBible[]; langue: string; nom: string }> = {
  "fr-apee": { data: frApee as unknown as LivreBible[], langue: "fr", nom: "Bible de l'Épée (Français)" },
  "en-kjv": { data: enKjv as unknown as LivreBible[], langue: "en", nom: "King James Version (English)" },
  "en-bbe": { data: enBbe as unknown as LivreBible[], langue: "en", nom: "Bible in Basic English" },
  "es-rvr": { data: esRvr as unknown as LivreBible[], langue: "es", nom: "Reina Valera (Español)" },
  "pt-acf": { data: ptAcf as unknown as LivreBible[], langue: "pt", nom: "Almeida Corrigida Fiel (Português)" },
  "ar-svd": { data: arSvd as unknown as LivreBible[], langue: "ar", nom: "Arabic Bible (العربية)" },
};

const cacheVersions: Record<string, VersionBible> = {};

export function chargerVersion(code: string): VersionBible | null {
  if (cacheVersions[code]) return cacheVersions[code];
  const config = VERSIONS_DATA[code];
  if (!config) return null;

  const livres = config.data;
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

const strongHebrewData = strongHebrew as unknown as Record<string, Omit<EntreeStrong, "numero" | "langue">>;
const strongGreekData = strongGreek as unknown as Record<string, Omit<EntreeStrong, "numero" | "langue">>;

export function chercherStrong(numero: string): EntreeStrong | null {
  const num = numero.toUpperCase();
  if (num.startsWith("H")) {
    const entry = strongHebrewData[num];
    return entry ? { ...entry, numero: num, langue: "hebrew" as const } : null;
  }
  if (num.startsWith("G")) {
    const entry = strongGreekData[num];
    return entry ? { ...entry, numero: num, langue: "greek" as const } : null;
  }
  return null;
}

// === MORPHHB ===
export interface MotHebreu { mot: string; lemme: string; morphologie: string; }

const morphhbData = morphhb as unknown as Record<string, string[][][][]>;

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
  const livre = morphhbData[livreNom];
  if (!livre) return null;
  const vers = livre[chapitre - 1]?.[verset - 1];
  if (!vers) return null;
  return { mots: vers.map((mot: string[]) => ({ mot: mot[0], lemme: mot[1], morphologie: mot[2] })) };
}

export function oshbVersId(nomOshb: string): string | null { return OSHB_VERS_ID[nomOshb] || null; }
export function listerLivresHebreu(): string[] { return Object.keys(morphhbData); }

export function concordanceStrong(numero: string, limite = 50) {
  const num = numero.toUpperCase();
  if (!num.startsWith("H")) return [];
  const strongNum = num.substring(1);
  const resultats: Array<{ livre: string; livreId: string; chapitre: number; verset: number; mots: MotHebreu[] }> = [];
  for (const [nomLivre, livre] of Object.entries(morphhbData)) {
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
import peshittaData from "@/data/bible/peshitta/peshitta.json";

interface PeshittaChapitre {
  livre: string;
  chapitre: number;
  versets: Array<{ numero: number; texte: string }>;
}

const peshittaCache = peshittaData as unknown as PeshittaChapitre[];

export function getChapitrePeshitta(livre: string, chapitre: number) {
  return peshittaCache.find((c) => c.livre === livre && c.chapitre === chapitre)?.versets || null;
}

export function listerLivresPeshitta(): string[] {
  return Array.from(new Set(peshittaCache.map((c) => c.livre)));
}
