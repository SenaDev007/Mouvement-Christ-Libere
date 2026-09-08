-- ⭐ V3.46 — Rubriques vidéo signatures
--   « Saint-Esprit réponds-moi » (Pam), « Rhema du matin » / « Rhema du soir » (Pasteur Kongo)
--
-- Colonne rubrique/catégorie EXPLICITE :
--   Video.category        — assignée depuis le back-office (module Vidéos)
--                           ou héritée du live à l'archivage du replay ;
--   LiveStream.category   — posée à la programmation du live (module Lives).
-- NULL = catégorisation automatique historique (mots-clés du titre).
--
-- Appliquée automatiquement à l'exécution par ensureRubriquesColumns()
-- (src/lib/ensure-schema.ts — ALTER TABLE IF NOT EXISTS, idempotent) :
-- cette migration documente le schéma pour les environnements frais.

ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "LiveStream" ADD COLUMN IF NOT EXISTS "category" TEXT;
