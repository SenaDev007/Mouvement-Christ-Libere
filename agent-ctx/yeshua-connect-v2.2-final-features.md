# Yeshua Connect V2.2 — Final features (drag&drop, paste, emoji picker, push notifs, code blocks, spoilers)

## Contexte
Suite au câblage V2.1 (SlashCommands, LinkEmbed, MessageThreads, mentions, unreadCount,
load more — voir `yeshua-connect-wiring-main-agent.md`), cette V2.2 ajoute les 6
fonctionnalités "finales" demandées pour la messagerie Yeshua Connect.

## Tâches exécutées (1 fichier modifié)

### 1. Drag & Drop de fichiers (multiple)
- ✅ `handleDragEnter` / `handleDragOver` / `handleDragLeave` / `handleDrop` branchés sur
  le `<div>` "CHAT ZONE" (le wrapper `flex-1 flex flex-col`).
- ✅ `dragCounterRef` évite que l'overlay ne clignote quand la souris passe sur des
  éléments enfants (le dragenter/dragleave se déclenche à chaque changement de cible).
- ✅ Filtre sur `e.dataTransfer.types.includes("Files")` — n'affiche l'overlay QUE pour
  des fichiers (pas pour du texte sélectionné drag-and-drop).
- ✅ Upload séquentiel (boucle `for ... await uploadSingleFile`) des fichiers multiples
  via l'API attachment existante `/api/yeshua-connect/conversations/{id}/messages/attachment`.
- ✅ Overlay visuel : bordure pointillée dorée (`border-dashed border-[#C9A227]`) + icône
  `UploadCloud` + texte "Déposez vos fichiers ici", avec fond translucide `bg-[#FAF6EF]/80`
  + `backdrop-blur-sm`. Animé via Framer Motion `AnimatePresence`.

### 2. Paste d'image depuis le presse-papiers
- ✅ `handlePaste` branché sur le `<textarea>` (`onPaste={handlePaste}`).
- ✅ Détecte les images dans `e.clipboardData.items` (filtre `item.kind === "file" &&
  item.type.startsWith("image/")`), appelle `item.getAsFile()`.
- ✅ Supporte plusieurs images d'un seul paste (boucle `for ... of`).
- ✅ `e.preventDefault()` uniquement si au moins une image a été trouvée — sinon laisse
  le paste texte par défaut.
- ✅ Preview temporaire : `URL.createObjectURL(file)` → tableau `pastedImagePreviews`
  affiché au-dessus du textarea (grille 80×80px avec spinner + nom du fichier).
  L'object URL est révoqué (`URL.revokeObjectURL`) après upload.
- ✅ Réutilise `uploadSingleFile` (helper unifié).

### 3. Emoji Picker complet (7 catégories)
- ✅ Constante `EMOJI_CATEGORIES` (avant le composant) — 7 catégories :
  Smileys, Gestes, Cœur, Religion, Nature, Objets, Drapeaux.
  ~340 emojis Unicode natifs au total (pas de librairie externe).
- ✅ Composant `EmojiPicker` : barre de catégories (icônes cliquables) + nom de la
  catégorie active + grille scrollable 8 colonnes (`max-h-64 overflow-y-auto`) +
  footer hint.
- ✅ Popover shadcn/ui (`Popover` / `PopoverTrigger` / `PopoverContent`) align="start"
  side="top" sideOffset=8 — s'ouvre au-dessus du textarea.
- ✅ Bouton `Smile` (lucide-react, déjà importé) à côté du bouton image.
- ✅ `handleEmojiSelect` : insère l'emoji à la position du curseur dans le textarea
  (`input.selectionStart` / `setSelectionRange`) — pas juste à la fin. Restore le
  focus + place le caret APRÈS l'emoji via `requestAnimationFrame`.

### 4. Notifications push à la réception d'un message
- ✅ `useEffect(() => { ... }, [])` au mount demande `Notification.requestPermission()`
  si `Notification.permission === "default"`. Gère le cas où `requestPermission`
  retourne une Promise (catch silencieux) — pas de re-prompt si déjà accordée/refusée.
- ✅ Dans le `useEffect` existant qui écoute `onNewMessage` (callback Socket.io), après
  la déduplication + l'incrément unreadCount :
  - Si `document.hidden && !mutedConversationsRef.current.has(convId) && Notification.permission === "granted"`
  - Titre = `conv?.name || "Yeshua Connect"` (lookup via `conversationsRef.current`)
  - Body = `"${msg.senderName}: ${contentPreview}"` (preview tronqué à 200 chars,
    fallback `📎 ${attachmentName}` pour les messages sans content texte).
  - Préfère `navigator.serviceWorker.getRegistration("/sw-push.js").showNotification()`
    (notifications riches via SW existant — voir `usePushSubscription.ts`) ; fallback
    sur `new Notification()` si SW non disponible ou registration introuvable.
- ✅ Refs "live" (`conversationsRef`, `mutedConversationsRef`) pour éviter les closures
  stale dans le callback Socket.io SANS re-souscrire à chaque render (les deps du
  `useEffect` ne changent pas → le listener reste stable).

### 5. Code blocks ```lang\ncode```
- ✅ Composant `CodeBlock` : fond `bg-[#1E0F2B]`, header `bg-[#2A0E3D]/60` avec label
  langage (uppercase, font-mono) + bouton "Copier" (`navigator.clipboard.writeText`)
  avec feedback "Copié" pendant 2s (icône `Check` lucide).
- ✅ `<pre><code>` monospace `text-xs text-stone-100` + `overflow-x-auto` pour le scroll
  horizontal si longues lignes.
- ✅ Aucun syntax highlighting réel (conforme au cahier des charges).

### 6. Spoiler tags ||texte||
- ✅ Composant `SpoilerText` : `<button>` inline avec `bg-[#1E0F2B]` (hidden) et
  `bg-stone-300/60` (revealed). Texte masqué via `opacity-0` + `select-none`.
  `aria-pressed={revealed}` + `<span className="sr-only">` pour l'accessibilité.
- ✅ Toggle au clic (`setRevealed(r => !r)`), `e.stopPropagation()` pour éviter que le
  clic ne déclenche d'autres handlers.
- ✅ Le contenu du spoiler passe par `MessageContentWithMentions` — les mentions @name
  restent surlignées même à l'intérieur d'un spoiler.

### Refactorisation annexe
- ✅ Extraction de `uploadSingleFile` (helper unifié) depuis `handleFileSelect`.
  Détecte automatiquement IMAGE/AUDIO/VIDEO/FILE à partir du MIME type (l'ancien code
  ne gérait que IMAGE vs FILE). Réutilisé par : input file, drag&drop, paste.
- ✅ Remplacement de `<MessageContentWithMentions>` par `<RichMessageContent>` dans le
  rendu des messages texte (le wrapper `<p>` est devenu `<div>` pour supporter les
  blocs de code block-level).
- ✅ Nouveau pipeline de parsing : `RichMessageContent` → split par code blocks →
  `TextWithSpoilers` → split par spoilers → `MessageContentWithMentions` (rendu
  mentions existant inchangé). Les blocs de code ne sont JAMAIS interprétés.

## Validation
- ✅ `bunx eslint src/components/yeshua-connect/MessagingView.tsx` — 0 erreur, 0 warning.
- ✅ `bunx tsc --noEmit` sur MessagingView.tsx — 2 erreurs PRÉ-EXISTANTES sur
  `session.user.id` (NextAuth v5 beta type augmentation, documentées dans
  `yeshua-connect-wiring-main-agent.md` comme non-bloquantes et hors-scope).
  Aucune NOUVELLE erreur TypeScript introduite par cette V2.2.

## Fichiers modifiés
- `src/components/yeshua-connect/MessagingView.tsx` (2177 → 2696 lignes, +519 lignes)

## Détails techniques notables

### Gestion des closures stale dans le callback Socket.io
Le `useEffect` qui souscrit à `onNewMessage` a pour deps
`[onNewMessage, onMessageEdited, onMessageDeleted, currentUserId, activeConvId]`.
Si on avait ajouté `conversations` et `mutedConversations` aux deps, l'effet se
re-souscrirait à CHAQUE message entrant (puisque unreadCount est incrémenté →
conversations change → re-run). Solution : refs synchronisées via des effets
dédiés (`conversationsRef`, `mutedConversationsRef`), lues dans le callback.
Aucune re-souscription inutile.

### Anti-clignotement du drag overlay
`dragenter` / `dragleave` se déclenchent à CHAQUE changement d'élément cible
(y compris enfants). Sans compteur, l'overlay disparaîtrait dès qu'on survole un
enfant du container. `dragCounterRef` est incrémenté à chaque `dragenter` et
décrémenté à chaque `dragleave` — l'overlay ne disparaît que quand le compteur
retombe à 0 (i.e. la souris a vraiment quitté le container).

### Regex spoiler non-gourmande
`/\|\|([\s\S]+?)\|\|/g` — `[\s\S]+?` lazy pour matcher le PLUS PETIT contenu
possible entre deux `||`, ce qui permet de détecter correctement
`||a|| texte ||b||` comme deux spoilers séparés. Les spoilers imbriqués
(`||outer ||inner|| text||`) ne sont PAS supportés (comportement identique à
Discord/Slack — c'est une limite acceptée).

### Regex code block
`/```(\w*)\n?([\s\S]*?)```/g` :
- group 1 = langage optionnel (`\w*` matche "js", "python", "" etc.)
- `\n?` consomme le newline optionnel juste après les backticks ouvrants
- group 2 = contenu du bloc (lazy, `[\s\S]*?` pour supporter les newlines)
- Le trailing `\n` du contenu est strippé via `.replace(/\n$/, "")` pour ne pas
  afficher de ligne vide en bas du bloc.

### Popover shadcn/ui
Utilisation du composant `Popover` existant dans `src/components/ui/popover.tsx`
(Radix UI). `PopoverTrigger asChild` pour wrapper le bouton sans casser le DOM.
`PopoverContent` aligné `start` côté `top` avec `sideOffset=8` — s'ouvre au-dessus
de la barre d'input sans recouvrir le textarea.
