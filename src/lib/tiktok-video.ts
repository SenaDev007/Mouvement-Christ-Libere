/**
 * ⭐ V4.04 — Vidéos TikTok : sauvegarde MP4 sur R2 (serveur uniquement).
 *
 * POURQUOI : l'embed officiel TikTok (tiktok.com/embed/v2/<id>) refuse
 * parfois la lecture avec l'écran « overload-protect triggered » —
 * saturation PERSISTANTE du CDN ByteDance sur les requêtes embed des
 * vidéos populaires (retour pasteur : la V4.03 « Réessayer » ne suffit
 * pas). La vidéo reste lisible sur tiktok.com, mais PAS dans notre page.
 *
 * LA PARADE (l'église est propriétaire de ses vidéos) : répliquer le
 * MP4 de chaque vidéo TikTok sur NOTRE stockage R2 — même mécanique que
 * les miniatures V3.85 (src/lib/tiktok-miniature.ts) :
 *   ① résoudre l'URL de lecture directe (playAddr) côté serveur ;
 *   ② télécharger le MP4 et l'uploader sur R2 (videos/tiktok-<id>.mp4) ;
 *   ③ stocker l'URL publique permanente dans Video.tiktokMp4Url ;
 *   ④ le lecteur public joue NOTRE copie (immunisée contre l'overload).
 *
 * RÉSOLUTION DU playAddr — deux méthodes en cascade (la PRODUCTION
 * Vercel/Paris joint TikTok normalement ; le poste de développement est
 * une région bloquée — 302 /hk/about — d'où le repli) :
 *   A. API mobile tiktokv (JSON léger) : aweme/v1/feed?aweme_id=<id> ;
 *   B. HTML de la page vidéo : regex "playAddr" dans le state embarqué
 *      (__UNIVERSAL_DATA_FOR_REHYDRATION__ / SIGI_STATE).
 *
 * Aucune exception ne sort de ce fichier : null/[] = échec silencieux.
 */

import { db } from "@/lib/db";
import { estUrlTiktok, extraireTiktokId } from "@/lib/tiktok";
import { uploadToR2, isR2Configured } from "@/lib/r2";

const UA_NAVIGATEUR =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Garde-fous de téléchargement : un MP4 TikTok vertical (≤ 10 min) fait
// typiquement 3-40 Mo. En dehors de ces bornes, ce n'est pas un mp4.
const OCTETS_MIN = 200 * 1024; // 200 Ko
const OCTETS_MAX = 90 * 1024 * 1024; // 90 Mo

/** Décode une valeur JSON échappée (\u0026, \/…) extraite par regex. */
function decoderValeurJson(brut: string): string {
  try {
    return JSON.parse(`"${brut}"`) as string;
  } catch {
    return brut.replace(/\\u0026/g, "&").replace(/\\\//g, "/");
  }
}

/**
 * Méthode A — API mobile tiktokv (JSON, rapide, sans scraping HTML).
 * Endpoint public historique utilisé par les téléchargeurs ; renvoie
 * aweme_list[0].video.play_addr.url_list[0].
 */
async function playAddrViaApiMobile(id: string): Promise<string | null> {
  const hotes = [
    "https://api16-normal-c-useast1a.tiktokv.com",
    "https://api22-normal-c-useast2a.tiktokv.com",
  ];
  for (const hote of hotes) {
    try {
      const res = await fetch(
        `${hote}/aweme/v1/feed/?aweme_id=${encodeURIComponent(
          id
        )}&version_code=262&app_name=musical_lyrics&channel=App&device_id=0&os_version=17.4&app_version=26.2.3&device_platform=iphone&device_type=iPhone9,3&regions=FR&carrier_region=FR`,
        {
          headers: {
            "user-agent":
              "TikTok 26.2.3 rv:262303 (iPhone; iOS 17.4; fr_FR) Cronet",
            accept: "application/json",
          },
          signal: AbortSignal.timeout(12_000),
          cache: "no-store",
        }
      );
      if (!res.ok) continue;
      const type = res.headers.get("content-type") || "";
      if (!type.includes("json")) continue;
      const data = (await res.json()) as {
        aweme_list?: Array<{
          video?: { play_addr?: { url_list?: string[] } };
        }>;
        statusCode?: number;
      };
      if (data.statusCode && data.statusCode !== 0) continue;
      const url =
        data.aweme_list?.[0]?.video?.play_addr?.url_list?.[0] || null;
      if (url && url.startsWith("http")) return url;
    } catch {
      // hôte suivant
    }
  }
  return null;
}

/**
 * Méthode A — PAGE VIDÉO HTML (prouvée en production Vercel — 200 +
 * playAddr dans __UNIVERSAL_DATA_FOR_REHYDRATION__). Le JSON embarqué
 * est PARSÉ réellement (le playAddr y est doublement échappé : la regex
 * naïve de la 1ʳᵉ version ne le voyait pas — diagnostic V4.04 diag-mp4).
 */
async function playAddrViaPage(videoUrl: string): Promise<string | null> {
  try {
    const res = await fetch(videoUrl, {
      headers: {
        "user-agent": UA_NAVIGATEUR,
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (!html || html.length < 10_000) return null;

    // ① Script __UNIVERSAL_DATA_FOR_REHYDRATION__ (web 2024+) : JSON pur.
    const mUniversal = html.match(
      /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)<\/script>/s
    );
    if (mUniversal) {
      try {
        const data = JSON.parse(mUniversal[1]) as unknown;
        const url = chercherPlayAddr(data);
        if (url) return url;
      } catch {
        // JSON invalide — essayer SIGI_STATE ci-dessous.
      }
    }

    // ② Script SIGI_STATE (pages legacy) : objet JS contenant du JSON pur.
    const mSigi = html.match(
      /<script id="SIGI_STATE"[^>]*>(.*?)<\/script>/s
    );
    if (mSigi) {
      try {
        const data = JSON.parse(mSigi[1]) as unknown;
        const url = chercherPlayAddr(data);
        if (url) return url;
      } catch {
        // JSON invalide — repli regex ci-dessous.
      }
    }

    // ③ Repli regex tolérant sur le HTML brut (simple PUIS double
    // échappement — SIGI_STATE comme objet JS a des clés non échappées,
    // les valeurs imbriquées de bitrateInfo sont doublement échappées).
    for (const champ of ["playAddr", "downloadAddr"]) {
      const simple = html.match(new RegExp(`"${champ}":"((?:[^"\\\\]|\\\\.)*)"`));
      if (simple?.[1]) {
        const url = decoderValeurJson(simple[1]);
        if (url.startsWith("http")) return url;
      }
      const double = html.match(
        new RegExp(`\\\\"${champ}\\\\":\\\\"((?:[^\\"\\\\]|\\\\\\\\.)*)\\\\"`)
      );
      if (double?.[1]) {
        // Double échappement : deux passes de décodage JSON.
        const url = decoderValeurJson(decoderValeurJson(double[1]));
        if (url.startsWith("http")) return url;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Recherche récursive d'une URL de lecture dans l'arbre JSON TikTok. */
function chercherPlayAddr(o: unknown, profondeur = 0): string | null {
  if (profondeur > 14 || o == null) return null;
  if (typeof o === "string") return null;
  if (Array.isArray(o)) {
    for (const e of o) {
      const r = chercherPlayAddr(e, profondeur + 1);
      if (r) return r;
    }
    return null;
  }
  if (typeof o === "object") {
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      // playAddr / PlayAddr directs.
      if (
        (k === "playAddr" || k === "PlayAddr") &&
        typeof v === "string" &&
        v.startsWith("http")
      ) {
        return v;
      }
      // PlayAddr: { UrlList: [...] } (bitrateInfo).
      if (k === "UrlList" && Array.isArray(v)) {
        for (const u of v) {
          if (typeof u === "string" && u.startsWith("http")) return u;
        }
      }
      const r = chercherPlayAddr(v, profondeur + 1);
      if (r) return r;
    }
  }
  return null;
}

/** Résout l'URL de lecture directe du MP4 d'une vidéo TikTok. */
export async function resoudreMp4Tiktok(
  id: string,
  videoUrl: string
): Promise<{ url: string; methode: "api-mobile" | "page" } | null> {
  // ① Page vidéo (prouvée en production Vercel — l'API mobile est
  // « ratelimit triggered » depuis les IP datacenter, diag V4.04).
  const viaPage = await playAddrViaPage(videoUrl);
  if (viaPage) return { url: viaPage, methode: "page" };

  // ② API mobile en repli (peut se libérer, 429 = rate limit).
  const viaApi = await playAddrViaApiMobile(id);
  if (viaApi) return { url: viaApi, methode: "api-mobile" };

  return null;
}

/**
 * Télécharge le MP4 (playAddr) puis le réplique sur R2.
 * @param id       identifiant de la vidéo (clé R2 : videos/tiktok-<id>.mp4)
 * @param videoUrl URL TikTok complète
 */
export async function sauvegarderMp4Tiktok(
  id: string,
  videoUrl: string
): Promise<{ url: string; octets: number; methode: string } | null> {
  if (!isR2Configured()) return null;
  try {
    const idTiktok = extraireTiktokId(videoUrl) || id;
    const source = await resoudreMp4Tiktok(idTiktok, videoUrl);
    if (!source) return null;

    // Téléchargement — le CDN TikTok exige parfois un Referer tiktok.com.
    let res = await fetch(source.url, {
      headers: {
        "user-agent": UA_NAVIGATEUR,
        referer: "https://www.tiktok.com/",
        accept: "video/webm,video/mp4,video/*;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(150_000),
      cache: "no-store",
    });
    if (!res.ok) {
      // Seconde chance sans Referer (certaines URLs signées le refusent).
      res = await fetch(source.url, {
        headers: { "user-agent": UA_NAVIGATEUR },
        signal: AbortSignal.timeout(150_000),
        cache: "no-store",
      });
    }
    if (!res.ok) return null;

    const type = (res.headers.get("content-type") || "").toLowerCase();
    if (type && !type.startsWith("video/") && !type.includes("octet-stream")) {
      return null; // page d'erreur HTML plutôt qu'un mp4
    }

    const octets = Buffer.from(await res.arrayBuffer());
    if (octets.length < OCTETS_MIN || octets.length > OCTETS_MAX) return null;
    // Signature MP4 légère (ftyp) — évite de stocker du HTML en .mp4.
    if (!(octets[4] === 0x66 && octets[5] === 0x74 && octets[6] === 0x79)) {
      return null;
    }

    const cle = `videos/tiktok-${idTiktok}.mp4`;
    const urlPublique = await uploadToR2(cle, octets, "video/mp4");

    // Persistance (et rien d'autre).
    await db.video.updateMany({
      where: { id },
      data: { tiktokMp4Url: urlPublique },
    });

    return { url: urlPublique, octets: octets.length, methode: source.methode };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Backfill par lots (même contrat que tiktok-miniature.ts, V3.85)
// ─────────────────────────────────────────────────────────────────────

export interface ResultatBackfillMp4Tiktok {
  traitées: number;
  sauvegardées: number;
  restantes: number;
  idsEchecs: string[];
  erreurs: string[];
  octetsTotaux: number;
}

/**
 * Backfill des vidéos TikTok SANS copie R2, par ORDRE DE POPULARITÉ
 * (views décroissantes) : les plus regardées sont les premières exposées
 * à l'erreur « overload-protect » du CDN TikTok — elles passent donc
 * en premier. Les diaporamas /photo/ (carrousels, pas de mp4 unique)
 * sont exclus.
 *
 * ⚠️ À appeler APRÈS ensureTiktokMp4UrlColumn() (P2022 sinon).
 * Idempotent : les vidéos déjà sauvegardées sont exclues — relancer ne
 * refait rien. Paquets de 3 en parallèle sous garde-fou horloge.
 */
export async function backfillMp4Tiktok(params?: {
  limite?: number;
  exclure?: string[];
  budgetMs?: number;
}): Promise<ResultatBackfillMp4Tiktok> {
  const limite = Math.min(Math.max(params?.limite ?? 6, 1), 20);
  const budgetMs = Math.min(Math.max(params?.budgetMs ?? 45_000, 10_000), 240_000);
  const exclure = new Set(params?.exclure ?? []);

  const debut = Date.now();
  const erreurs: string[] = [];

  // ① Candidates TikTok sans mp4 (diaporamas /photo/ exclus).
  const toutes = await db.video.findMany({
    where: { videoUrl: { not: null } },
    select: { id: true, videoUrl: true, tiktokMp4Url: true, views: true },
  });
  const candidates = toutes
    .filter(
      (v) =>
        estUrlTiktok(v.videoUrl) &&
        !v.videoUrl!.includes("/photo/") &&
        !v.tiktokMp4Url &&
        !exclure.has(v.id)
    )
    .sort((a, b) => b.views - a.views); // populaires d'abord

  let traites = 0;
  let sauvegardees = 0;
  let octetsTotaux = 0;
  const idsEchec: string[] = [];

  // ②-④ Paquets de 3 (les téléchargements sont plus lourds que les images).
  const TAILLE_PAQUET = 3;
  for (let i = 0; i < candidates.length; i += TAILLE_PAQUET) {
    if (traites >= limite || Date.now() - debut > budgetMs) break;
    const paquet = candidates.slice(i, i + TAILLE_PAQUET);
    traites += paquet.length;

    const resultats = await Promise.allSettled(
      paquet.map((v) =>
        sauvegarderMp4Tiktok(v.id, v.videoUrl as string)
      )
    );
    resultats.forEach((res, j) => {
      if (res.status === "fulfilled" && res.value) {
        sauvegardees++;
        octetsTotaux += res.value.octets;
      } else {
        idsEchec.push(paquet[j].id);
        if (res.status === "rejected") {
          erreurs.push(
            `${paquet[j].id}: ${
              res.reason instanceof Error ? res.reason.message : String(res.reason)
            }`
          );
        }
      }
    });
  }

  return {
    traitées: traites,
    sauvegardées: sauvegardees,
    restantes: Math.max(0, candidates.length - sauvegardees),
    idsEchecs: idsEchec,
    erreurs: erreurs.slice(0, 10),
    octetsTotaux: octetsTotaux,
  };
}
