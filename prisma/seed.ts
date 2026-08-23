/**
 * Seed — Mouvement Christ Libère
 * Peuple la base avec les données initiales (V1 MVP).
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

async function main() {
  console.log("🌱 Début du seed...");

  // ============================================================
  // 1. SERVITEURS
  // ============================================================
  const pam = await db.servant.upsert({
    where: { code: "pam" },
    update: {},
    create: {
      code: "pam",
      fullName: "Afrika Alkebulane Pamela Dali",
      shortName: "PAM",
      role: "Servante de l'Éternel",
      bio: "Témoignages d'enlèvements au ciel, instructions reçues du Seigneur Yeshoua, conformité à la Parole. Figure contemporaine du patriarche Hénoch.",
      isActive: true,
    },
  });

  const kongo = await db.servant.upsert({
    where: { code: "kongo" },
    update: {},
    create: {
      code: "kongo",
      fullName: "Pasteur Kongo",
      shortName: "Pasteur Kongo",
      role: "Époux, ministre pastoral",
      bio: "Ministère pastoral complémentaire, enseignements et partages spirituels.",
      isActive: true,
    },
  });

  console.log(`  ✓ Serviteurs: ${pam.shortName}, ${kongo.shortName}`);

  // ============================================================
  // 2. BIOGRAPHIES
  // ============================================================
  const pamBio = [
    {
      date: "Enfance",
      title: "Les premières intuitions",
      description:
        "Une enfance marquée par une perception spirituelle aiguë, où les questions sur l'invisible et la présence de Dieu s'imposent avec une intensité particulière. Pas encore de mots pour nommer ce qui se vivait — mais déjà une conscience que le ciel n'est pas un concept abstrait.",
      verseRef: "Psaume 22:10",
      verseText:
        "C'est toi qui m'as tiré du sein de ma mère, qui m'as mis en confiance sur les mamelles de ma mère.",
      order: 1,
    },
    {
      date: "L'ouverture",
      title: "Le premier appel",
      description:
        "Le moment où la voix du Seigneur s'est fait entendre d'une manière qui ne laissait plus place au doute. Une bascule. Ce qui était pressenti devient révélé. Ce qui était senti devient reçu.",
      verseRef: "1 Samuel 3:10",
      verseText:
        "L'Éternel vint et se présenta, et il appela comme les autres fois : Samuel, Samuel ! Et Samuel répondit : Parle, car ton serviteur écoute.",
      order: 2,
    },
    {
      date: "La rencontre",
      title: "La rencontre avec le Pasteur Kongo",
      description:
        "La rencontre de deux appels qui se rejoignent. Pas une fusion — une alliance. Deux ministères distincts qui s'articulent, deux voix qui ne se confondent pas mais s'accordent. Le mariage comme alliance spirituelle avant d'être une histoire d'amour terrestre.",
      verseRef: "Ecclésiaste 4:12",
      verseText:
        "Si quelqu'un tombe, son compagnon le relève ; mais malheur à celui qui est seul et qui tombe, sans avoir un second pour le relever.",
      order: 3,
    },
    {
      date: "Les enlèvements",
      title: "Marcher avec Dieu, comme Hénoch",
      description:
        "Les premières expériences d'enlèvement au ciel. Le Seigneur fait visiter des lieux, fait rencontrer des êtres, transmet des instructions. Chaque expérience est confrontée à la Parole écrite pour vérifier sa conformité. Rien n'est reçu sans être testé.",
      verseRef: "Genèse 5:24",
      verseText:
        "Et Hénoch marcha avec Dieu ; et il ne fut plus, car Dieu le prit.",
      order: 4,
    },
    {
      date: "Aujourd'hui",
      title: "La fidélité quotidienne",
      description:
        "Le ministère continue. Les enlèvements continuent. Les instructions continuent. Mais le quotidien reste — la prière, la lecture, le service, l'écoute des frères et sœurs. La plateforme est née de la nécessité de préserver et de transmettre ce qui est reçu.",
      verseRef: "Hébreux 11:5",
      verseText:
        "C'est par la foi qu'Hénoch fut enlevé afin d'échapper à la mort, et il ne fut plus retrouvé, parce que Dieu l'avait enlevé.",
      order: 5,
    },
  ];

  for (const b of pamBio) {
    await db.biography.create({
      data: { ...b, servantId: pam.id },
    });
  }
  console.log(`  ✓ ${pamBio.length} jalons biographiques PAM`);

  const kongoBio = [
    {
      date: "Enfance",
      title: "Un cœur tourné vers Dieu",
      description:
        "Une enfance où la question de Dieu s'est posée tôt, non comme une contrainte religieuse mais comme une attraction. L'Écriture lue, méditée, priée — bien avant tout ministère formel.",
      verseRef: "Psaume 119:9",
      verseText:
        "Comment le jeune homme rendra-t-il pur son sentier ? En se dirigeant d'après ta parole.",
      order: 1,
    },
    {
      date: "Le ministère",
      title: "Le pastorat",
      description:
        "L'appel à servir, à enseigner, à conduire. Le pastorat comme service, jamais comme pouvoir. Une charge qui s'exerce dans la crainte de Dieu et dans l'amour des brebis.",
      verseRef: "1 Pierre 5:2-3",
      verseText:
        "Paissez le troupeau de Dieu qui est sous votre garde, non par contrainte, mais volontairement.",
      order: 2,
    },
    {
      date: "La rencontre",
      title: "La rencontre avec PAM",
      description:
        "La reconnaissance de deux appels complémentaires. Le ministère pastoral et le ministère prophétique qui se rencontrent sans se confondre. Une alliance dans le Seigneur.",
      verseRef: "Amos 3:3",
      verseText: "Deux hommes marchent-ils ensemble, sans en être convenus ?",
      order: 3,
    },
    {
      date: "Aujourd'hui",
      title: "Servir dans la continuité",
      description:
        "Poursuite du ministère pastoral, en harmonie avec le ministère prophétique de PAM. Enseignements, partages, accompagnement des frères et sœurs dans la foi.",
      verseRef: "2 Timothée 4:2",
      verseText:
        "Prêche la parole, insiste en temps et hors de temps, reprends, censure, exhorte.",
      order: 4,
    },
  ];

  for (const b of kongoBio) {
    await db.biography.create({
      data: { ...b, servantId: kongo.id },
    });
  }
  console.log(`  ✓ ${kongoBio.length} jalons biographiques Pasteur Kongo`);

  // ============================================================
  // 3. TÉMOIGNAGES
  // ============================================================
  const testimonies: Array<{
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
      title: "Le ciel ouvert au milieu de la nuit",
      short:
        "Une vision nocturne où le ciel s'est déchiré et où une lumière s'est fait entendre.",
      content:
        "Récit détaillé d'une vision nocturne où le ciel s'est ouvert. Description de ce qui a été vu, entendu, et reçu comme instruction. Confrontation systématique avec la Parole écrite.",
      status: "CONFIRMED",
      themes: ["Vision", "Ciel", "Lumière"],
      bookRef: "Ézéchiel 1:1",
      readingTime: "8 min",
      publishedAt: new Date("2025-03-14"),
    },
    {
      servantId: pam.id,
      title: "Visite au Paradis — troisième ciel",
      short:
        "Un enlèvement où le Seigneur m'a fait visiter un lieu qui correspond à ce que Paul décrit.",
      content:
        "Récit d'un enlèvement au troisième ciel. Description du lieu, des êtres rencontrés, des paroles reçues. Conformité avec 2 Corinthiens 12:2.",
      status: "CONFIRMED",
      themes: ["Enlèvement", "Paradis", "Révélation"],
      bookRef: "2 Corinthiens 12:2",
      readingTime: "12 min",
      publishedAt: new Date("2025-02-08"),
    },
    {
      servantId: pam.id,
      title: "Le chofar qui retentit",
      short:
        "Le son du chofar entendu de manière surnaturelle, accompagné d'une instruction claire.",
      content:
        "Récit de l'audition surnaturelle du chofar, accompagnée d'une instruction précise sur le rassemblement et la préparation au retour.",
      status: "CONFIRMED",
      themes: ["Chofar", "Instruction", "Retour"],
      bookRef: "1 Thessaloniciens 4:16",
      readingTime: "6 min",
      publishedAt: new Date("2025-04-22"),
    },
    {
      servantId: kongo.id,
      title: "Parole reçue sur le rassemblement",
      short:
        "Une parole reçue concernant le rassemblement des fils d'Israël dispersés.",
      content:
        "Enseignement pastoral reçu par révélation sur le rassemblement des dispersés d'Israël, en lien avec Ésaïe 11:12.",
      status: "CONFIRMED",
      themes: ["Rassemblement", "Israël", "Prophétie"],
      bookRef: "Ésaïe 11:12",
      readingTime: "9 min",
      publishedAt: new Date("2025-05-10"),
    },
    {
      servantId: pam.id,
      title: "Récit récent d'une visite angélique",
      short:
        "Un récit transmis il y a quelques jours, encore en cours de discernement pastoral.",
      content:
        "Récit récent d'une visite angélique, en cours de discernement par l'équipe pastorale.",
      status: "TO_DISCERN",
      themes: ["Ange", "Visite", "À discerner"],
      bookRef: "Hébreux 13:2",
      readingTime: "5 min",
      publishedAt: new Date("2025-08-15"),
    },
    {
      servantId: kongo.id,
      title: "La paix au milieu de la tempête",
      short:
        "Un enseignement pastoral sur la paix que le monde ne peut pas donner.",
      content:
        "Enseignement pastoral sur la paix de Christ, au-delà de ce que le monde peut offrir.",
      status: "CONFIRMED",
      themes: ["Paix", "Foi", "Espérance"],
      bookRef: "Jean 14:27",
      readingTime: "7 min",
      publishedAt: new Date("2025-06-30"),
    },
  ];

  for (const t of testimonies) {
    await db.testimony.create({ data: t });
  }
  console.log(`  ✓ ${testimonies.length} témoignages`);

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
        "Étude sur Genèse 5:24 et le témoignage d'Hénoch. Que signifie marcher avec Dieu au quotidien, et comment cela se vit-il concrètement aujourd'hui ?",
      content:
        "Étude approfondie sur la marche avec Dieu à partir du témoignage d'Hénoch...",
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
        "Présentation des sept fêtes de l'Éternel (Lévitique 23) et de leur accomplissement progressif en Yeshoua le Messie.",
      content: "Étude des sept fêtes bibliques et de leur accomplissement messianique.",
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
        "Étude des promesses prophétiques sur le rassemblement des fils d'Israël et leur signification pour notre temps.",
      content: "Étude prophétique sur le rassemblement des dispersés d'Israël.",
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
        "Comment discerner ce qui vient de Dieu, ce qui vient de l'ennemi, et ce qui vient de notre propre âme. Critères bibliques de discernement.",
      content: "Enseignement sur le discernement spirituel selon 1 Jean 4.",
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
        "Étude sur la signification du chofar dans l'Écriture, depuis le mont Sinaï jusqu'au retour du Messie.",
      content: "Étude sur le chofar, du Sinaï au retour de Yeshoua.",
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
        "Enseignement pastoral sur la prière fervente, à partir de la vie d'Élie et de Jacques 5:16-18.",
      content: "Enseignement sur la prière fervente et efficace.",
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
        "Étude approfondie des signes des temps et de l'espérance du retour du Maître.",
      duration: "1:24:30",
      views: 1240,
      isLive: false,
      publishedAt: new Date("2025-08-18"),
    },
    {
      servantId: kongo.id,
      title: "Live — Marcher dans la sainteté",
      description: "Direct sur la marche quotidienne avec Dieu.",
      duration: "EN DIRECT",
      views: 0,
      isLive: true,
      publishedAt: new Date("2025-08-23"),
    },
    {
      servantId: pam.id,
      title: "Témoignage d'enlèvement au ciel",
      description:
        "Récit détaillé d'une visite au ciel et des instructions reçues.",
      duration: "42:15",
      views: 2150,
      isLive: false,
      publishedAt: new Date("2025-08-10"),
    },
    {
      servantId: kongo.id,
      title: "Pastorale — Tenir ferme dans la foi",
      description: "Encouragement pastoral pour les temps difficiles.",
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
        "Communications officielles de PAM et du Pasteur Kongo.",
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
        "Canal réservé aux pasteurs en relation avec le ministère. Accès sur invitation.",
      type: "RESTRICTED",
      isEncrypted: true,
      isRestricted: true,
      order: 3,
    },
    {
      name: "Intercession communautaire",
      description:
        "Demandes de prière, chaîne d'intercession, suivi des exaucements.",
      type: "TEXT",
      isEncrypted: false,
      isRestricted: false,
      order: 4,
    },
    {
      name: "Études bibliques en direct",
      description: "Canal vocal actif pendant les lives d'enseignement.",
      type: "VOICE",
      isEncrypted: false,
      isRestricted: false,
      order: 5,
    },
  ];

  for (const c of channels) {
    await db.channel.create({
      data: { ...c, communityId: community.id },
    });
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
      description: "Direct hebdomadaire du Pasteur Kongo sur la persévérance.",
      scheduledAt: nextLive,
      status: "SCHEDULED",
    } as const,
  });
  console.log(`  ✓ 1 live programmé`);

  console.log("\n✅ Seed terminé avec succès !");
  console.log(`   - 2 serviteurs`);
  console.log(`   - 9 jalons biographiques`);
  console.log(`   - 6 témoignages`);
  console.log(`   - 6 enseignements`);
  console.log(`   - 4 vidéos`);
  console.log(`   - 5 canaux communauté`);
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
