import { S3Client, PutObjectCommand, DeleteObjectCommand, ListBucketsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 — Helper de stockage compatible S3 (backend Railway).
 * Identique au frontend src/lib/r2.ts — gardé en sync.
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
    throw new Error("Cloudflare R2 non configuré. Variables requises : R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME");
  }
  s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  return s3Client;
}

export function isR2Configured(): boolean {
  const cfg = getConfig();
  return !!(cfg.accountId && cfg.accessKeyId && cfg.secretAccessKey && cfg.bucket);
}

export function getPublicUrl(key: string): string {
  const cfg = getConfig();
  if (cfg.publicUrl) {
    return `${cfg.publicUrl.replace(/\/$/, "")}/${key}`;
  }
  return `https://pub-${cfg.accountId}.r2.dev/${key}`;
}

export async function uploadToR2(key: string, body: Buffer | Uint8Array, contentType: string): Promise<string> {
  const client = getClient();
  const cfg = getConfig();
  await client.send(new PutObjectCommand({ Bucket: cfg.bucket, Key: key, Body: body, ContentType: contentType }));
  return getPublicUrl(key);
}

export async function deleteFromR2(key: string): Promise<void> {
  const client = getClient();
  const cfg = getConfig();
  await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
}

export function generateKey(prefix: string, id: string, ext: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}/${id}-${timestamp}-${random}.${ext}`;
}

export async function getPresignedUploadUrl(key: string, contentType: string, expiresIn = 3600): Promise<string> {
  const client = getClient();
  const cfg = getConfig();
  const command = new PutObjectCommand({ Bucket: cfg.bucket, Key: key, ContentType: contentType });
  return getSignedUrl(client, command, { expiresIn });
}

export async function listBucketsR2(): Promise<{ name: string; creationDate?: string }[]> {
  const client = getClient();
  const response = await client.send(new ListBucketsCommand({}));
  return (response.Buckets || []).map((b) => ({ name: b.Name || "", creationDate: b.CreationDate?.toISOString() }));
}

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

export async function diagnoseR2() {
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
    result.error = "R2 non configuré";
    details.push("Variables requises : R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME");
    return result;
  }

  details.push(`Account ID : ${cfg.accountId.substring(0, 8)}...`);
  details.push(`Bucket : ${cfg.bucket}`);
  details.push(`Endpoint : https://${cfg.accountId}.r2.cloudflarestorage.com`);

  try {
    const buckets = await listBucketsR2();
    result.credentialsValid = true;
    result.bucketsAccessible = buckets.map((b) => b.name);
    result.bucketExists = buckets.some((b) => b.name === cfg.bucket);
    details.push(`✓ ${buckets.length} bucket(s) accessible(s)`);
  } catch (err) {
    const code = extractErrorCode(err);
    if (code === "AccessDenied" || code === "HTTP 403") {
      details.push("⚠ ListBuckets refusé (token scoped) — test upload...");
      result.credentialsValid = true;
      result.bucketExists = true;
    } else {
      result.error = err instanceof Error ? err.message : "Erreur";
      result.errorCode = code;
      return result;
    }
  }

  try {
    const testKey = `test/diagnostic-${Date.now()}.txt`;
    await uploadToR2(testKey, Buffer.from("R2 test", "utf-8"), "text/plain");
    result.canWrite = true;
    details.push("✓ Upload réussi");
  } catch (err) {
    result.error = err instanceof Error ? err.message : "Erreur upload";
    result.errorCode = extractErrorCode(err);
    details.push(`✗ Upload échoué : ${result.error}`);
  }

  return result;
}
