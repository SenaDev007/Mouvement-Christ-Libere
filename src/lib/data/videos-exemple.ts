/**
 * Données d'exemple — Vidéos & Lives
 *
 * Structure : vidéos organisées par serviteur (Pam / Pasteur Kongo),
 * puis par catégorie/série. Chaque vidéo a un YouTube ID pour le lecteur intégré.
 *
 * Les vrai liens YouTube remplaceront ces données d'exemple via le back office.
 */

export interface VideoItem {
  id: string;
  youtubeId: string;
  title: string;
  description: string;
  duration: string;
  views: number;
  publishedAt: string;
  category: string;
  servant: "pam" | "kongo";
}

export interface VideoCategory {
  id: string;
  name: string;
  description: string;
  servant: "pam" | "kongo";
  videos: VideoItem[];
}

// ============================================================
// VIDÉOS DE PAM
// ============================================================

const PAM_VIDEOS: VideoItem[] = [
  // Série : Visites au Ciel
  {
    id: "pam-1",
    youtubeId: "dQw4w9WgXcQ",
    title: "Visite du Royaume des Cieux — Partie 1 : La Transfiguration",
    description: "Récit du premier enlèvement céleste de Pam en 2003. La chambre transformée en or pur, les corps transfigurés, et la voix du Seigneur retentissant : « Pam, monte ici, je vais te montrer ma gloire. »",
    duration: "45:32",
    views: 12500,
    publishedAt: "2024-03-15",
    category: "Visites au Ciel",
    servant: "pam",
  },
  {
    id: "pam-2",
    youtubeId: "dQw4w9WgXcQ",
    title: "Visite du Royaume des Cieux — Partie 2 : Le Trône de Cristal",
    description: "Pam décrit sa rencontre face au Trône de l'Éternel, le silence céleste, et la question qui a transpercé son âme : « Pam, où sont les vêtements de gloire que je t'ai donnés ? »",
    duration: "52:18",
    views: 9800,
    publishedAt: "2024-03-22",
    category: "Visites au Ciel",
    servant: "pam",
  },
  {
    id: "pam-3",
    youtubeId: "dQw4w9WgXcQ",
    title: "Visite du Royaume des Cieux — Partie 3 : Les Seize Anges de Destinée",
    description: "Découverte des seize anges assignés à chaque enfant de Dieu, leurs fonctions spécifiques, et la révélation de la loi des rencontres orchestrées par le Seigneur.",
    duration: "38:45",
    views: 7300,
    publishedAt: "2024-03-29",
    category: "Visites au Ciel",
    servant: "pam",
  },
  {
    id: "pam-4",
    youtubeId: "dQw4w9WgXcQ",
    title: "Visite du Royaume des Cieux — Partie 4 : La Rivière de Cristal",
    description: "Pam marche le long de la rivière de cristal qui coule du Trône de Dieu. Description des arbres de vie, des fruits célestes, et des enfants qui y grandissent.",
    duration: "41:20",
    views: 8100,
    publishedAt: "2024-04-05",
    category: "Visites au Ciel",
    servant: "pam",
  },
  // Série : Enseignements
  {
    id: "pam-5",
    youtubeId: "dQw4w9WgXcQ",
    title: "La Trinité Céleste : Un Seul Dieu sur un Seul Trône",
    description: "Enseignement sur la nature de la Trinité, basé sur les révélations reçues lors des visites au ciel. Comprendre comment le Père, le Fils et le Saint-Esprit forment un seul Dieu.",
    duration: "67:15",
    views: 15200,
    publishedAt: "2024-05-10",
    category: "Enseignements",
    servant: "pam",
  },
  {
    id: "pam-6",
    youtubeId: "dQw4w9WgXcQ",
    title: "La Sanctification du Shabbat à la Maison",
    description: "Enseignement pratique sur comment sanctifier le Shabbat en famille, les interdits bibliques, et les bénédictions promises à ceux qui gardent le jour de l'Éternel.",
    duration: "54:30",
    views: 11400,
    publishedAt: "2024-05-17",
    category: "Enseignements",
    servant: "pam",
  },
  {
    id: "pam-7",
    youtubeId: "dQw4w9WgXcQ",
    title: "Le Véritable Baptême d'Eau par Immersion",
    description: "Étude biblique approfondie sur le baptême : pourquoi l'immersion totale, la signification spirituelle, et les conditions préalables selon les Écritures.",
    duration: "49:12",
    views: 8900,
    publishedAt: "2024-05-24",
    category: "Enseignements",
    servant: "pam",
  },
  // Série : Témoignages
  {
    id: "pam-8",
    youtubeId: "dQw4w9WgXcQ",
    title: "Ma Mort et Ma Résurrection — 18 Juillet 2011",
    description: "Récit intégral de la mort physique de Pam au camp de San Pedro, son face-à-face avec l'Éternel, et sa résurrection glorieuse accompagnée du baptême du Saint-Esprit et de feu.",
    duration: "78:45",
    views: 23000,
    publishedAt: "2024-06-01",
    category: "Témoignages",
    servant: "pam",
  },
  {
    id: "pam-9",
    youtubeId: "dQw4w9WgXcQ",
    title: "Le Complot de San Pedro : Le Sacrifice Humain",
    description: "Détails du complot des sorciers et féticheurs contre la vie de Pam, les attaques mystiques, et la manière dont l'Éternel l'a délivrée par des actes prophétiques.",
    duration: "61:20",
    views: 18700,
    publishedAt: "2024-06-08",
    category: "Témoignages",
    servant: "pam",
  },
  {
    id: "pam-10",
    youtubeId: "dQw4w9WgXcQ",
    title: "Les Chars de Feu et la Révélation de mon Palais Céleste",
    description: "Pam décrit les chars de feu célestes, la révélation de son palais dans le Royaume, et la manière dont chaque croyant a une demeure préparée par le Seigneur.",
    duration: "55:33",
    views: 10200,
    publishedAt: "2024-06-15",
    category: "Témoignages",
    servant: "pam",
  },
];

// ============================================================
// VIDÉOS DU PASTEUR KONGO
// ============================================================

const KONGO_VIDEOS: VideoItem[] = [
  // Série : Fêtes de l'Éternel
  {
    id: "kongo-1",
    youtubeId: "dQw4w9WgXcQ",
    title: "Pâque et Pain sans Levain : La Fondation des Fêtes",
    description: "Enseignement pastoral sur la fête de Pâque, sa signification prophétique, et comment Yeshua l'a accomplie. Instructions pratiques pour la célébration.",
    duration: "58:40",
    views: 6500,
    publishedAt: "2024-04-12",
    category: "Fêtes de l'Éternel",
    servant: "kongo",
  },
  {
    id: "kongo-2",
    youtubeId: "dQw4w9WgXcQ",
    title: "Shavouot (Pentecôte) : Le Don de la Torah et de l'Esprit",
    description: "Étude de la fête de Shavouot : le don de la Torah au Sinaï, l'effusion du Saint-Esprit à Jérusalem, et la signification pour l'Église d'aujourd'hui.",
    duration: "47:25",
    views: 5200,
    publishedAt: "2024-05-20",
    category: "Fêtes de l'Éternel",
    servant: "kongo",
  },
  {
    id: "kongo-3",
    youtubeId: "dQw4w9WgXcQ",
    title: "Yom Teroua (Trompettes) : Le Réveil et le Retour du Roi",
    description: "Enseignement sur la fête des Trompettes, le son du chofar, et son lien prophétique avec le retour de Yeshua HaMashiach.",
    duration: "51:10",
    views: 7100,
    publishedAt: "2024-06-03",
    category: "Fêtes de l'Éternel",
    servant: "kongo",
  },
  // Série : Discernement Spirituel
  {
    id: "kongo-4",
    youtubeId: "dQw4w9WgXcQ",
    title: "Le Discernement des Esprits : Comment Reconnaître le Vrai du Faux",
    description: "Enseignement pastoral sur le don de discernement des esprits, les critères bibliques pour évaluer les manifestations spirituelles, et la protection contre la séduction.",
    duration: "63:18",
    views: 8400,
    publishedAt: "2024-05-05",
    category: "Discernement Spirituel",
    servant: "kongo",
  },
  {
    id: "kongo-5",
    youtubeId: "dQw4w9WgXcQ",
    title: "Les Pièges de l'Occultisme et la Délivrance en Christ",
    description: "Analyse biblique des pratiques occultes, leurs conséquences spirituelles, et le chemin de la délivrance par le sang de Yeshua.",
    duration: "69:45",
    views: 9300,
    publishedAt: "2024-05-12",
    category: "Discernement Spirituel",
    servant: "kongo",
  },
  // Série : Vie Pastorale
  {
    id: "kongo-6",
    youtubeId: "dQw4w9WgXcQ",
    title: "Le Rôle du Berger : Soigner les Brebis du Seigneur",
    description: "Enseignement sur le ministère pastoral selon le modèle de Yeshua le Bon Berger. Les responsabilités du berger, l'amour pour les brebis, et la garde du troupeau.",
    duration: "44:30",
    views: 4100,
    publishedAt: "2024-05-25",
    category: "Vie Pastorale",
    servant: "kongo",
  },
  {
    id: "kongo-7",
    youtubeId: "dQw4w9WgXcQ",
    title: "La Prière Fervente : Le Combat Spirituel du Croyant",
    description: "Enseignement pratique sur la prière fervente, les différents types de prière, et comment mener le combat spirituel dans le quotidien.",
    duration: "56:15",
    views: 7800,
    publishedAt: "2024-06-01",
    category: "Vie Pastorale",
    servant: "kongo",
  },
];

// ============================================================
// CATÉGORIES REGROUPÉES
// ============================================================

export function getCategoriesByServant(servant: "pam" | "kongo"): VideoCategory[] {
  const videos = servant === "pam" ? PAM_VIDEOS : KONGO_VIDEOS;
  const categoriesMap = new Map<string, VideoItem[]>();

  for (const video of videos) {
    if (!categoriesMap.has(video.category)) {
      categoriesMap.set(video.category, []);
    }
    categoriesMap.get(video.category)!.push(video);
  }

  return Array.from(categoriesMap.entries()).map(([name, vids], i) => ({
    id: `${servant}-cat-${i}`,
    name,
    description: getCategoryDescription(name),
    servant,
    videos: vids,
  }));
}

function getCategoryDescription(name: string): string {
  const descriptions: Record<string, string> = {
    "Visites au Ciel": "Récits détaillés des six enlèvements célestes de Pam — le Trône, les anges, le Paradis, et les révélations reçues de l'Éternel.",
    "Enseignements": "Études bibliques approfondies sur la Trinité, le Shabbat, le baptême, la dîme, et les fondements de la foi en Yeshua HaMashiach.",
    "Témoignages": "Témoignages authentiques de la mort, la résurrection, et les combats spirituels vécus par Pam dans le ministère.",
    "Fêtes de l'Éternel": "Enseignements sur les fêtes bibliques (Lévitique 23), leur accomplissement en Christ, et leur signification prophétique pour aujourd'hui.",
    "Discernement Spirituel": "Formation au discernement des esprits, reconnaissance des faux prophètes, et protection contre les séductions spirituelles.",
    "Vie Pastorale": "Enseignements pastoraux sur le ministère du berger, la prière fervente, et l'accompagnement spirituel des croyants.",
  };
  return descriptions[name] || "";
}

export function getAllVideos(): VideoItem[] {
  return [...PAM_VIDEOS, ...KONGO_VIDEOS];
}

export function getVideoById(id: string): VideoItem | undefined {
  return getAllVideos().find((v) => v.id === id);
}
