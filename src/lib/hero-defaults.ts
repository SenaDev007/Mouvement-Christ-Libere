/**
 * ============================================================
 * ⭐ V3.45 — SECTIONS HERO PARAMÉTRABLES — VALEURS PAR DÉFAUT
 * ============================================================
 *
 * Chaque page publique du site possède une section « hero » dont
 * l'image d'arrière-plan, l'accroche, le titre, le sous-titre et les
 * boutons sont désormais MODIFIABLES DEPUIS LE BACK-OFFICE
 * (/admin/heroes → table HeroSection, une ligne par page).
 *
 * Ce fichier est la SOURCE DE REPLI (aucune dépendance Prisma —
 * importable côté client ET serveur) :
 *   - les pages publiques fusionnent la ligne DB avec ces défauts ;
 *   - le back-office pré-remplit ses formulaires avec ces défauts ;
 *   - ensure-schema.ts sème la table avec ces valeurs au premier
 *     démarrage.
 *
 * Convention Isolélé : les textes bruts continuent d'écrire
 * « Israël » — c'est le RENDU (composant IsololeText / MarkdownText)
 * qui affiche « Isolélé (Israël) » avec « Isolélé » en gras.
 */

import { BIO_PAM, BIO_KONGO } from "@/lib/data/servant-bios";

// ============================================================
// TYPES
// ============================================================

export interface HeroConfig {
  page: string;
  /** Petit texte doré au-dessus du titre (ex. « Récits rapportés »). */
  kicker: string;
  /** Titre principal (partie blanche). */
  title: string;
  /** Partie dorée/accent du titre (2e ligne ou mot mis en couleur). */
  titleAccent: string;
  /** Texte APRÈS la partie dorée (ex. « d'Isolélé (Israël) »). */
  titleSuffix: string;
  subtitle: string;
  /** Image d'arrière-plan : chemin local, URL http OU data URL (upload). */
  backgroundImage: string;
  ctaLabel: string;
  ctaHref: string;
  cta2Label: string;
  cta2Href: string;
  /** Champs spécifiques par page (photo de biographie, badges, markdown…). */
  data: Record<string, string>;
}

/** Métadonnées d'affichage (back-office + listes). */
export interface HeroPageMeta {
  page: string;
  label: string;
  href: string;
  description: string;
}

// ============================================================
// PAGES COUVERTES (ordre de la sidebar back-office)
// ============================================================

export const HERO_PAGES: HeroPageMeta[] = [
  { page: "landing", label: "Accueil (landing)", href: "/", description: "Grand hero de la page d'accueil + photos de Pam et du Pasteur Kongo" },
  { page: "pam", label: "Pam — Servante", href: "/pam", description: "Hero, photo et biographie de Pam" },
  { page: "pasteur-kongo", label: "Pasteur Kongo", href: "/pasteur-kongo", description: "Hero, photo et biographie du Pasteur Kongo" },
  { page: "temoignages", label: "Témoignages", href: "/temoignages", description: "Hero de la page des témoignages" },
  { page: "enseignements", label: "Enseignements", href: "/enseignements", description: "Hero de la page des enseignements" },
  { page: "bible", label: "Bible", href: "/bible", description: "Hero de la Bible du Royaume" },
  { page: "calendrier-biblique", label: "Calendrier biblique", href: "/calendrier-biblique", description: "Hero du calendrier de l'Éternel" },
  { page: "videos", label: "Vidéos & Lives", href: "/videos", description: "Hero de la médiathèque vidéo" },
  { page: "intercession", label: "Intercession", href: "/intercession", description: "Hero de la chaîne d'intercession" },
  { page: "disperses", label: "Dispersés", href: "/disperses", description: "Hero de la carte des dispersés" },
  { page: "contribuer", label: "Contribuer", href: "/contribuer", description: "Hero de la page des dons" },
  { page: "contact", label: "Contact", href: "/contact", description: "Hero de la page contact" },
  { page: "communaute", label: "Communauté", href: "/communaute", description: "Hero de la page communauté" },
  { page: "appels", label: "Appels", href: "/appels", description: "Hero de la page appels audio/vidéo" },
  { page: "soustitrage", label: "Sous-titrage", href: "/soustitrage", description: "Hero de l'outil de sous-titrage" },
];

// ============================================================
// VALEURS PAR DÉFAUT (extraites des pages publiques existantes)
// ============================================================

export const DEFAULT_HEROES: Record<string, HeroConfig> = {
  landing: {
    page: "landing",
    kicker: "Un même appel, deux serviteurs",
    title: "Afrika Alkebulane Pamela Dali",
    titleAccent: "& Pasteur Kongo",
    titleSuffix: "",
    subtitle:
      "Témoignages, enseignements et vie de communauté, au service du rassemblement des fils d'Israël dispersés — en préparation au retour du Maître Yeshua, au son du chofar.",
    backgroundImage: "/pam-kongo-hero.webp",
    ctaLabel: "Découvrir Pam",
    ctaHref: "/pam",
    cta2Label: "Découvrir le Pasteur Kongo",
    cta2Href: "/pasteur-kongo",
    data: {
      pamPhoto: "/pam.jpeg",
      kongoPhoto: "/pasteur-kongo.jpeg",
      servantsKicker: "Deux serviteurs, un même appel",
      servantsTitle: "Découvrez leur parcours",
      pamName: "Afrika Alkebulane Pamela Dali",
      pamRole: "Servante de l'Éternel",
      pamDesc:
        "Témoignages de visites au ciel, révélations prophétiques, enseignements sur la sanctification et le retour de Yeshua HaMashiach.",
      kongoName: "Pasteur Kongo",
      kongoRole: "Ministère pastoral",
      kongoDesc:
        "Enseignements pastoraux, soins des brebis, discernement spirituel et accompagnement de la communauté dans la foi.",
    },
  },

  pam: {
    page: "pam",
    kicker: "Servante de l'Éternel",
    title: "Afrika Alkebulane",
    titleAccent: "Pamela Dali",
    titleSuffix: "",
    subtitle:
      "Servante de Dieu marquée dès le sein maternel, dépositaire d'un appel prophétique pour le rassemblement des dispersés d'Israël.",
    backgroundImage: "/pam.jpeg",
    ctaLabel: "",
    ctaHref: "",
    cta2Label: "",
    cta2Href: "",
    data: {
      badge1: "Alkebulan (Afrique)",
      badge2: "Marquée dès le sein maternel",
      bioKicker: "Biographie",
      bioTitle: "La Marche d'une Élue",
      bioQuote:
        "« À l'image du patriarche Hénoch qui marcha avec Dieu, elle a été saisie par le Créateur pour être le témoin direct des réalités invisibles du Royaume des Cieux. »",
      bioText: BIO_PAM,
      bioPhoto: "/pam.jpeg",
      bioPhotoBadge: "Servante de l'Éternel",
      bioPhotoFirstName: "Afrika Alkebulane",
      bioPhotoLastName: "Pamela Dali",
      bioCardLocation: "Née en Afrique — Alkebulan",
      bioCardCalendar: "Marquée dès le sein maternel",
    },
  },

  "pasteur-kongo": {
    page: "pasteur-kongo",
    kicker: "Ministère pastoral",
    // NB : sur cette page, la partie DORÉE (« Pasteur ») vient AVANT
    // le nom (« Kongo ») — l'ordre d'affichage est géré par la vue.
    title: "Kongo",
    titleAccent: "Pasteur",
    titleSuffix: "",
    subtitle: "La Voix de la Réforme Prophétique de la 11e Heure et la Restauration de l'Afrique.",
    backgroundImage: "/pasteur-kongo.jpeg",
    ctaLabel: "",
    ctaHref: "",
    cta2Label: "",
    cta2Href: "",
    data: {
      badge1: "Berger de la communauté",
      badge2: "Ministère pastoral",
      bioKicker: "Biographie",
      bioTitle: "La Voix de la Réforme Prophétique",
      bioQuote: "« Le temps fixé est arrivé pour redresser le drapeau de l'Afrique et stabiliser le continent. »",
      bioText: BIO_KONGO,
      bioPhoto: "/pasteur-kongo.jpeg",
      bioPhotoBadge: "Ministère pastoral",
      bioPhotoFirstName: "Pasteur",
      bioPhotoLastName: "Kongo",
      bioCardLocation: "Berger de la communauté",
      bioCardCalendar: "Ministère pastoral",
    },
  },

  temoignages: {
    page: "temoignages",
    kicker: "Récits rapportés",
    title: "Témoignages",
    titleAccent: "",
    titleSuffix: "",
    subtitle:
      "Des récits d'expériences spirituelles authentiques, rapportés tels qu'ils ont été vécus et confiés à la communauté. Chaque témoignage est confronté à la Parole écrite.",
    backgroundImage: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?q=80&w=1920&auto=format&fit=crop",
    ctaLabel: "Voir les enseignements",
    ctaHref: "/enseignements",
    cta2Label: "",
    cta2Href: "",
    data: {},
  },

  enseignements: {
    page: "enseignements",
    kicker: "Études bibliques",
    title: "Enseignements",
    titleAccent: "",
    titleSuffix: "",
    subtitle:
      "Des études bibliques classées par thème, par livre et par niveau, pour approfondir à votre rythme. Transmis avec rigueur, confrontés à la Parole.",
    backgroundImage: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=1920&auto=format&fit=crop",
    ctaLabel: "Voir les témoignages",
    ctaHref: "/temoignages",
    cta2Label: "",
    cta2Href: "",
    data: {},
  },

  bible: {
    page: "bible",
    kicker: "La Parole vivante",
    title: "Bible du Royaume",
    titleAccent: "",
    titleSuffix: "",
    subtitle:
      "6 versions de la Bible, concordance de Strong, hébreu originel et Peshitta — explorez les Écritures dans leur profondeur, pour nourrir votre foi.",
    backgroundImage: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?q=80&w=1920&auto=format&fit=crop",
    ctaLabel: "",
    ctaHref: "",
    cta2Label: "",
    cta2Href: "",
    data: {},
  },

  "calendrier-biblique": {
    page: "calendrier-biblique",
    kicker: "Calendrier de l'Éternel · 364 jours",
    title: "Calendrier Biblique",
    titleAccent: "",
    titleSuffix: "",
    subtitle:
      "Le calendrier solaire de 364 jours attesté dans le Livre d'Hénoch (72-82) et les manuscrits de Qumrân. Chaque fête tombe le même jour de semaine, chaque année, sans exception. L'année commence toujours un mercredi — jour de la création des luminaires.",
    backgroundImage: "https://images.unsplash.com/photo-1519677100203-a9b5e1e1e1e1?q=80&w=1920&auto=format&fit=crop",
    ctaLabel: "Aujourd'hui",
    ctaHref: "#aujourdhui",
    cta2Label: "",
    cta2Href: "",
    data: {},
  },

  videos: {
    page: "videos",
    kicker: "Vidéos & Lives",
    title: "Enseignements vidéo & directs",
    titleAccent: "",
    titleSuffix: "",
    subtitle: "",
    backgroundImage: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?q=80&w=1920&auto=format&fit=crop",
    ctaLabel: "",
    ctaHref: "",
    cta2Label: "",
    cta2Href: "",
    data: {},
  },

  intercession: {
    page: "intercession",
    kicker: "Moteur spirituel de la communauté",
    title: "Chaîne d'intercession",
    titleAccent: "",
    titleSuffix: "",
    subtitle:
      "Déposez vos demandes de prière : elles arrivent directement et en toute confidentialité entre les mains de l'équipe pastorale, qui les porte devant le Seigneur. Quand deux ou trois s'accordent, le Seigneur est au milieu.",
    backgroundImage: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=1920&auto=format&fit=crop",
    ctaLabel: "Déposer une demande",
    ctaHref: "#demander",
    cta2Label: "",
    cta2Href: "",
    data: {},
  },

  disperses: {
    page: "disperses",
    kicker: "Rassemblement des dispersés",
    title: "Carte des",
    titleAccent: "dispersés",
    titleSuffix: "d'Israël",
    subtitle:
      "« Il lèvera une bannière pour les nations lointaines, et il assemblera les exilés d'Israël. » — Ésaïe 11:12",
    backgroundImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1920&auto=format&fit=crop",
    ctaLabel: "Créer un compte",
    ctaHref: "/register",
    cta2Label: "",
    cta2Href: "",
    data: {
      ctaHelp:
        "Inscrivez-vous pour rejoindre la communauté — votre pseudonyme apparaîtra aussitôt sur la carte.",
    },
  },

  contribuer: {
    page: "contribuer",
    kicker: "Soutenir le ministère",
    title: "Contribuer",
    titleAccent: "",
    titleSuffix: "",
    subtitle:
      "Vos dons soutiennent le fonctionnement de cette plateforme et la diffusion des enseignements. Leur usage est publié chaque année, avec transparence totale.",
    backgroundImage: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=1920&auto=format&fit=crop",
    ctaLabel: "Faire un don",
    ctaHref: "#don",
    cta2Label: "",
    cta2Href: "",
    data: {},
  },

  contact: {
    page: "contact",
    kicker: "Prendre contact",
    title: "Demander un échange",
    titleAccent: "",
    titleSuffix: "",
    subtitle:
      "Laissez-nous vos coordonnées, un membre de l'équipe pastorale reviendra vers vous. Délai de réponse garanti : sous 24h.",
    backgroundImage: "https://images.unsplash.com/photo-1452408143346-2f5e2f0e1e1e?q=80&w=1920&auto=format&fit=crop",
    ctaLabel: "Envoyer ma demande",
    ctaHref: "#form",
    cta2Label: "",
    cta2Href: "",
    data: {},
  },

  communaute: {
    page: "communaute",
    kicker: "Espaces d'échange",
    title: "Communauté",
    titleAccent: "",
    titleSuffix: "",
    subtitle:
      "Des espaces d'échange organisés par thème, modérés avec attention, pour grandir ensemble dans la foi. Canaux ouverts, canaux restreints chiffrés, intercession — à chacun son rythme.",
    backgroundImage: "https://images.unsplash.com/photo-1511632765486-a0a80de485a5?q=80&w=1920&auto=format&fit=crop",
    ctaLabel: "Ouvrir Yeshua Connect",
    ctaHref: "/yeshua-connect",
    cta2Label: "",
    cta2Href: "",
    data: {},
  },

  appels: {
    page: "appels",
    kicker: "Appels audio & vidéo",
    title: "Appeler Pam ou le Pasteur Kongo",
    titleAccent: "",
    titleSuffix: "",
    subtitle:
      "Appels audio et vidéo chiffrés de bout en bout, style Telegram et WhatsApp. En cas d'indisponibilité, le contact recevra une notification d'appel manqué.",
    backgroundImage: "https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=1920&auto=format&fit=crop",
    ctaLabel: "Démarrer un appel",
    ctaHref: "#start",
    cta2Label: "",
    cta2Href: "",
    data: {},
  },

  soustitrage: {
    page: "soustitrage",
    kicker: "Sous-titrage IA multilingue",
    title: "Sous-titres automatiques",
    titleAccent: "",
    titleSuffix: "",
    subtitle:
      "Génération de sous-titres multilingues via Whisper (OpenAI). Pour que la Parole atteigne les dispersés d'Israël partout où ils se trouvent, dans leur langue.",
    backgroundImage: "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?q=80&w=1920&auto=format&fit=crop",
    ctaLabel: "Générer des sous-titres",
    ctaHref: "#generateur",
    cta2Label: "",
    cta2Href: "",
    data: {},
  },
};

// ============================================================
// SCHÉMA DE CHAMPS — FORMULAIRES DU BACK-OFFICE (/admin/heroes)
// ============================================================

export type HeroFieldType = "text" | "textarea" | "markdown" | "image";

export interface HeroFieldDef {
  /** "kicker" | "title" | … (colonne) ou "data.<clé>" (JSON). */
  key: string;
  label: string;
  type: HeroFieldType;
  help?: string;
  placeholder?: string;
  rows?: number;
}

/** Champs communs à toutes les pages (hero standard). */
const COMMON_HERO_FIELDS: HeroFieldDef[] = [
  {
    key: "backgroundImage",
    label: "Image d'arrière-plan du hero",
    type: "image",
    help: "Grande photo derrière le titre (bannière du haut de page). Compressée automatiquement.",
  },
  { key: "kicker", label: "Accroche (petit texte doré)", type: "text", placeholder: "Ex. Récits rapportés" },
  { key: "title", label: "Titre principal", type: "text" },
  { key: "titleAccent", label: "Titre — partie dorée", type: "text", help: "Partie du titre affichée en doré (2e ligne ou mot accentué). Laisser vide si aucun." },
  { key: "titleSuffix", label: "Titre — texte après la partie dorée", type: "text", help: "Ex. « d'Israël » sur la page Dispersés. Laisser vide si aucun." },
  { key: "subtitle", label: "Sous-titre", type: "textarea", rows: 3 },
  { key: "ctaLabel", label: "Bouton principal — libellé", type: "text", help: "Laisser vide pour masquer le bouton." },
  { key: "ctaHref", label: "Bouton principal — lien", type: "text", placeholder: "Ex. /temoignages ou #ancre" },
  { key: "cta2Label", label: "Bouton secondaire — libellé", type: "text", help: "Laisser vide pour masquer le bouton." },
  { key: "cta2Href", label: "Bouton secondaire — lien", type: "text" },
];

const SERVANT_BIO_FIELDS: HeroFieldDef[] = [
  { key: "data.badge1", label: "Badge du hero — 1er", type: "text", help: "Petit libellé avec icône lieu, sous le sous-titre." },
  { key: "data.badge2", label: "Badge du hero — 2e", type: "text", help: "Petit libellé avec icône calendrier, sous le sous-titre." },
  { key: "data.bioKicker", label: "Biographie — accroche", type: "text", placeholder: "Biographie" },
  { key: "data.bioTitle", label: "Biographie — grand titre", type: "text" },
  { key: "data.bioQuote", label: "Biographie — citation d'ouverture", type: "textarea", rows: 3 },
  {
    key: "data.bioText",
    label: "Biographie — texte complet",
    type: "markdown",
    rows: 18,
    help: "Texte de la biographie — Markdown autorisé : **gras**, *italique*, ## titres de section. « Israël » s'affichera automatiquement « Isolélé (Israël) ».",
  },
  { key: "data.bioPhoto", label: "Biographie — photo (cadre doré)", type: "image", help: "Photo affichée à côté de la biographie (portrait vertical de préférence)." },
  { key: "data.bioPhotoBadge", label: "Badge sur la photo", type: "text" },
  { key: "data.bioPhotoFirstName", label: "Photo — ligne dorée (prénom/titre)", type: "text" },
  { key: "data.bioPhotoLastName", label: "Photo — nom", type: "text" },
  { key: "data.bioCardLocation", label: "Carte photo — ligne lieu", type: "text" },
  { key: "data.bioCardCalendar", label: "Carte photo — ligne calendrier", type: "text" },
];

export const HERO_FIELDS: Record<string, HeroFieldDef[]> = {
  landing: [
    ...COMMON_HERO_FIELDS,
    { key: "data.servantsKicker", label: "Section « Deux serviteurs » — accroche", type: "text" },
    { key: "data.servantsTitle", label: "Section « Deux serviteurs » — titre", type: "text" },
    { key: "data.pamPhoto", label: "Photo de Pam (carte serviteurs)", type: "image", help: "Photo circulaire de la carte Pam, sur la page d'accueil." },
    { key: "data.pamName", label: "Pam — nom", type: "text" },
    { key: "data.pamRole", label: "Pam — rôle", type: "text" },
    { key: "data.pamDesc", label: "Pam — description", type: "textarea", rows: 3 },
    { key: "data.kongoPhoto", label: "Photo du Pasteur Kongo (carte serviteurs)", type: "image", help: "Photo circulaire de la carte Pasteur Kongo, sur la page d'accueil." },
    { key: "data.kongoName", label: "Pasteur Kongo — nom", type: "text" },
    { key: "data.kongoRole", label: "Pasteur Kongo — rôle", type: "text" },
    { key: "data.kongoDesc", label: "Pasteur Kongo — description", type: "textarea", rows: 3 },
  ],
  pam: [...COMMON_HERO_FIELDS, ...SERVANT_BIO_FIELDS],
  "pasteur-kongo": [...COMMON_HERO_FIELDS, ...SERVANT_BIO_FIELDS],
  disperses: [
    ...COMMON_HERO_FIELDS,
    {
      key: "data.ctaHelp",
      label: "Texte d'aide sous le bouton",
      type: "textarea",
      rows: 2,
      help: "Affiché sous le bouton « Créer un compte » pour les visiteurs non connectés.",
    },
  ],
};

/** Champs par défaut pour les pages sans champs spécifiques. */
export function getHeroFields(page: string): HeroFieldDef[] {
  return HERO_FIELDS[page] ?? COMMON_HERO_FIELDS;
}
