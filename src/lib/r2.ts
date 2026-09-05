import { S3Client, PutObjectCommand, DeleteObjectCommand, ListBucketsCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
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
    // ⭐ V3.34 — GEL DU COMPORTEMENT CHECKSUM (défensif) : depuis AWS SDK
    // v3.729, les clients calculent par défaut des checksums CRC32
    // ("WHEN_SUPPORTED"). Selon la version du SDK et la commande, ces
    // en-têtes (x-amz-checksum-crc32) peuvent être inclus dans les en-têtes
    // SIGNÉS des URL pré-signées — or le navigateur ne les renvoie jamais
    // lors du PUT direct → 403 AccessDenied systématique (problème connu
    // R2/MinIO, contournement officiel : WHEN_REQUIRED). Vérifié
    // empiriquement sur la v3.1121 installée (les URL générées ne signent
    // que « host ») : cette config est un no-op aujourd'hui qui protège
    // contre les montées de version futures du SDK.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return s3Client;
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
    const corsRules = {
      CORSRules: [
        {
          AllowedOrigins: ["*"],
          AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
          AllowedHeaders: ["*"],
          ExposeHeaders: ["ETag", "x-amz-request-id"],
          MaxAgeSeconds: 3600,
        },
      ],
    };
    await client.send(
      new PutBucketCorsCommand({
        Bucket: cfg.bucket,
        CORSConfiguration: corsRules,
      })
    );
    console.log("[r2] CORS configuration applied successfully");
  } catch (error) {
    console.error("[r2] Failed to apply CORS configuration:", error);
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
 * Diagnostic complet R2 — teste credentials, bucket existence, permissions
 * écriture ET (⭐ V3.25) l'ACCESSIBILITÉ de l'URL publique du fichier test.
 */
export async function diagnoseR2(): Promise<{
  credentialsValid: boolean;
  bucketsAccessible: string[];
  bucketExists: boolean;
  canWrite: boolean;
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
    canWrite: false,
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
