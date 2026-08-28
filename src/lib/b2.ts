import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Backblaze B2 — Helper de stockage compatible S3.
 *
 * Variables d'environnement requises :
 * - B2_KEY_ID          : Clé d'application B2 (keyID)
 * - B2_APPLICATION_KEY : Secret de la clé d'application B2
 * - B2_BUCKET_NAME     : Nom du bucket B2
 * - B2_ENDPOINT        : Endpoint S3 du bucket (ex: s3.us-west-004.backblazeb2.com)
 *
 * Les fichiers uploadés sont publics (lecture anonyme) si le bucket est configuré
 * en "Public" (Bucket Info: publicBucket=true) ou via un URL custom (CNAME).
 * Sinon, on génère une URL pré-signée valide 7 jours.
 */

const B2_KEY_ID = process.env.B2_KEY_ID || "";
const B2_APP_KEY = process.env.B2_APPLICATION_KEY || "";
const B2_BUCKET = process.env.B2_BUCKET_NAME || "";
const B2_ENDPOINT = process.env.B2_ENDPOINT || "";

let s3Client: S3Client | null = null;

function getClient(): S3Client {
  if (s3Client) return s3Client;
  if (!B2_KEY_ID || !B2_APP_KEY || !B2_BUCKET || !B2_ENDPOINT) {
    throw new Error("Backblaze B2 non configuré. Variables requises : B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, B2_ENDPOINT");
  }
  s3Client = new S3Client({
    region: "us-east-1", // B2 ignore ce champ mais le SDK en a besoin
    endpoint: `https://${B2_ENDPOINT}`,
    credentials: {
      accessKeyId: B2_KEY_ID,
      secretAccessKey: B2_APP_KEY,
    },
  });
  return s3Client;
}

export function isB2Configured(): boolean {
  return !!(B2_KEY_ID && B2_APP_KEY && B2_BUCKET && B2_ENDPOINT);
}

/**
 * Upload un fichier vers B2 et retourne l'URL publique.
 *
 * @param key   Chemin dans le bucket (ex: "replays/live-abc123.webm")
 * @param body  Buffer ou string
 * @param contentType  MIME type
 * @returns URL publique du fichier
 */
export async function uploadToB2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: B2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  // URL publique — nécessite bucket public ou URL custom
  return `https://${B2_ENDPOINT}/${B2_BUCKET}/${key}`;
}

/**
 * Supprime un fichier de B2.
 */
export async function deleteFromB2(key: string): Promise<void> {
  const client = getClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: B2_BUCKET,
      Key: key,
    })
  );
}

/**
 * Extrait le key B2 depuis une URL publique.
 */
export function extractKeyFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // Format: https://{endpoint}/{bucket}/{key}
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      // Premier = bucket, reste = key
      return parts.slice(1).join("/");
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
 * Génère une URL pré-signée pour upload direct depuis le navigateur vers B2.
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
    Bucket: B2_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Construit l'URL publique d'un key B2.
 */
export function getPublicUrl(key: string): string {
  return `https://${B2_ENDPOINT}/${B2_BUCKET}/${key}`;
}
