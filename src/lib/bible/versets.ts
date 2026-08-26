/**
 * Base de versets bibliques — Christ Libère (V3)
 *
 * Contient les versets les plus cités dans le ministère de Pam et du Pasteur Kongo.
 * Traduction : Louis Segond 1910 (domaine public).
 *
 * En production, cette base serait étendue pour couvrir toute la Bible,
 * ou connectée à une API Bible (bible-api.com, BibleHub, etc.).
 * Pour la V3, on couvre les versets clés du ministère + les références
 * utilisées dans les biographies, témoignages, et enseignements.
 */

export interface VersetBiblique {
  reference: string; // "Genèse 5:24"
  livreId: string;
  chapitre: number;
  verset: number;
  texte: string; // Louis Segond 1910
  texteOstervald?: string; // variante
  texteDarby?: string; // variante
  contexte?: string; // versets environnants
}

export const VERSETS_DB: VersetBiblique[] = [
  // === GENÈSE ===
  {
    reference: "Genèse 1:5",
    livreId: "genese",
    chapitre: 1,
    verset: 5,
    texte: "Dieu appela la lumière jour, et il appela les ténèbres nuit. Ainsi, il y eut un soir, et il y eut un matin : ce fut le premier jour.",
    contexte: "Création de la lumière, le premier jour. Le jour biblique commence au soir.",
  },
  {
    reference: "Genèse 1:14",
    livreId: "genese",
    chapitre: 1,
    verset: 14,
    texte: "Dieu dit : Qu'il y ait des luminaires dans l'étendue du ciel, pour séparer le jour d'avec la nuit ; que ce soient des signes pour marquer les époques, les jours et les années.",
    contexte: "Création des luminaires (soleil, lune, étoiles) le quatrième jour — mercredi dans le calendrier biblique.",
  },
  {
    reference: "Genèse 5:24",
    livreId: "genese",
    chapitre: 5,
    verset: 24,
    texte: "Hénoch marcha avec Dieu ; et il ne fut plus, car Dieu le prit.",
    contexte: "Le patriarche Hénoch, figure centrale du ministère de Pam. Marche avec Dieu et enlèvement au ciel.",
  },
  {
    reference: "Genèse 12:3",
    livreId: "genese",
    chapitre: 12,
    verset: 3,
    texte: "Je bénirai ceux qui te béniront, et je maudirai ceux qui te maudiront ; et toutes les familles de la terre seront bénies en toi.",
    contexte: "Promesse faite à Abraham — alliance, bénédiction universelle.",
  },

  // === EXODE ===
  {
    reference: "Exode 12:2",
    livreId: "exode",
    chapitre: 12,
    verset: 2,
    texte: "Ce mois-ci sera pour vous le premier des mois ; il sera pour vous le premier des mois de l'année.",
    contexte: "Institution du calendrier biblique — le mois de l'Exode (Aviv/Nissan) est le premier.",
  },
  {
    reference: "Exode 20:8",
    livreId: "exode",
    chapitre: 20,
    verset: 8,
    texte: "Souviens-toi du jour du repos, pour le sanctifier.",
    contexte: "Quatrième commandement — le shabbat.",
  },

  // === LÉVITIQUE ===
  {
    reference: "Lévitique 23:5",
    livreId: "levitique",
    chapitre: 23,
    verset: 5,
    texte: "Le premier mois, le quatorzième jour du mois, entre les deux soirs, ce sera la Pâque de l'Éternel.",
    contexte: "Institution de Pessah (Pâque) — 14 Aviv.",
  },
  {
    reference: "Lévitique 23:32",
    livreId: "levitique",
    chapitre: 23,
    verset: 32,
    texte: "Ce sera pour vous un shabbat, un temps de repos, et vous humilierez vos âmes ; le neuvième jour du mois, depuis le soir jusqu'au soir, vous célébrerez votre shabbat.",
    contexte: "Le jour biblique va du soir au soir — fondement du calendrier.",
  },

  // === NOMBRES ===
  {
    reference: "Nombres 6:24",
    livreId: "nombres",
    chapitre: 6,
    verset: 24,
    texte: "L'Éternel te bénisse, et qu'il te garde !",
    contexte: "Béniction sacerdotale d'Aaron.",
  },

  // === DEUTÉRONOME ===
  {
    reference: "Deutéronome 6:4",
    livreId: "deuteronome",
    chapitre: 6,
    verset: 4,
    texte: "Écoute, Israël ! L'Éternel, notre Dieu, est le seul Éternel.",
    contexte: "Shema Israël — confession de foi centrale d'Israël.",
  },

  // === 1 SAMUEL ===
  {
    reference: "1 Samuel 3:10",
    livreId: "1_samuel",
    chapitre: 3,
    verset: 10,
    texte: "L'Éternel vint et se présenta, et il appela comme les autres fois : Samuel, Samuel ! Et Samuel répondit : Parle, car ton serviteur écoute.",
    contexte: "L'appel de Samuel — figure du premier appel prophétique.",
  },

  // === 2 SAMUEL ===
  {
    reference: "2 Samuel 7:16",
    livreId: "2_samuel",
    chapitre: 7,
    verset: 16,
    texte: "Ta maison et ton règne subsisteront éternellement devant moi, ton trône sera affermi pour toujours.",
    contexte: "Alliance davidique — promesse du Messie, fils de David.",
  },

  // === PSAUMES ===
  {
    reference: "Psaume 22:10",
    livreId: "psaumes",
    chapitre: 22,
    verset: 10,
    texte: "C'est toi qui m'as tiré du sein de ma mère, qui m'as mis en confiance sur les mamelles de ma mère.",
    contexte: "Psaume messianique — prédiction de la crucifixion.",
  },
  {
    reference: "Psaume 119:9",
    livreId: "psaumes",
    chapitre: 119,
    verset: 9,
    texte: "Comment le jeune homme rendra-t-il pur son sentier ? En se dirigeant d'après ta parole.",
    contexte: "La Parole de Dieu comme guide pour la jeunesse.",
  },
  {
    reference: "Psaume 133:1",
    livreId: "psaumes",
    chapitre: 133,
    verset: 1,
    texte: "Voici, oh ! qu'il est agréable, qu'il est doux pour des frères de demeurer ensemble.",
    contexte: "La communion fraternelle — bénédiction de l'unité.",
  },
  {
    reference: "Psaume 139:15",
    livreId: "psaumes",
    chapitre: 139,
    verset: 15,
    texte: "Mon corps n'était point caché devant toi, lorsque j'ai été fait dans un lieu secret, tissé dans les profondeurs de la terre.",
    contexte: "La création de l'homme dans le secret — prédestination.",
  },

  // === PROVERBES ===
  {
    reference: "Proverbes 3:5",
    livreId: "proverbes",
    chapitre: 3,
    verset: 5,
    texte: "Confie-toi en l'Éternel de tout ton cœur, et ne t'appuie pas sur ta sagesse.",
  },

  // === ECCLÉSIASTE ===
  {
    reference: "Ecclésiaste 4:12",
    livreId: "ecclesiaste",
    chapitre: 4,
    verset: 12,
    texte: "Si quelqu'un tombe, son compagnon le relève ; mais malheur à celui qui est seul et qui tombe, sans avoir un second pour le relever.",
    contexte: "L'importance de la compagnie — alliance dans le mariage.",
  },

  // === ÉSAÏE ===
  {
    reference: "Ésaïe 9:6",
    livreId: "esaie",
    chapitre: 9,
    verset: 6,
    texte: "Car un enfant nous est né, un fils nous est donné, et la domination reposera sur son épaule ; on l'appellera Admirable, Conseiller, Dieu puissant, Père éternel, Prince de la paix.",
    contexte: "Prophétie messianique — le gouvernement de Yeshoua.",
  },
  {
    reference: "Ésaïe 11:12",
    livreId: "esaie",
    chapitre: 11,
    verset: 12,
    texte: "Il élèvera une bannière pour les nations, il rassemblera les exilés d'Israël, et il recueillera les dispersés de Juda des quatre extrémités de la terre.",
    contexte: "Le rassemblement des dispersés d'Israël — mission centrale du ministère de Pam.",
  },
  {
    reference: "Ésaïe 40:3",
    livreId: "esaie",
    chapitre: 40,
    verset: 3,
    texte: "Une voix crie : Préparez au désert le chemin de l'Éternel, aplanissez dans les lieux arides une route pour notre Dieu.",
    contexte: "Jean-Baptiste — préparation du chemin du Messie.",
  },
  {
    reference: "Ésaïe 45:3",
    livreId: "esaie",
    chapitre: 45,
    verset: 3,
    texte: "Je te donnerai des trésors cachés, des richesses enfouies, afin que tu saches que je suis l'Éternel, qui t'appelle par ton nom, le Dieu d'Israël.",
    contexte: "Dieu qui prépare son serviteur dans le secret.",
  },
  {
    reference: "Ésaïe 53:5",
    livreId: "esaie",
    chapitre: 53,
    verset: 5,
    texte: "Mais il était blessé pour nos péchés, brisé pour nos iniquités ; le châtiment qui nous donne la paix est tombé sur lui, et c'est par ses meurtrissures que nous sommes guéris.",
    contexte: "Le Serviteur souffrant — accomplissement en Yeshoua.",
  },

  // === JÉRÉMIE ===
  {
    reference: "Jérémie 31:10",
    livreId: "jeremie",
    chapitre: 31,
    verset: 10,
    texte: "Nations, écoutez la parole de l'Éternel, et publiez-la dans les îles lointaines ! Dites : Celui qui a dispersé Israël le rassemblera, et il le gardera comme le berger garde son troupeau.",
    contexte: "Le rassemblement d'Israël — prophétie eschatologique.",
  },

  // === ÉZÉCHIEL ===
  {
    reference: "Ézéchiel 1:1",
    livreId: "ezechiel",
    chapitre: 1,
    verset: 1,
    texte: "La trentième année, au cinquième mois, le cinquième jour du mois, comme j'étais parmi les captifs du fleuve de Kebar, les cieux s'ouvrirent, et j'eus des visions divines.",
    contexte: "Le ciel ouvert — vision prophétique d'Ézéchiel.",
  },
  {
    reference: "Ézéchiel 37:21",
    livreId: "ezechiel",
    chapitre: 37,
    verset: 21,
    texte: "Et dis-leur : Ainsi parle le Seigneur, l'Éternel : Voici, je prendrai les enfants d'Israël du milieu des nations où ils sont allés, je les rassemblerai de toutes parts, et je les ramènerai dans leur pays.",
    contexte: "Le rassemblement d'Israël — vision des ossements secs.",
  },

  // === DANIEL ===
  {
    reference: "Daniel 7:13",
    livreId: "daniel",
    chapitre: 7,
    verset: 13,
    texte: "Je regardai pendant mes visions nocturnes ; et voici, sur les nuées des cieux arriva quelqu'un de semblable à un fils de l'homme ; il s'avança vers l'ancien des jours, et on le fit approcher de lui.",
    contexte: "Le Fils de l'homme — vision messianique.",
  },

  // === AMOS ===
  {
    reference: "Amos 3:3",
    livreId: "amos",
    chapitre: 3,
    verset: 3,
    texte: "Deux hommes marchent-ils ensemble, sans en être convenus ?",
    contexte: "L'accord dans l'alliance — mariage, partenariat spirituel.",
  },

  // === ZACHARIE ===
  {
    reference: "Zacharie 14:16",
    livreId: "zacharie",
    chapitre: 14,
    verset: 16,
    texte: "Tous ceux qui resteront de toutes les nations venues contre Jérusalem monteront chaque année pour se prosterner devant le roi, l'Éternel des armées, et pour célébrer la fête des tabernacles.",
    contexte: "Souccot eschatologique — rassemblement des nations.",
  },

  // === MATTHIEU ===
  {
    reference: "Matthieu 24:30",
    livreId: "matthieu",
    chapitre: 24,
    verset: 30,
    texte: "Alors le signe du Fils de l'homme paraîtra dans le ciel, alors toutes les tribus de la terre se lamenteront, et elles verront le Fils de l'homme venant sur les nuées du ciel avec puissance et une grande gloire.",
    contexte: "Le retour glorieux de Yeshoua — signes des temps.",
  },

  // === JEAN ===
  {
    reference: "Jean 1:14",
    livreId: "jean",
    chapitre: 1,
    verset: 14,
    texte: "Et la parole a été faite chair, et elle a habité parmi nous, pleine de grâce et de vérité ; et nous avons contemplé sa gloire, une gloire comme la gloire du Fils unique venu du Père.",
    contexte: "L'incarnation — Dieu a tabernaclé parmi nous (Souccot).",
  },
  {
    reference: "Jean 1:29",
    livreId: "jean",
    chapitre: 1,
    verset: 29,
    texte: "Le lendemain, il vit Jésus venant à lui, et il dit : Voici l'Agneau de Dieu, qui ôte le péché du monde.",
    contexte: "Yeshoua, l'Agneau pascal — accomplissement de Pessah.",
  },
  {
    reference: "Jean 10:22",
    livreId: "jean",
    chapitre: 10,
    verset: 22,
    texte: "Célébrait à Jérusalem la fête de la Dédicace. C'était en hiver.",
    contexte: "Yeshoua célébrait Hanoucca (Dédicace).",
  },
  {
    reference: "Jean 14:27",
    livreId: "jean",
    chapitre: 14,
    verset: 27,
    texte: "Je vous laisse la paix, je vous donne ma paix. Je ne vous donne pas comme le monde donne. Que votre cœur ne se trouble point, et ne s'alarme point.",
    contexte: "La paix de Christ — paix qui dépasse toute intelligence.",
  },

  // === ACTES ===
  {
    reference: "Actes 2:1",
    livreId: "actes",
    chapitre: 2,
    verset: 1,
    texte: "Le jour de la Pentecôte, ils étaient tous ensemble dans le même lieu.",
    contexte: "L'effusion du Saint-Esprit à Shavouot — accomplissement de la fête.",
  },

  // === ROMAINS ===
  {
    reference: "Romains 8:28",
    livreId: "romains",
    chapitre: 8,
    verset: 28,
    texte: "Nous savons, du reste, que toutes choses concourent au bien de ceux qui aiment Dieu, de ceux qui sont appelés selon son dessein.",
  },

  // === 1 CORINTHIENS ===
  {
    reference: "1 Corinthiens 5:7",
    livreId: "1_corinthiens",
    chapitre: 5,
    verset: 7,
    texte: "Faites disparaître le vieux levain, afin que vous soyez une pâte nouvelle, puisque vous êtes sans levain, car Christ, notre Pâque, a été immolé.",
    contexte: "Yeshoua accomplissement de Pessah — la sanctification (Matsot).",
  },
  {
    reference: "1 Corinthiens 9:16",
    livreId: "1_corinthiens",
    chapitre: 9,
    verset: 16,
    texte: "Car si j'annonce l'Évangile, ce n'est pas pour moi un sujet de gloire, puisque la nécessité m'en est imposée, et malheur à moi si je n'annonce pas l'Évangile !",
    contexte: "L'urgence de l'annonce — vocation du Pasteur Kongo.",
  },
  {
    reference: "1 Corinthiens 15:20",
    livreId: "1_corinthiens",
    chapitre: 15,
    verset: 20,
    texte: "Mais maintenant, Christ est ressuscité des morts, il est les prémices de ceux qui sont morts.",
    contexte: "Yeshoua, prémices — accomplissement de Reshit Katzir.",
  },

  // === 2 CORINTHIENS ===
  {
    reference: "2 Corinthiens 2:11",
    livreId: "2_corinthiens",
    chapitre: 2,
    verset: 11,
    texte: "Afin que Satan n'eût pas l'avantage sur nous, car nous n'ignorons pas ses designs.",
    contexte: "Discernement des stratégies de l'ennemi.",
  },
  {
    reference: "2 Corinthiens 12:2",
    livreId: "2_corinthiens",
    chapitre: 12,
    verset: 2,
    texte: "Je connais un homme en Christ, qui fut, il y a quatorze ans, ravi jusqu'au troisième ciel (si ce fut dans son corps je ne sais, si ce fut hors de son corps je ne sais, Dieu le sait).",
    contexte: "L'apôtre Paul transporté au troisième ciel — comme Pam.",
  },

  // === GALATES ===
  {
    reference: "Galates 6:2",
    livreId: "galates",
    chapitre: 6,
    verset: 2,
    texte: "Portez les fardeaux les uns des autres, et vous accomplirez ainsi la loi de Christ.",
    contexte: "La loi de Christ — porter les fardeaux mutuellement.",
  },

  // === ÉPHÉSIENS ===
  {
    reference: "Éphésiens 4:11",
    livreId: "ephesiens",
    chapitre: 4,
    verset: 11,
    texte: "Et il a donné les uns comme apôtres, les autres comme prophètes, les autres comme évangélistes, les autres comme pasteurs et docteurs.",
    contexte: "Les dons de ministère — pastorat et prophétie en harmonie.",
  },
  {
    reference: "Éphésiens 6:12",
    livreId: "ephesiens",
    chapitre: 6,
    verset: 12,
    texte: "Car nous n'avons pas à lutter contre la chair et le sang, mais contre les dominations, contre les autorités, contre les princes de ce monde de ténèbres, contre les esprits méchants dans les lieux célestes.",
    contexte: "La guerre spirituelle — combat contre les puissances.",
  },

  // === PHILIPPIENS ===
  {
    reference: "Philippiens 4:7",
    livreId: "philippiens",
    chapitre: 4,
    verset: 7,
    texte: "Et la paix de Dieu, qui surpasse toute intelligence, gardera vos cœurs et vos pensées en Jésus-Christ.",
    contexte: "La paix qui surpasse l'intelligence.",
  },

  // === COLOSSIENS ===
  {
    reference: "Colossiens 2:16",
    livreId: "colossiens",
    chapitre: 2,
    verset: 16,
    texte: "Que personne donc ne vous juge au sujet du manger ou du boire, ou au sujet d'une fête, d'une nouvelle lune, ou des shabbats.",
    contexte: "Les fêtes bibliques comme ombre des choses à venir.",
  },

  // === 1 THESSALONICIENS ===
  {
    reference: "1 Thessaloniciens 4:16",
    livreId: "1_thessaloniciens",
    chapitre: 4,
    verset: 16,
    texte: "Car le Seigneur lui-même, à un signal donné, à la voix d'un archange, et au son de la trompette de Dieu, descendra du ciel, et les morts en Christ ressusciteront premièrement.",
    contexte: "Le retour de Yeshoua au son du chofar — accomplissement de Yom Teroua.",
  },

  // === 2 TIMOTHÉE ===
  {
    reference: "2 Timothée 3:16",
    livreId: "2_timothee",
    chapitre: 3,
    verset: 16,
    texte: "Toute Écriture est inspirée de Dieu, et utile pour enseigner, pour convaincre, pour corriger, pour instruire dans la justice.",
    contexte: "L'autorité de l'Écriture — fondement doctrinal.",
  },
  {
    reference: "2 Timothée 4:2",
    livreId: "2_timothee",
    chapitre: 4,
    verset: 2,
    texte: "Prêche la parole, insiste en temps et hors de temps, reprends, censure, exhorte, avec toute douceur et en instruisant.",
    contexte: "La prédication — vocation pastorale.",
  },

  // === HÉBREUX ===
  {
    reference: "Hébreux 9:12",
    livreId: "hebreux",
    chapitre: 9,
    verset: 12,
    texte: "Et il est entré une fois pour toutes dans le sanctuaire, non avec le sang des boucs et des veaux, mais avec son propre sang, ayant obtenu une rédemption éternelle.",
    contexte: "Yeshoua, grand sacrificateur — accomplissement de Yom Kippour.",
  },
  {
    reference: "Hébreux 11:5",
    livreId: "hebreux",
    chapitre: 11,
    verset: 5,
    texte: "C'est par la foi qu'Hénoch fut enlevé pour qu'il ne vît point la mort, et qu'il ne parut plus, parce que Dieu l'avait enlevé ; car, avant son enlèvement, il avait reçu le témoignage qu'il était agréable à Dieu.",
    contexte: "Hénoch, figure de foi — enlèvement prophétique.",
  },
  {
    reference: "Hébreux 13:2",
    livreId: "hebreux",
    chapitre: 13,
    verset: 2,
    texte: "N'oubliez pas l'hospitalité ; car, en l'exerçant, quelques-uns ont logé des anges sans le savoir.",
    contexte: "Hospitalité — possibility de visites angéliques.",
  },

  // === 1 PIERRE ===
  {
    reference: "1 Pierre 5:2",
    livreId: "1_pierre",
    chapitre: 5,
    verset: 2,
    texte: "Paissez le troupeau de Dieu qui est sous votre garde, non par contrainte, mais volontairement, selon Dieu ; non pour un gain sordide, mais avec dévouement.",
    contexte: "La vocation pastorale — service et non domination.",
  },

  // === 1 JEAN ===
  {
    reference: "1 Jean 4:1",
    livreId: "1_jean",
    chapitre: 4,
    verset: 1,
    texte: "Bien-aimés, n'ajoutez pas foi à tout esprit ; mais éprouvez les esprits, pour savoir s'ils sont de Dieu, car plusieurs faux prophètes sont venus dans le monde.",
    contexte: "Le discernement spirituel — éprouver les esprits.",
  },

  // === APOCALYPSE ===
  {
    reference: "Apocalypse 3:11",
    livreId: "apocalypse",
    chapitre: 3,
    verset: 11,
    texte: "Voici, je viens bientôt. Retiens ce que tu as, afin que personne ne prenne ta couronne.",
    contexte: "Le retour imminent — appel à la fidélité.",
  },
  {
    reference: "Apocalypse 21:3",
    livreId: "apocalypse",
    chapitre: 21,
    verset: 3,
    texte: "Et j'entendis du trône une forte voix qui disait : Voici le tabernacle de Dieu avec les hommes ! Il habitera avec eux, et ils seront son peuple, et Dieu lui-même sera avec eux.",
    contexte: "Souccot eschatologique — Dieu tabernacle parmi les hommes.",
  },

  // === JUDE ===
  {
    reference: "Jude 14",
    livreId: "jude",
    chapitre: 1,
    verset: 14,
    texte: "C'est aussi pour eux qu'Hénoch, le septième depuis Adam, a prophétisé en ces termes : Voici, le Seigneur est venu avec ses saintes myriades.",
    contexte: "Hénoch prophète — citation du Livre d'Hénoch.",
  },
];

// Map : référence normalisée → verset
const MAP_VERSETS: Map<string, VersetBiblique> = new Map();
for (const verset of VERSETS_DB) {
  MAP_VERSETS.set(verset.reference.toLowerCase(), verset);
  // Aussi avec l'ID du livre
  const altRef = `${verset.livreId} ${verset.chapitre}:${verset.verset}`.toLowerCase();
  MAP_VERSETS.set(altRef, verset);
}

/**
 * Cherche un verset par référence.
 */
export function trouverVerset(reference: string): VersetBiblique | null {
  const normalized = reference.toLowerCase().trim();
  return MAP_VERSETS.get(normalized) || null;
}

/**
 * Cherche des versets par mot-clé (dans le texte).
 */
export function chercherVersetsParTexte(recherche: string, limite = 20): VersetBiblique[] {
  const q = recherche.toLowerCase().trim();
  if (!q) return [];

  return VERSETS_DB.filter(
    (v) =>
      v.texte.toLowerCase().includes(q) ||
      v.contexte?.toLowerCase().includes(q) ||
      v.reference.toLowerCase().includes(q)
  ).slice(0, limite);
}

/**
 * Retourne les versets par livre.
 */
export function versetsParLivre(livreId: string): VersetBiblique[] {
  return VERSETS_DB.filter((v) => v.livreId === livreId);
}

/**
 * Retourne tous les versets de la base.
 */
export function tousLesVersets(): VersetBiblique[] {
  return VERSETS_DB;
}
