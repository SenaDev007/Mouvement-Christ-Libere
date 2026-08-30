-- V2.1 — Réactions emoji persistées, épinglage des messages, métadonnées pièces jointes
-- Migration non-destructive (toutes les colonnes sont optionnelles ou ont une valeur par défaut).

-- ============================================================
-- 1) Étendre la table "Channel" — date du dernier message (tri des canaux)
-- ============================================================
ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "lastMessageAt" TIMESTAMP(3);

-- ============================================================
-- 2) Étendre la table "Message" — épinglage + métadonnées
-- ============================================================
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "isPinned"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "pinnedAt"       TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "pinnedBy"       TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "attachmentName" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "attachmentSize" INTEGER;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "attachmentMime" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "duration"       DOUBLE PRECISION;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "verseRef"       TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "verseText"      TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "editedHistory"  JSONB;

-- Index pour récupérer rapidement les messages épinglés d'un canal
CREATE INDEX IF NOT EXISTS "Message_isPinned_idx" ON "Message"("isPinned");

-- ============================================================
-- 3) Créer la table "MessageReaction"
-- ============================================================
CREATE TABLE IF NOT EXISTS "MessageReaction" (
    "id"        TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "emoji"     TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);

-- Contrainte d'unicité : un utilisateur ne peut réagir qu'une fois avec le même emoji
-- sur un même message (toggle on/off).
CREATE UNIQUE INDEX IF NOT EXISTS "MessageReaction_messageId_userId_emoji_key"
    ON "MessageReaction"("messageId", "userId", "emoji");

-- Index pour lister rapidement toutes les réactions d'un message.
CREATE INDEX IF NOT EXISTS "MessageReaction_messageId_idx" ON "MessageReaction"("messageId");

-- Clé étrangère vers Message (avec cascade : supprimer un message supprime ses réactions).
ALTER TABLE "MessageReaction"
    ADD CONSTRAINT "MessageReaction_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "Message"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
