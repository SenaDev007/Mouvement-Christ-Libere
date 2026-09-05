import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { isR2Configured, diagnoseR2, getPresignedUploadUrl, getPublicUrl } from "@/lib/r2";

/**
 * GET /api/admin/r2-test
 *
 * Vérifie la configuration Cloudflare R2 et teste un upload.
 * Actions :
 *  - "status"   : état de la configuration (variables présentes ?)
 *  - "test"/"diagnose" : diagnostic complet (credentials + bucket +
 *                 permissions + URL publique) — 100 % côté SERVEUR.
 *  - "presign"  : ⭐ V3.35 — génère une URL pré-signée pour un PUT DEPUIS
 *                 LE NAVIGATEUR (le vrai chemin du replay de live > 4 Mo).
 *                 La page effectue ensuite le PUT elle-même et affiche le
 *                 résultat — c'est le seul moyen de tester CE qui échouait
 *                 (un PUT serveur réussit toujours, même quand le PUT
 *                 navigateur est refusé — cf. checksum, V3.35).
 */
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken || !verifySessionToken(sessionToken)) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "status";

    // ─── Status : vérifier la config ───
    if (action === "status") {
      return NextResponse.json({
        configured: isR2Configured(),
        provider: "Cloudflare R2",
        accountId: process.env.R2_ACCOUNT_ID ? `${process.env.R2_ACCOUNT_ID.substring(0, 8)}...` : "(non défini)",
        bucket: process.env.R2_BUCKET_NAME || "(non défini)",
        publicUrl: process.env.R2_PUBLIC_URL || "(non défini)",
        publicDevUrl: process.env.R2_PUBLIC_DEV_URL || "(non défini)",
        accessKeyId: process.env.R2_ACCESS_KEY_ID ? `${process.env.R2_ACCESS_KEY_ID.substring(0, 8)}...` : "(non défini)",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ? "(défini)" : "(non défini)",
        // Diagnostic rapide : quelles variables sont présentes ?
        envCheck: {
          R2_ACCOUNT_ID: !!process.env.R2_ACCOUNT_ID,
          R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID,
          R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY,
          R2_BUCKET_NAME: !!process.env.R2_BUCKET_NAME,
          R2_PUBLIC_URL: !!process.env.R2_PUBLIC_URL,
          R2_PUBLIC_DEV_URL: !!process.env.R2_PUBLIC_DEV_URL,
        },
      });
    }

    // ─── Diagnose : test complet avec détails ───
    if (action === "test" || action === "diagnose") {
      if (!isR2Configured()) {
        return NextResponse.json(
          {
            error: "R2 non configuré — variables d'environnement manquantes",
            details: [
              "Variables requises : R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME",
              "R2_PUBLIC_URL est optionnel (domaine custom CDN)",
            ],
          },
          { status: 503 }
        );
      }

      const diag = await diagnoseR2();

      return NextResponse.json({
        success: diag.canWrite,
        message: diag.canWrite
          ? diag.publicUrlOk === false
            ? "Upload OK MAIS l'URL publique est inaccessible — les fichiers sont stockés mais ne se chargeront jamais (voir détails)"
            : "Upload test réussi — R2 fonctionne correctement"
          : diag.error || "Échec du test R2",
        credentialsValid: diag.credentialsValid,
        bucketsAccessible: diag.bucketsAccessible,
        bucketExists: diag.bucketExists,
        canWrite: diag.canWrite,
        publicUrl: diag.publicUrl,
        publicUrlOk: diag.publicUrlOk,
        error: diag.error,
        errorCode: diag.errorCode,
        details: diag.details,
      });
    }

    // ─── ⭐ V3.35 — Presign : URL pré-signée pour le PUT navigateur ───
    if (action === "presign") {
      if (!isR2Configured()) {
        return NextResponse.json(
          { error: "R2 non configuré — variables d'environnement manquantes" },
          { status: 503 }
        );
      }
      try {
        const key = `test/presign-navigateur-${Date.now()}.txt`;
        // Content-Type video/webm : reproduit EXACTEMENT le chemin du replay
        // (y compris le preflight CORS, car video/webm n'est pas un type
        // « simple »). Un test en text/plain éviterait le preflight et
        // pourrait passer là où le replay échouerait.
        const uploadUrl = await getPresignedUploadUrl(key, "video/webm", 600);
        const suspects = [...new URL(uploadUrl).searchParams.keys()].filter((k) =>
          /x-amz-(sdk-)?checksum/i.test(k)
        );
        return NextResponse.json({
          success: true,
          uploadUrl,
          publicUrl: getPublicUrl(key),
          key,
          urlClean: suspects.length === 0,
          checksumParams: suspects,
        });
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Erreur génération URL pré-signée" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ error: "Action inconnue (status, test, diagnose, presign)" }, { status: 400 });
  } catch (error) {
    console.error("[r2-test] Error:", error);
    // Capturer les détails de l'erreur S3
    const errDetails: string[] = [];
    if (error && typeof error === "object") {
      const e = error as Record<string, unknown>;
      if (e.name) errDetails.push(`Erreur : ${e.name}`);
      if (e.message) errDetails.push(`Message : ${e.message}`);
      const metadata = e.$metadata as Record<string, unknown> | undefined;
      if (metadata) {
        if (metadata.httpStatusCode) errDetails.push(`HTTP : ${metadata.httpStatusCode}`);
        if (metadata.requestId) errDetails.push(`Request ID : ${metadata.requestId}`);
      }
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur test R2",
        details: errDetails.length > 0 ? errDetails : ["Erreur inconnue"],
      },
      { status: 500 }
    );
  }
}
