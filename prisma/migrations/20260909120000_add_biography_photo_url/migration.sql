-- ⭐ V3.47 — Photo des jalons biographiques.
--
-- Colonne Biography.photoUrl (TEXT, nullable) :
--   photo de chaque étape de la frise chronologique, affichée sur la
--   page publique du serviteur (/pam et /pasteur-kongo) et uploadée
--   depuis le modal biographique du back-office (/admin/biographies).
--   NULL = jalon sans photo (la frise reste élégante, point stylé).
--
-- Appliquée automatiquement à l'exécution par ensureBiographyPhotoColumn()
-- (src/lib/ensure-schema.ts — ALTER TABLE IF NOT EXISTS, idempotent) :
-- cette migration documente le schéma pour les environnements frais.

ALTER TABLE "Biography" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
