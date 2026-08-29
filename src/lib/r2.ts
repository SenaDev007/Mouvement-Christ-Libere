import { S3Client, PutObjectCommand, DeleteObjectCommand, ListBucketsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 — Helper de stockage compatible S3.
 *
 * Variables d'environnement requises :
 * - R2_ACCOUNT_ID       : ID de compte Cloudflare (ex: a1b2c3d4e5f6...)
 * - R2_ACCESS_KEY_ID    : Access Key ID (créée via R2 → Manage R2 API Tokens)
 * - R2_SECRET_ACCESS_KEY: Secret Access Key
 * - R2_BUCKET_NAME      : Nom du bucket R2
 * - R2_PUBLIC_URL       : (optionnel) Domaine public personnalisé lié au bucket
 *                         ex: https://cdn.mouvementchristlibere.org
 *                         Si non défini, utilise l'URL de dev R2.
 *
 * Docs : https://developers.cloudflare.com/r2/api/s3/api/
 *
 * Avantages R2 vs B2 :
 * - Zéro frais de transfert sortant (egress gratuit)
 * - Intégration native Cloudflare (CDN, Cache Rules)
 * - Compatible S3 API
 */

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET = process.env.R2_BUCKET_NAME || "";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ""; // optionnel : domaine custom

let s3Client: S3Client | null = null;

function getClient(): S3Client {
  if (s3Client) return s3Client;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error(
      "Cloudflare R2 non configuré. Variables requises : R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME"
    );
  }
  s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  return s3Client;
}

export function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET);
}

/**
 * Construit l'URL publique d'un key R2.
 * - Si R2_PUBLIC_URL est défini : utilise le domaine custom (CDN)
 * - Sinon : utilise l'URL de dev R2 (public-dev URL à activer sur le bucket)
 */
export function getPublicUrl(key: string): string {
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  }
  // Fallback : URL publique de dev R2 (r2.dev)
  return `https://pub-${R2_ACCOUNT_ID}.r2.dev/${key}`;
}

/**
 * Upload un fichier vers R2 et retourne l'URL publique.
 *
 * @param key   Chemin dans le bucket (ex: "replays/live-abc123.webm")
 * @param body  Buffer ou Uint8Array
 * @param contentType  MIME type
 * @returns URL publique du fichier
 */
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
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
  await client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
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
    // Format custom domain: https://cdn.domain.com/{key}
    // Format r2.dev: https://pub-{accountId}.r2.dev/{key}
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
 * Génère une URL pré-signée pour upload direct depuis le navigateur vers R2.
 * Permet d'uploader de gros fichiers (> 4.5MB) sans passer par le body Vercel.
 *
 * @param key          Chemin dans le bucket
 * @param contentType  MIME type attendu
 * @param expiresIn    Durée de validité (défaut: 1h)
 * @returns URL pré-signée PUT
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<string> {
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Liste tous les buckets R2 accessibles avec les credentials actuels.
 * Utile pour vérifier que les credentials sont valides (indépendamment des
 * permissions d'écriture sur un bucket spécifique).
 */
export async function listBucketsR2(): Promise<{ name: string; creationDate?: string }[]> {
  const client = getClient();
  const response = await client.send(new ListBucketsCommand({}));
  return (response.Buckets || []).map((b) => ({
    name: b.Name || "",
    creationDate: b.CreationDate?.toISOString(),
  }));
}

/**
 * Diagnostic complet R2 — teste credentials, bucket existence, permissions écriture.
 * Retourne un rapport détaillé pour identifier la cause d'une erreur.
 */
export async function diagnoseR2(): Promise<{
  credentialsValid: boolean;
  bucketsAccessible: string[];
  bucketExists: boolean;
  canWrite: boolean;
  error?: string;
  errorCode?: string;
  details: string[];
}> {
  const details: string[] = [];
  const result = {
    credentialsValid: false,
    bucketsAccessible: [] as string[],
    bucketExists: false,
    canWrite: false,
    error: undefined as string | undefined,
    errorCode: undefined as string | undefined,
    details,
  };

  if (!isR2Configured()) {
    result.error = "R2 non configuré — variables d'environnement manquantes";
    details.push("Variables requises : R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME");
    return result;
  }

  details.push(`Account ID : ${R2_ACCOUNT_ID.substring(0, 8)}...`);
  details.push(`Bucket configuré : ${R2_BUCKET}`);
  details.push(`Endpoint : https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);

  // ─── Test 1 : ListBuckets (vérifie les credentials) ───
  try {
    const buckets = await listBucketsR2();
    result.credentialsValid = true;
    result.bucketsAccessible = buckets.map((b) => b.name);
    details.push(`✓ Credentials valides — ${buckets.length} bucket(s) accessible(s) : ${buckets.map((b) => b.name).join(", ") || "(aucun)"}`);

    // Vérifier si le bucket configuré existe
    result.bucketExists = buckets.some((b) => b.name === R2_BUCKET);
    if (!result.bucketExists) {
      details.push(`✗ Le bucket "${R2_BUCKET}" n'existe pas ou n'est pas accessible avec ce token`);
      details.push(`  Buckets disponibles : ${result.bucketsAccessible.join(", ") || "(aucun)"}`);
      result.error = `Bucket "${R2_BUCKET}" introuvable`;
      result.errorCode = "NoSuchBucket";
      return result;
    }
    details.push(`✓ Bucket "${R2_BUCKET}" accessible`);
  } catch (err) {
    result.error = err instanceof Error ? err.message : "Erreur ListBuckets";
    result.errorCode = extractErrorCode(err);
    details.push(`✗ Échec ListBuckets : ${result.error} (code: ${result.errorCode})`);
    details.push("  → Vérifiez R2_ACCESS_KEY_ID et R2_SECRET_ACCESS_KEY");
    details.push("  → Vérifiez que le token R2 a la permission 'Object Read & Write'");
    return result;
  }

  // ─── Test 2 : Upload test (vérifie les permissions d'écriture) ───
  try {
    const testKey = `test/diagnostic-${Date.now()}.txt`;
    const testBuffer = Buffer.from(`R2 diagnostic ${new Date().toISOString()}`, "utf-8");
    await uploadToR2(testKey, testBuffer, "text/plain");
    result.canWrite = true;
    details.push("✓ Upload test réussi — permissions d'écriture OK");
  } catch (err) {
    result.error = err instanceof Error ? err.message : "Erreur upload";
    result.errorCode = extractErrorCode(err);
    details.push(`✗ Échec upload : ${result.error} (code: ${result.errorCode})`);
    details.push("  → Le token n'a peut-être pas la permission 'Object Write' sur ce bucket");
  }

  return result;
}

/**
 * Extrait le code d'erreur d'une erreur AWS SDK.
 */
function extractErrorCode(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (e.name) return String(e.name);
    if (e.Code) return String(e.Code);
    const metadata = e.$metadata as Record<string, unknown> | undefined;
    if (metadata?.httpStatusCode) return `HTTP ${metadata.httpStatusCode}`;
  }
  return "Unknown";
}
