#!/usr/bin/env node
/**
 * Importe les 544 vidéos YouTube (Pam 295 + Kongo 249) en DB Neon
 */
require("dotenv").config({ path: ".env" });
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // Récupérer les serviteurs
  const servants = await prisma.servant.findMany();
  console.log("Serviteurs:", servants.map(s => `${s.code} (${s.id})`).join(", "));

  const pam = servants.find(s => s.code === "pam");
  const kongo = servants.find(s => s.code === "kongo");
  if (!pam || !kongo) {
    console.error("Serviteurs pam/kongo non trouvés");
    return;
  }

  // Charger les titres
  const pamTitles = require("./pam-youtube-titles.json");
  const kongoTitles = require("./kongo-youtube-titles.json");

  // Vérifier les vidéos existantes
  const existing = await prisma.video.count();
  console.log(`Vidéos existantes en DB: ${existing}`);

  if (existing > 0) {
    console.log("Suppression des vidéos existantes...");
    await prisma.video.deleteMany({});
  }

  // Catégorisation
  function categorize(title, servant) {
    const t = title.toLowerCase();
    if (servant === "kongo") {
      if (t.includes("prière") || t.includes("délivrance")) return "Prière & Délivrance";
      if (t.includes("enseignement") || t.includes("prédication")) return "Enseignements & Prédications";
      if (t.includes("fête") || t.includes("shabbat")) return "Fêtes & Shabbat";
      if (t.includes("discernement") || t.includes("occult")) return "Discernement Spirituel";
      return "Paroles & Exhortations";
    }
    if (t.includes("direct") || t.includes("en direct")) return "Lives & Directs";
    if (t.includes("prière") || t.includes("délivrance")) return "Prière & Délivrance";
    if (t.includes("enseignement") || t.includes("prédication")) return "Enseignements & Prédications";
    if (t.includes("témoignage") || t.includes("vision")) return "Témoignages & Visions";
    if (t.includes("shabbat") || t.includes("fête")) return "Fêtes & Shabbat";
    return "Paroles & Exhortations";
  }

  // Insérer vidéos Pam
  let count = 0;
  for (const v of pamTitles) {
    await prisma.video.create({
      data: {
        title: v.title.trim() || `Vidéo Pam ${count + 1}`,
        description: `Vidéo de Pam — ${v.title?.trim() || ""}`,
        duration: "",
        views: 0,
        publishedAt: new Date("2024-01-01"),
        isLive: false,
        videoUrl: `https://www.youtube.com/watch?v=${v.id}`,
        thumbnailUrl: `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`,
        servantId: pam.id,
      },
    });
    count++;
    if (count % 50 === 0) console.log(`  Pam: ${count}/${pamTitles.length}`);
  }
  console.log(`Pam: ${count} vidéos insérées`);

  // Insérer vidéos Kongo
  count = 0;
  for (const v of kongoTitles) {
    await prisma.video.create({
      data: {
        title: v.title.trim() || `Vidéo Pasteur Kongo ${count + 1}`,
        description: `Vidéo du Pasteur Kongo — ${v.title?.trim() || ""}`,
        duration: "",
        views: 0,
        publishedAt: new Date("2024-01-01"),
        isLive: false,
        videoUrl: `https://www.youtube.com/watch?v=${v.id}`,
        thumbnailUrl: `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`,
        servantId: kongo.id,
      },
    });
    count++;
    if (count % 50 === 0) console.log(`  Kongo: ${count}/${kongoTitles.length}`);
  }
  console.log(`Kongo: ${count} vidéos insérées`);

  const total = await prisma.video.count();
  console.log(`\nTotal vidéos en DB: ${total}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
