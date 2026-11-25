/**
 * Page publique — /bibliotheque
 * ⭐ V4.42 — Bibliothèque scindée en espaces distincts par serviteur :
 * l'espace du pasteur Kongo et l'espace d'Afrika Pamela DALI (plus un
 * espace « Collectif » si des ouvrages sans serviteur existent). Chaque
 * espace a son identité visuelle et ses statistiques ; rien n'est mélangé.
 * Catégorisée, avec miniatures, lecteur PDF intégré et téléchargement.
 */

import { db } from "@/lib/db";
import { BibliotequeClient } from "./bibliotheque-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bibliothèque — Mouvement Christ Libère",
  description:
    "Deux espaces bien distincts : les livres gratuits du pasteur Kongo et ceux d'Afrika Pamela DALI.",
};

export default async function BibliothequePage() {
  const books = await db.book.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      servant: { select: { code: true, shortName: true } },
    },
  });

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
    />
  );
}
