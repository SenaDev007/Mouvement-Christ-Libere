import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import {
  isR2Configured,
  diagnoseR2,
  getPresignedUploadUrl,
  getPublicUrl,
  lireCorsBucketR2,
  appliquerCorsR2AvecIdentifiants,
  getR2Origin,
} from "@/lib/r2";

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
 *  - "cors-status" : ⭐ V3.55 — lit l'état CORS RÉEL du bucket (GetBucketCors,
 *                 best-effort avec le token de l'app) + renvoie l'origine du
 *                 bucket pour la sonde navigateur.
 * POST (body JSON):
 *  - "cors-apply" : ⭐ V3.55 — applique la règle CORS du bucket avec des
 *                 identifiants TEMPORAIRES « Admin Read & Write » fournis
 *                 par l'administrateur (usage unique en mémoire, jamais
 *                 stockés ni journalisés), puis relit la règle pour vérifier.
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
        // ⭐ V3.55 — origine du bucket (publique : c'est celle des URL
        // pré-signées visibles dans le navigateur) pour la sonde CORS.
        r2EndpointOrigin: getR2Origin() || "(non défini)",
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

      // ⭐ V3.52 — message serveur PINCÉ selon le verdict du diagnostic :
      // lecture OK + écriture refusée = token « Object Read only » ;
      // lecture refusée aussi = portée erronée ou token expiré/révoqué.
      let message: string;
      if (diag.canWrite) {
        message =
          diag.publicUrlOk === false
            ? "Upload OK MAIS l'URL publique est inaccessible — les fichiers sont stockés mais ne se chargeront jamais (voir détails)"
            : "Upload test réussi — R2 fonctionne correctement";
      } else if (diag.errorCode === "AccessDenied" || diag.errorCode === "HTTP 403") {
        message = diag.canRead
          ? "Écriture refusée (AccessDenied) : le token peut LIRE mais pas ÉCRIRE — passez sa permission en « Object Read & Write » (voir la procédure ci-dessous)."
          : "Accès refusé (AccessDenied) en lecture ET écriture — token expiré/révoqué ou scoped à un autre bucket : recréez-le (voir la procédure ci-dessous).";
      } else {
        message = diag.error || "Échec du test R2";
      }

      return NextResponse.json({
        success: diag.canWrite,
        message,
        credentialsValid: diag.credentialsValid,
        bucketsAccessible: diag.bucketsAccessible,
        bucketExists: diag.bucketExists,
        canRead: diag.canRead,
        readErrorCode: diag.readErrorCode,
        canWrite: diag.canWrite,
        canMultipart: diag.canMultipart,
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

    // ─── ⭐ V3.55 — État CORS réel du bucket (lecture best-effort) ───
    if (action === "cors-status") {
      if (!isR2Configured()) {
        return NextResponse.json(
          { error: "R2 non configuré — variables d'environnement manquantes" },
          { status: 503 }
        );
      }
      const cors = await lireCorsBucketR2();
      return NextResponse.json({
        etat: cors.etat,
        regles: cors.regles ?? [],
        detail: cors.detail ?? "",
        r2Origin: getR2Origin(),
      });
    }

    return NextResponse.json({ error: "Action inconnue (status, test, diagnose, presign, cors-status)" }, { status: 400 });
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

/**
 * ⭐ V3.55 — POST /api/admin/r2-test
 * Body JSON : { accessKeyId, secretAccessKey }  (token Cloudflare TEMPORAIRE
 * « Admin Read & Write » créé par l'administrateur).
 *
 * Applique la règle CORS du bucket avec CES identifiants (le token de prod
 * « Object Read & Write » est structurellement privé de PutBucketCors),
 * relit la règle pour vérifier, puis l'administrateur SUPPRIME le token
 * temporaire dans Cloudflare.
 *
 * ⚠️ Les identifiants ne sont JAMAIS stockés ni journalisés — usage unique
 * en mémoire, sur HTTPS, session admin obligatoire.
 */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken || !verifySessionToken(sessionToken)) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (
      !body ||
      typeof body.accessKeyId !== "string" ||
      typeof body.secretAccessKey !== "string"
    ) {
      return NextResponse.json(
        { error: "Champs 'accessKeyId' et 'secretAccessKey' requis" },
        { status: 400 }
      );
    }
    const { accessKeyId, secretAccessKey } = body;

    // Validation de forme (clés R2 : hex/base64 — on ne filtre pas le
    // charset du secret, base64 contient +/= ; longueur encadrée).
    if (
      !/^[A-Za-z0-9]{16,128}$/.test(accessKeyId) ||
      secretAccessKey.length < 16 ||
      secretAccessKey.length > 128
    ) {
      return NextResponse.json({ error: "Format d'identifiants invalide" }, { status: 400 });
    }

    // ⚠️ Ne JAMAIS journaliser ces identifiants (pas de console.log du body).
    const resultat = await appliquerCorsR2AvecIdentifiants(accessKeyId, secretAccessKey);
    return NextResponse.json(resultat, { status: resultat.success ? 200 : 400 });
  } catch (error) {
    console.error("[r2-test/cors-apply] Erreur (identifiants non journalisés) :");
    return NextResponse.json(
      { success: false, error: error instanceof Error ? "Échec de l'application de la règle CORS" : "Erreur" },
      { status: 500 }
    );
  }
}
