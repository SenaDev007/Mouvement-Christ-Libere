/**
 * Seed des enseignements et témoignages du Pasteur Kongo
 *
 * Lit les fichiers markdown fournis, parse les sections,
 * nettoie les nombres entre crochets/parenthèses,
 * déduplique par titre, et insère en DB.
 *
 * Usage: node scripts/seed-kongo-content.js
 */
require("dotenv").config({ path: ".env", override: true });
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const envDbUrl = require("dotenv").config({ path: ".env", override: true }).parsed?.DATABASE_URL;
if (envDbUrl) process.env.DATABASE_URL = envDbUrl;

const prisma = new PrismaClient();
const UPLOAD_DIR = "/home/z/my-project/upload";

// =============================================
// Utilitaires de nettoyage
// =============================================

/**
 * Supprime les nombres entre crochets [123, 456] et parenthèses (123, 456)
 * ainsi que les références de type [2, 26, 68]
 */
function cleanNumbers(text) {
  if (!text) return "";
  return text
    // [2, 26, 68, 110] ou [123]
    .replace(/\s*\[\s*\d+(?:\s*,\s*\d+)*\s*\]/g, "")
    // (2, 26, 68) mais seulement si c'est uniquement des nombres
    .replace(/\s*\(\s*\d+(?:\s*,\s*\d+)*\s*\)/g, "")
    // Nettoyer les espaces multiples laissés
    .replace(/[ \t]+/g, " ")
    .replace(/ \n/g, "\n")
    .trim();
}

/**
 * Nettoie le markdown : supprime les headers # inutiles pour le contenu,
 * garde les ## et ### pour la structure
 */
function cleanMarkdown(text) {
  if (!text) return "";
  let cleaned = cleanNumbers(text);
  // Supprimer les lignes vides multiples
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  return cleaned.trim();
}

/**
 * Extrait un titre propre depuis un header markdown
 */
function extractTitle(headerLine) {
  return headerLine
    .replace(/^#+\s*/, "")
    .replace(/\s*#+\s*$/, "")
    .trim();
}

/**
 * Génère un extrait court depuis le contenu
 */
function makeExcerpt(content, maxLen = 200) {
  if (!content) return "";
  // Supprimer les headers markdown
  const text = content.replace(/^#+\s.*$/gm, "").replace(/[*_`]/g, "").trim();
  // Prendre le premier paragraphe significatif
  const firstPara = text.split("\n\n").find((p) => p.trim().length > 50) || text;
  const cleaned = firstPara.replace(/\n/g, " ").trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.substring(0, maxLen).trim() + "...";
}

/**
 * Détecte le thème principal depuis le titre et le contenu
 */
function detectTheme(title, content) {
  const t = (title + " " + content).toLowerCase();
  if (t.includes("horloge") || t.includes("5h00") || t.includes("18h00") || t.includes("prière")) return "Prière & Intercession";
  if (t.includes("délivrance") || t.includes("démon") || t.includes("posséd")) return "Délivrance";
  if (t.includes("guérison") || t.includes("miracle")) return "Guérisons & Miracles";
  if (t.includes("afrique") || t.includes("congo") || t.includes("isolélé")) return "Restauration de l'Afrique";
  if (t.includes("fin des temps") || t.includes("millénium") || t.includes("retour du christ") || t.includes("enlèvement")) return "Fin des Temps";
  if (t.includes("identité") || t.includes("adamique") || t.includes("homme esprit")) return "Identité Spirituelle";
  if (t.includes("babylone") || t.includes("babel") || t.includes("nimrod")) return "Mystères Bibliques";
  if (t.includes("sanctification") || t.includes("sainteté") || t.includes("péché")) return "Sanctification";
  return "Révélations Prophétiques";
}

/**
 * Détecte le niveau d'enseignement
 */
function detectLevel(title, content) {
  const t = (title + " " + content).toLowerCase();
  if (t.includes("avancé") || t.includes("profond") || t.includes("mystère")) return "AVANCE";
  if (t.includes("intermédiaire") || t.includes("décryptage") || t.includes("prophétique")) return "INTERMEDIAIRE";
  return "DECOUVERTE";
}

/**
 * Détecte un livre biblique mentionné
 */
function detectBook(content) {
  const books = [
    "Genèse", "Exode", "Lévitique", "Nombres", "Deutéronome",
    "Josué", "Juges", "Ruth", "Samuel", "Rois", "Chroniques",
    "Psaumes", "Proverbes", "Ecclésiaste", "Cantique",
    "Ésaïe", "Ézéchiel", "Daniel", "Joël", "Abdias", "Jonas",
    "Matthieu", "Marc", "Luc", "Jean", "Actes", "Romains",
    "Corinthiens", "Galates", "Éphésiens", "Philippiens",
    "Thessaloniciens", "Timothée", "Tite", "Hébreux",
    "Apocalypse"
  ];
  for (const book of books) {
    if (content.includes(book)) return book;
  }
  return "";
}

// =============================================
// Parser pour les enseignements
// =============================================

/**
 * Parse un fichier d'enseignements markdown.
 * Extrait les sections (## et ###) comme enseignements individuels.
 */
function parseTeachings(markdown, sourceFile) {
  const teachings = [];
  const lines = markdown.split("\n");

  let currentTitle = null;
  let currentContent = [];
  let inIntro = false;
  let introContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Détecter un header de niveau 1 (titre du document)
    if (/^#\s+/.test(trimmed)) {
      // Si on a un enseignement en cours, le sauvegarder
      if (currentTitle && currentContent.length > 0) {
        teachings.push({
          title: currentTitle,
          content: currentContent.join("\n").trim(),
          sourceFile,
        });
      }
      currentTitle = null;
      currentContent = [];
      inIntro = false;
      continue;
    }

    // Détecter un header de niveau 2 (## Section principale)
    if (/^##\s+/.test(trimmed)) {
      // Sauvegarder l'enseignement précédent
      if (currentTitle && currentContent.length > 0) {
        teachings.push({
          title: currentTitle,
          content: currentContent.join("\n").trim(),
          sourceFile,
        });
      }
      currentTitle = extractTitle(trimmed);
      currentContent = [];
      inIntro = false;
      continue;
    }

    // Détecter un header de niveau 3 (### Sous-section)
    if (/^###\s+/.test(trimmed)) {
      // Si on a déjà un titre de niveau 2, on sauvegarde et on commence un nouveau
      if (currentTitle && currentContent.length > 0) {
        teachings.push({
          title: currentTitle,
          content: currentContent.join("\n").trim(),
          sourceFile,
        });
      }
      currentTitle = extractTitle(trimmed);
      currentContent = [];
      inIntro = false;
      continue;
    }

    // Accumuler le contenu
    if (currentTitle) {
      currentContent.push(line);
    }
  }

  // Dernier enseignement
  if (currentTitle && currentContent.length > 0) {
    teachings.push({
      title: currentTitle,
      content: currentContent.join("\n").trim(),
      sourceFile,
    });
  }

  return teachings;
}

// =============================================
// Parser pour les témoignages
// =============================================

/**
 * Parse un fichier de témoignages markdown.
 * Extrait les sections ### comme témoignages individuels.
 */
function parseTestimonies(markdown, sourceFile) {
  const testimonies = [];
  const lines = markdown.split("\n");

  let currentTitle = null;
  let currentContent = [];
  let inIntro = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip les headers de niveau 1 et 2 (titres de document et parties)
    if (/^#\s+/.test(trimmed) || /^##\s+/.test(trimmed)) {
      // Sauvegarder le témoignage précédent
      if (currentTitle && currentContent.length > 0) {
        testimonies.push({
          title: currentTitle,
          content: currentContent.join("\n").trim(),
          sourceFile,
        });
      }
      currentTitle = null;
      currentContent = [];
      continue;
    }

    // Détecter un header de niveau 3 (### Témoignage individuel)
    if (/^###\s+/.test(trimmed)) {
      if (currentTitle && currentContent.length > 0) {
        testimonies.push({
          title: currentTitle,
          content: currentContent.join("\n").trim(),
          sourceFile,
        });
      }
      currentTitle = extractTitle(trimmed);
      currentContent = [];
      continue;
    }

    if (currentTitle) {
      currentContent.push(line);
    }
  }

  // Dernier témoignage
  if (currentTitle && currentContent.length > 0) {
    testimonies.push({
      title: currentTitle,
      content: currentContent.join("\n").trim(),
      sourceFile,
    });
  }

  return testimonies;
}

// =============================================
// Main
// =============================================

async function main() {
  console.log("🌱 Début du seed des enseignements et témoignages du Pasteur Kongo\n");

  // Récupérer le serviteur Kongo
  const kongo = await prisma.servant.findFirst({ where: { code: "kongo" } });
  if (!kongo) {
    console.error("❌ Serviteur Kongo introuvable en DB");
    process.exit(1);
  }
  console.log(`✅ Serviteur Kongo trouvé : ${kongo.fullName} (id: ${kongo.id})\n`);

  // ===== ENSEIGNEMENTS =====
  console.log("📖 Traitement des enseignements...\n");

  const teachingFiles = [
    "enseignements_spirituels-v3.md",
    "enseignements_spirituels-v2.md",
    "horloge_celeste_et_fleaux.md",
  ];

  let allTeachings = [];
  for (const file of teachingFiles) {
    const filePath = path.join(UPLOAD_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.log(`  ⚠️  Fichier introuvable: ${file}`);
      continue;
    }
    const markdown = fs.readFileSync(filePath, "utf8");
    const teachings = parseTeachings(markdown, file);
    console.log(`  📄 ${file}: ${teachings.length} sections trouvées`);
    allTeachings.push(...teachings);
  }

  // Dédupliquer par titre (en gardant la première occurrence, préférée v3)
  const seenTitles = new Set();
  const uniqueTeachings = [];
  for (const t of allTeachings) {
    const cleanTitle = cleanNumbers(t.title).trim();
    if (!cleanTitle || cleanTitle.length < 5) continue;
    // Skip les sections d'introduction génériques
    if (/^(avant-propos|introduction|introductif|partie i|partie ii|conclusion)$/i.test(cleanTitle)) continue;
    const titleLower = cleanTitle.toLowerCase();
    if (seenTitles.has(titleLower)) continue;
    seenTitles.add(titleLower);
    uniqueTeachings.push({ ...t, title: cleanTitle });
  }

  console.log(`\n  📊 Total: ${allTeachings.length} sections → ${uniqueTeachings.length} uniques après déduplication\n`);

  // Vérifier les enseignements déjà en DB
  const existingTeachings = await prisma.teaching.findMany({
    where: { servantId: kongo.id },
    select: { title: true },
  });
  const existingTitles = new Set(existingTeachings.map((t) => t.title.toLowerCase()));
  console.log(`  📚 Enseignements déjà en DB pour Kongo: ${existingTitles.size}\n`);

  let teachingsInserted = 0;
  let teachingsSkipped = 0;

  for (const t of uniqueTeachings) {
    // Skip si déjà en DB
    if (existingTitles.has(t.title.toLowerCase())) {
      teachingsSkipped++;
      continue;
    }

    const cleanedContent = cleanMarkdown(t.content);
    if (cleanedContent.length < 100) {
      teachingsSkipped++;
      continue;
    }

    const excerpt = makeExcerpt(cleanedContent);
    const theme = detectTheme(t.title, cleanedContent);
    const level = detectLevel(t.title, cleanedContent);
    const book = detectBook(cleanedContent);

    try {
      await prisma.teaching.create({
        data: {
          servantId: kongo.id,
          title: t.title,
          excerpt,
          content: cleanedContent,
          theme,
          book,
          level,
          readingTime: `${Math.max(5, Math.ceil(cleanedContent.length / 1000) * 5)} min`,
          publishedAt: new Date(),
        },
      });
      teachingsInserted++;
    } catch (err) {
      console.error(`  ❌ Erreur insertion enseignement "${t.title}": ${err.message}`);
    }
  }

  console.log(`\n  ✅ Enseignements: ${teachingsInserted} insérés, ${teachingsSkipped} ignorés\n`);

  // ===== TÉMOIGNAGES =====
  console.log("📖 Traitement des témoignages...\n");

  const testimonyFiles = [
    "temoignages_miracles-v3.md",
    "temoignages_miracles-v2.md",
    "recueil-temoignages-la-verite-revelee.md",
  ];

  let allTestimonies = [];
  for (const file of testimonyFiles) {
    const filePath = path.join(UPLOAD_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.log(`  ⚠️  Fichier introuvable: ${file}`);
      continue;
    }
    const markdown = fs.readFileSync(filePath, "utf8");
    const testimonies = parseTestimonies(markdown, file);
    console.log(`  📄 ${file}: ${testimonies.length} témoignages trouvés`);
    allTestimonies.push(...testimonies);
  }

  // Dédupliquer par titre
  const seenTTitles = new Set();
  const uniqueTestimonies = [];
  for (const t of allTestimonies) {
    const cleanTitle = cleanNumbers(t.title).trim();
    if (!cleanTitle || cleanTitle.length < 5) continue;
    if (/^(introductif|introduction|protocoles|conclusion)$/i.test(cleanTitle)) continue;
    const titleLower = cleanTitle.toLowerCase();
    if (seenTTitles.has(titleLower)) continue;
    seenTTitles.add(titleLower);
    uniqueTestimonies.push({ ...t, title: cleanTitle });
  }

  console.log(`\n  📊 Total: ${allTestimonies.length} sections → ${uniqueTestimonies.length} uniques après déduplication\n`);

  // Vérifier les témoignages déjà en DB
  const existingTestimonies = await prisma.testimony.findMany({
    where: { servantId: kongo.id },
    select: { title: true },
  });
  const existingTTitles = new Set(existingTestimonies.map((t) => t.title.toLowerCase()));
  console.log(`  📚 Témoignages déjà en DB pour Kongo: ${existingTTitles.size}\n`);

  let testimoniesInserted = 0;
  let testimoniesSkipped = 0;

  for (const t of uniqueTestimonies) {
    if (existingTTitles.has(t.title.toLowerCase())) {
      testimoniesSkipped++;
      continue;
    }

    const cleanedContent = cleanMarkdown(t.content);
    if (cleanedContent.length < 100) {
      testimoniesSkipped++;
      continue;
    }

    const short = makeExcerpt(cleanedContent, 150);
    const themes = [detectTheme(t.title, cleanedContent)];
    const bookRef = detectBook(cleanedContent);

    try {
      await prisma.testimony.create({
        data: {
          servantId: kongo.id,
          title: t.title,
          short,
          content: cleanedContent,
          status: "CONFIRMED",
          themes,
          bookRef: bookRef || null,
          readingTime: `${Math.max(3, Math.ceil(cleanedContent.length / 1000) * 3)} min`,
          publishedAt: new Date(),
        },
      });
      testimoniesInserted++;
    } catch (err) {
      console.error(`  ❌ Erreur insertion témoignage "${t.title}": ${err.message}`);
    }
  }

  console.log(`\n  ✅ Témoignages: ${testimoniesInserted} insérés, ${testimoniesSkipped} ignorés\n`);

  // ===== Récapitulatif =====
  const totalTeachings = await prisma.teaching.count({ where: { servantId: kongo.id } });
  const totalTestimonies = await prisma.testimony.count({ where: { servantId: kongo.id } });
  console.log("═══════════════════════════════════════════");
  console.log("📊 RÉCAPITULATIF FINAL");
  console.log("═══════════════════════════════════════════");
  console.log(`  Enseignements Kongo en DB : ${totalTeachings}`);
  console.log(`  Témoignages Kongo en DB   : ${totalTestimonies}`);
  console.log("═══════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("❌ Erreur fatale:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
