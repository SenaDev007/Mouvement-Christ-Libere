-- V2.3 — Audit Log pour la modération Yeshua Connect
--
-- Stocke les actions sensibles (suppression/édition/épinglage de messages,
-- création de canaux, etc.) pour audit ultérieur par les modérateurs et
-- administrateurs.
--
-- Migration non-destructive (nouvelle table, aucune colonne ajoutée aux
-- tables existantes).

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id"        TEXT NOT NULL,
    "action"    TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "targetId"  TEXT,
    "channelId" TEXT,
    "metadata"  JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- Index pour lister rapidement les entrées d'audit d'un canal (ordre chrono).
CREATE INDEX IF NOT EXISTS "AuditLog_channelId_createdAt_idx"
    ON "AuditLog"("channelId", "createdAt");

-- Index pour retrouver l'historique d'audit d'un utilisateur précis.
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx"
    ON "AuditLog"("userId");

-- Clé étrangère vers User (cascade : supprimer un user supprime ses entrées
-- d'audit — évite les orphan rows).
ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
