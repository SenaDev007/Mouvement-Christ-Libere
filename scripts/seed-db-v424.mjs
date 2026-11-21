/**
 * seed-db-v424.mjs — Données de vérification pour la base locale (bac) :
 * 2 serviteurs + 4 vidéos (TikTok/YouTube, avec/sans miniature) afin de
 * tester le module Vidéos V4.24 (grille, modal d'édition, détection TikTok,
 * bouton de synchronisation YouTube).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Nettoyage (relance idempotente)
  await prisma.video.deleteMany();
  await prisma.servant.deleteMany();

  const afrika = await prisma.servant.create({
    data: {
      code: "afrika",
      fullName: "Afrika",
      shortName: "Afrika",
      role: "Servante de Dieu",
      bio: "Vérification locale V4.24",
    },
  });
  const kongo = await prisma.servant.create({
    data: {
      code: "kongo",
      fullName: "Pasteur Kongo",
      shortName: "Pasteur Kongo",
      role: "Pasteur",
      bio: "Vérification locale V4.24",
    },
  });

  const maintenant = new Date();
  const videos = [
    {
      servantId: afrika.id,
      title: "TikTok AVEC miniature (état normal)",
      description: "Vidéo TikTok dotée d'une miniature R2.",
      duration: "0:45",
      videoUrl: "https://www.tiktok.com/@pamela.dali7/video/7683371620924230944",
      thumbnailUrl: "https://pub-62cf84fc54c94c528348970b93c9a2db.r2.dev/thumbnails/tiktok-demo-1.jpg",
      views: 1520,
      likes: 230,
      category: "Saint-Esprit réponds-moi",
    },
    {
      servantId: afrika.id,
      title: "TikTok SANS miniature (cas fond noir)",
      description: "Vidéo TikTok sans thumbnailUrl — placeholder attendu dans la grille.",
      duration: "1:02",
      videoUrl: "https://www.tiktok.com/@pamela.dali7/video/7682225459177868577",
      thumbnailUrl: null,
      views: 990,
      likes: 101,
      category: null,
    },
    {
      servantId: kongo.id,
      title: "YouTube AVEC miniature (état normal)",
      description: "Vidéo YouTube dotée de sa miniature standard.",
      duration: "48:12",
      videoUrl: "https://www.youtube.com/watch?v=1GYUUiJuW3k",
      thumbnailUrl: "https://img.youtube.com/vi/1GYUUiJuW3k/hqdefault.jpg",
      views: 4021,
      likes: 380,
      category: "Rhema du matin",
    },
    {
      servantId: kongo.id,
      title: "YouTube SANS miniature (test auto-détection)",
      description: "Vidéo YouTube sans thumbnailUrl.",
      duration: "12:30",
      videoUrl: "https://www.youtube.com/watch?v=23Cf6IVwBus",
      thumbnailUrl: null,
      views: 77,
      likes: 12,
      category: null,
    },
  ];

  let i = 0;
  for (const v of videos) {
    await prisma.video.create({
      data: {
        ...v,
        isLive: false,
        publishedAt: new Date(maintenant.getTime() - i * 86400000),
      },
    });
    i++;
  }

  console.log(
    `Semis OK : 2 serviteurs, ${videos.length} vidéos (base locale christlibere).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
