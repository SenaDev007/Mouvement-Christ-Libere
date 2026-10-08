-- ⭐ V4.04 — Repli lecture TikTok auto-hébergé.
--
-- Problème : l'embed TikTok (tiktok.com/embed/v2/<id>) refuse parfois la
-- lecture avec l'écran « overload-protect triggered » (saturation CDN
-- persistante sur les vidéos populaires), alors que la vidéo se lit
-- normalement sur tiktok.com. La parade V4.03 (« Réessayer ») ne suffit
-- pas quand le refus persiste.
--
-- Solution : répliquer le MP4 de chaque vidéo TikTok sur notre stockage
-- R2 (backfill /api/tiktok/backfill-videos — même mécanique que les
-- miniatures V3.85) et lire NOTRE copie dans le lecteur public.
--
-- Colonne : Video.tiktokMp4Url — URL R2 publique du mp4 répliqué.
-- NULL = pas encore sauvegardée → lecteur embed TikTok classique.
--
-- Appliquée automatiquement à l'exécution par ensureTiktokMp4UrlColumn()
-- (src/lib/ensure-schema.ts — ALTER TABLE IF NOT EXISTS, idempotent) :
-- cette migration documente le schéma pour les environnements frais.

ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "tiktokMp4Url" TEXT;
