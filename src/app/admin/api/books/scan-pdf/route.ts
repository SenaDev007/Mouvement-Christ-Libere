/**
 * POST /admin/api/books/scan-pdf — analyse intelligente d'un PDF uploadé
 *
 * ⭐ V4.40 — Le livre est analysé APRÈS son upload direct vers R2 : le
 * serveur relit le fichier depuis son URL publique et en extrait
 * AUTOMATIQUEMENT, via pdf-lib (déjà présent pour la génération de PDF) :
 *
 *   · pageCount  — le nombre réel de pages du document ;
 *   · fileSize   — la taille exacte en octets (du corps téléchargé) ;
 *   · pdfTitle   — métadonnée « Title » du PDF (souvent renseignée par
 *                  Word/InDesign/Canva) → pré-remplit le titre ;
 *   · pdfAuthor  — métadonnée « Author » → pré-remplit l'auteur ;
 *   · pdfYear    — date de création du document → pré-remplit l'année
 *                  de publication (si plausible : 1990 → année courante +1).
 *
 * Le client ne pré-remplit QUE les champs laissés vides par l'administrateur :
 * l'humain garde toujours le dernier mot.
 *
 * Sécurité SSRF : l'analyse n'accepte que les fichiers hébergés sur NOS
 * hôtes R2 (extraireCleR2) — jamais une URL arbitraire.
 *
 * Body JSON : { fileUrl: "https://.../livres/pdf-....pdf" }
 * Retour   : { analysed: true, pageCount, fileSize, pdfTitle, pdfAuthor, pdfYear }
 *            { analysed: false, fileSize, error } — le PDF reste uploadé,
 *            les pages se saisissent alors à la main.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { PDFDocument } from "pdf-lib";
import { extraireCleR2 } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!(await authentifier())) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const fileUrl = (body.fileUrl as string)?.trim() || "";
  if (!fileUrl) {
    return NextResponse.json({ error: "fileUrl requis" }, { status: 400 });
  }

  // SSRF : uniquement nos propres fichiers R2.
  if (!extraireCleR2(fileUrl)) {
    return NextResponse.json(
      { error: "L'URL ne pointe pas vers le stockage du ministère — analyse refusée (renseignez les pages manuellement)." },
      { status: 400 }
    );
  }

  // Téléchargement du fichier depuis l'URL publique du bucket.
  let buffer: Buffer;
  try {
    const res = await fetch(fileUrl, {
      signal: AbortSignal.timeout(50_000),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { analysed: false, error: `Fichier illisible (HTTP ${res.status})` },
        { status: 200 }
      );
    }
    buffer = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    return NextResponse.json(
      {
        analysed: false,
        error: `Téléchargement impossible : ${err instanceof Error ? err.message : "erreur réseau"}`,
      },
      { status: 200 }
    );
  }

  const fileSize = buffer.length;

  try {
    // ignoreEncryption : certains PDF générés par Word portent un drapeau
    // de chiffrement sans contenu réellement chiffré — on les lit quand même.
    const pdf = await PDFDocument.load(buffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    });

    const pageCount = pdf.getPageCount();
    const pdfTitle = pdf.getTitle()?.trim() || null;
    const pdfAuthor = pdf.getAuthor()?.trim() || null;

    // Année de création du document — retenue seulement si plausible.
    let pdfYear: number | null = null;
    try {
      const creation = pdf.getCreationDate();
      const annee = creation?.getFullYear();
      const max = new Date().getFullYear() + 1;
      if (annee && annee >= 1990 && annee <= max) pdfYear = annee;
    } catch {
      /* métadonnée absente ou illisible — sans conséquence */
    }

    return NextResponse.json({
      analysed: true,
      pageCount,
      fileSize,
      pdfTitle,
      pdfAuthor,
      pdfYear,
    });
  } catch (err) {
    // PDF corrompu, protégé par mot de passe réel, ou format non conforme :
    // l'upload reste valide, la saisie manuelle prend le relais.
    console.warn("[admin/books/scan-pdf] Analyse impossible :", err instanceof Error ? err.message : err);
    return NextResponse.json(
      {
        analysed: false,
        fileSize,
        error:
          "PDF protégé, corrompu ou non conforme — impossible d'en extraire les pages automatiquement. Renseignez-les manuellement.",
      },
      { status: 200 }
    );
  }
}

async function authentifier(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return !!token && verifySessionToken(token);
}
