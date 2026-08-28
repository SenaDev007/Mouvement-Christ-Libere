#!/usr/bin/env node
/**
 * Importe une nouvelle série de vidéos YouTube du Pasteur Kongo en DB Neon.
 *
 * - Récupère les titres via l'API oEmbed publique de YouTube (pas de clé API requise)
 * - Évite les doublons (vérifie les videoUrl déjà présents en DB)
 * - Insertion par lots avec barre de progression
 *
 * Usage : node scripts/import-kongo-new-batch.js
 */
require("dotenv").config({ path: ".env", override: true });
const { PrismaClient } = require("@prisma/client");
const https = require("https");
const fs = require("fs");
const path = require("path");

// Forcer l'override de DATABASE_URL (une var système peut surcharger le .env)
const envDbUrl = require("dotenv").config({ path: ".env", override: true }).parsed?.DATABASE_URL;
if (envDbUrl) process.env.DATABASE_URL = envDbUrl;

const prisma = new PrismaClient();

const IDS_FILE = path.join(__dirname, "kongo-new-batch-ids.json");
// ID du serviteur Kongo (à adapter si différent en production)
const KONGO_SERVANT_ID = "cmta7tucm0001qckcq6sg4mwk";

/**
 * Récupère le titre d'une vidéo YouTube via l'API oEmbed publique.
 * Pas besoin de clé API.
 */
function fetchTitle(videoId) {
  return new Promise((resolve) => {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const req = https.get(url, { timeout: 8000 }, (res) => {
      if (res.statusCode !== 200) {
        // Vidéo privée/supprimée/indisponible
        res.resume();
        resolve(null);
        return;
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve(json.title || null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function main() {
  // Charger les IDs
  const ids = JSON.parse(fs.readFileSync(IDS_FILE, "utf8"));
  console.log(`\n🎬 Import de ${ids.length} vidéos YouTube du Pasteur Kongo\n`);

  // Vérifier que le serviteur Kongo existe
  const kongo = await prisma.servant.findUnique({
    where: { id: KONGO_SERVANT_ID },
  });
  if (!kongo) {
    // Tentative par code
    const alt = await prisma.servant.findFirst({ where: { code: "kongo" } });
    if (!alt) {
      console.error("❌ Serviteur Kongo introuvable en DB");
      process.exit(1);
    }
    console.log(`ℹ️  Serviteur Kongo trouvé : ${alt.fullName} (id: ${alt.id})`);
  } else {
    console.log(`ℹ️  Serviteur Kongo : ${kongo.fullName}`);
  }
  const servantId = kongo?.id || (await prisma.servant.findFirst({ where: { code: "kongo" } })).id;

  // Récupérer les YouTube IDs déjà en DB pour éviter les doublons
  const existing = await prisma.video.findMany({
    where: { servantId },
    select: { videoUrl: true },
  });
  const existingIds = new Set(
    existing
      .map((v) => v.videoUrl?.split("v=")[1])
      .filter(Boolean)
  );
  console.log(`📊 Vidéos Kongo déjà en DB : ${existingIds.size}\n`);

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const failedIds = [];

  for (let i = 0; i < ids.length; i++) {
    const ytId = ids[i];

    // Doublon ?
    if (existingIds.has(ytId)) {
      skipped++;
      continue;
    }

    // Récupérer le titre via oEmbed
    let title = await fetchTitle(ytId);
    if (!title) {
      title = `Vidéo Pasteur Kongo ${i + 1}`;
      failedIds.push(ytId);
      failed++;
    }

    try {
      await prisma.video.create({
        data: {
          title: title.trim(),
          description: `Vidéo du Pasteur Kongo — ${title.trim()}`,
          duration: "",
          views: 0,
          publishedAt: new Date(),
          isLive: false,
          videoUrl: `https://www.youtube.com/watch?v=${ytId}`,
          thumbnailUrl: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
          servantId,
        },
      });
      imported++;
      if (imported % 25 === 0) {
        console.log(`  ⏳ ${imported} vidéos importées...`);
      }
    } catch (err) {
      console.error(`  ❌ Erreur insertion ${ytId}:`, err.message);
      failedIds.push(ytId);
      failed++;
    }
  }

  console.log(`\n✅ Import terminé :`);
  console.log(`   - Importées : ${imported}`);
  console.log(`   - Doublons ignorés : ${skipped}`);
  console.log(`   - Échecs (titre par défaut) : ${failed}`);

  if (failedIds.length > 0) {
    console.log(`\n⚠️  IDs sans titre oEmbed (vidéos privées/supprimées ou erreur réseau) :`);
    console.log(`   ${failedIds.slice(0, 10).join(", ")}${failedIds.length > 10 ? ` ... (+${failedIds.length - 10})` : ""}`);
  }

  const totalKongo = await prisma.video.count({ where: { servantId } });
  const totalAll = await prisma.video.count();
  console.log(`\n📊 Total en DB :`);
  console.log(`   - Pasteur Kongo : ${totalKongo} vidéos`);
  console.log(`   - Tous serviteurs : ${totalAll} vidéos\n`);
}

main()
  .catch((e) => {
    console.error("❌ Erreur fatale :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
