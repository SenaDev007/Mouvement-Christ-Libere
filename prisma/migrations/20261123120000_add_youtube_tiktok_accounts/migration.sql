-- ⭐ V4.26 — Comptes YouTube + TikTok multi-serviteurs
-- Chaque serviteur peut avoir un compte YouTube (OAuth 2.0) et un compte
-- TikTok (scraping tikwm) liés. Les tokens OAuth sont chiffrés côté app
-- (AES-256-GCM via SESSION_SECRET) — en base on ne stocke que le ciphertext.
--
-- Idempotent : toutes les creations utilisent IF NOT EXISTS pour pouvoir
-- etre rejouee sans erreur (la base de production a ete initiee via
-- `prisma db push`, pas `migrate deploy`, donc cette migration n'est pas
-- trackee dans la table _prisma_migrations — c'est normal).

-- CreateTable: YoutubeAccount
CREATE TABLE IF NOT EXISTS "YoutubeAccount" (
    "id"            TEXT NOT NULL,
    "servantId"     TEXT NOT NULL,
    "channelId"     TEXT,
    "channelTitle"  TEXT,
    "clientId"      TEXT NOT NULL,
    "clientSecret"  TEXT NOT NULL,        -- ciphertext AES-256-GCM
    "refreshToken"  TEXT NOT NULL,        -- ciphertext AES-256-GCM
    "actif"         BOOLEAN NOT NULL DEFAULT true,
    "dernierSyncAt" TIMESTAMPTZ(3),
    "derniereErreur" TEXT,
    "createdAt"     TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "YoutubeAccount_pkey" PRIMARY KEY ("id")
);

-- 1 compte YouTube par serviteur (relation 1:1)
CREATE UNIQUE INDEX IF NOT EXISTS "YoutubeAccount_servantId_key" ON "YoutubeAccount"("servantId");
CREATE INDEX IF NOT EXISTS "YoutubeAccount_actif_idx" ON "YoutubeAccount"("actif");

-- Contrainte FK : suppression en cascade si le serviteur est supprimé
-- (IF NOT EXISTS supporté par PostgreSQL ≥ 14 ; Neon utilise PG 17).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'YoutubeAccount_servantId_fkey'
  ) THEN
    ALTER TABLE "YoutubeAccount"
      ADD CONSTRAINT "YoutubeAccount_servantId_fkey"
      FOREIGN KEY ("servantId") REFERENCES "Servant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- CreateTable: TiktokAccount
CREATE TABLE IF NOT EXISTS "TiktokAccount" (
    "id"            TEXT NOT NULL,
    "servantId"     TEXT NOT NULL,
    "username"      TEXT NOT NULL,        -- sans le @
    "displayName"   TEXT,
    "actif"         BOOLEAN NOT NULL DEFAULT true,
    "dernierSyncAt" TIMESTAMPTZ(3),
    "derniereErreur" TEXT,
    "createdAt"     TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TiktokAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TiktokAccount_servantId_key" ON "TiktokAccount"("servantId");
CREATE INDEX IF NOT EXISTS "TiktokAccount_actif_idx" ON "TiktokAccount"("actif");
CREATE INDEX IF NOT EXISTS "TiktokAccount_username_idx" ON "TiktokAccount"("username");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TiktokAccount_servantId_fkey'
  ) THEN
    ALTER TABLE "TiktokAccount"
      ADD CONSTRAINT "TiktokAccount_servantId_fkey"
      FOREIGN KEY ("servantId") REFERENCES "Servant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
