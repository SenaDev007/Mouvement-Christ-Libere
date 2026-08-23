// Données mockées pour la V1 — seront remplacées par la base Prisma en V1 finale
// Conformes au copywriting et au design system

import { ServantId } from "@/components/site/servant-context";

export interface BiographyMilestone {
  date: string;
  title: string;
  description: string;
  verseRef?: string;
  verseText?: string;
}

export interface Testimony {
  id: string;
  title: string;
  short: string;
  servant: ServantId;
  date: string;
  status: "confirmed" | "to_discern";
  themes: string[];
  bookRef?: string;
  readingTime: string;
}

export interface Teaching {
  id: string;
  title: string;
  excerpt: string;
  servant: ServantId;
  theme: string;
  book: string;
  level: "Découverte" | "Intermédiaire" | "Avancé";
  date: string;
  readingTime: string;
}

export interface VideoItem {
  id: string;
  title: string;
  description: string;
  servant: ServantId;
  duration: string;
  thumbnail: string;
  date: string;
  isLive?: boolean;
  views: number;
}

// === BIOGRAPHIES ===

export const BIOGRAPHIES: Record<Exclude<ServantId, "commun">, BiographyMilestone[]> = {
  pam: [
    {
      date: "Enfance",
      title: "Les premières intuitions",
      description:
        "Une enfance marquée par une perception spirituelle aiguë, où les questions sur l'invisible et la présence de Dieu s'imposent avec une intensité particulière. Pas encore de mots pour nommer ce qui se vivait — mais déjà une conscience que le ciel n'est pas un concept abstrait.",
      verseRef: "Psaume 22:10",
      verseText:
        "C'est toi qui m'as tiré du sein de ma mère, qui m'as mis en confiance sur les mamelles de ma mère.",
    },
    {
      date: "L'ouverture",
      title: "Le premier appel",
      description:
        "Le moment où la voix du Seigneur s'est fait entendre d'une manière qui ne laissait plus place au doute. Une bascule, un basculement. Ce qui était pressenti devient révélé. Ce qui était senti devient reçu.",
      verseRef: "1 Samuel 3:10",
      verseText:
        "L'Éternel vint et se présenta, et il appela comme les autres fois : Samuel, Samuel ! Et Samuel répondit : Parle, car ton serviteur écoute.",
    },
    {
      date: "La rencontre",
      title: "La rencontre avec le Pasteur Kongo",
      description:
        "La rencontre de deux appels qui se rejoignent. Pas une fusion — une alliance. Deux ministères distincts qui s'articulent, deux voix qui ne se confondent pas mais s'accordent. Le mariage comme alliance spirituelle avant d'être une histoire d'amour terrestre.",
      verseRef: "Ecclésiaste 4:12",
      verseText:
        "Si quelqu'un tombe, son compagnon le relève ; mais malheur à celui qui est seul et qui tombe, sans avoir un second pour le relever.",
    },
    {
      date: "Les enlèvements",
      title: "Marcher avec Dieu, comme Hénoch",
      description:
        "Les premières expériences d'enlèvement au ciel. Le Seigneur fait visiter des lieux, fait rencontrer des êtres, transmet des instructions. Chaque expérience est confrontée à la Parole écrite pour vérifier sa conformité. Rien n'est reçu sans être testé.",
      verseRef: "Genèse 5:24",
      verseText:
        "Et Hénoch marcha avec Dieu ; et il ne fut plus, car Dieu le prit.",
    },
    {
      date: "Aujourd'hui",
      title: "La fidélité quotidienne",
      description:
        "Le ministère continue. Les enlèvements continuent. Les instructions continuent. Mais le quotidien reste — la prière, la lecture, le service, l'écoute des frères et sœurs. La plateforme est née de la nécessité de préserver et de transmettre ce qui est reçu.",
      verseRef: "Hébreux 11:5",
      verseText:
        "C'est par la foi qu'Hénoch fut enlevé afin d'échapper à la mort, et il ne fut plus retrouvé, parce que Dieu l'avait enlevé.",
    },
  ],
  kongo: [
    {
      date: "Enfance",
      title: "Un cœur tourné vers Dieu",
      description:
        "Une enfance où la question de Dieu s'est posée tôt, non comme une contrainte religieuse mais comme une attraction. L'Écriture lue, méditée, priée — bien avant tout ministère formel.",
      verseRef: "Psaume 119:9",
      verseText:
        "Comment le jeune homme rendra-t-il pur son sentier ? En se dirigeant d'après ta parole.",
    },
    {
      date: "Le ministère",
      title: "Le pastorat",
      description:
        "L'appel à servir, à enseigner, à conduire. Le pastorat comme service, jamais comme pouvoir. Une charge qui s'exerce dans la crainte de Dieu et dans l'amour des brebis.",
      verseRef: "1 Pierre 5:2-3",
      verseText:
        "Paissez le troupeau de Dieu qui est sous votre garde, non par contrainte, mais volontairement.",
    },
    {
      date: "La rencontre",
      title: "La rencontre avec PAM",
      description:
        "La reconnaissance de deux appels complémentaires. Le ministère pastoral et le ministère prophétique qui se rencontrent sans se confondre. Une alliance dans le Seigneur.",
      verseRef: "Amos 3:3",
      verseText: "Deux hommes marchent-ils ensemble, sans en être convenus ?",
    },
    {
      date: "Aujourd'hui",
      title: "Servir dans la continuité",
      description:
        "Poursuite du ministère pastoral, en harmonie avec le ministère prophétique de PAM. Enseignements, partages, accompagnement des frères et sœurs dans la foi.",
      verseRef: "2 Timothée 4:2",
      verseText:
        "Prêche la parole, insiste en temps et hors de temps, reprends, censure, exhorte.",
    },
  ],
};

// === TÉMOIGNAGES ===

export const TESTIMONIES: Testimony[] = [
  {
    id: "t1",
    title: "Le ciel ouvert au milieu de la nuit",
    short:
      "Une vision nocturne où le ciel s'est déchiré et où une lumière s'est fait entendre.",
    servant: "pam",
    date: "2025-03-14",
    status: "confirmed",
    themes: ["Vision", "Ciel", " Lumière"],
    bookRef: "Ézéchiel 1:1",
    readingTime: "8 min",
  },
  {
    id: "t2",
    title: "Visite au Paradis — troisième ciel",
    short:
      "Un enlèvement où le Seigneur m'a fait visiter un lieu qui correspond à ce que Paul décrit.",
    servant: "pam",
    date: "2025-02-08",
    status: "confirmed",
    themes: ["Enlèvement", "Paradis", "Révélation"],
    bookRef: "2 Corinthiens 12:2",
    readingTime: "12 min",
  },
  {
    id: "t3",
    title: "Le chofar qui retentit",
    short:
      "Le son du chofar entendu de manière surnaturelle, accompagné d'une instruction claire.",
    servant: "pam",
    date: "2025-04-22",
    status: "confirmed",
    themes: ["Chofar", "Instruction", "Retour"],
    bookRef: "1 Thessaloniciens 4:16",
    readingTime: "6 min",
  },
  {
    id: "t4",
    title: "Parole reçue sur le rassemblement",
    short:
      "Une parole reçue concernant le rassemblement des fils d'Israël dispersés.",
    servant: "kongo",
    date: "2025-05-10",
    status: "confirmed",
    themes: ["Rassemblement", "Israël", "Prophétie"],
    bookRef: "Ésaïe 11:12",
    readingTime: "9 min",
  },
  {
    id: "t5",
    title: "Récit récent d'une visite angélique",
    short:
      "Un récit transmis il y a quelques jours, encore en cours de discernement pastoral.",
    servant: "pam",
    date: "2025-08-15",
    status: "to_discern",
    themes: ["Ange", "Visite", "À discerner"],
    bookRef: "Hébreux 13:2",
    readingTime: "5 min",
  },
  {
    id: "t6",
    title: "La paix au milieu de la tempête",
    short:
      "Un enseignement pastoral sur la paix que le monde ne peut pas donner.",
    servant: "kongo",
    date: "2025-06-30",
    status: "confirmed",
    themes: ["Paix", "Foi", "Espérance"],
    bookRef: "Jean 14:27",
    readingTime: "7 min",
  },
];

// === ENSEIGNEMENTS ===

export const TEACHINGS: Teaching[] = [
  {
    id: "e1",
    title: "Marcher avec Dieu à la manière d'Hénoch",
    excerpt:
      "Étude sur Genèse 5:24 et le témoignage d'Hénoch. Que signifie marcher avec Dieu au quotidien, et comment cela se vit-il concrètement aujourd'hui ?",
    servant: "pam",
    theme: "Marche spirituelle",
    book: "Genèse",
    level: "Intermédiaire",
    date: "2025-07-20",
    readingTime: "15 min",
  },
  {
    id: "e2",
    title: "Les fêtes bibliques et leur accomplissement",
    excerpt:
      "Présentation des sept fêtes de l'Éternel (Lévitique 23) et de leur accomplissement progressif en Yeshoua le Messie.",
    servant: "kongo",
    theme: "Calendrier liturgique",
    book: "Lévitique",
    level: "Avancé",
    date: "2025-07-10",
    readingTime: "22 min",
  },
  {
    id: "e3",
    title: "Le rassemblement des dispersés d'Israël",
    excerpt:
      "Étude des promesses prophétiques sur le rassemblement des fils d'Israël et leur signification pour notre temps.",
    servant: "pam",
    theme: "Prophétie",
    book: "Ésaïe",
    level: "Avancé",
    date: "2025-06-15",
    readingTime: "18 min",
  },
  {
    id: "e4",
    title: "Discerner les voix spirituelles",
    excerpt:
      "Comment discerner ce qui vient de Dieu, ce qui vient de l'ennemi, et ce qui vient de notre propre âme. Critères bibliques de discernement.",
    servant: "kongo",
    theme: "Discernement",
    book: "1 Jean",
    level: "Intermédiaire",
    date: "2025-05-25",
    readingTime: "14 min",
  },
  {
    id: "e5",
    title: "Le chofar dans la Bible et aujourd'hui",
    excerpt:
      "Étude sur la signification du chofar dans l'Écriture, depuis le mont Sinaï jusqu'au retour du Messie.",
    servant: "pam",
    theme: "Symbolique biblique",
    book: "Exode",
    level: "Découverte",
    date: "2025-04-08",
    readingTime: "10 min",
  },
  {
    id: "e6",
    title: "La prière qui prévaut",
    excerpt:
      "Enseignement pastoral sur la prière fervente, à partir de la vie d'Élie et de Jacques 5:16-18.",
    servant: "kongo",
    theme: "Prière",
    book: "Jacques",
    level: "Découverte",
    date: "2025-03-30",
    readingTime: "12 min",
  },
];

// === VIDÉOS ===

export const VIDEOS: VideoItem[] = [
  {
    id: "v1",
    title: "Enseignement sur le retour de Yeshoua",
    description:
      "Étude approfondie des signes des temps et de l'espérance du retour du Maître.",
    servant: "pam",
    duration: "1:24:30",
    thumbnail: "",
    date: "2025-08-18",
    views: 1240,
    isLive: false,
  },
  {
    id: "v2",
    title: "Live — Marcher dans la sainteté",
    description: "Direct sur la marche quotidienne avec Dieu.",
    servant: "kongo",
    duration: "EN DIRECT",
    thumbnail: "",
    date: "2025-08-23",
    views: 0,
    isLive: true,
  },
  {
    id: "v3",
    title: "Témoignage d'enlèvement au ciel",
    description:
      "Récit détaillé d'une visite au ciel et des instructions reçues.",
    servant: "pam",
    duration: "42:15",
    thumbnail: "",
    date: "2025-08-10",
    views: 2150,
  },
  {
    id: "v4",
    title: "Pastorale — Tenir ferme dans la foi",
    description: "Encouragement pastoral pour les temps difficiles.",
    servant: "kongo",
    duration: "28:50",
    thumbnail: "",
    date: "2025-07-28",
    views: 890,
  },
];

// === CANAUX COMMUNAUTÉ ===

export interface Channel {
  id: string;
  name: string;
  description: string;
  type: "texte" | "voix" | "annonce" | "groupe restreint";
  members: number;
  encrypted: boolean;
}

export const CHANNELS: Channel[] = [
  {
    id: "c1",
    name: "Annonces officielles",
    description: "Communications officielles de PAM et du Pasteur Kongo.",
    type: "annonce",
    members: 0,
    encrypted: false,
  },
  {
    id: "c2",
    name: "Nouveaux croyants Yeshoua",
    description:
      "Accueil et accompagnement des nouveaux venus dans la foi. Questions bienvenus.",
    type: "texte",
    members: 124,
    encrypted: false,
  },
  {
    id: "c3",
    name: "Cercle des pasteurs affiliés",
    description:
      "Canal réservé aux pasteurs en relation avec le ministère. Accès sur invitation.",
    type: "groupe restreint",
    members: 18,
    encrypted: true,
  },
  {
    id: "c4",
    name: "Intercession communautaire",
    description:
      "Demandes de prière, chaîne d'intercession, suivi des exaucements.",
    type: "texte",
    members: 287,
    encrypted: false,
  },
  {
    id: "c5",
    name: "Études bibliques en direct",
    description: "Canal vocal actif pendant les lives d'enseignement.",
    type: "voix",
    members: 0,
    encrypted: false,
  },
];

// === STATS ACCUEIL ===

export const HOME_STATS = [
  { value: "6", label: "enseignements publiés" },
  { value: "6", label: "témoignages partagés" },
  { value: "12", label: "pays représentés dans la communauté" },
  { value: "24h", label: "délai de réponse aux demandes d'appel" },
];
