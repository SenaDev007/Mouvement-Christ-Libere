-- Add likeCount column to LiveChatMessage for message likes
ALTER TABLE "LiveChatMessage" ADD COLUMN IF NOT EXISTS "likeCount" INTEGER NOT NULL DEFAULT 0;
