# Yeshua Connect — Câblage des composants (SlashCommands, LinkEmbed, MessageThreads, Mentions, UnreadCount, LoadMore)

## Contexte
Le projet `Mouvement-Christ-Libere` dispose déjà des composants `SlashCommands.tsx`,
`LinkEmbed.tsx`, `MessageThreads.tsx` mais ils ne sont PAS intégrés dans `MessagingView.tsx`.
Le but est de les câbler et d'ajouter les fonctionnalités manquantes (mentions, unreadCount,
pagination "load more").

## Stack
- Next.js 16 (App Router) + TypeScript 5
- Prisma + PostgreSQL (ChannelMember.lastReadAt existe déjà)
- NextAuth v5 (auth.ts expose `session.user.id` et `session.user.role`)
- Socket.io (useChatSocket hook déjà en place)
- Pas de server actions — uniquement des routes API `/api/...`

## Tâches exécutées

### 1. Backend (4 fichiers)
- ✅ Création `src/app/api/yeshua-connect/conversations/[id]/members/route.ts` (GET)
  → Liste les membres d'un canal pour l'autocomplétion @mention.
- ✅ Création `src/app/api/yeshua-connect/conversations/[id]/read/route.ts` (POST)
  → Met à jour `ChannelMember.lastReadAt` à la date actuelle (upsert pour modérateurs non-membres).
- ✅ Update `src/app/api/yeshua-connect/conversations/route.ts`
  → Calcule unreadCount = messages depuis lastReadAt (en parallèle pour tous les canaux).
  → Expose `lastReadAt` dans la réponse pour sync client.
- ✅ Update `src/app/api/yeshua-connect/conversations/[id]/messages/route.ts`
  → Ajoute `?before=<messageId>` pour la pagination cursor (Prisma cursor + take négatif).
  → Corrige le chargement initial : retourne désormais les `limit` messages les plus RÉCENTS
    (au lieu des plus anciens) — nécessaire pour que le "Load more" ait du sens.

### 2. Frontend - Composants existants (3 fichiers réparés)
- ✅ `LinkEmbed.tsx` : bug `api_url` undefined → utilise `api.url()` de `@/lib/api-client`.
  Refactor en `LinkEmbed` (wrapper avec `key={url}`) + `LinkEmbedInner` (état paresseux)
  pour éviter le `setState in effect` interdit par react-hooks/set-state-in-effect.
- ✅ `SlashCommands.tsx` : utilisait mauvaise API bible → désormais `parserReference` +
  `/api/bible-v2/fr-apee/{livreId}/{chapitre}` puis extrait le(s) verset(s) demandé(s).
  Refactor : `filteredCommands` en `useMemo` (au lieu de state + effect), navigation
  clavier ↑/↓/Enter/Échap, `executeCommand` retourne un `SlashCommandResult` discriminé
  (`send` | `clear` | `noop`) pour que MessagingView décide quoi faire.
- ✅ `MessageThreads.tsx` : aucune modif nécessaire — juste câblé dans MessagingView.

### 3. Frontend - Câblage MessagingView.tsx (6 fonctionnalités)
- ✅ **SlashCommands** : popover au-dessus du textarea quand l'input commence par "/".
  `/bible Jean 3:16` → insère un message VERSE avec verseRef + verseText.
  `/clear` → vide l'écran de chat côté client.
  `/help` → affiche l'aide dans le chat.
  `/poll`, `/announce` → placeholders.
- ✅ **LinkEmbed** : détecte les URLs dans `msg.content` via `extractUrls()`,
  affiche `<LinkEmbed url={url} />` sous chaque message (max 3 embeds/message).
- ✅ **MessageThreads** : bouton MessageCircle dans la barre d'actions hover de chaque
  message → ouvre le panneau latéral droit. Threads stockés en `useState` (client-side V1).
  Badge or avec le nombre de réponses dans le thread.
- ✅ **Mentions @user** : `detectMentionQuery()` au caret → dropdown `MentionAutocomplete`
  avec les membres du canal (chargés via `/members`). Navigation ↑/↓/Enter/Tab/Échap.
  Insertion `@name ` avec restauration du caret. Rendu `MessageContentWithMentions`
  surligne les mentions en jaune/or (gère les noms multi-mots comme "Pasteur Kongo").
- ✅ **UnreadCount** : badge rouge dans la sidebar (au lieu de gold). Au changement de
  conversation : POST `/read` → update `ChannelMember.lastReadAt`. Socket.io incrémente
  `unreadCount` en temps réel pour les convs non actives. Côté API : unreadCount calculé
  depuis `lastReadAt` (exclut les propres messages de l'utilisateur).
- ✅ **Load More** : bouton "Charger les messages précédents" en haut de la liste.
  Fetch avec `?before=<oldestId>` (cursor pagination). Préserve la position de scroll
  (`prevHeightRef` + restauration) pour ne pas bondir l'utilisateur vers le haut.

## Validation
- ✅ `bun run lint` clean sur tous les fichiers modifiés (0 erreurs, 0 warnings).
- ✅ `tsc --noEmit` : 0 erreurs sur les fichiers créés/modifiés (les erreurs restantes
  sont pré-existantes sur `session.user.id` liées à next-auth v5 beta type augmentation,
  et sur `search/route.ts` qui n'a pas été touché).

## Fichiers créés
- `src/app/api/yeshua-connect/conversations/[id]/members/route.ts` (89 lignes)
- `src/app/api/yeshua-connect/conversations/[id]/read/route.ts` (78 lignes)

## Fichiers modifiés
- `src/app/api/yeshua-connect/conversations/route.ts` (+86 lignes : unreadCount + lastReadAt)
- `src/app/api/yeshua-connect/conversations/[id]/messages/route.ts` (+50 lignes : ?before cursor)
- `src/lib/yeshua-connect/types.ts` (+5 lignes : lastReadAt? sur ChatConversation)
- `src/components/yeshua-connect/LinkEmbed.tsx` (réécrit : 80 → 153 lignes)
- `src/components/yeshua-connect/SlashCommands.tsx` (réécrit : 138 → 354 lignes)
- `src/components/yeshua-connect/MessagingView.tsx` (1431 → 2007 lignes, +576 lignes)
