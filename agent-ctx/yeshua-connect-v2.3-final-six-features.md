# Yeshua Connect V2.3 — 6 dernières fonctionnalités manquantes

## Statut : ✅ TERMINÉ

## Contexte
Suite aux versions V2.1 (SlashCommands, LinkEmbed, MessageThreads, mentions, unreadCount, load more)
et V2.2 (drag&drop, paste, emoji picker, push notifs, code blocks, spoilers), cette V2.3 ajoute
les 6 dernières fonctionnalités manquantes de Yeshua Connect.

## Tâches exécutées

### 1. ✅ APPELS AUDIO/VIDÉO WEBRTC RÉELS (LiveKit)
- `startCall(type: "audio" | "video")` : fetch /api/livekit/token avec role="publisher",
  roomName=`yeshua-call-<conversationId>`, crée une `Room` livekit-client, publie le micro
  (toujours) et la caméra (si vidéo) via `room.localParticipant.setMicrophoneEnabled` /
  `setCameraEnabled`.
- Listeners `RoomEvent.TrackSubscribed`, `ParticipantConnected`, `ParticipantDisconnected`,
  `Disconnected` mettent à jour `remoteParticipants` (state React).
- `CallOverlay` (sous-composant) : overlay plein écran (`fixed inset-0 z-[60]`), PIP vidéo
  locale en haut à droite, vidéo distante plein écran (si appel vidéo + participant connecté),
  avatar + pulse animé sinon.
- Boutons : mute micro (`MicOff`/`Mic`), toggle caméra (`Video`), speaker (`Volume2`/`VolumeX`),
  raccrocher (`PhoneOff` rouge).
- Compteur de durée d'appel (mm:ss) qui démarre quand `callState === "active"`.
- `endCall()` : `room.disconnect(true)` + cleanup tracks + setCallState("idle").
- Cleanup automatique au unmount du composant (useEffect cleanup).
- Attachement des tracks LiveKit aux éléments `<video>`/`<audio>` via `track.attach(el)` /
  `track.detach(el)` dans des effets dédiés (gèrent correctement le cycle de vie React).

### 2. ✅ CANAUX VOICAUX PERSISTANTS (VOICE)
- `ConversationType` étendu avec "VOICE" (types.ts).
- Route `/api/yeshua-connect/conversations` mappe `ChannelType.VOICE` → `ConversationType.VOICE`.
- Sidebar : section "Canaux vocaux" dédiée avec icône `Volume2`.
- `VoiceChannelView` (sous-composant) : remplace la zone messages + input quand
  `activeConv.type === "VOICE"`.
  - État déconnecté : bouton "🔊 Rejoindre le canal vocal".
  - État connecté : liste des participants connectés (moi + remoteParticipants),
    boutons mute/speaker/leave, info "Le canal reste ouvert même si vous le quittez".
- `joinVoiceChannel()` : roomName=`yeshua-voice-<conversationId>` (persistante côté serveur).
- `leaveVoiceChannel()` : disconnect — le canal reste, l'utilisateur peut le rejoindre à nouveau.
- Input bar masqué pour les canaux VOICE.

### 3. ✅ GALERIE MÉDIAS DU CANAL
- Bouton "Galerie" (`ImageIcon`) dans le header du chat.
- `loadGallery()` : fetch `/api/yeshua-connect/conversations/<id>/messages?limit=200` puis
  filtre côté client les messages avec `attachmentUrl`.
- Modal (composant `Modal` existant) avec grille 3 colonnes d'éléments `aspect-square` :
  - Images : thumbnail cliquable → lightbox plein écran.
  - Vidéos : icône `Play` + nom du fichier, lien de téléchargement.
  - Audios : icône `Mic` dorée + nom, lien de téléchargement.
  - Fichiers : icône `getFileIcon` + nom + `Download`.
- Sender info overlay au survol (couleur selon le rôle via `getRoleColor`).
- Lightbox plein écran (`z-[70]`) : image centrée, bouton Fermer (X), bouton Télécharger.

### 4. ✅ GIF PICKER (Giphy API publique)
- Bouton "GIF" (texte stylisé) à côté de l'emoji picker dans la barre d'input.
- Popover shadcn/ui (`Popover`/`PopoverTrigger`/`PopoverContent`) au-dessus du textarea.
- `GifPicker` (sous-composant) :
  - Barre de recherche avec debounce 400ms (gifSearchTimeoutRef).
  - Appel à `https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=QUERY&limit=24&rating=g`
    (clé publique démo Giphy, pas d'auth requise).
  - Grille 3 colonnes d'éléments `aspect-square` avec preview du GIF (fixed_height_small).
  - État vide : "Tapez une recherche pour afficher des GIFs" + "Propulsé par Giphy".
  - Loading spinner pendant la recherche.
- `sendGif(url, name)` : POST `/api/yeshua-connect/conversations/<id>/messages` avec
  `type: "IMAGE"`, `attachmentUrl: <gifUrl>`, `attachmentName: "gif-<id>.gif"`,
  `attachmentMime: "image/gif"`. Le GIF est rendu via le rendu IMAGE existant dans MessagingView.
- Diffusion Socket.io (best-effort) après envoi.

### 5. ✅ AUDIT LOG
- Modèle Prisma `AuditLog` (action, userId, targetId?, channelId?, metadata?, createdAt)
  avec relation `user User @relation(... onDelete: Cascade)` et back-relation `auditLogs AuditLog[]`
  sur User.
- Migration SQL `20260903120000_add_audit_log/migration.sql` (CREATE TABLE + 2 index +
  FK vers User avec cascade).
- `db.auditLog.create()` ajouté dans :
  - `messages/[messageId]/delete/route.ts` → action "MESSAGE_DELETE" (stocke extrait contenu original).
  - `messages/[messageId]/edit/route.ts` → action "MESSAGE_EDIT" (stocke ancien + nouveau contenu).
  - `messages/[messageId]/pin/route.ts` → action "MESSAGE_PIN" ou "MESSAGE_UNPIN" (toggle).
  - `channels/route.ts` POST → action "CHANNEL_CREATE" (stocke name/description/type/communityId/isEncrypted).
- API GET `/api/yeshua-connect/audit-log?channelId=xxx&limit=100` :
  - 🔒 Auth NextAuth requise.
  - 🔒 Réservé SUPER_ADMIN/ADMIN/MODERATOR (403 sinon).
  - Retourne les entrées triées par `createdAt desc`, avec user info (id, name, avatarUrl, role).
- Bouton "Audit Log" (`ScrollText` lucide) dans le header du chat, visible seulement si
  `AUDIT_PRIVILEGED_ROLES.has(currentUserRole)` (réservé modérateurs et +).
- Modal d'audit log : liste scrollable des entrées avec user (couleur rôle), action formatée
  lisible (`formatAuditAction`), metadata formatée (`formatAuditMetadata`).

### 6. ✅ RÔLES COULEURS SUR LES NOMS
- Fonction `getRoleColor(role?: string)` retourne un hex selon le rôle :
  - SUPER_ADMIN → #C9A227 (or)
  - ADMIN → #8C5FA8 (violet)
  - MODERATOR → #5B7052 (vert)
  - ANIMATOR → #3b82f6 (bleu)
  - MEMBER / MEMBER_VERIFIED / défaut → #8A8378 (gris)
- Appliqué via `style={{ color: senderColor }}` sur le `<p>` du senderName dans le rendu
  des messages (remplace l'ancien `text-[#8C5FA8]` hardcodé).
- Aussi appliqué dans :
  - Galerie médias (overlay sender info).
  - Audit log modal (user name).
  - Voice channel view (chips des membres du canal).
- Le rôle vient de `msg.senderRole` (UserRole du User, exposé par l'API messages) ou
  `channelMembers[i].role` (ChannelRole) — les deux enums partagent les mêmes libellés.

## Authentification LiveKit pour Yeshua Connect
L'API `/api/livekit/token` existante exigeait une session admin (cookie `admin_session`)
pour le `role="publisher"`. Pour les appels Yeshua Connect, l'utilisateur est authentifié
via NextAuth, pas admin. Solution : modifier la route pour accepter AUSSI une session
NextAuth valide quand le `roomName` commence par `yeshua-call-` ou `yeshua-voice-`
(namespacing des rooms Yeshua). Ceci empêche un utilisateur Yeshua de publier dans une
room de live studio.

## Validation
- ✅ `npx eslint src/components/yeshua-connect/MessagingView.tsx` + 8 autres fichiers modifiés
  → **0 erreur, 0 warning** sur les fichiers modifiés.
- ✅ `npx tsc --noEmit` sur les fichiers modifiés → **0 nouvelle erreur TypeScript**.
  Les 3 erreurs restantes sur MessagingView.tsx (lignes 247, 380, 2853) sont des erreurs
  PRÉ-EXISTANTES documentées sur `session.user.id` / `session.user.role` (NextAuth v5 beta
  type augmentation, voir `yeshua-connect-wiring-main-agent.md` — non-bloquantes et hors-scope).
- ✅ `bun run db:push` — schéma AuditLog sync avec PostgreSQL Neon.

## Fichiers modifiés
1. `prisma/schema.prisma` — modèle AuditLog + relation user + back-relation auditLogs sur User.
2. `prisma/migrations/20260903120000_add_audit_log/migration.sql` — migration SQL (CREATE TABLE + 2 index + FK).
3. `src/lib/yeshua-connect/types.ts` — ajout type "VOICE" à ConversationType, "GIF" à MessageType.
4. `src/app/api/yeshua-connect/conversations/route.ts` — mapper ChannelType.VOICE → ConversationType.VOICE.
5. `src/app/api/yeshua-connect/messages/[messageId]/delete/route.ts` — ajout AuditLog (action MESSAGE_DELETE).
6. `src/app/api/yeshua-connect/messages/[messageId]/edit/route.ts` — ajout AuditLog (action MESSAGE_EDIT).
7. `src/app/api/yeshua-connect/messages/[messageId]/pin/route.ts` — ajout AuditLog (actions MESSAGE_PIN / MESSAGE_UNPIN).
8. `src/app/api/yeshua-connect/channels/route.ts` — ajout AuditLog sur POST (action CHANNEL_CREATE).
9. `src/app/api/yeshua-connect/audit-log/route.ts` — NOUVEAU GET endpoint (réservé modérateurs).
10. `src/app/api/livekit/token/route.ts` — accepter NextAuth session pour publishers Yeshua (rooms namespaced).
11. `src/components/yeshua-connect/MessagingView.tsx` — les 6 features UI (2696 → 3948 lignes, +1252 lignes).

## Nouveaux sous-composants dans MessagingView.tsx
- `getRoleColor(role)` — helper couleur selon le rôle.
- `AUDIT_PRIVILEGED_ROLES` — Set des rôles pouvant consulter l'audit log.
- `GifPicker` — popover de recherche + grille 3 colonnes de GIFs Giphy.
- `formatAuditAction(action)` — traduit "MESSAGE_DELETE" → "🗑️ Message supprimé" etc.
- `formatAuditMetadata(metadata)` — formate lisible le JSON metadata de l'audit log.
- `VoiceChannelView` — UI complète du canal vocal (rejoindre / participants / contrôles).
- `CallOverlay` — overlay plein écran pour appels audio/vidéo LiveKit (vidéo locale PIP +
  vidéo distante + boutons mute/caméra/speaker/hangup + compteur de durée).

## Détails techniques notables

### Gestion des closures stale dans les callbacks LiveKit
Les listeners `room.on(RoomEvent.TrackSubscribed, ...)` sont définis dans `startCall` /
`joinVoiceChannel` (useCallback). Ils utilisent `setRemoteParticipants` qui est stable
(state setter React). Aucune closure stale car on ne lit pas d'état React dans les listeners,
on ne fait que des `set`.

### Cleanup LiveKit au unmount
`useEffect(() => { return () => cleanupLiveKit(); }, [cleanupLiveKit])` — appelle
`cleanupLiveKit` au unmount du composant pour éviter les fuites de tracks micro/caméra si
l'utilisateur quitte la page pendant un appel. `cleanupLiveKit` stoppe les tracks locaux
(audio, vidéo, stream), disconnect la Room, et reset les states.

### Attachement des tracks LiveKit aux éléments <video>/<audio>
Dans `CallOverlay`, 3 `useEffect` dédiés attachent les tracks (local caméra, remote vidéo,
remote audio) aux éléments `<video>`/`<audio>` via `track.attach(el)`. La fonction `attach`
attend un `HTMLMediaElement` non-null — on extrait le ref dans une variable locale `el`
typée non-null après le check `if (!el) return`. Le cleanup détache proprement via
`track.detach(el)` dans un try/catch.

### Namespacing des rooms LiveKit Yeshua
- `yeshua-call-<conversationId>` pour les appels 1-1 (audio ou vidéo).
- `yeshua-voice-<conversationId>` pour les canaux vocaux persistants.
Ce namespacing côté roomName + check `isYeshuaRoom()` côté API token permet à l'API
`/api/livekit/token` d'autoriser les publishers Yeshua (NextAuth) sans compromettre la
sécurité des rooms de live studio (admin-only).

### Prisma relation User ↔ AuditLog
Le modèle AuditLog du spec utilisateur n'avait pas de relation Prisma déclarée. Pour
pouvoir faire `db.auditLog.findMany({ include: { user: ... } })` (nécessaire pour afficher
le nom de l'auteur dans l'UI d'audit), j'ai ajouté la relation `user User @relation(...)`
sur AuditLog + la back-relation `auditLogs AuditLog[]` sur User. Cette modification est
conventionnelle Prisma (toutes les autres tables avec userId ont leur relation) et n'ajoute
aucune colonne — juste la contrainte FK. `onDelete: Cascade` évite les orphan rows.
