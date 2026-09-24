-- ⭐ V3.100 — Témoignages des croyants (« Vies transformées »).
--
-- Distinction demandée par le pasteur : les témoignages des serviteurs
-- (model Testimony — /temoignages) et ceux des CROYANTS dont la vie a
-- été transformée (cette table — page /vie-transformee + section
-- « Vies transformées » de la landing).
--
-- Parcours : soumission publique en 2 modales (personnel →
-- professionnel) → statut en_attente → validation super admin
-- (/admin/vie-transformee) → statut publie → affichage public.
--
-- Appliquée automatiquement à l'exécution par ensureCroyantTestimoniesTable()
-- (src/lib/ensure-schema.ts — CREATE TABLE IF NOT EXISTS, idempotent) :
-- cette migration documente le schéma pour les environnements frais.

CREATE TABLE IF NOT EXISTS "CroyantTestimony" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT,
    "telephone" TEXT,
    "pays" TEXT,
    "ville" TEXT,
    "profession" TEXT,
    "eglise" TEXT,
    "categorie" TEXT NOT NULL DEFAULT 'vie_transformee',
    "titre" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "consentement" BOOLEAN NOT NULL DEFAULT true,
    "statut" TEXT NOT NULL DEFAULT 'en_attente',
    "noteAdmin" TEXT,
    "publishedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "CroyantTestimony_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CroyantTestimony_statut_idx" ON "CroyantTestimony"("statut");
CREATE INDEX IF NOT EXISTS "CroyantTestimony_publishedAt_idx" ON "CroyantTestimony"("publishedAt");
CREATE INDEX IF NOT EXISTS "CroyantTestimony_createdAt_idx" ON "CroyantTestimony"("createdAt");
