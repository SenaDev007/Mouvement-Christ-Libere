/**
 * Page publique — /bibliotheque
 * ⭐ V4.42 — Bibliothèque scindée en espaces distincts par serviteur :
 * l'espace du pasteur Kongo et l'espace d'Afrika Pamela DALI (plus un
 * espace « Collectif » si des ouvrages sans serviteur existent).
 * Catégorisée, avec miniatures, lecteur PDF intégré et téléchargement.
 *
 * ⭐ V4.44 — Bibliothèque réelle : par défaut, TOUTE la bibliothèque est
 * affichée avec ses TOTAUX (ouvrages, catégories, téléchargements) ;
 * cliquer un serviteur ouvre SON espace (grille + chiffres à jour), et
 * cliquer dans le vide (ou re-cliquer la carte active) ramène à tout.
 * Les cartes d'espace affichent les VRAIES photos de profil des
 * serviteurs, lues depuis la base (même source unique que la landing :
 * module serviteur → Servant.portraitUrl, repli bioPhoto du hero, puis
 * fichiers historiques — cf. servant-photos.ts, V3.77).
 */

import { db } from "@/lib/db";
import { photosServiteurs } from "@/lib/servant-photos";
import { BibliotequeClient } from "./bibliotheque-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bibliothèque — Mouvement Christ Libère",
  description:
    "Tous les ouvrages gratuits du ministère : ceux du pasteur Kongo et ceux d'Afrika Pamela DALI. Choisissez un espace ou parcourez l'ensemble, avec lecture en ligne et téléchargement.",
};

export default async function BibliothequePage() {
  const [books, photos] = await Promise.all([
    db.book.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        servant: { select: { code: true, shortName: true } },
      },
    }),
    photosServiteurs(),
  ]);

  return (
    <BibliotequeClient
      photos={photos}
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
