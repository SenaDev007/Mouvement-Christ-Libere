/**
 * Moteur de références bibliques — Mouvement Christ Libère (V3)
 *
 * Parse, normalise et résout les références bibliques (ex: "Genèse 5:24",
 * "1 Corinthiens 15:20", "Ésaïe 11:12-14").
 *
 * Supporte les notations françaises et anglaises, les abréviations courantes,
 * et les plages de versets.
 */

// ============================================================
// LIVRES BIBLIQUES — noms français + abréviations + noms anglais
// ============================================================

export interface LivreBiblique {
  id: string; // "genese", "1_corinthiens", etc.
  nomFr: string; // "Genèse"
  nomFrCourt: string; // "Gen"
  nomEn: string; // "Genesis"
  nomEnCourt: string; // "Gen"
  nomHe: string | null; // "בְּרֵאשִׁית"
  testament: "AT" | "NT";
  chapitres: number; // nombre de chapitres
}

export const LIVRES_BIBLIQUES: LivreBiblique[] = [
  // === ANCIEN TESTAMENT ===
  { id: "genese", nomFr: "Genèse", nomFrCourt: "Gen", nomEn: "Genesis", nomEnCourt: "Gen", nomHe: "בְּרֵאשִׁית", testament: "AT", chapitres: 50 },
  { id: "exode", nomFr: "Exode", nomFrCourt: "Ex", nomEn: "Exodus", nomEnCourt: "Ex", nomHe: "שְׁמוֹת", testament: "AT", chapitres: 40 },
  { id: "levitique", nomFr: "Lévitique", nomFrCourt: "Lév", nomEn: "Leviticus", nomEnCourt: "Lev", nomHe: "וַיִּקְרָא", testament: "AT", chapitres: 27 },
  { id: "nombres", nomFr: "Nombres", nomFrCourt: "Nb", nomEn: "Numbers", nomEnCourt: "Num", nomHe: "בַּמִּדְבָּר", testament: "AT", chapitres: 36 },
  { id: "deuteronome", nomFr: "Deutéronome", nomFrCourt: "Deut", nomEn: "Deuteronomy", nomEnCourt: "Deut", nomHe: "דְּבָרִים", testament: "AT", chapitres: 34 },
  { id: "josue", nomFr: "Josué", nomFrCourt: "Jos", nomEn: "Joshua", nomEnCourt: "Josh", nomHe: "יְהוֹשֻׁעַ", testament: "AT", chapitres: 24 },
  { id: "juges", nomFr: "Juges", nomFrCourt: "Jug", nomEn: "Judges", nomEnCourt: "Judg", nomHe: "שֹׁפְטִים", testament: "AT", chapitres: 21 },
  { id: "ruth", nomFr: "Ruth", nomFrCourt: "Ruth", nomEn: "Ruth", nomEnCourt: "Ruth", nomHe: "רוּת", testament: "AT", chapitres: 4 },
  { id: "1_samuel", nomFr: "1 Samuel", nomFrCourt: "1 Sam", nomEn: "1 Samuel", nomEnCourt: "1 Sam", nomHe: "שְׁמוּאֵל א", testament: "AT", chapitres: 31 },
  { id: "2_samuel", nomFr: "2 Samuel", nomFrCourt: "2 Sam", nomEn: "2 Samuel", nomEnCourt: "2 Sam", nomHe: "שְׁמוּאֵל ב", testament: "AT", chapitres: 24 },
  { id: "1_rois", nomFr: "1 Rois", nomFrCourt: "1 Rois", nomEn: "1 Kings", nomEnCourt: "1 Kgs", nomHe: "מְלָכִים א", testament: "AT", chapitres: 22 },
  { id: "2_rois", nomFr: "2 Rois", nomFrCourt: "2 Rois", nomEn: "2 Kings", nomEnCourt: "2 Kgs", nomHe: "מְלָכִים ב", testament: "AT", chapitres: 25 },
  { id: "1_chroniques", nomFr: "1 Chroniques", nomFrCourt: "1 Chr", nomEn: "1 Chronicles", nomEnCourt: "1 Chr", nomHe: "דִּבְרֵי הַיָּמִים א", testament: "AT", chapitres: 29 },
  { id: "2_chroniques", nomFr: "2 Chroniques", nomFrCourt: "2 Chr", nomEn: "2 Chronicles", nomEnCourt: "2 Chr", nomHe: "דִּבְרֵי הַיָּמִים ב", testament: "AT", chapitres: 36 },
  { id: "esdras", nomFr: "Esdras", nomFrCourt: "Esd", nomEn: "Ezra", nomEnCourt: "Ezra", nomHe: "עֶזְרָא", testament: "AT", chapitres: 10 },
  { id: "nehemie", nomFr: "Néhémie", nomFrCourt: "Néh", nomEn: "Nehemiah", nomEnCourt: "Neh", nomHe: "נְחֶמְיָה", testament: "AT", chapitres: 13 },
  { id: "esther", nomFr: "Esther", nomFrCourt: "Est", nomEn: "Esther", nomEnCourt: "Est", nomHe: "אֶסְתֵּר", testament: "AT", chapitres: 10 },
  { id: "job", nomFr: "Job", nomFrCourt: "Job", nomEn: "Job", nomEnCourt: "Job", nomHe: "אִיּוֹב", testament: "AT", chapitres: 42 },
  { id: "psaumes", nomFr: "Psaumes", nomFrCourt: "Ps", nomEn: "Psalms", nomEnCourt: "Ps", nomHe: "תְּהִלִּים", testament: "AT", chapitres: 150 },
  { id: "proverbes", nomFr: "Proverbes", nomFrCourt: "Prov", nomEn: "Proverbs", nomEnCourt: "Prov", nomHe: "מִשְׁלֵי", testament: "AT", chapitres: 31 },
  { id: "ecclesiaste", nomFr: "Ecclésiaste", nomFrCourt: "Eccl", nomEn: "Ecclesiastes", nomEnCourt: "Ecc", nomHe: "קֹהֶלֶת", testament: "AT", chapitres: 12 },
  { id: "cantique", nomFr: "Cantique des Cantiques", nomFrCourt: "Cant", nomEn: "Song of Solomon", nomEnCourt: "Song", nomHe: "שִׁיר הַשִּׁירִים", testament: "AT", chapitres: 8 },
  { id: "esaie", nomFr: "Ésaïe", nomFrCourt: "És", nomEn: "Isaiah", nomEnCourt: "Isa", nomHe: "יְשַׁעְיָהוּ", testament: "AT", chapitres: 66 },
  { id: "jeremie", nomFr: "Jérémie", nomFrCourt: "Jér", nomEn: "Jeremiah", nomEnCourt: "Jer", nomHe: "יִרְמְיָהוּ", testament: "AT", chapitres: 52 },
  { id: "lamentations", nomFr: "Lamentations", nomFrCourt: "Lam", nomEn: "Lamentations", nomEnCourt: "Lam", nomHe: "אֵיכָה", testament: "AT", chapitres: 5 },
  { id: "ezechiel", nomFr: "Ézéchiel", nomFrCourt: "Éz", nomEn: "Ezekiel", nomEnCourt: "Ezek", nomHe: "יְחֶזְקֵאל", testament: "AT", chapitres: 48 },
  { id: "daniel", nomFr: "Daniel", nomFrCourt: "Dan", nomEn: "Daniel", nomEnCourt: "Dan", nomHe: "דָּנִיֵּאל", testament: "AT", chapitres: 12 },
  { id: "osee", nomFr: "Osée", nomFrCourt: "Os", nomEn: "Hosea", nomEnCourt: "Hos", nomHe: "הוֹשֵׁעַ", testament: "AT", chapitres: 14 },
  { id: "joel", nomFr: "Joël", nomFrCourt: "Joël", nomEn: "Joel", nomEnCourt: "Joel", nomHe: "יוֹאֵל", testament: "AT", chapitres: 3 },
  { id: "amos", nomFr: "Amos", nomFrCourt: "Am", nomEn: "Amos", nomEnCourt: "Amos", nomHe: "עָמוֹס", testament: "AT", chapitres: 9 },
  { id: "abdias", nomFr: "Abdias", nomFrCourt: "Abd", nomEn: "Obadiah", nomEnCourt: "Obad", nomHe: "עֹבַדְיָה", testament: "AT", chapitres: 1 },
  { id: "jonas", nomFr: "Jonas", nomFrCourt: "Jon", nomEn: "Jonah", nomEnCourt: "Jonah", nomHe: "יוֹנָה", testament: "AT", chapitres: 4 },
  { id: "michee", nomFr: "Michée", nomFrCourt: "Mich", nomEn: "Micah", nomEnCourt: "Mic", nomHe: "מִיכָה", testament: "AT", chapitres: 7 },
  { id: "nahum", nomFr: "Nahum", nomFrCourt: "Nah", nomEn: "Nahum", nomEnCourt: "Nah", nomHe: "נַחוּם", testament: "AT", chapitres: 3 },
  { id: "habacuc", nomFr: "Habacuc", nomFrCourt: "Hab", nomEn: "Habakkuk", nomEnCourt: "Hab", nomHe: "חֲבַקּוּק", testament: "AT", chapitres: 3 },
  { id: "sophonie", nomFr: "Sophonie", nomFrCourt: "Soph", nomEn: "Zephaniah", nomEnCourt: "Zeph", nomHe: "צְפַנְיָה", testament: "AT", chapitres: 3 },
  { id: "aggee", nomFr: "Aggée", nomFrCourt: "Agg", nomEn: "Haggai", nomEnCourt: "Hag", nomHe: "חַגַּי", testament: "AT", chapitres: 2 },
  { id: "zacharie", nomFr: "Zacharie", nomFrCourt: "Zach", nomEn: "Zechariah", nomEnCourt: "Zech", nomHe: "זְכַרְיָה", testament: "AT", chapitres: 14 },
  { id: "malachie", nomFr: "Malachie", nomFrCourt: "Mal", nomEn: "Malachi", nomEnCourt: "Mal", nomHe: "מַלְאָכִי", testament: "AT", chapitres: 4 },

  // === NOUVEAU TESTAMENT ===
  { id: "matthieu", nomFr: "Matthieu", nomFrCourt: "Mat", nomEn: "Matthew", nomEnCourt: "Matt", nomHe: null, testament: "NT", chapitres: 28 },
  { id: "marc", nomFr: "Marc", nomFrCourt: "Marc", nomEn: "Mark", nomEnCourt: "Mark", nomHe: null, testament: "NT", chapitres: 16 },
  { id: "luc", nomFr: "Luc", nomFrCourt: "Luc", nomEn: "Luke", nomEnCourt: "Luke", nomHe: null, testament: "NT", chapitres: 24 },
  { id: "jean", nomFr: "Jean", nomFrCourt: "Jean", nomEn: "John", nomEnCourt: "John", nomHe: null, testament: "NT", chapitres: 21 },
  { id: "actes", nomFr: "Actes", nomFrCourt: "Act", nomEn: "Acts", nomEnCourt: "Acts", nomHe: null, testament: "NT", chapitres: 28 },
  { id: "romains", nomFr: "Romains", nomFrCourt: "Rom", nomEn: "Romans", nomEnCourt: "Rom", nomHe: null, testament: "NT", chapitres: 16 },
  { id: "1_corinthiens", nomFr: "1 Corinthiens", nomFrCourt: "1 Cor", nomEn: "1 Corinthians", nomEnCourt: "1 Cor", nomHe: null, testament: "NT", chapitres: 16 },
  { id: "2_corinthiens", nomFr: "2 Corinthiens", nomFrCourt: "2 Cor", nomEn: "2 Corinthians", nomEnCourt: "2 Cor", nomHe: null, testament: "NT", chapitres: 13 },
  { id: "galates", nomFr: "Galates", nomFrCourt: "Gal", nomEn: "Galatians", nomEnCourt: "Gal", nomHe: null, testament: "NT", chapitres: 6 },
  { id: "ephesiens", nomFr: "Éphésiens", nomFrCourt: "Éph", nomEn: "Ephesians", nomEnCourt: "Eph", nomHe: null, testament: "NT", chapitres: 6 },
  { id: "philippiens", nomFr: "Philippiens", nomFrCourt: "Phil", nomEn: "Philippians", nomEnCourt: "Phil", nomHe: null, testament: "NT", chapitres: 4 },
  { id: "colossiens", nomFr: "Fr:Colossiens", nomFrCourt: "Col", nomEn: "Colossians", nomEnCourt: "Col", nomHe: null, testament: "NT", chapitres: 4 },
  { id: "1_thessaloniciens", nomFr: "1 Thessaloniciens", nomFrCourt: "1 Thess", nomEn: "1 Thessalonians", nomEnCourt: "1 Thess", nomHe: null, testament: "NT", chapitres: 5 },
  { id: "2_thessaloniciens", nomFr: "2 Thessaloniciens", nomFrCourt: "2 Thess", nomEn: "2 Thessalonians", nomEnCourt: "2 Thess", nomHe: null, testament: "NT", chapitres: 3 },
  { id: "1_timothee", nomFr: "1 Timothée", nomFrCourt: "1 Tim", nomEn: "1 Timothy", nomEnCourt: "1 Tim", nomHe: null, testament: "NT", chapitres: 6 },
  { id: "2_timothee", nomFr: "2 Timothée", nomFrCourt: "2 Tim", nomEn: "2 Timothy", nomEnCourt: "2 Tim", nomHe: null, testament: "NT", chapitres: 4 },
  { id: "tite", nomFr: "Tite", nomFrCourt: "Tite", nomEn: "Titus", nomEnCourt: "Titus", nomHe: null, testament: "NT", chapitres: 3 },
  { id: "philemon", nomFr: "Philémon", nomFrCourt: "Phlm", nomEn: "Philemon", nomEnCourt: "Phlm", nomHe: null, testament: "NT", chapitres: 1 },
  { id: "hebreux", nomFr: "Hébreux", nomFrCourt: "Héb", nomEn: "Hebrews", nomEnCourt: "Heb", nomHe: null, testament: "NT", chapitres: 13 },
  { id: "jacques", nomFr: "Jacques", nomFrCourt: "Jac", nomEn: "James", nomEnCourt: "Jas", nomHe: null, testament: "NT", chapitres: 5 },
  { id: "1_pierre", nomFr: "1 Pierre", nomFrCourt: "1 Pi", nomEn: "1 Peter", nomEnCourt: "1 Pet", nomHe: null, testament: "NT", chapitres: 5 },
  { id: "2_pierre", nomFr: "2 Pierre", nomFrCourt: "2 Pi", nomEn: "2 Peter", nomEnCourt: "2 Pet", nomHe: null, testament: "NT", chapitres: 3 },
  { id: "1_jean", nomFr: "1 Jean", nomFrCourt: "1 Jean", nomEn: "1 John", nomEnCourt: "1 John", nomHe: null, testament: "NT", chapitres: 5 },
  { id: "2_jean", nomFr: "2 Jean", nomFrCourt: "2 Jean", nomEn: "2 John", nomEnCourt: "2 John", nomHe: null, testament: "NT", chapitres: 1 },
  { id: "3_jean", nomFr: "3 Jean", nomFrCourt: "3 Jean", nomEn: "3 John", nomEnCourt: "3 John", nomHe: null, testament: "NT", chapitres: 1 },
  { id: "jude", nomFr: "Jude", nomFrCourt: "Jude", nomEn: "Jude", nomEnCourt: "Jude", nomHe: null, testament: "NT", chapitres: 1 },
  { id: "apocalypse", nomFr: "Apocalypse", nomFrCourt: "Apoc", nomEn: "Revelation", nomEnCourt: "Rev", nomHe: null, testament: "NT", chapitres: 22 },
];

// Map : toutes les variantes de nom → livre
const MAP_LIVRES: Map<string, LivreBiblique> = new Map();
for (const livre of LIVRES_BIBLIQUES) {
  // Ajouter toutes les variantes (minuscules, sans accents)
  const variantes = [
    livre.nomFr,
    livre.nomFrCourt,
    livre.nomEn,
    livre.nomEnCourt,
    livre.id,
  ];
  for (const v of variantes) {
    const normalized = normaliserTexte(v);
    if (!MAP_LIVRES.has(normalized)) {
      MAP_LIVRES.set(normalized, livre);
    }
  }
}

function normaliserTexte(texte: string): string {
  return texte
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/\s+/g, " ");
}

// ============================================================
// PARSER DE RÉFÉRENCE
// ============================================================

export interface ReferenceBiblique {
  livre: LivreBiblique;
  chapitre: number;
  versetDebut: number;
  versetFin?: number; // pour les plages (ex: 5-7)
  referenceOriginale: string;
  referenceNormalisee: string; // "Genèse 5:24"
}

/**
 * Parse une référence biblique.
 *
 * Formats supportés :
 * - "Genèse 5:24"
 * - "Gen 5:24"
 * - "Genesis 5:24"
 * - "1 Corinthiens 15:20"
 * - "1 Cor 15:20-22"
 * - "Esaie 11:12" (sans accent)
 * - "Ps 119:9-11"
 */
export function parserReference(reference: string): ReferenceBiblique | null {
  if (!reference) return null;

  // Regex : livre (avec optionnellement un chiffre devant) + chapitre + verset(s)
  // Capture : [1] numéro livre (1/2/3), [2] nom livre, [3] chapitre, [4] verset début, [5] verset fin optionnel
  const match = reference.trim().match(
    /^(?:(\d)\s+)?([A-Za-zÀ-ÿ\s]+?)\s+(\d+):(\d+)(?:-(\d+))?$/
  );

  if (!match) return null;

  const [, numLivre, nomLivre, chapStr, versetStr, versetFinStr] = match;
  const nomComplet = numLivre ? `${numLivre} ${nomLivre}` : nomLivre;
  const normalized = normaliserTexte(nomComplet);

  const livre = MAP_LIVRES.get(normalized);
  if (!livre) return null;

  const chapitre = parseInt(chapStr);
  const versetDebut = parseInt(versetStr);
  const versetFin = versetFinStr ? parseInt(versetFinStr) : undefined;

  if (chapitre < 1 || chapitre > livre.chapitres) return null;
  if (versetDebut < 1) return null;

  return {
    livre,
    chapitre,
    versetDebut,
    versetFin,
    referenceOriginale: reference,
    referenceNormalisee: `${livre.nomFr} ${chapitre}:${versetDebut}${versetFin ? `-${versetFin}` : ""}`,
  };
}

/**
 * Détecte toutes les références bibliques dans un texte.
 * Utile pour rendre les références cliquables dans les enseignements/témoignages.
 *
 * @returns Liste des références trouvées avec leur position dans le texte
 */
export function detecterReferencesDansTexte(texte: string): Array<{
  reference: ReferenceBiblique;
  debut: number;
  fin: number;
}> {
  const resultats: Array<{ reference: ReferenceBiblique; debut: number; fin: number }> = [];

  // Pattern large : chiffre optionnel + mots + chiffre:chiffre
  const pattern = /(?:(\d)\s+)?([A-Za-zÀ-ÿ]{2,}(?:\s+[A-Za-zÀ-ÿ]+)?)\s+(\d+):(\d+)(?:-(\d+))?/g;

  let match;
  while ((match = pattern.exec(texte)) !== null) {
    const refStr = match[0];
    const parsed = parserReference(refStr);
    if (parsed) {
      resultats.push({
        reference: parsed,
        debut: match.index,
        fin: match.index + refStr.length,
      });
    }
  }

  return resultats;
}

/**
 * Retourne tous les livres (pour interface de sélection).
 */
export function getLivres(): LivreBiblique[] {
  return LIVRES_BIBLIQUES;
}

/**
 * Retourne les livres par testament.
 */
export function getLivresParTestament(testament: "AT" | "NT"): LivreBiblique[] {
  return LIVRES_BIBLIQUES.filter((l) => l.testament === testament);
}

/**
 * Cherche un livre par nom ou abréviation.
 */
export function trouverLivre(nom: string): LivreBiblique | null {
  return MAP_LIVRES.get(normaliserTexte(nom)) || null;
}
