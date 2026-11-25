-- ⭐ V4.38 — Bibliothèque documentaire (livres gratuits)
-- Modèle Book pour les publications du pasteur et d'Afrika Pamela.

CREATE TABLE IF NOT EXISTS "Book" (
    "id"            TEXT NOT NULL,
    "title"         TEXT NOT NULL,
    "author"        TEXT NOT NULL,
    "description"   TEXT NOT NULL,
    "category"      TEXT NOT NULL DEFAULT 'Autres',
    "coverUrl"      TEXT,
    "fileUrl"       TEXT,
    "fileSize"      INTEGER,
    "pageCount"     INTEGER,
    "language"      TEXT NOT NULL DEFAULT 'Français',
    "publishedYear" INTEGER,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "isPublished"   BOOLEAN NOT NULL DEFAULT true,
    "sortOrder"     INTEGER NOT NULL DEFAULT 0,
    "servantId"     TEXT,
    "createdAt"     TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Book_isPublished_idx" ON "Book"("isPublished");
CREATE INDEX IF NOT EXISTS "Book_category_idx" ON "Book"("category");
CREATE INDEX IF NOT EXISTS "Book_sortOrder_idx" ON "Book"("sortOrder");
CREATE INDEX IF NOT EXISTS "Book_servantId_idx" ON "Book"("servantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Book_servantId_fkey'
  ) THEN
    ALTER TABLE "Book"
      ADD CONSTRAINT "Book_servantId_fkey"
      FOREIGN KEY ("servantId") REFERENCES "Servant"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
