-- Ajout de l'état de pause pour les lives YouTube
-- Les viewers YouTube ne reçoivent pas le DataChannel LiveKit, donc on persiste
-- l'état de pause en base pour qu'ils puissent le récupérer via polling.

ALTER TABLE `LiveStream` ADD COLUMN `isPaused` BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE `LiveStream` ADD COLUMN `pausedAt` DATETIME(3) NULL;
