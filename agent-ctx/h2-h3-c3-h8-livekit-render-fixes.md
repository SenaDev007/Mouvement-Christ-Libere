# H2-H3-C3-H8 — Fixes LiveKit Egress/Ingress + Render R2

**Date**: 2026-08-30
**Agent**: main-agent (work done directly, no subagent delegation)
**Task IDs**: H2, H3, C3, H8

## Contexte

Quatre problèmes de production dans le projet Mouvement Christ Libère :

- **H2** — Egress RTMP utilisait `startRoomCompositeEgress(..., "speaker")` qui
  injectait un layout composite inutile (le studio publie déjà un canvas
  composite via `live-studio-client.tsx`).
- **H3** — L'URL RTMP finale était `${url}/${key}` ; si l'admin saisit l'URL
  avec slash final, on obtenait `rtmp://host//key`.
- **C3** — La route `/api/live/[id]/ingress` fabriquait une URL
  `rtmp://{host}/{roomName}` sans créer d'Ingress réel côté LiveKit — l'URL
  n'était pas validée et ne fonctionnait pas.
- **H8** — La route `/api/videos/[id]/render` faisait
  `fs.copyFile(finalFile, public/rendered-videos/...)` qui déclenche `EROFS`
  sur Vercel (filesystem read-only).

## Vérification du SDK `livekit-server-sdk` v2.18.0

Inspecté `node_modules/livekit-server-sdk/dist/*.d.ts` :

- ✅ `EgressClient.startTrackCompositeEgress(roomName, output, opts: TrackCompositeOptions)` existe.
  ⚠️ `TrackCompositeOptions` n'a **pas** de champ `trackName` — il faut
  `audioTrackId` et/ou `videoTrackId` (qui sont en réalité des **track SIDs**,
  pas des noms). Le snippet de l'énoncé (`{ trackName: "composite" }`) était
  incorrect ; j'ai dû résoudre le SID à runtime via `RoomServiceClient.listParticipants`.
- ✅ `IngressClient` + `IngressInput` existent et sont ré-exportés depuis
  `livekit-server-sdk`.
  ⚠️ La signature réelle est `createIngress(inputType, opts: CreateIngressOptions)`
  avec `opts.participantIdentity` **obligatoire**. Le snippet de l'énoncé
  `createIngress(IngressInput.RTMP_INPUT, roomName, { name: ... })` était
  incorrect (3 args positionnels au lieu de 2).
- ✅ `RoomServiceClient.listParticipants(roomName)` retourne des
  `ParticipantInfo[]` avec `tracks: TrackInfo[]`, chaque `TrackInfo` expose
  `sid`, `name`, `type` (où `type === TrackType.VIDEO|AUDIO`).
- ✅ `StreamOutput`, `TrackType` sont ré-exportés depuis `livekit-server-sdk`.

## Fichiers modifiés

### 1. `src/app/api/live/[id]/egress/route.ts` (H2 + H3)

- Ajout d'une fonction `stripTrailingSlash(url)` appliquée à toutes les URLs
  RTMP (YouTube, Facebook, TikTok, Instagram) avant concaténation avec la clé.
  → fix H3.
- Ajout d'une fonction `resolveCompositeTrackIds(roomService, roomName)` qui
  liste les participants de la room et résout :
  - `videoTrackId` = SID du track vidéo nommé `"composite"` (fallback :
    premier track vidéo publié)
  - `audioTrackId` = SID du premier track audio publié
- Remplacement de
  `egressClient.startRoomCompositeEgress(roomName, streamOutput, "speaker")`
  par
  `egressClient.startTrackCompositeEgress(roomName, streamOutput, { audioTrackId, videoTrackId })`
  → fix H2.
- Conversion `wss://` → `https://` pour les clients server-sdk (qui attendent
  une URL HTTP, pas WebSocket).
- Réponse enrichie avec `trackDiagnostic`, `audioTrackId`, `videoTrackId`.
- Garde-fou : si aucun track n'est publié dans la room, retour 400 avec
  message "démarrez d'abord le studio LiveKit".

### 2. `src/app/api/live/[id]/ingress/route.ts` (C3)

- Import de `IngressClient, IngressInput` depuis `livekit-server-sdk`.
- Création d'un véritable Ingress LiveKit :
  ```ts
  const info = await ingressClient.createIngress(IngressInput.RTMP_INPUT, {
    name: `live-${id}`,
    roomName,
    participantIdentity: `obs-${id}`,
    participantName: `OBS Studio (live ${id})`,
    enableTranscoding: true, // requis pour RTMP_INPUT
  });
  ```
- Retourne `info.url`, `info.streamKey`, `info.ingressId` fournis par LiveKit
  (au lieu de l'URL fabriquée `rtmp://{host}/{roomName}`).
- Conversion `wss://` → `https://` pour `IngressClient`.

### 3. `src/app/api/videos/[id]/render/route.ts` (H8)

- Import de `uploadToR2, generateKey, isR2Configured` depuis `@/lib/r2`.
- Garde-fou en début de route : si R2 n'est pas configuré, retour 500 avec
  message clair (les fichiers rendus sont trop gros pour le fallback base64).
- Le répertoire temporaire passe de `process.cwd()/tmp/...` à `/tmp/...`
  (seul répertoire inscriptible sur Vercel serverless).
- Remplacement de :
  ```ts
  const outputDir = path.join(process.cwd(), "public", "rendered-videos");
  await fs.mkdir(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, `video-${id}.mp4`);
  await fs.copyFile(finalFile, outputFile);
  const outputUrl = `/rendered-videos/video-${id}.mp4`;
  ```
  par :
  ```ts
  const finalBuffer = await fs.readFile(finalFile);
  const r2Key = generateKey("rendered-videos", `video-${id}`, "mp4");
  const outputUrl = await uploadToR2(r2Key, finalBuffer, "video/mp4");
  ```
- `Video.videoUrl` stocke désormais l'URL publique R2 au lieu du chemin local.
- Réponse enrichie avec `storage: "r2"`.

## Vérification

- ✅ `bunx eslint` sur les 3 fichiers modifiés → exit 0 (aucune erreur).
- ✅ Les 15 erreurs résiduelles du `bun run lint` global sont pré-existantes
  dans `src/hooks/use-matrix-client.ts` et `src/components/yeshua-connect/ScreenShare.tsx`
  (non liées à ces fixes).
- ✅ Toutes les APIs SDK utilisées sont confirmées par les fichiers
  `.d.ts` publiés dans `node_modules/livekit-server-sdk/dist/`.
