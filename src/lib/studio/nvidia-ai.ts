/**
 * ⭐ V3.90 — MCL CREATIVE STUDIO : client NVIDIA NIM (build.nvidia.com).
 *
 * Directive du pasteur : « alimenter avec l'IA pour bien peaufiner le
 * travail… des rendus vraiment professionnels, pas des trucs statiques
 * et génériques » — le pasteur possède un compte build.nvidia.com.
 *
 * Modèles recommandés (conseil donné au pasteur) :
 *   · FLUX.1 Kontext [dev]  — ÉDITION d'image guidée par texte : c'est
 *     LE modèle pour « peaufiner » une photo d'intervenant (relight
 *     studio, netteté, fond nettoyé) EN CONSERVANT l'identité et la
 *     pose de la personne ;
 *   · FLUX.1 [dev]          — génération texte→image : fonds exclusifs
 *     (feu, or, cinématique…) à la palette du ministère ;
 *   · (alternatives : Stable Diffusion 3.5, SDXL — moins bonnes sur
 *     les visages sombres et les rendus « premium »).
 *
 * ⚠️ Le texte et la mise en page restent rendus par NOTRE moteur
 * @napi-rs/canvas : les modèles d'image détruisent le texte net —
 * l'IA peaufine les PHOTOS, le typographe reste le moteur MCL.
 *
 * Clé : variable d'environnement NVIDIA_API_KEY (à définir dans
 * Vercel → Settings → Environment Variables). Endpoints surchargeables
 * via NVIDIA_KONTEXT_URL / NVIDIA_FLUX_URL si NVIDIA fait évoluer ses
 * chemins. Les réponses sont analysées avec TOLÉRANCE (plusieurs
 * schémas connus : { image }, { artifacts: [{ base64 }] },
 * { data: [{ url | b64_json }] }) — jamais d'erreur technique au
 * client (§38) : le détail part dans les logs serveur.
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

const URL_KONTEXT =
  process.env.NVIDIA_KONTEXT_URL ||
  "https://ai.api.nvidia.com/v1/bfl/flux.1-kontext-dev";
const URL_FLUX =
  process.env.NVIDIA_FLUX_URL ||
  "https://ai.api.nvidia.com/v1/generation/black-forest-labs/flux.1-dev";

const DELAI_TIMEOUT_MS = Number(process.env.NVIDIA_TIMEOUT_MS || 40_000);

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

/** POST JSON vers NVIDIA avec auth, timeout et 1 repli minimal. */
async function appelerNvidia(
  url: string,
  corps: Record<string, unknown>,
  cleApi: string
): Promise<Record<string, unknown>> {
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
    // Un paramètre optionnel mal accepté ? Retentons au strict minimum.
    if (e instanceof ErreurNvidia && (e.statut === 400 || e.statut === 422)) {
      const minimal: Record<string, unknown> = {
        prompt: corps.prompt as string,
      };
      if (typeof corps.image === "string") minimal.image = corps.image;
      if (corps.mode) minimal.mode = corps.mode;
      return await tenter(minimal);
    }
    throw e;
  }
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
    URL_KONTEXT,
    {
      prompt: consigne,
      mode: "edit",
      image: urlPhoto,
      aspect_ratio: "match_input",
      steps: 30,
      cfg: 2.5,
      output_format: "png",
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

  const corps = await appelerNvidia(
    URL_FLUX,
    {
      prompt: consigne,
      mode: "base",
      aspect_ratio: "16:9",
      cfg: 3.5,
      steps: 30,
      output_format: "png",
    },
    cleApi
  );
  return extraireImage(corps, cleApi);
}

/** Construit la consigne de fond à partir des intentions saisies. */
export function consigneFond(
  intention: string,
  styleKey?: string
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
  const ambiance = (styleKey && palette[styleKey]) || "dark elegant background";
  return [
    `Professional church ministry visual background: ${intention.trim()}`,
    `${ambiance}, deep blacks, high contrast, premium quality`,
    "no people, no faces, no text, no logos, no letters, no watermark",
    "photorealistic or abstract gradient art, high detail, 4k",
  ].join(", ");
}
