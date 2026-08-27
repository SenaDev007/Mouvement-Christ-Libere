/**
 * Nettoyage des enseignements et témoignages du Pasteur Kongo en DB.
 *
 * 1. Supprime les numérotations en début de titre :
 *    "1. Le nom d'Isolélé" → "Le nom d'Isolélé"
 *    "2. L'usurpation Kazar" → "L'usurpation Kazar"
 *
 * 2. Améliore les références bibliques :
 *    - Pour les teachings: enrichit le champ `book` avec une référence complète
 *      (ex: "Jean" → "Jean 10:10") en parsant le contenu
 *    - Pour les testimonies: enrichit le champ `bookRef` de la même manière
 *
 * 3. Nettoie le markdown dans le contenu :
 *    - Supprime les numérotations en début de titres ## et ###
 *    - Garde les ** et * pour le rendu Markdown
 *
 * Usage: node scripts/clean-kongo-content.js
 */
require("dotenv").config({ path: ".env", override: true });
const { PrismaClient } = require("@prisma/client");

const envDbUrl = require("dotenv").config({ path: ".env", override: true }).parsed?.DATABASE_URL;
if (envDbUrl) process.env.DATABASE_URL = envDbUrl;

const prisma = new PrismaClient();

/**
 * Supprime les numérotations en début de titre
 * "1. Titre" → "Titre"
 * "2. Titre" → "Titre"
 * "10. Titre" → "Titre"
 */
function stripNumbering(title) {
  if (!title) return title;
  return title
    .replace(/^\s*\d+\.\s*/, "")
    .replace(/^\s*\d+\)\s*/, "")
    .replace(/^\s*\d+\s*[-—]\s*/, "")
    .trim();
}

/**
 * Extrait toutes les références bibliques complètes depuis un texte
 * Retourne un tableau de { book, chapter, verse, full }
 * Ex: "Jean 10:10", "Genèse 15:13", "1 Rois 17", "Apocalypse 6:6"
 */
function extractBibleRefs(text) {
  if (!text) return [];

  const books = [
    // Ancien Testament
    "Genèse", "Exode", "Lévitique", "Nombres", "Deutéronome",
    "Josué", "Juges", "Ruth", "1 Samuel", "2 Samuel", "1 Rois", "2 Rois",
    "1 Chroniques", "2 Chroniques", "Esdra", "Néhémie", "Esther",
    "Job", "Psaume", "Psaumes", "Proverbes", "Ecclésiaste", "Cantique",
    "Ésaïe", "Ézéchiel", "Daniel", "Osée", "Joël", "Amos", "Abdias",
    "Jonas", "Michée", "Nahum", "Habacuc", "Sophonie", "Aggée",
    "Zacharie", "Malachie",
    // Nouveau Testament
    "Matthieu", "Marc", "Luc", "Jean", "Actes", "Romains",
    "1 Corinthiens", "2 Corinthiens", "Galates", "Éphésiens",
    "Philippiens", "Colossiens", "1 Thessaloniciens", "2 Thessaloniciens",
    "1 Timothée", "2 Timothée", "Tite", "Philémon", "Hébreux",
    "Jacques", "1 Pierre", "2 Pierre", "1 Jean", "2 Jean", "3 Jean",
    "Jude", "Apocalypse",
  ];

  const refs = [];
  // Pattern: "Livre chapitre:verset" ou "Livre chapitre" ou "1 Livre chapitre"
  // On construit un pattern qui matche n'importe quel livre biblique
  const bookPattern = books.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`(?:${bookPattern})\\s+\\d+(?::\\d+(?:[-–]\\d+)?)?`, "g");

  const matches = text.match(regex) || [];
  const seen = new Set();
  for (const m of matches) {
    const full = m.trim();
    if (seen.has(full)) continue;
    seen.add(full);

    // Extraire livre, chapitre, verset
    const parts = full.match(/^((?:\d+\s+)?[^0-9]+?)\s+(\d+)(?::(\d+))?/);
    if (parts) {
      refs.push({
        book: parts[1].trim(),
        chapter: parts[2],
        verse: parts[3] || null,
        full,
      });
    }
  }

  return refs;
}

/**
 * Sélectionne la meilleure référence biblique pour un enseignement
 * Privilégie les références avec verset (Genèse 15:13) sur celles sans (Genèse 15)
 */
function pickBestRef(refs) {
  if (!refs || refs.length === 0) return null;
  // Prioriser les refs avec verset
  const withVerse = refs.filter((r) => r.verse);
  if (withVerse.length > 0) return withVerse[0];
  return refs[0];
}

async function main() {
  console.log("🧹 Nettoyage des enseignements et témoignages du Pasteur Kongo...\n");

  let titlesFixed = 0;
  let refsImproved = 0;

  // ===== 1. ENSEIGNEMENTS =====
  console.log("📖 Traitement des enseignements...");
  const teachings = await prisma.teaching.findMany({
    where: { servant: { code: "kongo" } },
    select: { id: true, title: true, content: true, book: true },
  });
  console.log(`   ${teachings.length} enseignements à traiter`);

  for (const t of teachings) {
    const newTitle = stripNumbering(t.title);

    // Extraire les références bibliques du contenu
    const refs = extractBibleRefs(t.content);
    const bestRef = pickBestRef(refs);

    // Si on a une meilleure référence que juste le nom du livre, l'utiliser
    let newBook = t.book;
    if (bestRef && bestRef.full) {
      // Si le book actuel est juste le nom du livre (ex: "Genèse")
      // et qu'on a une réf complète (ex: "Genèse 15:13"), utiliser la complète
      if (!t.book || t.book === bestRef.book) {
        newBook = bestRef.full;
      }
    }

    // Nettoyer aussi les numérotations dans les titres ## et ### du contenu
    let newContent = t.content
      .replace(/^(##+)\s+\d+\.\s+/gm, "$1 ")
      .replace(/^(##+)\s+\d+\)\s+/gm, "$1 ")
      .replace(/^(##+)\s+\d+\s*[-—]\s+/gm, "$1 ");

    // Mettre à jour seulement si quelque chose a changé
    if (newTitle !== t.title || newBook !== t.book || newContent !== t.content) {
      await prisma.teaching.update({
        where: { id: t.id },
        data: {
          title: newTitle,
          book: newBook,
          content: newContent,
        },
      });
      if (newTitle !== t.title) {
        titlesFixed++;
        console.log(`   ✓ Titre: "${t.title}" → "${newTitle}"`);
      }
      if (newBook !== t.book) {
        refsImproved++;
        console.log(`   ✓ Réf: "${t.book || "—"}" → "${newBook}"`);
      }
    }
  }

  // ===== 2. TÉMOIGNAGES =====
  console.log("\n📖 Traitement des témoignages...");
  const testimonies = await prisma.testimony.findMany({
    where: { servant: { code: "kongo" } },
    select: { id: true, title: true, content: true, bookRef: true },
  });
  console.log(`   ${testimonies.length} témoignages à traiter`);

  for (const t of testimonies) {
    const newTitle = stripNumbering(t.title);

    // Extraire les références bibliques
    const refs = extractBibleRefs(t.content);
    const bestRef = pickBestRef(refs);

    let newBookRef = t.bookRef;
    if (bestRef && bestRef.full && !t.bookRef) {
      newBookRef = bestRef.full;
    }

    // Nettoyer les numérotations dans le contenu
    let newContent = t.content
      .replace(/^(##+)\s+\d+\.\s+/gm, "$1 ")
      .replace(/^(##+)\s+\d+\)\s+/gm, "$1 ")
      .replace(/^(##+)\s+\d+\s*[-—]\s+/gm, "$1 ");

    if (newTitle !== t.title || newBookRef !== t.bookRef || newContent !== t.content) {
      await prisma.testimony.update({
        where: { id: t.id },
        data: {
          title: newTitle,
          bookRef: newBookRef,
          content: newContent,
        },
      });
      if (newTitle !== t.title) {
        titlesFixed++;
        console.log(`   ✓ Titre: "${t.title}" → "${newTitle}"`);
      }
      if (newBookRef !== t.bookRef) {
        refsImproved++;
        console.log(`   ✓ Réf: "${t.bookRef || "—"}" → "${newBookRef}"`);
      }
    }
  }

  // ===== Récapitulatif =====
  console.log("\n═══════════════════════════════════════════");
  console.log("📊 RÉCAPITULATIF");
  console.log("═══════════════════════════════════════════");
  console.log(`  Titres nettoyés (numérotation supprimée) : ${titlesFixed}`);
  console.log(`  Références bibliques améliorées          : ${refsImproved}`);
  console.log("═══════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("❌ Erreur:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
