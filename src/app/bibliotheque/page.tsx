/**
 * Page publique — /bibliotheque
 * Bibliothèque documentaire : livres gratuits du pasteur et d'Afrika Pamela.
 * Catégorisée, avec miniatures, lecteur PDF intégré et téléchargement.
 */

import { db } from "@/lib/db";
import { BibliotequeClient } from "./bibliotheque-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bibliothèque — Mouvement Christ Libère",
  description: "Livres et enseignements gratuits du Pasteur Kongo et d'Afrika Pamela.",
};

export default async function BibliothequePage() {
  const books = await db.book.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      servant: { select: { code: true, shortName: true } },
    },
  });

  // Catégories uniques pour le filtre
  const categories = Array.from(
    new Set(books.map((b) => b.category).filter(Boolean))
  ).sort();

  return (
    <BibliotequeClient
      books={books.map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author,
        description: b.description,
        category: b.category,
        coverUrl: b.coverUrl,
        fileUrl: b.fileUrl,
        fileSize: b.fileSize, // ⭐ V4.40 — champs professionnels affichés
        pageCount: b.pageCount,
        language: b.language,
        publishedYear: b.publishedYear,
        isbn: b.isbn,
        editeur: b.editeur,
        tags: b.tags,
        isDownloadable: b.isDownloadable,
        downloadCount: b.downloadCount,
        servantCode: b.servant?.code || null,
        servantShortName: b.servant?.shortName || null,
      }))}
      categories={categories}
    />
  );
}
