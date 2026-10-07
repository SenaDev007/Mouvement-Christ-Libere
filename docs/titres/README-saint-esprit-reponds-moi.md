# Propositions de titres — « Saint-Esprit réponds-moi »

**Relevé : 7 octobre 2026** · Servante : **Afrika**

Fichiers associés :

- `saint-esprit-reponds-moi-273.csv` : tableau à relire ou à utiliser comme base de renommage.
- `saint-esprit-reponds-moi-273.json` : même mapping, au format structuré.

## Couverture

La page de la catégorie annonce **273 éléments**. Le relevé comprend **269 liens TikTok de vidéos et 4 liens TikTok de publications photo**; les 273 éléments sont présents dans les fichiers, avec leur identifiant et leur URL source.

| Base de rédaction | Nombre | Traitement |
| --- | ---: | --- |
| Sous-titres automatiques TikTok | 216 | Titres proposés à partir des paroles transcrites |
| Texte lisible sur la miniature (OCR) | 51 | Propositions prudentes; vidéo à écouter avant validation |
| Sans transcription ni texte de miniature exploitable | 6 | Sujet à confirmer, sans invention de contenu |

Au total, **62 lignes** portent `needs_review=true` : les 57 lignes sans transcription complète et 5 lignes dont la transcription ne permettait pas un intitulé suffisamment assuré.

## Champs du CSV/JSON

- `id` : identifiant de l'entrée dans le catalogue.
- `current_title` / `proposed_title` : titre actuel / proposition.
- `videoUrl` : lien TikTok source.
- `source_basis`, `source_status`, `evidence` : fondement et justification courte de la proposition.
- `confidence` : confiance rédactionnelle (`élevée`, `moyenne`, `faible`).
- `needs_review` : validation humaine recommandée avant renommage.

Les titres ont été normalisés en français, préfixés par le nom de la série et rendus uniques. Les doublons de sujet restent possibles; les dates sont alors ajoutées pour les distinguer.

## Limites et portée

- Les titres sont des **propositions**, pas des modifications appliquées aux vidéos, au site ou à la base de données.
- Les sous-titres sont générés automatiquement par TikTok et peuvent contenir des erreurs.
- Une miniature ne vérifie pas le contenu intégral d'une vidéo. Toute proposition issue de l'OCR est explicitement signalée comme telle et doit être écoutée/visionnée avant publication.
- Pour les six lignes sans éléments de contenu fiables, le titre reste provisoire (« Sujet à confirmer ») afin de ne pas inventer le thème.
