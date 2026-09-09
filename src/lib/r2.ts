import { S3Client, PutObjectCommand, DeleteObjectCommand, ListBucketsCommand, PutBucketCorsCommand, GetBucketCorsCommand, HeadObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 — Helper de stockage compatible S3.
 *
 * Variables d'environnement requises (à configurer sur Vercel) :
 * - R2_ACCOUNT_ID       : ID de compte Cloudflare (ex: a1b2c3d4e5f6...)
 * - R2_ACCESS_KEY_ID    : Access Key ID (créée via R2 → Manage R2 API Tokens)
 * - R2_SECRET_ACCESS_KEY: Secret Access Key
 * - R2_BUCKET_NAME      : Nom du bucket R2
 * - R2_PUBLIC_URL       : (optionnel) Domaine public personnalisé lié au bucket
 * - R2_PUBLIC_DEV_URL   : (optionnel) URL de développement public du bucket
 *                         (Dashboard Cloudflare → R2 → bucket → Settings →
 *                         Public Development URL — format pub-<hash>.r2.dev)
 *
 * ⭐ V3.25 — AVANT, le fallback construisait https://pub-<ACCOUNT_ID>.r2.dev/
 * qui est TOUJOURS invalide : le préfixe pub-… de l'URL r2.dev est un hash
 * PROPRE AU BUCKET (visible dans ses réglages), PAS l'ID de compte. Résultat :
 * les uploads réussissaient mais les fichiers étaient INACCESSIBLES (replays,
 * miniatures, vidéos jamais chargeables) — « l'upload R2 échoue ». Désormais :
 * R2_PUBLIC_URL (domaine custom) → R2_PUBLIC_DEV_URL (pub-<hash> réel) →
 * fallback historique conservé mais avec avertissement explicite + le
 * diagnostic /admin/r2-test teste la JOINISSABILITÉ de l'URL publique.
 *
 * ⚠️ Les variables sont lues au RUNTIME (pas au top-level) pour garantir
 * qu'elles sont fraîches même après un redéploiement Vercel.
 *
 * Docs : https://developers.cloudflare.com/r2/api/s3/api/
 */

function getConfig() {
  return {
    accountId: process.env.R2_ACCOUNT_ID || "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    bucket: process.env.R2_BUCKET_NAME || "",
    publicUrl: process.env.R2_PUBLIC_URL || "",
    publicDevUrl: process.env.R2_PUBLIC_DEV_URL || "",
  };
}

let s3Client: S3Client | null = null;

function getClient(): S3Client {
  if (s3Client) return s3Client;
  const cfg = getConfig();
  if (!cfg.accountId || !cfg.accessKeyId || !cfg.secretAccessKey || !cfg.bucket) {
    throw new Error(
      "Cloudflare R2 non configuré. Variables requises : R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME"
    );
  }
  s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    // R2 utilise virtual-hosted-style par défaut :
    // https://{bucket}.{accountId}.r2.cloudflarestorage.com
    // NE PAS mettre forcePathStyle: true (cause Access Denied sur R2)
    //
    // ⭐ V3.34/V3.35 — CHECKSUM : les uploads SERVEUR (intercession, replays
    // ≤ 4 Mo, rendu post-production) passent très bien AVEC ou SANS ces
    // options — le SDK y envoie lui-même le checksum du VRAI corps, la
    // signature correspond. Ces options sont conservées par cohérence avec
    // le client dédié au pré-signage (voir getPresignClient).
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return s3Client;
}

/**
 * ⭐ V3.35 — CLIENT DÉDIÉ AU PRÉ-SIGNAGE des URL d'upload navigateur.
 *
 * CAUSE RACINE CONFIRMÉE (empirique, test local SDK 3.1121) du « Upload R2
 * échoue : access denied » sur les replays de live : SANS l'option
 * requestChecksumCalculation="WHEN_REQUIRED", le SDK (≥ v3.729) ajoute
 * DEUX paramètres de query à l'URL pré-signée d'un PutObject :
 *
 *   x-amz-checksum-crc32=AAAAAA==      ← CRC32 du corps… VIDE (la commande
 *                                          n'a pas de Body au pré-signage)
 *   x-amz-sdk-checksum-algorithm=CRC32
 *
 * Ces paramètres font partie de la requête canonique signée (signature
 * valide !) — mais lorsque le NAVIGATEUR PUT ensuite le VRAI corps vidéo,
 * R2 valide le checksum déclaré (celui d'un corps vide) contre le corps
 * réel → mismatch → **403 AccessDenied systématique**.
 *
 * C'est pourquoi : les audios d'intercession s'enregistrent parfaitement
 * (upload 100 % serveur — le SDK envoie le checksum du vrai corps), tandis
 * que le replay du live (> 4 Mo, PUT navigateur direct) échouait TOUJOURS.
 *
 * Ce client est SÉPARÉ du client partagé : même si quelqu'un modifie
 * getClient() plus tard, le pré-signage restera propre. Un garde-fou
 * supplémentaire (voir getPresignedUploadUrl) vérifie l'URL générée.
 */
let presignClient: S3Client | null = null;

function getPresignClient(): S3Client {
  if (presignClient) return presignClient;
  const cfg = getConfig();
  if (!cfg.accountId || !cfg.accessKeyId || !cfg.secretAccessKey || !cfg.bucket) {
    throw new Error(
      "Cloudflare R2 non configuré. Variables requises : R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME"
    );
  }
  presignClient = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    // ⭐ V3.35 — OBLIGATOIRE pour les URL pré-signées utilisables par le
    // navigateur (voir commentaire de bloc ci-dessus). Contournement
    // documenté par Cloudflare pour R2 + AWS SDK ≥ v3.729.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return presignClient;
}

export function isR2Configured(): boolean {
  const cfg = getConfig();
  return !!(cfg.accountId && cfg.accessKeyId && cfg.secretAccessKey && cfg.bucket);
}

/**
 * Configure les règles CORS sur le bucket R2 pour autoriser les uploads
 * directs depuis le navigateur (presigned PUT).
 *
 * Sans cette configuration, les uploads presigned PUT depuis le navigateur
 * échouent avec "Failed to fetch" (erreur CORS bloquée par le navigateur).
 *
 * Cette fonction est idempotente — elle peut être appelée à chaque démarrage.
 * Elle ne fait rien si R2 n'est pas configuré.
 */
export async function ensureR2CorsConfig(): Promise<void> {
  if (!isR2Configured()) return;
  try {
    const client = getClient();
    const cfg = getConfig();
    await client.send(
      new PutBucketCorsCommand({
        Bucket: cfg.bucket,
        CORSConfiguration: reglesCorsR2(),
      })
    );
    console.log("[r2] CORS configuration applied successfully");
  } catch (error) {
    // ⭐ V3.52 — PutBucketCors exige une permission admin : refusé
    // (AccessDenied) pour un token « Object Read & Write » scoped au
    // bucket — ce n'est PAS bloquant en soi (la règle peut être posée via
    // le Dashboard ou un token temporaire).
    // ⭐ V3.55 — CONSTATÉ EN PRODUCTION : le bucket N'A JAMAIS eu de règle
    // CORS (R2 répond « CORS not configured for this bucket » au preflight)
    // → TOUT PUT navigateur était rejeté d'office et les 3 tentatives du
    // client martelaient un refus déterministe. Réparation guidée :
    // /admin/r2-test → section « CORS du bucket ».
    if (estAccesRefuse(error)) {
      console.warn(
        "[r2] PutBucketCors refusé (AccessDenied) — normal pour un token scoped Object Read & Write. " +
          "Si les PUT navigateur échouent, appliquez la règle CORS via /admin/r2-test (section « CORS du bucket ») " +
          "ou le Dashboard Cloudflare (R2 → bucket → Settings → CORS Policy)."
      );
      return;
    }
    console.error("[r2] Failed to apply CORS configuration:", error);
  }
}

/** ⭐ V3.55 — Origine (virtual-hosted) du bucket R2, celle des URL pré-signées.
 * Le navigateur envoie ses PUT de morceaux vers https://{bucket}.{account}.r2.cloudflarestorage.com —
 * c'est CETTE origine que la sonde CORS du client doit interroger. */
export function getR2Origin(): string {
  const cfg = getConfig();
  if (!cfg.accountId || !cfg.bucket) return "";
  return `https://${cfg.bucket}.${cfg.accountId}.r2.cloudflarestorage.com`;
}

/**
 * ⭐ V3.55 — Règle CORS UNIQUE et centralisée du bucket (plus de « * » éparpillé).
 *
 * Origines : UNIQUEMENT la plateforme (site public, apex, back-office, dev
 * local) — pas de joker : un site tiers ne peut pas réutiliser une URL
 * pré-signée fuïtée depuis son propre domaine.
 * PUT = UploadPart (morceaux) ; GET/HEAD = diagnostics navigateur.
 * ETag exposé = INDISPENSABLE : chaque morceau renvoie son ETag, sans lui
 * l'assemblage final (complete) est impossible.
 * MaxAge 3600 = le preflight OPTIONS n'est refait qu'une fois par heure.
 */
export function reglesCorsR2() {
  return {
    CORSRules: [
      {
        AllowedOrigins: [
          "https://www.mouvementchristlibere.com",
          "https://mouvementchristlibere.com",
          "https://admin.mouvementchristlibere.com",
          "http://localhost:3000",
        ],
        AllowedMethods: ["PUT", "GET", "HEAD"],
        AllowedHeaders: ["*"],
        ExposeHeaders: ["ETag", "x-amz-request-id"],
        MaxAgeSeconds: 3600,
      },
    ],
  };
}

/**
 * ⭐ V3.56 — Même règle, au format JSON à COLLER dans le Dashboard Cloudflare
 * (R2 → bucket → Settings → CORS Policy → onglet JSON).
 *
 * CONSTAT 2026-09-09 (retour pasteur) : l'éditeur « CORS Policy » du Dashboard
 * R2 n'accepte PLUS le XML S3 — coller du XML renvoie « This policy is not
 * valid » ; la doc officielle (developers.cloudflare.com/r2/buckets/cors,
 * màj 2026-07) ne documente plus QUE le JSON pour le Dashboard (onglet JSON,
 * tableau de règles). Le XML reste le format de l'API S3 (PutBucketCors) :
 * c'est ce que construit le SDK pour l'option B (token temporaire) à partir
 * de reglesCorsR2() — inchangée.
 */
export function reglesCorsR2Json(): string {
  return JSON.stringify(reglesCorsR2().CORSRules, null, 2);
}

export type EtatCorsR2 = "ok" | "absent" | "inverifiable";

/** ⭐ V3.57 — Verdict du preflight CORS testé DEPUIS LE SERVEUR. */
export type VerdictPreflightR2 = "ok" | "absent" | "inconnu";

/**
 * ⭐ V3.57 — Sonde le preflight CORS du bucket DEPUIS LE SERVEUR (autorité).
 *
 * POURQUOI (établi en production le 2026-09-09) : R2 rejette toute requête
 * NON SIGNÉE par un 400 « InvalidArgument / Authorization » SANS joindre les
 * en-têtes CORS (rejet AVANT l'évaluation CORS) → dans un navigateur, une
 * requête non signée vers le bucket échoue TOUJOURS (fetch → TypeError),
 * même quand la règle CORS est parfaitement appliquée. L'ancienne sonde
 * cliente (PUT non signé vers l'origine du bucket) produisait donc un
 * verdict « bloqué » PERPÉTUEL — y compris après la réparation du pasteur
 * (règle appliquée et vérifiée : preflight 204, PUT signés 200 + ETag exposé).
 *
 * Le SERVEUR, lui, sait distinguer : il envoie le preflight OPTIONS (avec
 * Origin + Access-Control-Request-Method) et lit la réponse BRUTE :
 *   • 2xx + Access-Control-Allow-Origin → "ok"   (la règle couvre l'origine)
 *   • 403 (sans ACAO)                    → "absent" (pas de règle, ou origine non couverte)
 *   • réseau injoignable / imprévu       → "inconnu" (le client tranche sur échec réel)
 *
 * @param origine Origine EXACTE du navigateur qui va envoyer les morceaux
 *                (en-tête Origin de la requête create) — c'est ELLE que la
 *                règle du bucket doit couvrir.
 */
export async function sonderPreflightCorsR2(origine: string): Promise<VerdictPreflightR2> {
  const cible = getR2Origin();
  if (!cible || !origine) return "inconnu";
  try {
    const res = await fetch(`${cible}/test/sonde-preflight.txt`, {
      method: "OPTIONS",
      headers: {
        Origin: origine,
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "content-type",
      },
      // 5 s max : le preflight est léger, pas de raison de bloquer create.
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok && res.headers.get("access-control-allow-origin")) return "ok";
    if (res.status === 403) return "absent";
    return "inconnu";
  } catch {
    return "inconnu";
  }
}

/**
 * ⭐ V3.55 — Lit l'état CORS RÉEL du bucket (GetBucketCors) avec le token de
 * l'application. Best-effort : un token « Object Read & Write » scoped est
 * refusé sur les opérations de configuration du bucket (AccessDenied) →
 * « inverifiable » — dans ce cas c'est le NAVIGATEUR qui sonde le preflight
 * (autorité finale, puisque c'est lui qui envoie les PUT).
 *
 * Établi en production le 2026-09-09 : le bucket « christ-libere » répond
 * « CORS not configured for this bucket » → etat = "absent".
 */
export async function lireCorsBucketR2(): Promise<{
  etat: EtatCorsR2;
  regles?: { origins: string[]; methods: string[] }[];
  detail?: string;
}> {
  const cfg = getConfig();
  if (!isR2Configured()) return { etat: "inverifiable", detail: "R2 non configuré" };
  try {
    const client = getClient();
    const res = await client.send(new GetBucketCorsCommand({ Bucket: cfg.bucket }));
    const regles = (res.CORSRules ?? []).map((r) => ({
      origins: (r.AllowedOrigins ?? []) as string[],
      methods: (r.AllowedMethods ?? []) as string[],
    }));
    return {
      etat: regles.length > 0 ? "ok" : "absent",
      regles,
    };
  } catch (error) {
    if (estAccesRefuse(error)) {
      return {
        etat: "inverifiable",
        detail:
          "Le token de l'application (Object Read & Write) ne peut pas lire la configuration du bucket — vérification faite par le navigateur lui-même.",
      };
    }
    const code = extractErrorCode(error);
    // NoSuchCORSConfiguration (sémantique S3) → jamais configuré.
    if (/NoSuchCORS/i.test(code)) return { etat: "absent" };
    return { etat: "inverifiable", detail: code };
  }
}

/**
 * ⭐ V3.55 — Applique la règle CORS du bucket avec des identifiants
 * TEMPORAIRES fournis par l'administrateur (token Cloudflare « Admin Read &
 * Write »), puis relit la règle pour VÉRIFIER. Les identifiants transitent
 * une seule fois en mémoire (HTTPS) — jamais stockés, jamais journalisés,
 * et le token temporaire est à supprimer dans Cloudflare juste après.
 *
 * C'est la seule façon pour l'APPLICATION de réparer le CORS : le token de
 * prod (Object Read & Write) est structurellement privé de PutBucketCors.
 */
export async function appliquerCorsR2AvecIdentifiants(
  accessKeyId: string,
  secretAccessKey: string
): Promise<{ success: boolean; message: string; origins?: string[] }> {
  const cfg = getConfig();
  if (!cfg.accountId || !cfg.bucket) {
    return { success: false, message: "R2_ACCOUNT_ID / R2_BUCKET_NAME manquants sur le serveur." };
  }
  // Client S3 ÉPHÉMÈRE monté sur les identifiants fournis (pas ceux de prod).
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  try {
    await client.send(
      new PutBucketCorsCommand({
        Bucket: cfg.bucket,
        CORSConfiguration: reglesCorsR2(),
      })
    );
    // Vérification immédiate avec les MÊMES identifiants.
    const res = await client.send(new GetBucketCorsCommand({ Bucket: cfg.bucket }));
    const origins = (res.CORSRules?.[0]?.AllowedOrigins ?? []) as string[];
    return {
      success: true,
      origins,
      message:
        "Règle CORS appliquée et vérifiée sur le bucket « " +
        cfg.bucket +
        " » — les envois du navigateur vers le stockage cloud sont désormais acceptés. " +
        "Supprimez MAINTENANT le token temporaire dans Cloudflare (R2 → Manage R2 API Tokens), puis relancez le test navigateur.",
    };
  } catch (error) {
    // ⚠️ Ne JAMAIS inclure les identifiants dans le message d'erreur.
    if (estAccesRefuse(error)) {
      return {
        success: false,
        message:
          "Ce token n'a pas la permission de modifier le bucket (AccessDenied) — il faut un token avec la permission « Admin Read & Write » (créé au niveau du compte ou scoped au bucket « " +
          cfg.bucket +
          " » avec cette permission).",
      };
    }
    if (error instanceof Error && /credentials|signature|sign/i.test(error.message)) {
      return {
        success: false,
        message:
          "Identifiants invalides (SignatureDoesNotMatch / InvalidAccessKeyId) — revérifiez l'Access Key ID et le Secret Access Key copiés dans Cloudflare.",
      };
    }
    return {
      success: false,
      message:
        "Échec : " +
        (extractErrorCode(error) || (error instanceof Error ? error.message : "erreur inconnue")),
    };
  }
}

/**
 * Construit l'URL publique d'un key R2.
 * Ordre : R2_PUBLIC_URL (domaine custom/CDN) → R2_PUBLIC_DEV_URL
 * (pub-<hash>.r2.dev du bucket) → fallback historique + avertissement.
 */
export function getPublicUrl(key: string): string {
  const cfg = getConfig();
  if (cfg.publicUrl) {
    return `${cfg.publicUrl.replace(/\/$/, "")}/${key}`;
  }
  if (cfg.publicDevUrl) {
    return `${cfg.publicDevUrl.replace(/\/$/, "")}/${key}`;
  }
  // ⭐ V3.25 — Fallback historique INVALIDE en règle générale : le préfixe
  // pub-<accountId> n'est PAS le hash r2.dev du bucket. On le conserve pour
  // ne casser aucun déploiement existant, mais on alerte dans les logs.
  console.warn(
    "[r2] Ni R2_PUBLIC_URL ni R2_PUBLIC_DEV_URL ne sont définis — l'URL publique " +
    "est construite sur le format pub-<accountId>.r2.dev, probablement INVALIDE. " +
    "Configurez R2_PUBLIC_URL (domaine custom) ou R2_PUBLIC_DEV_URL " +
    "(Public Development URL du bucket, Dashboard Cloudflare → R2 → Settings)."
  );
  return `https://pub-${cfg.accountId}.r2.dev/${key}`;
}

/**
 * Upload un fichier vers R2 et retourne l'URL publique.
 */
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const client = getClient();
  const cfg = getConfig();
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return getPublicUrl(key);
}

/**
 * Supprime un fichier de R2.
 */
export async function deleteFromR2(key: string): Promise<void> {
  const client = getClient();
  const cfg = getConfig();
  await client.send(
    new DeleteObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
    })
  );
}

/**
 * Extrait le key R2 depuis une URL publique.
 */
export function extractKeyFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 1) {
      return parts.join("/");
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Génère un key unique pour un upload.
 */
export function generateKey(prefix: string, id: string, ext: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}/${id}-${timestamp}-${random}.${ext}`;
}

/**
 * Détecte les paramètres de checksum dans une URL pré-signée — un PUT
 * navigateur vers une telle URL est REJETÉ par R2 (403 AccessDenied, cf.
 * getPresignClient). Retourne la liste des paramètres fautifs.
 */
function parametresChecksum(url: string): string[] {
  try {
    return [...new URL(url).searchParams.keys()].filter((k) =>
      /x-amz-(sdk-)?checksum/i.test(k)
    );
  } catch {
    return [];
  }
}

/**
 * Génère une URL pré-signée pour upload direct depuis le navigateur vers R2.
 *
 * ⭐ V3.35 — GARDE-FOU : après génération, on VÉRIFIE que l'URL ne contient
 * aucun paramètre checksum (x-amz-checksum-*, x-amz-sdk-checksum-*). Si le
 * SDK (montée de version future, autre chemin de code) en produisait une,
 * on régénère avec un client éphémère configuré WHEN_REQUIRED ; si elle
 * restait polluée, on REFUSE de la délivrer (erreur explicite) plutôt que
 * de laisser le navigateur échouer avec un 403 « access denied » opaque.
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<string> {
  const cfg = getConfig();
  const client = getPresignClient();
  const command = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: key,
    ContentType: contentType,
  });
  let url = await getSignedUrl(client, command, { expiresIn });

  const suspects = parametresChecksum(url);
  if (suspects.length > 0) {
    console.error(
      `[r2] ⚠️ URL pré-signée polluée par des paramètres checksum (${suspects.join(
        ", "
      )}) — régénération avec un client éphémère WHEN_REQUIRED…`
    );
    const secours = new S3Client({
      region: "auto",
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
    try {
      const cmdSecours = new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        ContentType: contentType,
      });
      url = await getSignedUrl(secours, cmdSecours, { expiresIn });
    } finally {
      secours.destroy();
    }
    const suspectsRestants = parametresChecksum(url);
    if (suspectsRestants.length > 0) {
      throw new Error(
        `URL pré-signée R2 inutilisable : le SDK AWS y inclut des paramètres checksum (${suspectsRestants.join(
          ", "
        )}) que le navigateur ne peut pas satisfaire. Signalez cette erreur — le comportement du SDK AWS a changé.`
      );
    }
  }
  return url;
}

/**
 * Liste tous les buckets R2 accessibles avec les credentials actuels.
 */
export async function listBucketsR2(): Promise<{ name: string; creationDate?: string }[]> {
  const client = getClient();
  const response = await client.send(new ListBucketsCommand({}));
  return (response.Buckets || []).map((b) => ({
    name: b.Name || "",
    creationDate: b.CreationDate?.toISOString(),
  }));
}

// ═══════════════════════════════════════════════════════════════════════
// ⭐ V3.51 — UPLOAD MULTIPART SÉQUENTIEL (morceau par morceau)
//
// Le PUT monolithique (fichier ENTIER en une seule requête) échoue sur les
// connexions lentes/instables : un hoquet réseau à 95 % tuait tout l'envoi
// et repartait de zéro. R2 supporte l'API S3 multipart :
//   1. CreateMultipartUpload  → uploadId
//   2. UploadPart × N         → chaque morceau (~8 Mo) via URL pré-signée
//                               FRAÎCHE, envoyé SÉQUENTIELLEMENT, avec
//                               reprise par morceau en cas d'échec
//   3. CompleteMultipartUpload→ R2 assemble les morceaux → objet final
//   4. AbortMultipartUpload   → nettoyage (sinon les morceaux orphelins
//                               restent facturables sur le bucket !)
//
// Le même garde-fou anti-checksum que getPresignedUploadUrl s'applique aux
// URL de morceaux (UploadPart pré-signé) : un x-amz-checksum-* dans l'URL
// serait validé par R2 contre le corps réel → 403 systématique.
// ═══════════════════════════════════════════════════════════════════════

/** Morceau assemblé : numéro + ETag renvoyé par R2 à la réception du PUT. */
export interface MorceauR2 {
  partNumber: number;
  etag: string;
}

/**
 * Ouvre une session d'upload multipart sur R2. Retourne l'uploadId.
 * Le ContentType est posé ici (l'objet final le portera après assemblage).
 */
export async function creerMultipartR2(
  key: string,
  contentType: string
): Promise<string> {
  const client = getClient();
  const cfg = getConfig();
  const res = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: cfg.bucket,
      Key: key,
      ContentType: contentType,
    })
  );
  if (!res.UploadId) {
    throw new Error("R2 n'a pas renvoyé d'uploadId pour l'upload multipart");
  }
  return res.UploadId;
}

/**
 * URL pré-signée pour uploader UN morceau (UploadPart) directement depuis
 * le navigateur. Générée À LA DEMANDE (toujours fraîche — aucune expiration
 * possible sur les uploads longs) via le client de pré-signage dédié
 * WHEN_REQUIRED + garde-fou checksum (cf. getPresignClient).
 */
export async function getPresignedPartUrl(
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn = 3600
): Promise<string> {
  const cfg = getConfig();
  const client = getPresignClient();
  const command = new UploadPartCommand({
    Bucket: cfg.bucket,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  let url = await getSignedUrl(client, command, { expiresIn });

  const suspects = parametresChecksum(url);
  if (suspects.length > 0) {
    console.error(
      `[r2] ⚠️ URL de morceau polluée par des paramètres checksum (${suspects.join(", ")}) — régénération…`
    );
    const secours = new S3Client({
      region: "auto",
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
    try {
      const cmdSecours = new UploadPartCommand({
        Bucket: cfg.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      });
      url = await getSignedUrl(secours, cmdSecours, { expiresIn });
    } finally {
      secours.destroy();
    }
    const restants = parametresChecksum(url);
    if (restants.length > 0) {
      throw new Error(
        `URL de morceau R2 inutilisable : paramètres checksum (${restants.join(", ")}) injectés par le SDK AWS. Signalez cette erreur.`
      );
    }
  }
  return url;
}

/**
 * Demande à R2 d'assembler les morceaux en l'objet final.
 * `morceaux` doit être ordonné par partNumber croissant avec les ETag EXACTS
 * renvoyés par R2 (reçus par le navigateur dans l'en-tête ETag de chaque PUT).
 */
export async function completerMultipartR2(
  key: string,
  uploadId: string,
  morceaux: MorceauR2[]
): Promise<void> {
  const client = getClient();
  const cfg = getConfig();
  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: cfg.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: morceaux.map((m) => ({
          PartNumber: m.partNumber,
          ETag: m.etag,
        })),
      },
    })
  );
}

/**
 * Annule une session multipart (best-effort). IMPORTANT : sans abort, les
 * morceaux déjà envoyés restent stockés sur R2 (facturables) jusqu'à ~7 j.
 */
export async function annulerMultipartR2(
  key: string,
  uploadId: string
): Promise<void> {
  try {
    const client = getClient();
    const cfg = getConfig();
    await client.send(
      new AbortMultipartUploadCommand({
        Bucket: cfg.bucket,
        Key: key,
        UploadId: uploadId,
      })
    );
  } catch (err) {
    // Best-effort : l'échec de l'abort ne doit jamais masquer l'erreur
    // d'origine ni bloquer l'utilisateur.
    console.warn("[r2] Abort multipart impossible (best-effort) :", err);
  }
}

/**
 * Diagnostic complet R2 — teste credentials, bucket existence, permissions
 * écriture ET (⭐ V3.25) l'ACCESSIBILITÉ de l'URL publique du fichier test.
 */
export async function diagnoseR2(): Promise<{
  credentialsValid: boolean;
  bucketsAccessible: string[];
  bucketExists: boolean;
  /** ⭐ V3.52 — le token peut-il LIRE le bucket (HeadObject, clé factice) ? */
  canRead?: boolean;
  /** ⭐ V3.52 — code d'erreur renvoyé par la sonde de lecture. */
  readErrorCode?: string;
  canWrite: boolean;
  /** ⭐ V3.52 — CreateMultipartUpload (upload vidéo séquentiel V3.51) OK ? */
  canMultipart?: boolean;
  /** URL publique du fichier test (remplie si l'upload a réussi). */
  publicUrl?: string;
  /** ⭐ V3.25 — true si l'URL publique répond (HEAD 2xx). */
  publicUrlOk?: boolean;
  error?: string;
  errorCode?: string;
  details: string[];
}> {
  const cfg = getConfig();
  const details: string[] = [];
  const result = {
    credentialsValid: false,
    bucketsAccessible: [] as string[],
    bucketExists: false,
    canRead: undefined as boolean | undefined,
    readErrorCode: undefined as string | undefined,
    canWrite: false,
    canMultipart: undefined as boolean | undefined,
    publicUrl: undefined as string | undefined,
    publicUrlOk: undefined as boolean | undefined,
    error: undefined as string | undefined,
    errorCode: undefined as string | undefined,
    details,
  };

  if (!isR2Configured()) {
    result.error = "R2 non configuré — variables d'environnement manquantes";
    details.push("Variables requises : R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME");
    details.push(`Valeurs actuelles : accountId=${cfg.accountId ? "✓" : "✗"}, accessKeyId=${cfg.accessKeyId ? "✓" : "✗"}, secretAccessKey=${cfg.secretAccessKey ? "✓" : "✗"}, bucket=${cfg.bucket ? "✓" : "✗"}`);
    return result;
  }

  details.push(`Account ID : ${cfg.accountId.substring(0, 8)}...`);
  details.push(`Bucket configuré : ${cfg.bucket}`);
  details.push(`Endpoint : https://${cfg.accountId}.r2.cloudflarestorage.com`);
  details.push(`URL d'upload : https://${cfg.bucket}.${cfg.accountId}.r2.cloudflarestorage.com/{key}`);
  details.push(`Style : virtual-hosted (par défaut R2 — ne pas utiliser forcePathStyle)`);

  // ─── Test 1 : ListBuckets (vérifie les credentials globalement) ───
  // Note : Un token R2 scoped à un bucket spécifique n'a PAS la permission
  // ListBuckets (qui nécessite "Admin Read & Write"). Si ListBuckets échoue
  // avec AccessDenied, on ne s'arrête pas — on teste l'upload quand même.
  try {
    const buckets = await listBucketsR2();
    result.credentialsValid = true;
    result.bucketsAccessible = buckets.map((b) => b.name);
    details.push(`✓ Credentials valides — ${buckets.length} bucket(s) accessible(s) : ${buckets.map((b) => b.name).join(", ") || "(aucun)"}`);

    result.bucketExists = buckets.some((b) => b.name === cfg.bucket);
    if (!result.bucketExists) {
      details.push(`⚠ Le bucket "${cfg.bucket}" n'apparaît pas dans la liste (peut être normal si le token est scoped)`);
    } else {
      details.push(`✓ Bucket "${cfg.bucket}" trouvé dans la liste`);
    }
  } catch (err) {
    const code = extractErrorCode(err);
    const msg = err instanceof Error ? err.message : "Erreur ListBuckets";
    if (code === "AccessDenied" || code === "HTTP 403") {
      // AccessDenied sur ListBuckets = token scoped à un bucket (normal)
      details.push(`⚠ ListBuckets refusé (AccessDenied) — token probablement scoped au bucket "${cfg.bucket}"`);
      details.push("  → Ce n'est PAS un problème : les tokens scoped n'ont pas la permission ListBuckets");
      details.push("  → Test de l'upload en cours...");
      result.credentialsValid = true; // On suppose que les credentials sont OK, on le confirmera avec l'upload
      result.bucketExists = true; // On suppose que le bucket existe, on le confirmera avec l'upload
    } else {
      // Autre erreur = credentials vraiment invalides
      result.error = msg;
      result.errorCode = code;
      details.push(`✗ Échec ListBuckets : ${msg} (code: ${code})`);
      details.push("  → Vérifiez R2_ACCESS_KEY_ID et R2_SECRET_ACCESS_KEY (copier-coller sans espaces)");
      details.push("  → Vérifiez que R2_ACCOUNT_ID est correct (ID du compte Cloudflare, pas du bucket)");
      return result;
    }
  }

  // ─── Test 1bis (⭐ V3.52) : sonde de LECTURE (HeadObject, clé factice) ───
  // 404 (NotFound/NoSuchKey) = le token a le droit de LIRE ce bucket
  // (portée correcte) ; 403 = il ne peut même pas lire → portée erronée
  // (autre bucket) ou token expiré/révoqué. C'est CE QUI DISTINGUE :
  //   - lecture OK + écriture refusée → permission « Object Read only »
  //     → éditer le token → « Object Read & Write »
  //   - lecture ET écriture refusées → portée/expiry → recréer le token
  try {
    await getClient().send(
      new HeadObjectCommand({
        Bucket: cfg.bucket,
        Key: `test/sonde-lecture-${Date.now()}.txt`,
      })
    );
    // Objet existant (improbable) → lecture OK de toute façon.
    result.canRead = true;
    details.push("✓ Sonde lecture : le token peut lire le bucket (HeadObject OK)");
  } catch (err) {
    const code = extractErrorCode(err);
    result.readErrorCode = code;
    if (code === "NoSuchKey" || code === "NotFound" || code === "HTTP 404") {
      result.canRead = true;
      details.push(
        "✓ Sonde lecture : le token peut lire le bucket (404 = clé absente mais lecture autorisée)"
      );
    } else {
      result.canRead = false;
      details.push(`✗ Sonde lecture refusée : ${code}`);
      details.push(
        "  → Le token ne peut même pas LIRE ce bucket : portée erronée (autre bucket ?) ou token expiré/révoqué."
      );
    }
  }

  // ─── Test 2 : Upload test (vérifie les permissions d'écriture sur le bucket) ───
  const testKey = `test/diagnostic-${Date.now()}.txt`;
  try {
    const testBuffer = Buffer.from(`R2 diagnostic ${new Date().toISOString()}`, "utf-8");
    await uploadToR2(testKey, testBuffer, "text/plain");
    result.canWrite = true;
    details.push("✓ Upload test réussi — permissions d'écriture OK sur le bucket");
  } catch (err) {
    const code = extractErrorCode(err);
    const msg = err instanceof Error ? err.message : "Erreur upload";
    result.error = msg;
    result.errorCode = code;
    details.push(`✗ Échec upload : ${msg} (code: ${code})`);

    // Messages spécifiques selon le code d'erreur
    if (code === "AccessDenied" || code === "HTTP 403") {
      details.push("  → ⭐ V3.52 — CAUSE CONFIRMÉE : le token n'a pas (ou plus) la permission d'écrire dans ce bucket.");
      if (result.canRead === true) {
        details.push("  → Le token PEUT lire mais PAS écrire → sa permission est probablement « Object Read only ».");
        details.push("  → RÉPARATION : Dashboard Cloudflare → R2 → Manage R2 API Tokens → éditer le token → permission « Object Read & Write » sur le bucket « " + cfg.bucket + " ».");
      } else {
        details.push("  → Le token ne peut NI lire NI écrire → portée erronée (token scoped à un autre bucket) ou token expiré/révoqué.");
        details.push("  → RÉPARATION : Dashboard Cloudflare → R2 → Manage R2 API Tokens → créer un NOUVEAU token (Object Read & Write, bucket « " + cfg.bucket + " ») → copier Access Key ID + Secret → Vercel → Settings → Environment Variables → mettre à jour R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY → Redeploy.");
      }
      details.push("  → Vérifier AUSSI dans le Dashboard Cloudflare (R2) qu'aucune alerte de facturation ne bloque les écritures (free tier 10 Go dépassé sans moyen de paiement).");
      details.push("  → Après réparation : revenir sur /admin/r2-test et relancer le test (« Permission écriture » doit passer à ✓).");
    } else if (code === "NoSuchBucket") {
      details.push(`  → Le bucket "${cfg.bucket}" n'existe pas sur ce compte R2`);
      details.push("  → Vérifiez R2_BUCKET_NAME (sensible à la casse)");
    } else if (code === "InvalidAccessKeyId") {
      details.push("  → R2_ACCESS_KEY_ID invalide");
    } else if (code === "SignatureDoesNotMatch") {
      details.push("  → R2_SECRET_ACCESS_KEY invalide (la signature ne correspond pas)");
    }
  }

  // ─── Test 2bis (⭐ V3.52) : sonde MULTIPART (l'upload vidéo V3.51) ───
  // CreateMultipartUpload + Abort immédiat : exactement l'opération qui
  // échouait dans le modal « Nouvelle vidéo » (« Création de la session
  // d'upload impossible : Access Denied »). Confirmée OK = tout le flux
  // vidéo pourra ouvrir ses sessions.
  if (result.canWrite) {
    const multipartKey = `test/sonde-multipart-${Date.now()}.bin`;
    try {
      const uploadId = await creerMultipartR2(multipartKey, "application/octet-stream");
      await annulerMultipartR2(multipartKey, uploadId); // nettoyage immédiat
      result.canMultipart = true;
      details.push("✓ Sonde multipart : CreateMultipartUpload + Abort OK — l'upload vidéo séquentiel peut ouvrir ses sessions");
    } catch (err) {
      const code = extractErrorCode(err);
      result.canMultipart = false;
      details.push(`✗ Sonde multipart refusée : ${err instanceof Error ? err.message : code}`);
      details.push("  → L'upload vidéo par morceaux échouera tant que ce n'est pas réparé (voir réparations ci-dessus).");
    }
  }

  // ─── Test 3 (⭐ V3.25) : l'URL publique est-elle RÉELLEMENT accessible ? ───
  // Un upload réussi + une URL publique cassée = « l'upload échoue » pour
  // l'utilisateur (le replay/la miniature/la vidéo ne charge jamais). On
  // vérifie donc que le fichier test est bien servi par son URL publique.
  if (result.canWrite) {
    const publicUrl = getPublicUrl(testKey);
    result.publicUrl = publicUrl;
    try {
      const res = await fetch(publicUrl, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        result.publicUrlOk = true;
        details.push(`✓ URL publique ACCESSIBLE : ${publicUrl}`);
      } else {
        result.publicUrlOk = false;
        details.push(`✗ URL publique INACCESSIBLE (HTTP ${res.status}) : ${publicUrl}`);
        details.push("  → L'upload fonctionne mais les fichiers ne sont PAS servis : replays/miniatures/vidéos ne chargeront jamais.");
        if (!cfg.publicUrl && !cfg.publicDevUrl) {
          details.push("  → CAUSE PROBABLE : ni R2_PUBLIC_URL ni R2_PUBLIC_DEV_URL définis — l'URL pub-<accountId>.r2.dev construite est INVALIDE (le préfixe r2.dev est un hash propre au bucket, PAS l'ID de compte).");
          details.push("  → CORRECTION : Dashboard Cloudflare → R2 → votre bucket → Settings → Public access → activez « Public Development URL » puis copiez-la dans la variable R2_PUBLIC_DEV_URL (ou liez un domaine custom → R2_PUBLIC_URL).");
        } else {
          details.push("  → CORRECTION : vérifiez que l'URL publique configurée correspond bien à CE bucket et que l'accès public y est activé.");
        }
      }
    } catch (err) {
      result.publicUrlOk = false;
      details.push(`✗ URL publique INJOIGNABLE (${err instanceof Error ? err.message : "erreur réseau"}) : ${publicUrl}`);
      details.push("  → DNS/réseau : l'URL publique ne résout pas ou n'existe pas — vérifiez R2_PUBLIC_URL / R2_PUBLIC_DEV_URL.");
    }
  }

  return result;
}

/**
 * ⭐ V3.52 — Détecte une erreur R2/S3 de refus d'autorisation (403).
 *
 * EMPIRIQUEMENT CONFIRMÉ en production (V3.52) : le token R2 configuré
 * n'a PAS (ou plus) la permission d'ÉCRIRE dans le bucket — PutObject
 * (test serveur), CreateMultipartUpload (upload vidéo V3.51) et le PUT
 * pré-signé navigateur renvoient TOUS « 403 AccessDenied » alors que la
 * signature est valide (sinon : SignatureDoesNotMatch/InvalidAccessKeyId).
 * Ce n'est donc PAS un bug de code (la requête du SDK 3.1121.0 a été
 * capturée : elle est PROPRE, aucun paramètre checksum — contrairement au
 * bug V3.35) : la réparation se fait dans le Cloudflare Dashboard du
 * pasteur (permission du token), pas dans le code.
 */
export function estAccesRefuse(err: unknown): boolean {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (e.name === "AccessDenied" || e.Code === "AccessDenied") return true;
    const metadata = e.$metadata as Record<string, number> | undefined;
    if (metadata?.httpStatusCode === 403) return true;
  }
  return false;
}

/**
 * Extrait le code d'erreur d'une erreur AWS SDK.
 */
function extractErrorCode(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const metadata = e.$metadata as Record<string, number> | undefined;
    // ⭐ V3.52 — R2 ne renvoie PAS de corps d'erreur sur les requêtes HEAD
    // (sémantique S3) → le SDK synthétise name="Unknown"/message=
    // "UnknownError" et le VRAI statut (403/404) n'est que dans
    // $metadata.httpStatusCode — le remonter au lieu de « Unknown ».
    if ((e.name === "Unknown" || e.name === "UnknownError") && metadata?.httpStatusCode) {
      return `HTTP ${metadata.httpStatusCode}`;
    }
    if (e.name) return String(e.name);
    if (e.Code) return String(e.Code);
    if (metadata?.httpStatusCode) return `HTTP ${metadata.httpStatusCode}`;
  }
  return "Unknown";
}
