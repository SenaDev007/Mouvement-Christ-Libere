import { NextRequest, NextResponse } from "next/server";
import {
  isR2Configured,
  ensureR2CorsConfig,
  generateKey,
  getPublicUrl,
  creerMultipartR2,
  getPresignedPartUrl,
  completerMultipartR2,
  annulerMultipartR2,
  estAccesRefuse,
  type MorceauR2,
} from "@/lib/r2";

/**
 * ⭐ V3.51 — Logique partagée des routes /api/videos/[id]/multipart et
 * /api/live/[id]/multipart (upload SÉQUENTIEL par morceaux vers R2).
 *
 * POURQUOI (remplace le PUT monolithique) :
 * - Le fichier était envoyé en UNE SEULE requête PUT : un hoquet réseau à
 *   95 % tuait tout l'envoi (repartir de zéro, « crash » ressenti) et le
 *   repli serveur est limité à 4 Mo par le body Vercel.
 * - Désormais : le fichier est découpé en morceaux (~8 Mo) envoyés UN PAR
 *   UN (séquentiel), chacun avec URL pré-signée FRAÎCHE, réessayé
 *   individuellement (3 tentatives) — un échec ne redémarre PAS tout.
 *
 * PROTOCOLE (4 actions, même URL) :
 *   POST { action: "create",   contentType, filename? }
 *        → { uploadId, key, partSize, partCount, publicUrl }
 *   POST { action: "part",     uploadId, key, partNumber }
 *        → { url } (URL pré-signée du morceau, valable 1 h, à la demande)
 *   POST { action: "complete", uploadId, key, parts: [{ partNumber, etag }] }
 *        → { publicUrl } (R2 assemble les morceaux ; le CALLER commite
 *          ensuite l'URL via ses routes existantes — /upload JSON, /recording)
 *   POST { action: "abort",    uploadId, key }
 *        → { success: true } (nettoyage best-effort des morceaux)
 *
 * SÉCURITÉ : le `key` renvoyé par le client est VALIDÉ contre le motif
 * attendu pour CET enregistrement (prefix + id) — impossible d'écrire sur
 * un key arbitraire du bucket.
 */

export const TAILLE_MORCEAU = 8 * 1024 * 1024; // 8 Mo (min R2/S3 : 5 Mo, sauf dernier)
export const MAX_MORCEAUX = 10000; // limite S3/R2

/** Réponse standard des erreurs de la route multipart. */
export function reponseErreur(message: string, statut: number) {
  return NextResponse.json({ error: message }, { status: statut });
}

/** Erreur 503 « R2 non configuré » avec le marqueur compris par le client. */
export function reponseR2NonConfigure() {
  return NextResponse.json(
    {
      error:
        "Cloudflare R2 non configuré (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME). Vérifiez /admin/r2-test.",
      r2NotConfigured: true,
    },
    { status: 503 }
  );
}

/** Génère la regex de validation du key pour un enregistrement donné. */
export function motifKey(prefixe: string, id: string): RegExp {
  // ex. videos/video-abc12-1757…-x7k9f2.mp4 — id échappé, extension alphanum
  const idEchappe = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${prefixe}/${idEchappe}-\\d{6,}-[a-z0-9]{4,12}\\.[a-z0-9]{1,8}$`);
}

/**
 * Traite une requête multipart (appelé par les deux routes, après leur
 * contrôle d'authentification et d'existence de l'enregistrement).
 *
 * @param prefixeKey  "videos" (clé generateKey côté create) ou "replays"
 * @param idEnregistrement  id de la vidéo (video-<id>) ou du live (<id>)
 */
export async function traiterRequeteMultipart(opts: {
  req: NextRequest;
  prefixeKey: string;
  idEnregistrement: string;
}): Promise<NextResponse> {
  const { req, prefixeKey, idEnregistrement } = opts;

  if (!isR2Configured()) {
    return reponseR2NonConfigure();
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.action !== "string") {
    return reponseErreur("Champ 'action' manquant (create | part | complete | abort)", 400);
  }

  // Le CORS du bucket est indispensable aux PUT navigateur des morceaux
  // (preflight) — appliqué avant create, idempotent, best-effort.
  await ensureR2CorsConfig().catch(() => undefined);

  switch (body.action) {
    // ─── ① Création de la session multipart ───────────────────────────
    case "create": {
      const contentType =
        typeof body.contentType === "string" && body.contentType ? body.contentType : "video/mp4";
      const filename = typeof body.filename === "string" ? body.filename : "";

      const extNom = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
      const extMime = contentType.split("/")[1] || "mp4";
      const ext = (extNom || extMime).replace(/[^a-z0-9]/g, "") || "mp4";

      const key = generateKey(prefixeKey, idEnregistrement, ext);
      const partSize = TAILLE_MORCEAU;
      const partCount = Math.max(1, Math.ceil(Number(body.fileSize) / partSize) || 1);
      if (partCount > MAX_MORCEAUX) {
        return reponseErreur(
          `Fichier trop volumineux (${partCount} morceaux > ${MAX_MORCEAUX} maximum).`,
          413
        );
      }

      try {
        const uploadId = await creerMultipartR2(key, contentType);
        return NextResponse.json({
          uploadId,
          key,
          partSize,
          partCount,
          publicUrl: getPublicUrl(key),
        });
      } catch (error) {
        console.error("[multipart/create] Erreur R2 :", error);
        // ⭐ V3.52 — AccessDenied = le token R2 n'a pas (ou plus) la
        // permission d'écrire (confirmé en production : PutObject ET
        // multipart refusés, signature valide). Ce n'est PAS transitoire :
        // on ne renvoie PAS 500 (le client réessaierait 3× pour rien) mais
        // 403 (échec immédiat) avec un message ACTIONNABLE.
        if (estAccesRefuse(error)) {
          return reponseErreur(
            "Écriture refusée par le stockage cloud (AccessDenied) : le token Cloudflare R2 n'a pas (ou plus) la permission d'écrire dans le bucket. " +
              "Réparation (2 min) : Cloudflare Dashboard → R2 → Manage R2 API Tokens → token avec permission « Object Read & Write » sur le bucket ; " +
              "si le token a été recréé, mettre à jour R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY sur Vercel puis Redéployer. " +
              "Diagnostic détaillé : /admin/r2-test → « Lancer le test serveur ».",
            403
          );
        }
        return reponseErreur(
          error instanceof Error
            ? `Création de la session d'upload impossible : ${error.message}`
            : "Création de la session d'upload impossible",
          500
        );
      }
    }

    // ─── ② URL pré-signée d'UN morceau (à la demande — toujours fraîche) ─
    case "part": {
      const { uploadId, key, partNumber } = body;
      if (typeof uploadId !== "string" || typeof key !== "string" || !Number.isInteger(partNumber)) {
        return reponseErreur("Champs 'uploadId', 'key', 'partNumber' requis", 400);
      }
      if (!motifKey(prefixeKey, idEnregistrement).test(key)) {
        return reponseErreur("Key non autorisée pour cet enregistrement", 403);
      }
      if (partNumber < 1 || partNumber > MAX_MORCEAUX) {
        return reponseErreur("Numéro de morceau invalide", 400);
      }
      try {
        const url = await getPresignedPartUrl(key, uploadId, partNumber, 3600);
        return NextResponse.json({ url });
      } catch (error) {
        console.error("[multipart/part] Erreur R2 :", error);
        return reponseErreur(
          error instanceof Error
            ? `Génération de l'URL du morceau ${partNumber} impossible : ${error.message}`
            : "Génération de l'URL du morceau impossible",
          500
        );
      }
    }

    // ─── ③ Assemblage final des morceaux ──────────────────────────────
    case "complete": {
      const { uploadId, key, parts } = body;
      if (typeof uploadId !== "string" || typeof key !== "string" || !Array.isArray(parts)) {
        return reponseErreur("Champs 'uploadId', 'key', 'parts' requis", 400);
      }
      if (!motifKey(prefixeKey, idEnregistrement).test(key)) {
        return reponseErreur("Key non autorisée pour cet enregistrement", 403);
      }
      const morceaux: MorceauR2[] = parts
        .filter(
          (p: unknown): p is { partNumber: number; etag: string } =>
            !!p &&
            typeof p === "object" &&
            Number.isInteger((p as { partNumber?: unknown }).partNumber) &&
            typeof (p as { etag?: unknown }).etag === "string" &&
            (p as { etag?: unknown }).etag!.length > 0
        )
        .sort((a: { partNumber: number }, b: { partNumber: number }) => a.partNumber - b.partNumber);
      if (morceaux.length === 0) {
        return reponseErreur("Aucun morceau valide fourni", 400);
      }
      try {
        await completerMultipartR2(key, uploadId, morceaux);
        return NextResponse.json({ success: true, publicUrl: getPublicUrl(key) });
      } catch (error) {
        console.error("[multipart/complete] Erreur R2 :", error);
        // Complete peut échouer avec EntityTooSmall / InvalidPart (ETag
        // incorrect) — l'abort évite les morceaux orphelins facturables.
        await annulerMultipartR2(key, uploadId);
        return reponseErreur(
          error instanceof Error
            ? `Assemblage des morceaux impossible : ${error.message}`
            : "Assemblage des morceaux impossible",
          500
        );
      }
    }

    // ─── ④ Annulation / nettoyage ─────────────────────────────────────
    case "abort": {
      const { uploadId, key } = body;
      if (typeof uploadId !== "string" || typeof key !== "string") {
        return reponseErreur("Champs 'uploadId', 'key' requis", 400);
      }
      if (!motifKey(prefixeKey, idEnregistrement).test(key)) {
        return reponseErreur("Key non autorisée pour cet enregistrement", 403);
      }
      await annulerMultipartR2(key, uploadId);
      return NextResponse.json({ success: true });
    }

    default:
      return reponseErreur(`Action inconnue : ${body.action}`, 400);
  }
}
