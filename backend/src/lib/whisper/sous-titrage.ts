/**
 * Sous-titrage IA multilingue — Mouvement Christ Libère (V3)
 *
 * Utilise Whisper (OpenAI) pour générer des sous-titres à partir de fichiers audio/vidéo.
 *
 * Modes :
 * 1. Mode démo (sans clé API) — simulation, génère des sous-titres fictifs
 * 2. Mode production (avec OPENAI_API_KEY) — appel réel à l'API Whisper
 *
 * Langues cibles prioritaires :
 * FR, EN, ES, PT, HE (hébreu), AM (amharique), Lingala
 */

export interface SousTitre {
  debut: number; // secondes
  fin: number; // secondes
  texte: string;
}

export interface ResultatSousTitrage {
  langueSource: string;
  sousTitres: SousTitre[];
  traductions: Record<string, SousTitre[]>; // par langue cible
  dureeTotal: number; // secondes
  mode: "demo" | "production";
}

export const LANGUES_SOUS_TITRAGE = [
  { code: "fr", nom: "Français", drapeau: "🇫🇷" },
  { code: "en", nom: "English", drapeau: "🇬🇧" },
  { code: "es", nom: "Español", drapeau: "🇪🇸" },
  { code: "pt", nom: "Português", drapeau: "🇵🇹" },
  { code: "he", nom: "עברית", drapeau: "🇮🇱" },
  { code: "am", nom: "አማርኛ", drapeau: "🇪🇹" },
  { code: "ln", nom: "Lingála", drapeau: "🇨🇩" },
  { code: "ar", nom: "العربية", drapeau: "🇸🇦" },
];

/**
 * Vérifie si Whisper est configuré.
 */
export function isWhisperConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Génère des sous-titres à partir d'un fichier audio/vidéo.
 * En mode démo, génère des sous-titres simulés.
 */
export async function genererSousTitres(
  _fichierUrl: string,
  langueSource: string = "fr"
): Promise<ResultatSousTitrage> {
  if (!isWhisperConfigured()) {
    return genererSousTitresDemo(langueSource);
  }

  // Mode production : appel à l'API Whisper
  try {
    return await appelerWhisperAPI(_fichierUrl, langueSource);
  } catch (error) {
    console.error("[whisper] Erreur, fallback démo:", error);
    return genererSousTitresDemo(langueSource);
  }
}

/**
 * Mode démo : génère des sous-titres simulés.
 */
function genererSousTitresDemo(langueSource: string): ResultatSousTitrage {
  const sousTitres: SousTitre[] = [
    { debut: 0, fin: 5, texte: "Shalom à tous, au nom du Seigneur Yeshoua." },
    { debut: 5, fin: 12, texte: "Je voudrais partager avec vous ce que le Seigneur m'a montré." },
    { debut: 12, fin: 20, texte: "Dans Genèse 5:24, il est écrit qu'Hénoch marcha avec Dieu." },
    { debut: 20, fin: 28, texte: "Et il ne fut plus, car Dieu le prit." },
    { debut: 28, fin: 35, texte: "Ce témoignage est vivant aujourd'hui encore." },
    { debut: 35, fin: 42, texte: "Le Seigneur visite son peuple, il parle, il instruit." },
    { debut: 42, fin: 50, texte: "Que chacun de nous prépare son cœur pour le retour du Maître." },
    { debut: 50, fin: 58, texte: "Le chofar va retentir, soyez prêts." },
    { debut: 58, fin: 65, texte: "Que la paix de Yeshoua soit avec vous tous. Amen." },
  ];

  // Traductions simulées
  const traductions: Record<string, SousTitre[]> = {};
  const traductionsMock: Record<string, (s: string) => string> = {
    en: (s) => s.replace("Shalom", "Shalom").replace("Seigneur Yeshoua", "Lord Yeshua"),
    es: (s) => s.replace("Seigneur", "Señor").replace("paix", "paz"),
    pt: (s) => s.replace("Seigneur", "Senhor").replace("paix", "paz"),
    he: (s) => `[עברית] ${s}`,
    am: (s) => `[አማርኛ] ${s}`,
    ln: (s) => `[Lingála] ${s}`,
    ar: (s) => `[العربية] ${s}`,
  };

  for (const [code, traduire] of Object.entries(traductionsMock)) {
    if (code !== langueSource) {
      traductions[code] = sousTitres.map((st) => ({
        ...st,
        texte: traduire(st.texte),
      }));
    }
  }

  return {
    langueSource,
    sousTitres,
    traductions,
    dureeTotal: 65,
    mode: "demo",
  };
}

/**
 * Appel réel à l'API Whisper (mode production).
 */
async function appelerWhisperAPI(
  fichierUrl: string,
  langueSource: string
): Promise<ResultatSousTitrage> {
  const openai = await import("openai");
  const client = new openai.default({ apiKey: process.env.OPENAI_API_KEY });

  // Télécharger le fichier audio
  const response = await fetch(fichierUrl);
  const audioBuffer = await response.arrayBuffer();
  const audioFile = new File([new Uint8Array(audioBuffer)], "audio.mp3", { type: "audio/mpeg" });

  // Transcription avec Whisper
  const transcription = await client.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
    language: langueSource,
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  });

  // Parser les segments en sous-titres
  const sousTitres: SousTitre[] = (transcription.segments || []).map((seg) => ({
    debut: seg.start,
    fin: seg.end,
    texte: seg.text.trim(),
  }));

  return {
    langueSource,
    sousTitres,
    traductions: {}, // Traductions via GPT-4 dans une étape suivante
    dureeTotal: sousTitres[sousTitres.length - 1]?.fin || 0,
    mode: "production",
  };
}

/**
 * Génère une traduction des sous-titres via GPT-4.
 */
export async function traduireSousTitres(
  sousTitres: SousTitre[],
  langueSource: string,
  langueCible: string
): Promise<SousTitre[]> {
  if (!isWhisperConfigured()) {
    // Mode démo
    return sousTitres.map((st) => ({
      ...st,
      texte: `[${langueCible.toUpperCase()}] ${st.texte}`,
    }));
  }

  try {
    const openai = await import("openai");
    const client = new openai.default({ apiKey: process.env.OPENAI_API_KEY });

    const textes = sousTitres.map((s) => s.texte);
    const prompt = `Traduis les sous-titres suivants de ${langueSource} vers ${langueCible}. 
    Conserve le sens spirituel et biblique. Réponds avec un JSON array de strings, un par sous-titre.
    
    Sous-titres : ${JSON.stringify(textes)}`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    const traductions: string[] = parsed.translations || parsed.textes || textes;

    return sousTitres.map((st, i) => ({
      ...st,
      texte: traductions[i] || st.texte,
    }));
  } catch (error) {
    console.error("[whisper] Erreur traduction:", error);
    return sousTitres;
  }
}

/**
 * Formate un timestamp en format SRT (00:00:00,000).
 */
export function formatTimestampSRT(secondes: number): string {
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  const s = Math.floor(secondes % 60);
  const ms = Math.floor((secondes % 1) * 1000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
}

/**
 * Génère un fichier SRT à partir de sous-titres.
 */
export function genererSRT(sousTitres: SousTitre[]): string {
  return sousTitres
    .map((st, i) => {
      return `${i + 1}\n${formatTimestampSRT(st.debut)} --> ${formatTimestampSRT(st.fin)}\n${st.texte}\n`;
    })
    .join("\n");
}

/**
 * Formate la durée en mm:ss.
 */
export function formaterDuree(secondes: number): string {
  const m = Math.floor(secondes / 60);
  const s = Math.floor(secondes % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
