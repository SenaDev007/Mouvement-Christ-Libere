-- Nettoyage ponctuel des titres de la rubrique d'Afrika.
-- Portée : catégorie exacte « Saint-Esprit réponds-moi ».
-- Première exécution en production le 2026-10-08 : 262 lignes modifiées.
-- La vidéo déjà dépourvue du préfixe reste inchangée.
-- Relancer ce script ne modifie aucune autre ligne et renvoie 0 après succès.

BEGIN;

WITH changed AS (
  UPDATE "Video" AS v
  SET "title" = btrim(regexp_replace(
        v."title",
        '^[[:space:]]*Saint-Esprit réponds-moi[[:space:]]*[—–:-]?[[:space:]]*',
        '',
        'i'
      )),
      "updatedAt" = CURRENT_TIMESTAMP
  FROM "Servant" AS s
  WHERE s."id" = v."servantId"
    AND s."code" = 'afrika'
    AND v."category" = 'Saint-Esprit réponds-moi'
    AND v."title" ILIKE 'Saint-Esprit réponds-moi%'
  RETURNING v."id"
)
SELECT COUNT(*)::int AS updated_count FROM changed;

COMMIT;
