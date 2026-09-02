# ⭐ V3.23 — Notifications push mobiles (FCM)

## Ce qui a été livré

| Événement | Notification | Priorité |
|---|---|---|
| Appel privé entrant | « X vous appelle (audio/vidéo) » | HAUTE (sonne même app fermée, Android) |
| Message privé (DM) reçu | « X : <aperçu du message> » | normale |

- Notifications visibles **application fermée / en arrière-plan** (Android :
  bac système automatique ; iOS : nécessite APNs — voir ci-dessous).
- App ouverte : rien ne change (le polling temps réel existant gère).
- Canaux publics : pas de push (50 membres ≠ 50 vibrations) — le badge
  non-lus dans l'app suffit.
- Sans configuration FCM : **tout est silencieux** — zéro erreur, zéro
  impact sur l'existant.

## Configuration (une seule fois, ~10 minutes)

1. **Console Firebase** → https://console.firebase.google.com → *Créer un
   projet* (ex. « yeshua-connect ») → gratuit suffit.
2. Dans le projet → ⚙️ *Paramètres du projet* → onglet **Cloud Messaging**
   → activer l'API si proposé.
3. Onglet **Comptes de service** → *Créer un compte de service* (rôle :
   « Éditeur Firebase » ou minimal) → *Générer une clé privée* →
   télécharger le `.json`.
4. Dans le `.json` (ouvrez avec un éditeur de texte), récupérez :
   - `project_id`   → **FCM_PROJECT_ID**
   - `client_email` → **FCM_CLIENT_EMAIL**
   - `private_key`  → **FCM_PRIVATE_KEY** (gardez TOUTE la valeur avec
     `\n` — sur Vercel, collez-la telle quelle)
5. **Vercel** → projet `Mouvement-Christ-Libere` → Settings → Environment
   Variables → ajouter les 3 variables. Effet **immédiat** (runtime).

Côté **app mobile** : les identifiants Firebase de l'app
(`--dart-define=FIREBASE_API_KEY=…,FIREBASE_APP_ID=…,FIREBASE_SENDER_ID=…,
FIREBASE_PROJECT_ID=…`) se récupèrent dans la même console :
*Paramètres du projet → Général → Vos applications → (ajouter une app
Android)* → `google-services.json` → `api_key`, `mobilesdk_app_id`,
`project_number`, `project_id`.

⚠️ **iOS** : les push exigent en plus un compte Apple Developer (~99 $/an)
+ certificat APNs téléversé dans Firebase (Cloud Messaging → iOS).

## Ce qu'il faut retenir

- **Aucune clé privée dans l'app mobile** : le mobile ne connaît que ses
  identifiants publics Firebase ; l'envoi des notifications est 100 %
  serveur (Vercel), le token FCM de chaque appareil est enregistré via
  `POST /api/yeshua-connect/devices` (auth NextAuth).
- Les appareils désinstallés sont auto-désactivés (réponse 404/410 FCM).
- Table : `PushDevice` (token, userId, platform, active) — créée
  automatiquement au premier appel.
