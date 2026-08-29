import { S3Client, PutObjectCommand, DeleteObjectCommand, ListBucketsCommand } from "@aws-sdk/client-s3";
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
  });
  return s3Client;
}

export function isR2Configured(): boolean {
  const cfg = getConfig();
  return !!(cfg.accountId && cfg.accessKeyId && cfg.secretAccessKey && cfg.bucket);
}

/**
 * Construit l'URL publique d'un key R2.
 * - Si R2_PUBLIC_URL est défini : utilise le domaine custom (CDN)
 * - Sinon : utilise l'URL de dev R2 (public-dev URL à activer sur le bucket)
 */
export function getPublicUrl(key: string): string {
  const cfg = getConfig();
  if (cfg.publicUrl) {
    return `${cfg.publicUrl.replace(/\/$/, "")}/${key}`;
  }
  // Fallback : URL publique de dev R2 (r2.dev)
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
 * Génère une URL pré-signée pour upload direct depuis le navigateur vers R2.
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<string> {
  const client = getClient();
  const cfg = getConfig();
  const command = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn });
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

/**
 * Diagnostic complet R2 — teste credentials, bucket existence, permissions écriture.
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
  const cfg = getConfig();
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

  // ─── Test 2 : Upload test (vérifie les permissions d'écriture sur le bucket) ───
  try {
    const testKey = `test/diagnostic-${Date.now()}.txt`;
    const testBuffer = Buffer.from(`R2 diagnostic ${new Date().toISOString()}`, "utf-8");
    await uploadToR2(testKey, testBuffer, "text/plain");
    result.canWrite = true;
    details.push("✓ Upload test réussi — permissions d'écriture OK sur le bucket");
    details.push(`✓ URL publique : ${getPublicUrl(testKey)}`);
  } catch (err) {
    const code = extractErrorCode(err);
    const msg = err instanceof Error ? err.message : "Erreur upload";
    result.error = msg;
    result.errorCode = code;
    details.push(`✗ Échec upload : ${msg} (code: ${code})`);

    // Messages spécifiques selon le code d'erreur
    if (code === "AccessDenied" || code === "HTTP 403") {
      details.push("  → Le token n'a pas la permission 'Object Write' sur ce bucket");
      details.push("  → Dashboard Cloudflare → R2 → Manage R2 API Tokens → éditer le token");
      details.push("  → Cocher 'Object Read & Write' pour le bucket concerné");
    } else if (code === "NoSuchBucket") {
      details.push(`  → Le bucket "${cfg.bucket}" n'existe pas sur ce compte R2`);
      details.push("  → Vérifiez R2_BUCKET_NAME (sensible à la casse)");
    } else if (code === "InvalidAccessKeyId") {
      details.push("  → R2_ACCESS_KEY_ID invalide");
    } else if (code === "SignatureDoesNotMatch") {
      details.push("  → R2_SECRET_ACCESS_KEY invalide (la signature ne correspond pas)");
    }
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
