/**
 * ============================================================================
 * ⭐ V3.51 — UPLOAD SÉQUENTIEL PAR MORCEAUX vers Cloudflare R2 (client)
 * ============================================================================
 *
 * Remplace le PUT monolithique (fichier ENTIER en une requête — cause des
 * « crashs » d'upload : un hoquet réseau à 95 % tuait tout et repartait de
 * zéro ; le repli serveur est limité à 4 Mo par le body Vercel).
 *
 * Fonctionnement :
 *   1. create   → ouvre une session multipart côté R2 (uploadId, partSize)
 *   2. part × N → chaque morceau (~8 Mo) est envoyé SÉQUENTIELLEMENT :
 *                  - URL pré-signée FRAÎCHE demandée à la volée (1 action
 *                    « part » par morceau — aucune URL qui expire)
 *                  - PUT XHR (progression réelle du morceau)
 *                  - réessai INDIVIDUEL (3 tentatives, nouvelle URL à
 *                    chaque tentative) — un échec ne redémarre PAS tout
 *   3. complete → R2 assemble les morceaux en l'objet final
 *   4. abort    → nettoyage best-effort en cas d'échec définitif/annulation
 *
 * Utilisé par : modal « Nouvelle vidéo » (module Vidéos du back-office),
 * upload du replay de live (studio), post-production (vidéo source) et
 * suppression de fond — via les routes :
 *   /api/videos/[id]/multipart  (prefixe « videos »)
 *   /api/live/[id]/multipart    (prefixe « replays »)
 */

/** Marqueur : R2 n'est pas configuré → l'appelant peut utiliser son repli (≤ 4 Mo). */
export class ErreurR2NonConfigure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurR2NonConfigure";
  }
}

/** Marqueur : envoi annulé par l'utilisateur (pas un échec technique). */
export class ErreurEnvoiAnnule extends Error {
  constructor() {
    super("Envoi annulé");
    this.name = "ErreurEnvoiAnnule";
  }
}

/**
 * ⭐ V3.55 — Marqueur : le bucket R2 refuse les PUT du NAVIGATEUR (politique
 * CORS absente/incomplète). C'est un refus DÉTERMINISTE — aucun réessai ne
 * peut l'arranger — la seule issue est la réparation guidée (2 min, une
 * fois) sur /admin/r2-test, section « CORS du bucket ».
 */
export class ErreurCorsBucket extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurCorsBucket";
  }
}

/**
 * ⭐ V3.55 — Message CORS : la VRAIE cause, établie par test direct (le
 * bucket répond « CORS not configured for this bucket »), avec la
 * réparation exacte. Remplace l'ancien message qui accusait à tort la
 * connexion du pasteur (« Votre connexion semble instable ») sur un refus
 * déterministe que trois tentatives ne pouvaient que répéter à l'identique.
 */
const MESSAGE_CORS_BUCKET =
  "Envoi impossible : le stockage Cloudflare R2 n'accepte pas les requêtes de votre navigateur — " +
  "la politique CORS du bucket n'est pas configurée (vérifié par test direct : ce n'est PAS votre connexion). " +
  "Réparation guidée (2 minutes, une seule fois) : back-office → Test R2 (/admin/r2-test) → section « CORS du bucket ». " +
  "Aucune tentative supplémentaire ne peut aboutir tant que la règle n'est pas appliquée.";

export interface DetailsProgression {
  /** Morceau en cours (1-indexé). */
  partie: number;
  /** Nombre total de morceaux. */
  total: number;
  /** Tentative en cours pour CE morceau (1 = première). */
  tentatives: number;
}

export interface OptionsUploadSequentiel {
  /** Route multipart : `/api/videos/${id}/multipart` ou `/api/live/${id}/multipart`. */
  endpoint: string;
  /** Fichier (File) ou Blob (replay enregistré, rendu post-production…). */
  fichier: Blob;
  /** Type MIME (posé sur l'objet R2 final). */
  contentType: string;
  /** Progression globale 0-100 + détails du morceau en cours. */
  onProgression?: (pourcent: number, details?: DetailsProgression) => void;
  /** Phases pour l'UI. */
  onPhase?: (phase: "preparation" | "envoi" | "assemblage") => void;
  /** Annulation (fermeture du modal, abandon). Déclenche l'abort R2. */
  signalAnnulation?: AbortSignal;
  /** Tentatives par morceau (défaut 3). */
  tentativesMax?: number;
}

interface ReponseCreate {
  uploadId: string;
  key: string;
  partSize: number;
  partCount: number;
  publicUrl: string;
  /** ⭐ V3.55 — origine (virtual-hosted) du bucket pour la sonde CORS navigateur. */
  r2Origin?: string;
  /** ⭐ V3.55 — état CORS constaté côté serveur : "ok" | "absent" | "inverifiable". */
  corsEtat?: string;
}

const ATTENTE_REESSAI_MS = [1200, 3000]; // entre tentatives de morceau

function attendre(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new ErreurEnvoiAnnule());
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new ErreurEnvoiAnnule());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Appel JSON vers la route multipart, avec réessais sur erreurs transitoires. */
async function appelMultipart<T>(
  endpoint: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
  tentatives = 3
): Promise<T> {
  let derniereErreur = "";
  for (let tentative = 1; tentative <= tentatives; tentative++) {
    if (signal?.aborted) throw new ErreurEnvoiAnnule();
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (res.ok) return data as T;

      // 503 = R2 non configuré (marqueur r2NotConfigured) → erreur dédiée
      // immédiate (un réessai ne changerait rien).
      if (res.status === 503) {
        throw new ErreurR2NonConfigure(
          typeof data.error === "string" ? data.error : "Cloudflare R2 non configuré"
        );
      }
      // 4xx (hors 429) = erreur définitive (bad request, non autorisé…)
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new Error(
          typeof data.error === "string" ? data.error : `Erreur serveur (HTTP ${res.status})`
        );
      }
      derniereErreur =
        typeof data.error === "string" ? data.error : `Erreur serveur (HTTP ${res.status})`;
    } catch (err) {
      if (err instanceof ErreurR2NonConfigure || err instanceof ErreurEnvoiAnnule) throw err;
      if (signal?.aborted) throw new ErreurEnvoiAnnule();
      derniereErreur = err instanceof Error ? err.message : "erreur réseau";
    }
    if (tentative < tentatives) await attendre(ATTENTE_REESSAI_MS[tentative - 1] ?? 3000, signal);
  }
  throw new Error(`Communication avec le serveur d'upload impossible : ${derniereErreur}`);
}

/** PUT XHR d'UN morceau avec progression du morceau. Retourne l'ETag R2. */
function envoyerMorceau(
  morceau: Blob,
  url: string,
  timeoutMs: number,
  onAvancementMorceau: (octetsEnvoyes: number) => void,
  signal?: AbortSignal
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let termine = false;
    const nettoyage = () => {
      signal?.removeEventListener("abort", onAnnulation);
    };
    const onAnnulation = () => {
      if (termine) return;
      termine = true;
      nettoyage();
      xhr.abort();
      reject(new ErreurEnvoiAnnule());
    };
    signal?.addEventListener("abort", onAnnulation, { once: true });

    xhr.upload.addEventListener("progress", (ev) => {
      if (ev.lengthComputable && !termine) onAvancementMorceau(ev.loaded);
    });
    xhr.addEventListener("load", () => {
      if (termine) return;
      termine = true;
      nettoyage();
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader("ETag");
        if (!etag) {
          // ETag non lisible = CORS du bucket incomplet (ExposeHeaders)
          reject(
            new Error(
              "R2 n'a pas renvoyé d'ETag lisible (CORS du bucket) — ouvrez /admin/r2-test pour reconfigurer le bucket."
            )
          );
        } else {
          resolve(etag);
        }
      } else {
        // Extraire le code d'erreur XML de R2 quand présent (AccessDenied…)
        const xmlCode = xhr.responseText?.match(/<Code>([^<]{1,60})<\/Code>/)?.[1];
        reject(new Error(xmlCode ? `${xmlCode} (HTTP ${xhr.status})` : `HTTP ${xhr.status}`));
      }
    });
    xhr.addEventListener("error", () => {
      if (termine) return;
      termine = true;
      nettoyage();
      // ⭐ V3.55 — le CORS est désormais sonde AVANT l'envoi (sondeCorsR2) :
      // si on arrive ici, le preflight passait → il s'agit d'une vraie
      // coupure réseau en cours d'envoi (c'est LE cas légitime des
      // tentatives par morceau).
      reject(new Error("connexion interrompue pendant l'envoi du morceau (erreur réseau)"));
    });
    xhr.addEventListener("timeout", () => {
      if (termine) return;
      termine = true;
      nettoyage();
      reject(new Error("délai dépassé"));
    });
    xhr.addEventListener("abort", () => {
      if (termine) return;
      termine = true;
      nettoyage();
      reject(new ErreurEnvoiAnnule());
    });
    xhr.open("PUT", url);
    // PAS de Content-Type : les requêtes UploadPart signées ci-dessus ne
    // l'incluent pas dans la signature → ne pas l'ajouter côté navigateur.
    xhr.timeout = timeoutMs;
    xhr.send(morceau);
  });
}

/**
 * ⭐ V3.55 — Sonde le preflight CORS du bucket DEPUIS LE NAVIGATEUR.
 *
 * Un PUT (non signé, sans corps) vers l'ORIGINE du bucket déclenche le
 * préflight OPTIONS exact des PUT de morceaux : si une règle CORS existe
 * et couvre cette origine, le préflight passe et R2 répond (statut
 * quelconque — peu importe, on n'est pas authentifié) → "ok". Sinon le
 * navigateur bloque la réponse → TypeError → "bloque".
 *
 * C'est la réplique EXACTE du test serveur (curl -X OPTIONS) qui a établi
 * le diagnostic : le bucket répond « CORS not configured for this bucket ».
 */
async function sonderCorsR2(r2Origin: string): Promise<"ok" | "bloque"> {
  try {
    await fetch(`${r2Origin}/`, { method: "PUT", cache: "no-store" });
    return "ok"; // préflight accepté — le statut HTTP final est sans importance
  } catch {
    return "bloque"; // préflight refusé (TypeError: Failed to fetch)
  }
}

/** ⭐ V3.55 — Le serveur d'upload répond-il ? (distingue « CORS bloqué » de « réseau coupé »). */
async function serveurJoinable(endpoint: string): Promise<boolean> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    });
    return res.status > 0; // toute réponse HTTP (même 400) = serveur joignable
  } catch {
    return false;
  }
}

/**
 * Upload séquentiel complet d'un fichier/Blob vers R2 par morceaux.
 * Retourne l'URL PUBLIQUE de l'objet assemblé — le commit en base reste
 * à la charge de l'appelant (routes existantes inchangées).
 */
export async function uploaderSequentielVersR2(
  opts: OptionsUploadSequentiel
): Promise<{ publicUrl: string }> {
  const {
    endpoint,
    fichier,
    contentType,
    onProgression,
    onPhase,
    signalAnnulation,
    tentativesMax = 3,
  } = opts;

  if (fichier.size === 0) throw new Error("Fichier vide (0 octet) — rien à envoyer.");
  if (signalAnnulation?.aborted) throw new ErreurEnvoiAnnule();

  // ─── ① Session multipart ─────────────────────────────────────────────
  onPhase?.("preparation");
  const session = await appelMultipart<ReponseCreate>(
    endpoint,
    {
      action: "create",
      contentType,
      filename: fichier instanceof File ? fichier.name : undefined,
      fileSize: fichier.size,
    },
    signalAnnulation
  );

  const { uploadId, key, partSize, partCount, publicUrl } = session;
  const octetsTotal = fichier.size;

  // ─── ⭐ V3.55 ①bis — Sonde CORS du bucket AVANT tout morceau ──────────
  // La session vient d'être créée via le serveur (le réseau vient donc de
  // fonctionner). Si l'état CORS n'a pas pu être vérifié côté serveur
  // (token scoped — cas normal) ou n'est pas « ok », le NAVIGATEUR sonde
  // lui-même le préflight : un bucket sans règle CORS rejette TOUT PUT
  // navigateur de façon DÉTERMINISTE — réessayer 3 fois ne peut que
  // répéter le même refus. On échoue donc IMMÉDIATEMENT avec la cause
  // exacte et la réparation guidée, au lieu de marteler le bucket et
  // d'accuser à tort la connexion du pasteur.
  if (session.r2Origin && session.corsEtat !== "ok") {
    const verdict = await sonderCorsR2(session.r2Origin);
    if (verdict === "bloque") {
      // Double contrôle avant de rendre un verdict CORS : si le serveur
      // d'upload ne répond PLUS non plus, c'est le réseau qui est tombé
      // (pas le CORS) → message réseau, réessai légitime.
      if (!(await serveurJoinable(endpoint))) {
        throw new Error(
          "Connexion perdue avec le serveur pendant la préparation de l'envoi — " +
            "vérifiez votre connexion puis cliquez sur « Réessayer l'envoi »."
        );
      }
      // Session ouverte pour rien → nettoyage immédiat (morceaux orphelins facturables).
      await appelMultipart(endpoint, { action: "abort", uploadId, key }, undefined, 1).catch(
        () => undefined
      );
      throw new ErreurCorsBucket(MESSAGE_CORS_BUCKET);
    }
  }

  // ─── ② Envoi SÉQUENTIEL des morceaux ─────────────────────────────────
  onPhase?.("envoi");
  const morceauxEnvoyes: { partNumber: number; etag: string }[] = [];
  let octetsTermines = 0;

  for (let partNumber = 1; partNumber <= partCount; partNumber++) {
    if (signalAnnulation?.aborted) {
      await appelMultipart(endpoint, { action: "abort", uploadId, key }, undefined, 1).catch(
        () => undefined
      );
      throw new ErreurEnvoiAnnule();
    }

    const debut = (partNumber - 1) * partSize;
    const fin = Math.min(debut + partSize, octetsTotal);
    const morceau = fichier.slice(debut, fin);

    let etag: string | null = null;
    let derniereErreur = "";

    for (let tentative = 1; tentative <= tentativesMax; tentative++) {
      try {
        // URL pré-signée FRAÎCHE à chaque tentative (jamais expirée).
        const { url } = await appelMultipart<{ url: string }>(
          endpoint,
          { action: "part", uploadId, key, partNumber },
          signalAnnulation
        );

        etag = await envoyerMorceau(
          morceau,
          url,
          5 * 60 * 1000, // 5 min par morceau (connexions lentes)
          (octetsMorceau) => {
            const total = octetsTermines + Math.min(octetsMorceau, morceau.size);
            onProgression?.(Math.round((total / octetsTotal) * 100), {
              partie: partNumber,
              total: partCount,
              tentatives: tentative,
            });
          },
          signalAnnulation
        );
        break; // morceau envoyé ✔
      } catch (err) {
        if (err instanceof ErreurEnvoiAnnule || err instanceof ErreurR2NonConfigure) {
          // Annulation utilisateur ou configuration cassée → abort + remonter.
          await appelMultipart(
            endpoint,
            { action: "abort", uploadId, key },
            undefined,
            1
          ).catch(() => undefined);
          throw err;
        }
        derniereErreur = err instanceof Error ? err.message : "erreur inconnue";
        if (tentative < tentativesMax) {
          onProgression?.(Math.round((octetsTermines / octetsTotal) * 100), {
            partie: partNumber,
            total: partCount,
            tentatives: tentative + 1,
          });
          await attendre(ATTENTE_REESSAI_MS[tentative - 1] ?? 3000, signalAnnulation);
        }
      }
    }

    if (!etag) {
      // Échec définitif du morceau → abort (nettoie les morceaux envoyés)
      // + erreur ACTIONNABLE (quel morceau, quelle cause, quoi faire).
      await appelMultipart(endpoint, { action: "abort", uploadId, key }, undefined, 1).catch(
        () => undefined
      );
      throw new Error(
        `Le morceau ${partNumber}/${partCount} n'a pas pu être envoyé après ${tentativesMax} tentatives ` +
          `(${derniereErreur}). Votre connexion semble instable — cliquez sur « Réessayer l'envoi » : ` +
          "l'envoi reprendra depuis le début du fichier, morceau par morceau."
      );
    }

    morceauxEnvoyes.push({ partNumber, etag });
    octetsTermines = fin;
    onProgression?.(Math.round((octetsTermines / octetsTotal) * 100), {
      partie: partNumber,
      total: partCount,
      tentatives: 1,
    });
  }

  // ─── ③ Assemblage final ──────────────────────────────────────────────
  onPhase?.("assemblage");
  try {
    await appelMultipart<{ publicUrl: string }>(
      endpoint,
      { action: "complete", uploadId, key, parts: morceauxEnvoyes },
      signalAnnulation
    );
  } catch (err) {
    if (err instanceof ErreurEnvoiAnnule) throw err;
    // complete a échoué → les morceaux orphelins sont déjà abortés côté
    // serveur (cf. multipart-shared) ; remonter l'erreur du serveur.
    throw err instanceof Error
      ? err
      : new Error("L'assemblage final du fichier sur R2 a échoué");
  }

  return { publicUrl };
}
