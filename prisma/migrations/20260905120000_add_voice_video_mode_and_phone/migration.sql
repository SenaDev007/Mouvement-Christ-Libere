-- ⭐ V2.7 — Bascule audio/vidéo des canaux vocaux + informations complètes du profil
-- Channel.videoMode : mode vidéo (façon WhatsApp) des canaux vocaux Yeshua Connect,
--   décidée par l'administrateur, propagée en temps réel via les métadonnées
--   de la room LiveKit `yeshua-voice-<channelId>`.
-- User.phone : numéro de téléphone des membres (profil « informations complètes »).

ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "videoMode" BOOLEAN DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
