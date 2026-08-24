/**
 * Seed V2 — Mouvement Christ Libère
 * Contenus authentiques enrichis pour PAM et Pasteur Kongo.
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
import { PAM_BIOGRAPHY, KONGO_BIOGRAPHY, AUTHENTIC_TESTIMONIES } from "../src/lib/data/authentic-content";

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
  const pam = await db.servant.create({
    data: {
      code: "pam",
      fullName: "Afrika Alkebulane Pamela Dali",
      shortName: "PAM",
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
      bio: "Ministère pastoral complémentaire au ministère prophétique de PAM. Enseignements bibliques structurés, accompagnement spirituel, transmission rigoureuse de la Parole.",
      isActive: true,
    },
  });

  console.log(`  ✓ Serviteurs: ${pam.shortName}, ${kongo.shortName}`);

  // ============================================================
  // 2. BIOGRAPHIES AUTHENTIQUES
  // ============================================================
  for (const b of PAM_BIOGRAPHY) {
    await db.biography.create({ data: { ...b, servantId: pam.id } });
  }
  console.log(`  ✓ ${PAM_BIOGRAPHY.length} jalons biographiques PAM (authentiques)`);

  for (const b of KONGO_BIOGRAPHY) {
    await db.biography.create({ data: { ...b, servantId: kongo.id } });
  }
  console.log(`  ✓ ${KONGO_BIOGRAPHY.length} jalons biographiques Pasteur Kongo (authentiques)`);

  // ============================================================
  // 3. TÉMOIGNAGES AUTHENTIQUES
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
  }> = [
    {
      servantId: pam.id,
      ...AUTHENTIC_TESTIMONIES[0],
      status: "CONFIRMED",
      publishedAt: new Date("2025-03-14"),
    },
    {
      servantId: pam.id,
      ...AUTHENTIC_TESTIMONIES[1],
      status: "CONFIRMED",
      publishedAt: new Date("2025-02-08"),
    },
    {
      servantId: pam.id,
      ...AUTHENTIC_TESTIMONIES[2],
      status: "CONFIRMED",
      publishedAt: new Date("2025-04-22"),
    },
    {
      servantId: pam.id,
      ...AUTHENTIC_TESTIMONIES[3],
      status: "CONFIRMED",
      publishedAt: new Date("2025-05-10"),
    },
    {
      servantId: pam.id,
      ...AUTHENTIC_TESTIMONIES[4],
      status: "TO_DISCERN",
      publishedAt: new Date("2025-08-15"),
    },
    {
      servantId: kongo.id,
      ...AUTHENTIC_TESTIMONIES[5],
      status: "CONFIRMED",
      publishedAt: new Date("2025-06-30"),
    },
  ];

  for (const t of testimonyData) {
    await db.testimony.create({ data: t });
  }
  console.log(`  ✓ ${testimonyData.length} témoignages authentiques`);

  // ============================================================
  // 4. ENSEIGNEMENTS
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
    {
      servantId: pam.id,
      title: "Marcher avec Dieu à la manière d'Hénoch",
      excerpt:
        "Étude sur Genèse 5:24 et le témoignage d'Hénoch. Que signifie marcher avec Dieu au quotidien, et comment cela se vit-il concrètement aujourd'hui, à partir du témoignage contemporain de PAM ?",
      content:
        "Étude approfondie sur la marche avec Dieu à partir du témoignage d'Hénoch, patriarche mentionné dans Genèse 5. Hénoch n'a pas connu la mort — il a été enlevé. Ce témoignage, qui pourrait paraître étrange, est confirmé par Hébreux 11:5 et rappelé dans le livre d'Hénoch cité par Jude. L'enseignement explore ce que signifie 'marcher avec Dieu' : intimité, obéissance, réception, transmission. Et comment, à notre époque, certains serviteurs sont à nouveau conduits dans cette dimension prophétique.",
      theme: "Marche spirituelle",
      book: "Genèse",
      level: "INTERMEDIAIRE",
      readingTime: "15 min",
      publishedAt: new Date("2025-07-20"),
    },
    {
      servantId: kongo.id,
      title: "Les fêtes bibliques et leur accomplissement",
      excerpt:
        "Présentation des sept fêtes de l'Éternel (Lévitique 23) et de leur accomplissement progressif en Yeshoua le Messie — passé, présent et à venir.",
      content:
        "Étude des sept fêtes bibliques instituées par l'Éternel en Lévitique 23. Quatre fêtes de printemps (Pâque, Pain sans levain, Prémices, Pentecôte) ont déjà été accomplies lors du premier avènement de Yeshoua. Trois fêtes d'automne (Trompettes, Expiation, Tabernacles) attendent leur accomplissement lors de son retour. Cette étude est fondamentale pour comprendre le calendrier prophétique de Dieu et se préparer aux temps qui viennent.",
      theme: "Calendrier liturgique",
      book: "Lévitique",
      level: "AVANCE",
      readingTime: "22 min",
      publishedAt: new Date("2025-07-10"),
    },
    {
      servantId: pam.id,
      title: "Le rassemblement des dispersés d'Israël",
      excerpt:
        "Étude des promesses prophétiques sur le rassemblement des fils d'Israël et leur signification pour notre temps — à partir des paroles reçues par PAM.",
      content:
        "Étude prophétique sur le rassemblement des dispersés d'Israël, en lien avec les paroles reçues par PAM. Ésaïe 11:12, Ézéchiel 37:21-22, Jérémie 31:10 annoncent un rassemblement des fils d'Israël avant le retour du Messie. Cette étude explore comment ce rassemblement commence spirituellement avant de se manifester visiblement, et quel rôle joue la plateforme Mouvement Christ Libère dans cette œuvre.",
      theme: "Prophétie",
      book: "Ésaïe",
      level: "AVANCE",
      readingTime: "18 min",
      publishedAt: new Date("2025-06-15"),
    },
    {
      servantId: kongo.id,
      title: "Discerner les voix spirituelles",
      excerpt:
        "Comment discerner ce qui vient de Dieu, ce qui vient de l'ennemi, et ce qui vient de notre propre âme. Critères bibliques de discernement, à partir de 1 Jean 4.",
      content:
        "Enseignement pastoral sur le discernement spirituel. Comment distinguer la voix du Bon Berger de celle du mercenaire, de celle du loup, et de celle de notre propre âme ? Critères bibliques : conformité à l'Écriture, fruit de l'Esprit, témoignage intérieur, confirmation communautaire. Cet enseignement est crucial en un temps où beaucoup reçoivent des 'paroles' — toutes ne viennent pas du Seigneur.",
      theme: "Discernement",
      book: "1 Jean",
      level: "INTERMEDIAIRE",
      readingTime: "14 min",
      publishedAt: new Date("2025-05-25"),
    },
    {
      servantId: pam.id,
      title: "Le chofar dans la Bible et aujourd'hui",
      excerpt:
        "Étude sur la signification du chofar dans l'Écriture, depuis le mont Sinaï jusqu'au retour du Messie — et ce que son retentissement signifie pour nous.",
      content:
        "Le chofar — cor de bélier — occupe une place centrale dans la Bible. Il retentit au Sinaï (Exode 19), il annonce l'année jubilaire (Lévitique 25), il ouvre Yom Terouah (la fête des Trompettes). Il retentira aussi lors du retour du Messie (1 Thessaloniciens 4:16). Cet enseignement explore la signification spirituelle du chofar et prépare la communauté à écouter attentivement ce qui va retentir.",
      theme: "Symbolique biblique",
      book: "Exode",
      level: "DECOUVERTE",
      readingTime: "10 min",
      publishedAt: new Date("2025-04-08"),
    },
    {
      servantId: kongo.id,
      title: "La prière qui prévaut",
      excerpt:
        "Enseignement pastoral sur la prière fervente, à partir de la vie d'Élie et de Jacques 5:16-18. La prière qui obtient, la prière qui résiste, la prière qui prévaut.",
      content:
        "Enseignement sur la prière fervente et efficace, à partir du témoignage d'Élie (1 Rois 17-18, Jacques 5:16-18). Élie était un homme de même nature que nous, mais sa prière a fermé les cieux, ouvert les cieux, fait descendre le feu. Qu'est-ce qui distinguait sa prière ? Foi, persévérance, alignement avec la volonté divine, posture. Cet enseignement pastoral encourage la communauté à persévérer dans une prière qui prévaut.",
      theme: "Prière",
      book: "Jacques",
      level: "DECOUVERTE",
      readingTime: "12 min",
      publishedAt: new Date("2025-03-30"),
    },
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
      servantId: pam.id,
      title: "Enseignement sur le retour de Yeshoua",
      description:
        "Étude approfondie des signes des temps et de l'espérance du retour du Maître. Enseignement prophétique à partir des paroles reçues.",
      duration: "1:24:30",
      views: 1240,
      isLive: false,
      publishedAt: new Date("2025-08-18"),
    },
    {
      servantId: kongo.id,
      title: "Live — Marcher dans la sainteté",
      description: "Direct sur la marche quotidienne avec Dieu, la sanctification pratique au quotidien.",
      duration: "EN DIRECT",
      views: 0,
      isLive: true,
      publishedAt: new Date("2025-08-23"),
    },
    {
      servantId: pam.id,
      title: "Témoignage d'enlèvement au ciel",
      description:
        "Récit détaillé d'une visite au ciel et des instructions reçues du Seigneur Yeshoua.",
      duration: "42:15",
      views: 2150,
      isLive: false,
      publishedAt: new Date("2025-08-10"),
    },
    {
      servantId: kongo.id,
      title: "Pastorale — Tenir ferme dans la foi",
      description: "Encouragement pastoral pour les temps difficiles. Comment tenir quand tout semble chanceler.",
      duration: "28:50",
      views: 890,
      isLive: false,
      publishedAt: new Date("2025-07-28"),
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
      name: "Mouvement Christ Libère",
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
        "Communications officielles de PAM et du Pasteur Kongo. Lecture seule pour les membres.",
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
      servantId: kongo.id,
      title: "Enseignement hebdomadaire — Tenir ferme",
      description: "Direct hebdomadaire du Pasteur Kongo sur la persévérance dans les temps difficiles.",
      scheduledAt: nextLive,
      status: "SCHEDULED",
    } as const,
  });
  console.log(`  ✓ 1 live programmé`);

  console.log("\n✅ Seed V2 terminé avec succès !");
  console.log(`   - 2 serviteurs`);
  console.log(`   - ${PAM_BIOGRAPHY.length + KONGO_BIOGRAPHY.length} jalons biographiques authentiques`);
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
