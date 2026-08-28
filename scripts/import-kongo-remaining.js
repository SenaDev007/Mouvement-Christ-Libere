#!/usr/bin/env node
/** Importe uniquement les vidéos Kongo restantes */
require("dotenv").config({ path: ".env" });
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const kongoId = "cmta7tucm0001qckcq6sg4mwk";
  const kongoTitles = require("./kongo-youtube-titles.json");
  
  // Récupérer les youtubeId déjà en DB
  const existing = await prisma.video.findMany({
    where: { servantId: kongoId },
    select: { videoUrl: true }
  });
  const existingIds = new Set(existing.map(v => v.videoUrl?.split("v=")[1]));
  console.log(`Kongo déjà en DB: ${existingIds.size}`);

  let count = 0;
  for (const v of kongoTitles) {
    if (existingIds.has(v.id)) continue;
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
        servantId: kongoId,
      },
    });
    count++;
    if (count % 50 === 0) console.log(`  Kongo: ${count} importés`);
  }
  console.log(`Kongo: ${count} nouvelles vidéos importées`);
  
  const total = await prisma.video.count();
  const kongo = await prisma.video.count({ where: { servantId: kongoId } });
  console.log(`Total DB: ${total} (Kongo: ${kongo})`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
