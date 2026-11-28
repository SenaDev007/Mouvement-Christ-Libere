/**
 * GET  /admin/api/books — liste tous les livres (admin)
 * POST /admin/api/books — crée un nouveau livre
 *
 * ⭐ V4.38 — Bibliothèque documentaire : gestion des livres gratuits
 * publiés par le pasteur et Afrika Pamela.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { db } from "@/lib/db";
// ⭐ V4.44 — Transfert R2 → GitHub pour les PDF de la bibliothèque
import { uploadToGithub, isGithubStorageConfigured } from "@/lib/github-storage";
import { extraireCleR2, deleteFromR2, getClient } from "@/lib/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function authentifier(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return !!token && verifySessionToken(token);
}

// ─── GET : liste ──────────────────────────────────────────────────────

export async function GET() {
  if (!(await authentifier())) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const books = await db.book.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        servant: { select: { code: true, shortName: true } },
      },
    });

    return NextResponse.json({
      books: books.map((b) => ({
        ...b,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
        servantCode: b.servant?.code || null,
        servantShortName: b.servant?.shortName || null,
      })),
    });
  } catch (err) {
    console.error("[admin/books GET] Erreur :", err);
    return NextResponse.json({ error: "Erreur lecture livres" }, { status: 500 });
  }
}

// ─── POST : création ──────────────────────────────────────────────────

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

  const title = (body.title as string)?.trim();
  const author = (body.author as string)?.trim();
  const description = (body.description as string)?.trim() || "";
  const category = (body.category as string)?.trim() || "Autres";
  const coverUrl = (body.coverUrl as string)?.trim() || null;
  const fileUrl = (body.fileUrl as string)?.trim() || null;
  const fileSize = body.fileSize ? Number(body.fileSize) : null;
  const pageCount = body.pageCount ? Number(body.pageCount) : null;
  const language = (body.language as string)?.trim() || "Français";
  const publishedYear = body.publishedYear ? Number(body.publishedYear) : null;
  // ⭐ V4.40 — champs professionnels : ISBN, éditeur, mots-clés, téléchargeable.
  const isbn = (body.isbn as string)?.trim() || null;
  const editeur = (body.editeur as string)?.trim() || null;
  const tags = (body.tags as string)?.trim() || null;
  const isDownloadable = body.isDownloadable !== false;
  const isPublished = body.isPublished !== false;
  const sortOrder = body.sortOrder ? Number(body.sortOrder) : 0;
  const servantId = (body.servantId as string)?.trim() || null;

  if (!title || !author) {
    return NextResponse.json({ error: "Titre et auteur requis" }, { status: 400 });
  }

  try {
    const book = await db.book.create({
      data: {
        title,
        author,
        description,
        category,
        coverUrl,
        fileUrl,
        fileSize,
        pageCount,
        language,
        publishedYear,
        isbn,
        editeur,
        tags,
        isDownloadable,
        isPublished,
        sortOrder,
        servantId,
      },
    });

    // ⭐ V4.44 — Transfert R2 → GitHub en arrière-plan (après la réponse)
    // Le PDF est transféré de R2 vers GitHub et le fileUrl en base est mis
    // à jour. Le fichier R2 est supprimé (libère l'espace).
    if (fileUrl && isGithubStorageConfigured()) {
      after(async () => {
        try {
          const keyR2 = extraireCleR2(fileUrl);
          if (!keyR2) return;

          const client = getClient();
          const command = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: keyR2,
          });
          const response = await client.send(command);
          if (!response.Body) return;

          const chunks: Buffer[] = [];
          const corps = response.Body as AsyncIterable<Uint8Array>;
          for await (const chunk of corps) {
            chunks.push(Buffer.from(chunk));
          }
          const buffer = Buffer.concat(chunks);

          const filename = keyR2.split("/").pop() || `${title}.pdf`;
          const result = await uploadToGithub(buffer, "documents", "bibliotheque", filename);

          // Mettre à jour le fileUrl en base vers GitHub
          await db.book.update({
            where: { id: book.id },
            data: { fileUrl: result.url },
          });

          // Supprimer de R2
          await deleteFromR2(keyR2).catch(() => {});

          console.log(
            `[admin/books] Transfert R2 → GitHub OK : livre ${book.id} → ${result.storage}`
          );
        } catch (err) {
          console.warn(
            "[admin/books] Transfert R2 → GitHub échec (non bloquant) :",
            err instanceof Error ? err.message : err
          );
        }
      });
    }

    return NextResponse.json({ ok: true, id: book.id });
  } catch (err) {
    console.error("[admin/books POST] Erreur :", err);
    return NextResponse.json({ error: "Erreur création livre" }, { status: 500 });
  }
}
