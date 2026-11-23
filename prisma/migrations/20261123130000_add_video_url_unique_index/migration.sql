-- ⭐ V4.30 — Index unique partiel sur Video.videoUrl
--
-- Garantit l'absence de doublons au niveau BASE DE DONNÉES (pas seulement
-- au niveau applicatif). Protection supplémentaire contre les race conditions
-- si deux syncs tournent en même temps (cron + clic manuel par exemple).
--
-- Index PARTIEL (WHERE videoUrl IS NOT NULL) :
--   - videoUrl est nullable (certains uploads chunked n'ont pas d'URL finale)
--   - un index partiel est plus léger et plus rapide qu'un unique constraint
--     classique sur colonne nullable (qui indexe aussi les NULL)
--   - Postgres autorise plusieurs NULL même avec un unique constraint, mais
--     l'index partiel est plus explicite sur l'intention
--
-- Idempotent : IF NOT EXISTS (la base de production a été initée via
-- `prisma db push`, pas `migrate deploy` — donc cette migration n'est pas
-- trackee dans _prisma_migrations, c'est normal).

CREATE UNIQUE INDEX IF NOT EXISTS "Video_videoUrl_unique_not_null"
  ON "Video"("videoUrl")
  WHERE "videoUrl" IS NOT NULL;
