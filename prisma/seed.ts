/**
 * Seed V2 — Christ Libère
 * Contenus authentiques enrichis pour Afrika et Pasteur Kongo.
 * Exécuter avec : bun run db:seed
 */

import { PrismaClient } from "@prisma/client";

// Charger manuellement .env avec override (bun peut charger d'autres .env)
import { config } from "dotenv";
config({ path: ".env", override: true });

const db = new PrismaClient();

// Type helpers pour les énums
type TestimonyStatus = "TO_DISCERN" | "CONFIRMED" | "ARCHIVED";
type TeachingLevel = "DECOUVERTE" | "INTERMEDIAIRE" | "AVANCE";
type ChannelType = "TEXT" | "VOICE" | "VIDEO" | "ANNOUNCEMENT" | "RESTRICTED";

// Import des contenus authentiques
import { AFRIKA_BIOGRAPHY, KONGO_BIOGRAPHY, AUTHENTIC_TESTIMONIES, AUTHENTIC_TEACHINGS } from "../src/lib/data/authentic-content";

async function main() {
  console.log("🌱 Début du seed V2 (contenus authentiques)...");

  // Nettoyer les anciennes données
  console.log("  ⚠ Nettoyage des anciennes données...");
  await db.message.deleteMany();
  await db.channelMember.deleteMany();
  await db.communityMember.deleteMany();
  await db.channel.deleteMany();
  await db.community.deleteMany();
  await db.donation.deleteMany();
  await db.contactRequest.deleteMany();
  await db.call.deleteMany();
  await db.liveStream.deleteMany();
  await db.video.deleteMany();
  await db.teaching.deleteMany();
  await db.testimony.deleteMany();
  await db.biography.deleteMany();
  await db.servant.deleteMany();
  console.log("  ✓ Base nettoyée");

  // ============================================================
  // 1. SERVITEURS
  // ============================================================
  const afrika = await db.servant.create({
    data: {
      code: "afrika",
      fullName: "Afrika Alkebulane Pamela Dali",
      shortName: "Afrika",
      role: "Servante de l'Éternel",
      bio: "Témoignages d'enlèvements au ciel, instructions reçues du Seigneur Yeshoua, conformité à la Parole. Figure contemporaine du patriarche Hénoch — celle qui marche avec Dieu et qui est conduite au ciel pour recevoir et transmettre.",
      isActive: true,
    },
  });

  const kongo = await db.servant.create({
    data: {
      code: "kongo",
      fullName: "Pasteur Kongo",
      shortName: "Pasteur Kongo",
      role: "Époux, ministre pastoral",
      bio: "Ministère pastoral complémentaire au ministère prophétique d'Afrika. Enseignements bibliques structurés, accompagnement spirituel, transmission rigoureuse de la Parole.",
      isActive: true,
    },
  });

  console.log(`  ✓ Serviteurs: ${afrika.shortName}, ${kongo.shortName}`);

  // ============================================================
  // 2. BIOGRAPHIES AUTHENTIQUES
  // ============================================================
  for (const b of AFRIKA_BIOGRAPHY) {
    await db.biography.create({ data: { ...b, servantId: afrika.id } });
  }
  console.log(`  ✓ ${AFRIKA_BIOGRAPHY.length} jalons biographiques Afrika (authentiques)`);

  for (const b of KONGO_BIOGRAPHY) {
    await db.biography.create({ data: { ...b, servantId: kongo.id } });
  }
  console.log(`  ✓ ${KONGO_BIOGRAPHY.length} jalons biographiques Pasteur Kongo (authentiques)`);

  // ============================================================
  // 3. TÉMOIGNAGES AUTHENTIQUES (tous — 31 témoignages d'Afrika)
  // ============================================================
  const testimonyData: Array<{
    servantId: string;
    title: string;
    short: string;
    content: string;
    status: TestimonyStatus;
    themes: string[];
    bookRef: string;
    readingTime: string;
    publishedAt: Date;
  }> = AUTHENTIC_TESTIMONIES.map((t, i) => ({
    servantId: afrika.id,
    ...t,
    status: "CONFIRMED" as TestimonyStatus,
    publishedAt: new Date(2025, 0, 1 + i * 10), // stagger dates
  }));

  for (const t of testimonyData) {
    await db.testimony.create({ data: t });
  }
  console.log(`  ✓ ${testimonyData.length} témoignages authentiques`);

  // ============================================================
  // 4. ENSEIGNEMENTS AUTHENTIQUES (Afrika) + enseignements Kongo
  // ============================================================
  const teachings: Array<{
    servantId: string;
    title: string;
    excerpt: string;
    content: string;
    theme: string;
    book: string;
    level: TeachingLevel;
    readingTime: string;
    publishedAt: Date;
  }> = [
    // ⭐ Enseignements authentiques d'Afrika (transcriptions réelles)
    ...AUTHENTIC_TEACHINGS.map((t) => ({
      servantId: afrika.id,
      title: t.title,
      excerpt: t.excerpt,
      content: t.content,
      theme: t.theme,
      book: t.book,
      level: t.level as TeachingLevel,
      readingTime: t.readingTime,
      publishedAt: new Date("2025-07-20"),
    })),
  ];

  for (const t of teachings) {
    await db.teaching.create({ data: t });
  }
  console.log(`  ✓ ${teachings.length} enseignements`);

  // ============================================================
  // 5. VIDÉOS
  // ============================================================
  const videos = [
    {
      servantId: afrika.id,
      title: "Enseignement sur le retour de Yeshoua",
      description:
        "Étude approfondie des signes des temps et de l'espérance du retour du Maître. Enseignement prophétique à partir des paroles reçues.",
      duration: "1:24:30",
      views: 1240,
      isLive: false,
      publishedAt: new Date("2025-08-18"),
    },
    {
      servantId: afrika.id,
      title: "Témoignage d'enlèvement au ciel",
      description:
        "Récit détaillé d'une visite au ciel et des instructions reçues du Seigneur Yeshoua.",
      duration: "42:15",
      views: 2150,
      isLive: false,
      publishedAt: new Date("2025-08-10"),
    },
  ];

  for (const v of videos) {
    await db.video.create({ data: v });
  }
  console.log(`  ✓ ${videos.length} vidéos`);

  // ============================================================
  // 6. COMMUNAUTÉ + CANAUX
  // ============================================================
  const community = await db.community.create({
    data: {
      name: "Christ Libère",
      description: "Communauté principale rassemblant les membres du mouvement.",
      isPublic: true,
    },
  });

  const channels: Array<{
    name: string;
    description: string;
    type: ChannelType;
    isEncrypted: boolean;
    isRestricted: boolean;
    order: number;
  }> = [
    {
      name: "Annonces officielles",
      description:
        "Communications officielles d'Afrika et du Pasteur Kongo. Lecture seule pour les membres.",
      type: "ANNOUNCEMENT",
      isEncrypted: false,
      isRestricted: false,
      order: 1,
    },
    {
      name: "Nouveaux croyants Yeshoua",
      description:
        "Accueil et accompagnement des nouveaux venus dans la foi. Questions bienvenues.",
      type: "TEXT",
      isEncrypted: false,
      isRestricted: false,
      order: 2,
    },
    {
      name: "Cercle des pasteurs affiliés",
      description:
        "Canal réservé aux pasteurs en relation avec le ministère. Accès sur invitation. Échanges chiffrés de bout en bout.",
      type: "RESTRICTED",
      isEncrypted: true,
      isRestricted: true,
      order: 3,
    },
    {
      name: "Intercession communautaire",
      description:
        "Demandes de prière, chaîne d'intercession, suivi des exaucements. Le moteur spirituel de la communauté.",
      type: "TEXT",
      isEncrypted: false,
      isRestricted: false,
      order: 4,
    },
    {
      name: "Études bibliques en direct",
      description: "Canal vocal actif pendant les lives d'enseignement. Échanges en temps réel.",
      type: "VOICE",
      isEncrypted: false,
      isRestricted: false,
      order: 5,
    },
  ];

  for (const c of channels) {
    await db.channel.create({ data: { ...c, communityId: community.id } });
  }
  console.log(`  ✓ ${channels.length} canaux communauté`);

  // ============================================================
  // 7. LIVE STREAM PROGRAMMÉ
  // ============================================================
  const nextLive = new Date();
  nextLive.setDate(nextLive.getDate() + 3);
  nextLive.setHours(20, 0, 0, 0);

  await db.liveStream.create({
    data: {
      servantId: afrika.id,
      title: "Enseignement hebdomadaire — Tenir ferme",
      description: "Direct hebdomadaire d'Afrika sur la persévérance dans les temps difficiles.",
      scheduledAt: nextLive,
      status: "SCHEDULED",
    } as const,
  });
  console.log(`  ✓ 1 live programmé`);

  console.log("\n✅ Seed V2 terminé avec succès !");
  console.log(`   - 2 serviteurs`);
  console.log(`   - ${AFRIKA_BIOGRAPHY.length + KONGO_BIOGRAPHY.length} jalons biographiques authentiques`);
  console.log(`   - ${testimonyData.length} témoignages authentiques`);
  console.log(`   - ${teachings.length} enseignements`);
  console.log(`   - ${videos.length} vidéos`);
  console.log(`   - ${channels.length} canaux communauté`);
  console.log(`   - 1 live programmé`);
}

main()
  .catch((e) => {
    console.error("❌ Erreur lors du seed :", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
