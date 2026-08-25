/**
 * Versets de fallback — utilisés quand les fichiers de données bibliques
 * ne sont pas accessibles (ex: sur Vercel serverless où les 46MB ne sont pas bundlés).
 *
 * Contient les versets les plus cités dans le ministère de Pam et du Pasteur Kongo.
 */

export interface FallbackVerset {
  reference: string;
  livre: string;
  livreId: string;
  chapitre: number;
  verset: number;
  texte: string;
}

export const FALLBACK_VERSETS: FallbackVerset[] = [
  { reference: "Genèse 1:1", livre: "Genèse", livreId: "gn", chapitre: 1, verset: 1, texte: "Au commencement, Dieu créa les cieux et la terre." },
  { reference: "Genèse 1:3", livre: "Genèse", livreId: "gn", chapitre: 1, verset: 3, texte: "Dieu dit : Que la lumière soit ! Et la lumière fut." },
  { reference: "Genèse 1:5", livre: "Genèse", livreId: "gn", chapitre: 1, verset: 5, texte: "Dieu appela la lumière jour, et il appela les ténèbres nuit. Ainsi, il y eut un soir, et il y eut un matin : ce fut le premier jour." },
  { reference: "Genèse 5:24", livre: "Genèse", livreId: "gn", chapitre: 5, verset: 24, texte: "Hénoch marcha avec Dieu ; et il ne fut plus, car Dieu le prit." },
  { reference: "Genèse 12:3", livre: "Genèse", livreId: "gn", chapitre: 12, verset: 3, texte: "Je bénirai ceux qui te béniront, et je maudirai ceux qui te maudiront ; et toutes les familles de la terre seront bénies en toi." },
  { reference: "Exode 12:2", livre: "Exode", livreId: "ex", chapitre: 12, verset: 2, texte: "Ce mois-ci sera pour vous le premier des mois ; il sera pour vous le premier des mois de l'année." },
  { reference: "Exode 20:8", livre: "Exode", livreId: "ex", chapitre: 20, verset: 8, texte: "Souviens-toi du jour du repos, pour le sanctifier." },
  { reference: "Lévitique 23:5", livre: "Lévitique", livreId: "lv", chapitre: 23, verset: 5, texte: "Le premier mois, le quatorzième jour du mois, entre les deux soirs, ce sera la Pâque de l'Éternel." },
  { reference: "Deutéronome 6:4", livre: "Deutéronome", livreId: "dt", chapitre: 6, verset: 4, texte: "Écoute, Israël ! L'Éternel, notre Dieu, est le seul Éternel." },
  { reference: "1 Samuel 3:10", livre: "1 Samuel", livreId: "1sm", chapitre: 3, verset: 10, texte: "L'Éternel vint et se présenta, et il appela comme les autres fois : Samuel, Samuel ! Et Samuel répondit : Parle, car ton serviteur écoute." },
  { reference: "Psaume 22:10", livre: "Psaumes", livreId: "ps", chapitre: 22, verset: 10, texte: "C'est toi qui m'as tiré du sein de ma mère, qui m'as mis en confiance sur les mamelles de ma mère." },
  { reference: "Psaume 119:9", livre: "Psaumes", livreId: "ps", chapitre: 119, verset: 9, texte: "Comment le jeune homme rendra-t-il pur son sentier ? En se dirigeant d'après ta parole." },
  { reference: "Psaume 119:105", livre: "Psaumes", livreId: "ps", chapitre: 119, verset: 105, texte: "Ta parole est une lampe à mes pieds, et une lumière sur mon sentier." },
  { reference: "Psaume 133:1", livre: "Psaumes", livreId: "ps", chapitre: 133, verset: 1, texte: "Voici, oh ! qu'il est agréable, qu'il est doux pour des frères de demeurer ensemble." },
  { reference: "Psaume 139:15", livre: "Psaumes", livreId: "ps", chapitre: 139, verset: 15, texte: "Mon corps n'était point caché devant toi, lorsque j'ai été fait dans un lieu secret, tissé dans les profondeurs de la terre." },
  { reference: "Proverbes 3:5", livre: "Proverbes", livreId: "pv", chapitre: 3, verset: 5, texte: "Confie-toi en l'Éternel de tout ton cœur, et ne t'appuie pas sur ta sagesse." },
  { reference: "Ésaïe 9:6", livre: "Ésaïe", livreId: "es", chapitre: 9, verset: 6, texte: "Car un enfant nous est né, un fils nous est donné, et la domination reposera sur son épaule ; on l'appellera Admirable, Conseiller, Dieu puissant, Père éternel, Prince de la paix." },
  { reference: "Ésaïe 11:12", livre: "Ésaïe", livreId: "es", chapitre: 11, verset: 12, texte: "Il élèvera une bannière pour les nations, il rassemblera les exilés d'Israël, et il recueillera les dispersés de Juda des quatre extrémités de la terre." },
  { reference: "Ésaïe 40:3", livre: "Ésaïe", livreId: "es", chapitre: 40, verset: 3, texte: "Une voix crie : Préparez au désert le chemin de l'Éternel, aplanissez dans les lieux arides une route pour notre Dieu." },
  { reference: "Ésaïe 53:5", livre: "Ésaïe", livreId: "es", chapitre: 53, verset: 5, texte: "Mais il était blessé pour nos péchés, brisé pour nos iniquités ; le châtiment qui nous donne la paix est tombé sur lui, et c'est par ses meurtrissures que nous sommes guéris." },
  { reference: "Ézéchiel 1:1", livre: "Ézéchiel", livreId: "ez", chapitre: 1, verset: 1, texte: "Les cieux s'ouvrirent, et j'eus des visions divines." },
  { reference: "Ézéchiel 37:21", livre: "Ézéchiel", livreId: "ez", chapitre: 37, verset: 21, texte: "Voici, je prendrai les enfants d'Israël du milieu des nations où ils sont allés, je les rassemblerai de toutes parts, et je les ramènerai dans leur pays." },
  { reference: "Daniel 7:13", livre: "Daniel", livreId: "dn", chapitre: 7, verset: 13, texte: "Je regardai pendant mes visions nocturnes ; et voici, sur les nuées des cieux arriva quelqu'un de semblable à un fils de l'homme." },
  { reference: "Amos 3:3", livre: "Amos", livreId: "am", chapitre: 3, verset: 3, texte: "Deux hommes marchent-ils ensemble, sans en être convenus ?" },
  { reference: "Matthieu 24:14", livre: "Matthieu", livreId: "mt", chapitre: 24, verset: 14, texte: "Cette bonne nouvelle du royaume sera prêchée dans le monde entier, pour servir de témoignage à toutes les nations." },
  { reference: "Matthieu 24:30", livre: "Matthieu", livreId: "mt", chapitre: 24, verset: 30, texte: "Alors le signe du Fils de l'homme paraîtra dans le ciel, alors toutes les tribus de la terre se lamenteront, et elles verront le Fils de l'homme venant sur les nuées du ciel avec puissance et une grande gloire." },
  { reference: "Matthieu 24:35", livre: "Matthieu", livreId: "mt", chapitre: 24, verset: 35, texte: "Le ciel et la terre passeront, mais mes paroles ne passeront point." },
  { reference: "Jean 1:14", livre: "Jean", livreId: "jo", chapitre: 1, verset: 14, texte: "Et la parole a été faite chair, et elle a habité parmi nous, pleine de grâce et de vérité." },
  { reference: "Jean 1:29", livre: "Jean", livreId: "jo", chapitre: 1, verset: 29, texte: "Voici l'Agneau de Dieu, qui ôte le péché du monde." },
  { reference: "Jean 14:27", livre: "Jean", livreId: "jo", chapitre: 14, verset: 27, texte: "Je vous laisse la paix, je vous donne ma paix. Je ne vous donne pas comme le monde donne. Que votre cœur ne se trouble point, et ne s'alarme point." },
  { reference: "Actes 2:1", livre: "Actes", livreId: "ac", chapitre: 2, verset: 1, texte: "Le jour de la Pentecôte, ils étaient tous ensemble dans le même lieu." },
  { reference: "Romains 8:28", livre: "Romains", livreId: "rm", chapitre: 8, verset: 28, texte: "Nous savons, du reste, que toutes choses concourent au bien de ceux qui aiment Dieu, de ceux qui sont appelés selon son dessein." },
  { reference: "1 Corinthiens 5:7", livre: "1 Corinthiens", livreId: "1co", chapitre: 5, verset: 7, texte: "Faites disparaître le vieux levain, afin que vous soyez une pâte nouvelle, puisque vous êtes sans levain, car Christ, notre Pâque, a été immolé." },
  { reference: "1 Corinthiens 15:20", livre: "1 Corinthiens", livreId: "1co", chapitre: 15, verset: 20, texte: "Mais maintenant, Christ est ressuscité des morts, il est les prémices de ceux qui sont morts." },
  { reference: "2 Corinthiens 12:2", livre: "2 Corinthiens", livreId: "2co", chapitre: 12, verset: 2, texte: "Je connais un homme en Christ, qui fut, il y a quatorze ans, ravi jusqu'au troisième ciel." },
  { reference: "Galates 6:2", livre: "Galates", livreId: "ga", chapitre: 6, verset: 2, texte: "Portez les fardeaux les uns des autres, et vous accomplirez ainsi la loi de Christ." },
  { reference: "Éphésiens 6:12", livre: "Éphésiens", livreId: "ep", chapitre: 6, verset: 12, texte: "Car nous n'avons pas à lutter contre la chair et le sang, mais contre les dominations, contre les autorités, contre les princes de ce monde de ténèbres." },
  { reference: "Philippiens 4:7", livre: "Philippiens", livreId: "ph", chapitre: 4, verset: 7, texte: "Et la paix de Dieu, qui surpasse toute intelligence, gardera vos cœurs et vos pensées en Jésus-Christ." },
  { reference: "Colossiens 2:16", livre: "Colossiens", livreId: "cl", chapitre: 2, verset: 16, texte: "Que personne donc ne vous juge au sujet du manger ou du boire, ou au sujet d'une fête, d'une nouvelle lune, ou des shabbats." },
  { reference: "1 Thessaloniciens 4:16", livre: "1 Thessaloniciens", livreId: "1th", chapitre: 4, verset: 16, texte: "Car le Seigneur lui-même, à un signal donné, à la voix d'un archange, et au son de la trompette de Dieu, descendra du ciel." },
  { reference: "2 Timothée 3:16", livre: "2 Timothée", livreId: "2tm", chapitre: 3, verset: 16, texte: "Toute Écriture est inspirée de Dieu, et utile pour enseigner, pour convaincre, pour corriger, pour instruire dans la justice." },
  { reference: "Hébreux 11:5", livre: "Hébreux", livreId: "he", chapitre: 11, verset: 5, texte: "C'est par la foi qu'Hénoch fut enlevé pour qu'il ne vît point la mort, et qu'il ne parut plus, parce que Dieu l'avait enlevé." },
  { reference: "Apocalypse 3:11", livre: "Apocalypse", livreId: "ap", chapitre: 3, verset: 11, texte: "Voici, je viens bientôt. Retiens ce que tu as, afin que personne ne prenne ta couronne." },
  { reference: "Apocalypse 21:3", livre: "Apocalypse", livreId: "ap", chapitre: 21, verset: 3, texte: "Voici le tabernacle de Dieu avec les hommes ! Il habitera avec eux, et ils seront son peuple." },
];

export function chercherFallbackVerset(reference: string): FallbackVerset | null {
  const found = FALLBACK_VERSETS.find(
    (v) => v.reference.toLowerCase() === reference.toLowerCase().trim()
  );
  return found || null;
}

export function chercherFallbackParTexte(query: string): FallbackVerset[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return FALLBACK_VERSETS.filter(
    (v) =>
      v.texte.toLowerCase().includes(q) ||
      v.reference.toLowerCase().includes(q) ||
      v.livre.toLowerCase().includes(q)
  );
}
