/**
 * ⭐ V3.64 — Bibliothèque TikTok partagée (client + serveur).
 *
 * Aucun import serveur ici : les helpers de ce fichier sont utilisés aussi
 * bien par les Composants Client (détection d'URL, lecteur) que par les
 * routes API (oEmbed, backfill des miniatures).
 *
 * Rappel du schéma V3.63 : l'URL TikTok COMPLÈTE est stockée dans
 * Video.videoUrl (comme YouTube) ; l'id est extrait à la lecture.
 */

/** Regex canonique d'une URL vidéo/diaporama TikTok. */
const RE_URL_TIKTOK =
  /^https:\/\/(?:www\.)?tiktok\.com\/@[^/\s]+\/(video|photo)\/(\d{5,25})\/?$/;

/** Regex tolérante (détecte dans du texte libre / une URL quelconque). */
const RE_URL_TIKTOK_TOLERANT =
  /tiktok\.com\/@[^/\s]+\/(?:video|photo)\/(\d{5,25})/;

/** L'URL est-elle une URL TikTok exploitable (vidéo ou diaporama) ? */
export function estUrlTiktok(url?: string | null): boolean {
  if (!url) return false;
  return RE_URL_TIKTOK_TOLERANT.test(url);
}

/**
 * Extrait l'identifiant TikTok d'une videoUrl.
 * Formats : https://www.tiktok.com/@user/video/7683371620924230944
 *           (et /photo/<id> — diaporamas).
 */
export function extraireTiktokId(videoUrl?: string | null): string {
  if (!videoUrl) return "";
  return videoUrl.match(RE_URL_TIKTOK_TOLERANT)?.[1] || "";
}

/**
 * URL d'embed officielle TikTok ( lecteur portrait, autoplay géré par
 * TikTok). embed/v2 fonctionne pour les vidéos ET les diaporamas /photo/.
 */
export function urlEmbedTiktok(tiktokId: string): string {
  return `https://www.tiktok.com/embed/v2/${tiktokId}`;
}

// ────────────────────────────────────────────────────────────────
// oEmbed TikTok (SERVEUR uniquement — fetch sortant vers TikTok)
// ────────────────────────────────────────────────────────────────

export interface OembedTikTok {
  /** Légende TikTok (titre réel de la vidéo). */
  titre: string;
  /** Nom d'auteur (ex. « Pam »). */
  auteur: string;
  /** Profil TikTok de l'auteur. */
  auteurUrl: string;
  /** Miniature SIGNÉE (expire — à ne stocker qu'en repli temporaire). */
  miniatureUrl: string;
  /** Hauteur d'embed EXACTE renvoyée par TikTok (iframe de l'oEmbed). */
  hauteurEmbed: number;
  /** Hauteur brute du champ height (même valeur en général). */
  hauteur: number;
}

interface ReponseOembedBrute {
  title?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  html?: string;
  type?: string;
}

// ⭐ Cache mémoire TTL 10 min : les instances serverless Vercel sont
// réutilisées entre les requêtes — 336 vidéos populaires ne re-frappent
// pas TikTok à chaque visite. (Clé : URL TikTok.)
const CACHE_OEMBED = new Map<string, { expire: number; valeur: OembedTikTok }>();
const TTL_OEMBED_MS = 10 * 60 * 1000;
const TAILLE_MAX_CACHE = 500;

/**
 * Interroge l'oEmbed officiel TikTok (https://www.tiktok.com/oembed).
 *
 * ⚠️ À n'appeler QUE depuis le serveur (route API) :
 *  - le poste de développement est géolocalisé dans une région où TikTok
 *    redirige vers une page « indisponible » ;
 *  - la PRODUCTION (Vercel, région cdg1/Paris) joint TikTok normalement.
 * Les erreurs remontent à l'appelant (null) — JAMAIS d'exception.
 */
export async function oembedTiktok(url: string): Promise<OembedTikTok | null> {
  const enCache = CACHE_OEMBED.get(url);
  if (enCache && enCache.expire > Date.now()) return enCache.valeur;

  try {
    const res = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
      {
        headers: {
          // Un User-Agent de navigateur évite les blocages grossiers.
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          accept: "application/json,text/html;q=0.9",
        },
        signal: AbortSignal.timeout(9000),
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "";
    if (!type.includes("json")) return null;
    const bruted = (await res.json()) as ReponseOembedBrute;

    // Hauteur d'embed : TikTok dimensionne l'iframe de l'oEmbed à la
    // hauteur RÉELLE de la page embed (vidéo + légende + bouton) —
    // c'est la valeur qui supprime scrollbar + textes tronqués.
    let hauteurEmbed = 0;
    if (bruted.html) {
      hauteurEmbed = Number(bruted.html.match(/height="(\d+)"/)?.[1] || 0);
    }
    if (!hauteurEmbed || !Number.isFinite(hauteurEmbed)) {
      hauteurEmbed = bruted.height || 0;
    }
    if (!hauteurEmbed || !Number.isFinite(hauteurEmbed)) {
      hauteurEmbed = 780; // hauteur canonique TikTok (325×780)
    }

    const valeur: OembedTikTok = {
      titre: bruted.title || "",
      auteur: bruted.author_name || "",
      auteurUrl: bruted.author_url || "",
      miniatureUrl: bruted.thumbnail_url || "",
      hauteurEmbed: Math.min(Math.max(hauteurEmbed, 580), 1500),
      hauteur: bruted.height || hauteurEmbed,
    };

    if (CACHE_OEMBED.size > TAILLE_MAX_CACHE) CACHE_OEMBED.clear();
    CACHE_OEMBED.set(url, { expire: Date.now() + TTL_OEMBED_MS, valeur });
    return valeur;
  } catch {
    return null;
  }
}
