/**
 * ⭐ V3.90 → V3.91 — MCL CREATIVE STUDIO : client NVIDIA NIM (build.nvidia.com).
 *
 * Directive du pasteur : « alimenter avec l'IA pour bien peaufiner le
 * travail… des rendus vraiment professionnels, pas des trucs statiques
 * et génériques » — le pasteur possède un compte build.nvidia.com.
 *
 * Modèles utilisés (les DEUX branches de build.nvidia.com) :
 *   · openai/gpt-oss-20b  — DIRECTEUR IA (texte, raisonnement) : transforme
 *     une description française complète en spécification de visuel
 *     (prompt FLUX + palette de couleurs LIBRE + ambiance). C'est le
 *     « cerveau » façon ChatGPT ; il ne génère PAS d'image (aucun modèle
 * ChatGPT/GPT-image n'est disponible sur build.nvidia.com) ;
 *   · FLUX.1 Kontext [dev] — ÉDITION d'image guidée par texte : peaufiner
 *     une photo d'intervenant (relight studio, netteté, fond nettoyé) EN
 *     CONSERVANT l'identité et la pose de la personne ;
 *   · FLUX.1 [dev]       — génération texte→image : fonds exclusifs à la
 *     palette voulue (libre, pas seulement les palettes du ministère).
 *
 * ⭐ V3.91 (correction du bug « Unexpected token '<' ») : les URL et les
 * paramètres suivaient D'ANCIENS schémas — NVIDIA répondait 4xx/404, la
 * fonction renvoyait 502, et Cloudflare REMPLAÇAIT le corps par sa page
 * HTML « Bad gateway » → le client plantait en parsant du HTML comme JSON.
 * Schémas corrigés d'après les exemples officiels build.nvidia.com :
 *   · chemins /v1/genai/black-forest-labs/… (et non /v1/bfl ni /v1/generation) ;
 *   · paramètre cfg_scale (et non cfg) ;
 *   · Kontext aspect_ratio "match_input_image" (et non "match_input").
 *
 * ⚠️ Le texte et la mise en page restent rendus par NOTRE moteur
 * @napi-rs/canvas : les modèles d'image détruisent le texte net —
 * l'IA peaufine les PHOTOS et les FONDS, le typographe reste le moteur MCL.
 *
 * Clé : variable d'environnement NVIDIA_API_KEY (à définir dans
 * Vercel → Settings → Environment Variables — la même clé sert les
 * DEUX branches : integrate.api.nvidia.com ET ai.api.nvidia.com).
 * Endpoints surchargeables via NVIDIA_KONTEXT_URL / NVIDIA_FLUX_URL /
 * NVIDIA_DIRECTEUR_URL si NVIDIA fait évoluer ses chemins. Les réponses
 * sont analysées avec TOLÉRANCE (plusieurs schémas connus : { image },
 * { artifacts: [{ base64 }] }, { data: [{ url | b64_json }] }) — jamais
 * d'erreur technique au client (§38) : le détail part dans les logs serveur.
 *
 * ⚠️ SERVEUR UNIQUEMENT.
 */

/** La clé NVIDIA est-elle configurée ? (exposé à l'UI via /meta — sans
 * jamais divulguer la clé elle-même). */
export function estIAActive(): boolean {
  return Boolean(
    process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY.trim().length > 20
  );
}

// ⭐ V3.91 — chemins officiels actuels (exemples build.nvidia.com).
// Anciens chemins conservés en repli : si NVIDIA déplace ses routes,
// l'escalier ci-dessous essaie la variante historique.
const URLS_KONTEXT = [
  process.env.NVIDIA_KONTEXT_URL,
  "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-kontext-dev",
  "https://ai.api.nvidia.com/v1/bfl/flux.1-kontext-dev",
].filter(Boolean) as string[];
const URLS_FLUX = [
  process.env.NVIDIA_FLUX_URL,
  "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev",
  "https://ai.api.nvidia.com/v1/generation/black-forest-labs/flux.1-dev",
].filter(Boolean) as string[];
// ⭐ V3.91 — Directeur IA (gpt-oss-20b, API compatible OpenAI).
const URL_DIRECTEUR =
  process.env.NVIDIA_DIRECTEUR_URL ||
  "https://integrate.api.nvidia.com/v1/chat/completions";
const MODELE_DIRECTEUR = process.env.NVIDIA_DIRECTEUR_MODELE || "openai/gpt-oss-20b";

const DELAI_TIMEOUT_MS = Number(process.env.NVIDIA_TIMEOUT_MS || 40_000);
// 55 s : latence OBSERVÉE de gpt-oss-20b sur build.nvidia.com = 15 à 45 s
  // (tier partagé — files d'attente variables) ; route maxDuration = 60 s.
const DELAI_DIRECTEUR_MS = Number(process.env.NVIDIA_DIRECTEUR_TIMEOUT_MS || 55_000);

export class ErreurNvidia extends Error {
  constructor(
    message: string,
    public readonly statut: number,
    public readonly detail?: string
  ) {
    super(message);
    this.name = "ErreurNvidia";
  }
}

// ─── Appel + analyse tolérante des réponses ───────────────────────────

/** Extrait une image (Buffer PNG/JPEG) d'une réponse NIM, quel que soit
 * son schéma : { image }, { artifacts: [{ base64 }] }, { data: [...] },
 * { image_url }… ou une URL à télécharger. */
async function extraireImage(
  corps: Record<string, unknown>,
  cleApi: string
): Promise<Buffer> {
  const candidats: string[] = [];

  // { image: "https://…" | "data:image/…;base64,…" }
  if (typeof corps.image === "string") candidats.push(corps.image);

  // { artifacts: [{ base64 }] } (schémas type Stability)
  if (Array.isArray(corps.artifacts)) {
    const premier = corps.artifacts[0] as { base64?: string } | undefined;
    if (premier?.base64) candidats.push(`data:image/png;base64,${premier.base64}`);
  }

  // { data: [{ url | b64_json }] } (schémas type OpenAI)
  if (Array.isArray(corps.data)) {
    const premier = corps.data[0] as { url?: string; b64_json?: string } | undefined;
    if (premier?.b64_json) candidats.push(`data:image/png;base64,${premier.b64_json}`);
    if (premier?.url) candidats.push(premier.url);
  }

  // { image_url: "…" }
  if (typeof corps.image_url === "string") candidats.push(corps.image_url);

  for (const candidat of candidats) {
    const tampon = await versTampon(candidat, cleApi);
    if (tampon) return tampon;
  }
  throw new ErreurNvidia(
    "Réponse NVIDIA dans un format inattendu.",
    200,
    JSON.stringify(corps).substring(0, 400)
  );
}

/** Convertit une URL http(s) ou une data URL base64 en Buffer. */
async function versTampon(valeur: string, cleApi: string): Promise<Buffer | null> {
  try {
    if (valeur.startsWith("data:")) {
      const base64 = valeur.substring(valeur.indexOf(",") + 1);
      const tampon = Buffer.from(base64, "base64");
      return tampon.length > 64 && tampon.length < 25 * 1024 * 1024 ? tampon : null;
    }
    if (/^https?:\/\//i.test(valeur)) {
      const res = await fetch(valeur, {
        signal: AbortSignal.timeout(15_000),
        headers: { authorization: `Bearer ${cleApi}` },
      });
      if (!res.ok) return null;
      const tampon = Buffer.from(await res.arrayBuffer());
      return tampon.length > 64 && tampon.length < 25 * 1024 * 1024 ? tampon : null;
    }
  } catch {
    return null;
  }
  return null;
}

/** POST JSON vers NVIDIA avec auth, timeout et escalier de repli.
 * ⭐ V3.91 : plusieurs URL candidates (schéma officiel actuel + variante
 * historique) — si une URL répond 404 (chemin déplacé), la suivante est
 * essayée ; sur 400/422, un repli minimal (prompt + champs essentiels)
 * est tenté sur la MÊME url (paramètre optionnel mal accepté). */
async function appelerNvidia(
  urls: string[],
  corps: Record<string, unknown>,
  cleApi: string
): Promise<Record<string, unknown>> {
  let derniereErreur: ErreurNvidia | null = null;

  for (const url of urls) {
    const tenter = async (charge: Record<string, unknown>) => {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${cleApi}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(charge),
        signal: AbortSignal.timeout(DELAI_TIMEOUT_MS),
      });
      const texte = await res.text();
      if (!res.ok) {
        throw new ErreurNvidia(
          `NVIDIA a répondu ${res.status}.`,
          res.status,
          texte.substring(0, 400)
        );
      }
      try {
        return JSON.parse(texte) as Record<string, unknown>;
      } catch {
        throw new ErreurNvidia("Réponse NVIDIA illisible.", res.status, texte.substring(0, 200));
      }
    };

    try {
      return await tenter(corps);
    } catch (e) {
      if (e instanceof ErreurNvidia && (e.statut === 400 || e.statut === 422)) {
        // Un paramètre optionnel mal accepté ? Retentons au strict minimum
        // (d'après les exemples officiels : prompt + image + ratio + pas).
        const minimal: Record<string, unknown> = {
          prompt: corps.prompt as string,
        };
        if (typeof corps.image === "string") minimal.image = corps.image;
        try {
          return await tenter(minimal);
        } catch {
          // On continue vers l'URL suivante (404) ou on remonte l'erreur.
        }
      }
      if (e instanceof ErreurNvidia && e.statut !== 404) throw e;
      derniereErreur = e instanceof ErreurNvidia ? e : null;
    }
  }
  throw (
    derniereErreur ||
    new ErreurNvidia("NVIDIA n'a pas répondu (chemins essayés sans succès).", 504)
  );
}

// ─── Capacités exposées au service studio ─────────────────────────────

/**
 * PEAUFINER une photo d'intervenant (FLUX.1 Kontext [dev], mode « edit ») :
 * éclairage studio, netteté, fond nettoyé — en gardant exactement la
 * MÊME personne (visage, pose, vêtements). Retourne le PNG résultat.
 */
export async function peaufinerPhotoNvidia(
  urlPhoto: string,
  consigneSup?: string
): Promise<Buffer> {
  const cleApi = process.env.NVIDIA_API_KEY?.trim();
  if (!cleApi) throw new ErreurNvidia("Clé NVIDIA absente (NVIDIA_API_KEY).", 503);

  const consigne = [
    "Enhance this exact photo into a professional studio portrait.",
    "Keep the SAME person: identical face, identity, pose and clothing.",
    "Improve lighting with a soft cinematic key light, increase sharpness",
    "and detail, clean up the background, natural skin tones.",
    "Photorealistic, high resolution, no text, no watermark.",
    consigneSup?.trim() ? `Additional guidance: ${consigneSup.trim()}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const corps = await appelerNvidia(
    URLS_KONTEXT,
    {
      prompt: consigne,
      image: urlPhoto,
      // ⭐ V3.91 — schéma officiel build.nvidia.com (exemples du pasteur).
      aspect_ratio: "match_input_image",
      steps: 30,
      cfg_scale: 3.5,
      seed: 0,
    },
    cleApi
  );
  return extraireImage(corps, cleApi);
}

/**
 * GÉNÉRER un fond (FLUX.1 [dev], texte→image) à la palette du ministère :
 * noir profond, or, feu — sans texte ni personne, exploitable derrière
 * n'importe quel visuel. Retourne le PNG résultat.
 */
export async function genererFondNvidia(consigne: string): Promise<Buffer> {
  const cleApi = process.env.NVIDIA_API_KEY?.trim();
  if (!cleApi) throw new ErreurNvidia("Clé NVIDIA absente (NVIDIA_API_KEY).", 503);

  // ⭐ V3.91 — schéma STRICT du endpoint /v1/genai (preuve 422 du
  // 16/09/2026 : « aspect_ratio » et « output_format » sont
  // « Extra inputs are not permitted » sur flux.1-dev — seul Kontext les
  // accepte). Paramètres valides : prompt, cfg_scale, steps, seed, mode.
  // Le fond sort au ratio natif du modèle ; notre pipeline sharp le
  // recentre en 1920×1080 « cover » (§ handlerGenererFondIA).
  const corps = await appelerNvidia(
    URLS_FLUX,
    {
      prompt: consigne,
      mode: "base",
      cfg_scale: 3.5,
      steps: 30,
      seed: 0,
    },
    cleApi
  );
  return extraireImage(corps, cleApi);
}

/** Construit la consigne de fond à partir des intentions saisies.
 * ⭐ V3.91 : palette LIBRE — si le Directeur IA (ou l'utilisateur) fournit
 * des couleurs, elles remplacent le mapping par style : n'importe quelle
 * palette devient possible. */
export function consigneFond(
  intention: string,
  styleKey?: string,
  couleursPerso?: { accent?: string; secondary?: string; background?: string }
): string {
  const palette: Record<string, string> = {
    "feu-puissance": "dark background with intense orange fire embers and warm glow",
    "noir-or": "deep black background with elegant golden light rays",
    royal: "royal deep purple and gold background, majestic lighting",
    cinematique: "cinematic dark background, dramatic rim light, subtle haze",
    "lion-feu": "dark fiery background with golden sparks",
    "aigle-feu": "dark sky at dusk with warm orange glow",
    predication: "dark stage background with a single warm spotlight",
    enseignement: "clean dark blue-black background, soft gradient",
    live: "concert-like dark background with subtle warm bokeh lights",
    temoignage: "soft dark background with warm golden gradient",
  };

  // Palette LIBRE (Directeur IA ou sélecteurs) : la description parle
  // d'elle-même — FLUX comprend les hexadécimaux.
  let ambiance = (styleKey && palette[styleKey]) || "dark elegant background";
  if (couleursPerso && (couleursPerso.accent || couleursPerso.background)) {
    ambiance = [
      `background color exactly ${couleursPerso.background || "deep black"}`,
      `accents and glow of ${couleursPerso.accent || "gold"}`,
    ].join(", ");
  }
  return [
    `Professional church ministry visual background: ${intention.trim()}`,
    `${ambiance}, deep blacks, high contrast, premium quality`,
    "no people, no faces, no text, no logos, no letters, no watermark",
    "photorealistic or abstract gradient art, high detail, 4k",
  ].join(", ");
}

// ─── ⭐ V3.91 — DIRECTEUR IA (openai/gpt-oss-20b) ─────────────────────

/** Spécification de visuel produite par le Directeur IA. */
export interface SpecDirecteur {
  /** Prompt FLUX complet (anglais) pour le fond. */
  prompt_flux: string;
  /** Palette LIBRE — n'importe quel hexadécimal, harmonisée à la demande. */
  palette: { accent: string; secondary: string; background: string };
  /** Ambiance en français (affichée à l'utilisateur). */
  ambiance: string;
  /** Suggestions facultatives (l'utilisateur peut les appliquer). */
  suggestion_titre?: string;
  suggestion_accroche?: string;
}

const SYSTEME_DIRECTEUR = [
  "Tu es le directeur artistique du Mouvement Christ Libère (église).",
  "L'utilisateur décrit en français le visuel qu'il veut créer (miniature vidéo ou affiche d'événement).",
  "Tu transformes sa demande en une spécification de visuel, puis tu réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte autour, au format :",
  '{"prompt_flux": "...", "palette": {"accent": "#RRGGBB", "secondary": "#RRGGBB", "background": "#RRGGBB"}, "ambiance": "...", "suggestion_titre": "...", "suggestion_accroche": "..."}',
  "Règles :",
  "- prompt_flux : description ANGLAISE riche et cinématographique du FOND de l'image (lumières, textures, matières, atmosphère), sans texte, sans personnes, sans logos, finissant par \"no people, no text, no watermark\".",
  "- palette : 3 couleurs hexadécimales HARMONISÉES à la demande (accent = couleur vive du titre, secondary = texte secondaire clair, background = fond sombre pour que le blanc/doré reste lisible). Libérez-vous des palettes habituelles : si l'utilisateur veut du vert émeraude, du bleu profond, du bordeaux… faites-le.",
  "- ambiance : une phrase française courte décrivant le rendu.",
  "- suggestion_titre / suggestion_accroche : suggestions françaises percutantes (MAJUSCULES pour le titre), inspirées de la demande.",
  "- Si le message est une CORRECTION d'un visuel précédent, intègre la correction à la spécification précédente (nouvelles valeurs complètes).",
].join("\n");

/** Extrait tolérant du JSON renvoyé par gpt-oss-20b (les modèles de
 * raisonnement encadrent parfois leur réponse dans du texte ou des
 * balises de code — on isole le premier objet équilibré {…}). */
function extraireJsonDirecteur(texte: string): Record<string, unknown> | null {
  const sansBalises = texte.replace(/```(?:json)?/gi, "");
  const debut = sansBalises.indexOf("{");
  if (debut < 0) return null;
  // Équilibre des accolades (chaînes ignorées) pour trouver la FIN de
  // l'objet — robuste même si la réponse contient du texte autour.
  let profondeur = 0;
  let dansChaine = false;
  let echappe = false;
  for (let i = debut; i < sansBalises.length; i++) {
    const c = sansBalises[i];
    if (dansChaine) {
      if (echappe) echappe = false;
      else if (c === "\\") echappe = true;
      else if (c === '"') dansChaine = false;
      continue;
    }
    if (c === '"') dansChaine = true;
    else if (c === "{") profondeur++;
    else if (c === "}") {
      profondeur--;
      if (profondeur === 0) {
        try {
          return JSON.parse(sansBalises.substring(debut, i + 1)) as Record<
            string,
            unknown
          >;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

const COULEUR_HEXA = /^#[0-9a-fA-F]{6}$/;

/** NORMALISE une spécification du Directeur (couleurs validées, champs
 * coupés) — le rendu ne reçoit JAMAIS de valeurs dangereuses. */
export function normaliserSpecDirecteur(
  brut: Record<string, unknown>
): SpecDirecteur {
  const paletteBrute = (brut.palette || {}) as Record<string, unknown>;
  const couleur = (v: unknown, defaut: string): string => {
    const s = typeof v === "string" ? v.trim() : "";
    return COULEUR_HEXA.test(s) ? s.toUpperCase() : defaut;
  };
  return {
    prompt_flux: String(brut.prompt_flux || "")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 900),
    palette: {
      accent: couleur(paletteBrute.accent, "#C9A227"),
      secondary: couleur(paletteBrute.secondary, "#FAF6EF"),
      background: couleur(paletteBrute.background, "#141009"),
    },
    ambiance: String(brut.ambiance || "").trim().substring(0, 160),
    suggestion_titre: brut.suggestion_titre
      ? String(brut.suggestion_titre).trim().substring(0, 120)
      : undefined,
    suggestion_accroche: brut.suggestion_accroche
      ? String(brut.suggestion_accroche).trim().substring(0, 120)
      : undefined,
  };
}

/** Appelle le Directeur IA (gpt-oss-20b) : description française →
 * spécification de visuel. L'historique (itérations) est renvoyé par
 * l'appelant pour permettre les corrections successives (« corrige telle
 * chose… jusqu'au rendu final » — directive du pasteur). */
export async function directeurIA(
  messageUtilisateur: string,
  historique: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<{ spec: SpecDirecteur; reponseBrute: string }> {
  const cleApi = process.env.NVIDIA_API_KEY?.trim();
  if (!cleApi) throw new ErreurNvidia("Clé NVIDIA absente (NVIDIA_API_KEY).", 503);

  // ⭐ gpt-oss-20b est un modèle à RAISONNEMENT : à l'effort par défaut,
  // il dépasse 45 s (preuve du 16/09/2026 : « The operation was aborted due
  // to timeout »). Effort LEGER : la tâche (JSON de spécification) est
  // simple — quelques secondes suffisent.
  const appeler = async (charge: Record<string, unknown>) => {
    const res = await fetch(URL_DIRECTEUR, {
      method: "POST",
      headers: {
        authorization: `Bearer ${cleApi}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(charge),
      signal: AbortSignal.timeout(DELAI_DIRECTEUR_MS),
    });
    const texte = await res.text();
    return { res, texte };
  };

  const base: Record<string, unknown> = {
    model: MODELE_DIRECTEUR,
    messages: [
      { role: "system", content: SYSTEME_DIRECTEUR },
      ...historique.slice(-12), // borné : la mémoire d'itération reste légère
      { role: "user", content: messageUtilisateur.substring(0, 4000) },
    ],
    // Réglages de l'exemple officiel build.nvidia.com (gpt-oss : temp 1).
    // ⭐ V3.93 — max_tokens 1200 (la spécification JSON tient en ~300 jetons :
    // moins à générer = réponse plus rapide).
    temperature: 1,
    top_p: 1,
    max_tokens: 1200,
    stream: false,
  };

  // ⭐ V3.93 — ESCALIER de charge utile pour l'effort de raisonnement.
  // gpt-oss-20b sur NIM accepte « low » selon le déploiement : soit à la
  // OpenAI (reasoning_effort), soit via chat_template_kwargs (vLLM),
  // soit PAS DU TOUT. L'ANCIEN repli « sans paramètre » laissait le
  // modèle raisonner à l'effort PAR DÉFAUT (médian/élevé) — la cause des
  // 55 s d'attente puis « aborted due to timeout » observées le 17/09.
  // Chaque variante rejetée (400/422) échoue en ~1 s : on peut toutes les
  // essayer avant de tomber sur le prompt brut.
  const variantes: Record<string, unknown>[] = [
    { ...base, reasoning_effort: "low" },
    { ...base, chat_template_kwargs: { reasoning_effort: "low" } },
    base,
  ];
  let essai = await appeler(variantes[0]);
  if (essai.res.status === 400 || essai.res.status === 422) {
    essai = await appeler(variantes[1]);
    if (essai.res.status === 400 || essai.res.status === 422) {
      essai = await appeler(variantes[2]);
    }
  }
  const { res, texte } = essai;
  if (!res.ok) {
    throw new ErreurNvidia(
      `Le directeur IA a répondu ${res.status}.`,
      res.status,
      texte.substring(0, 400)
    );
  }

  let contenu = "";
  try {
    const json = JSON.parse(texte) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    contenu = json.choices?.[0]?.message?.content || "";
  } catch {
    throw new ErreurNvidia("Réponse du directeur IA illisible.", 502);
  }
  if (!contenu.trim()) {
    throw new ErreurNvidia("Le directeur IA n'a rien renvoyé.", 502);
  }
  return { spec: normaliserSpecDirecteur(extraireJsonDirecteur(contenu) || {}), reponseBrute: contenu };
}

// ─── ⭐ V3.93 — SPÉCIFICATION DE REPLI (directeur saturé) ─────────────

/** Palettes harmonisées prêtes à l'emploi — le repli reste BEAU même
 * quand le directeur IA ne répond pas (choix DÉTERMINISTE par hachage :
 * la même description redonne la même ambiance, deux descriptions
 * différentes explorent des familles différentes). */
const PALETTES_REPLI: SpecDirecteur["palette"][] = [
  { accent: "#C9A227", secondary: "#FAF6EF", background: "#141009" }, // or / noir ministère
  { accent: "#E0A458", secondary: "#FFF3E0", background: "#1C1008" }, // ambre chaud
  { accent: "#D8B24A", secondary: "#EEF4FF", background: "#0B1220" }, // bleu nuit & or
  { accent: "#E5D5A8", secondary: "#FFFDF5", background: "#0E0E12" }, // ivoire sacré
  { accent: "#C9A227", secondary: "#F7F0FA", background: "#170E1D" }, // pourpre royal
];

/** ⭐ V3.93 — Spécification construite LOCALEMENT quand le directeur IA
 * ne répond pas à temps (file d'attente NVIDIA saturée) : la description
 * française part DIRECTEMENT chez FLUX.1 (qui la comprend), habillée du
 * même échafaudage professionnel que consigneFond(). Le pasteur obtient
 * TOUJOURS son visuel — jamais d'impasse « réessayez dans un instant ». */
export function specDeRepli(description: string, correction?: string): SpecDirecteur {
  const intention = [
    description.trim(),
    correction?.trim() ? `Ajustement demandé : ${correction.trim()}` : "",
  ]
    .filter(Boolean)
    .join(". ")
    .substring(0, 800);

  let h = 0;
  for (let i = 0; i < intention.length; i++) h = (h * 31 + intention.charCodeAt(i)) >>> 0;
  const palette = PALETTES_REPLI[h % PALETTES_REPLI.length];

  return {
    prompt_flux: consigneFond(intention, undefined, palette).substring(0, 900),
    palette,
    ambiance:
      "Fond généré directement depuis votre description (le directeur IA était saturé — relancez pour le retenter).",
  };
}
