# ⭐ V3.22 — Lives publics : mode « YouTube » (0 participant viewer) + chaîne de repli

## Le problème constaté

Chaque viewer du site public rejoignait la room LiveKit en « subscriber »
(`roomJoin: true`) → **LiveKit comptait ET facturait chaque spectateur comme
un participant**. Un culte avec 200 viewers = 200 participants facturés.

## La solution (exactement « à l'instar de YouTube »)

```
STUDIO (le diffuseur)                    VIEWERS (spectateurs)
─────────────────────                    ──────────────────────
LiveKit Room ── 1 SEUL participant ──►   Egress HLS (serveur)
(caméra + micro + canvas overlay)        │
                                         ▼
                                 Flux HLS (comme YouTube TV)
                                         │
                                         ▼
                                 Lecteur <video> + hls.js
                                 (les viewers NE rejoignent
                                  JAMAIS la room : 0 participant,
                                  0 DataChannel, 0 interaction)
```

- **Le seul participant LiveKit est le diffuseur** (1).
- Les viewers regardent un flux HLS — réactions ❤️ et chat passent par
  l'API HTTP existante (aucune perte de fonctionnalité).
- Pause/lecture : persistée en base (`/api/live/[id]/pause`) et pollée par
  tous les viewers (comme les viewers YouTube déjà).
- Compteur de spectateurs : inchangé (base `LiveViewer`).

## Chaîne de repli des lives (comme les appels)

| Ordre | Fournisseur | Viewers | Studio |
|---|---|---|---|
| 1 | **LiveKit** (source de vérité) | HLS — **0 participant** | Room WebRTC (publisher) |
| 2 | **Agora** (si LiveKit tombe) | rôle **audience** (reçoivent, n'interagissent pas) | rôle host (même canvas + micro) |
| 3 | **Daily** (si Agora tombe aussi) | participants simples | room Daily (owner) |

- La **santé est partagée** avec les appels Yeshua (table
  `CallProviderHealth`) : une panne LiveKit bascule appels ET lives.
- Le choix est **persisté par live** (table `LiveMediaProvider`).
- Le **studio décide** de la bascule (c'est la source du flux) ; les viewers
  suivent automatiquement en ≤ 12 s (polling `GET /api/live/[id]/stream`).
- Si l'egress HLS échoue (quota/plan LiveKit), les viewers retombent
  **proprement** en WebRTC LiveKit — le direct continue sans interruption.

## Variables d'environnement (Vercel — AUCUNE n'est obligatoire)

| Variable | Rôle |
|---|---|
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | déjà configurées (Plan A Cloud) |
| `AGORA_APP_ID` / `AGORA_APP_CERTIFICATE` | repli 1 des lives (et des appels) |
| `DAILY_API_KEY` | repli 2 |
| `LIVE_VIEWER_MODE` | `hls` (défaut) ou `webrtc` — coupe le mode YouTube SANS redéploiement |

**Le mobile n'a rien à configurer** : les viewers mobiles hériteront du même
flux HLS (lecture native) dès l'écran live dédié de l'app.

## Économies / points d'attention facturation

- Participants facturés : **N → 1** (le diffuseur).
- L'egress HLS consomme des **minutes d'egress** LiveKit Cloud (même pot que
  le multistreaming RTMP déjà utilisé). L'arrêt automatique existe déjà :
  `/api/live/stop` arrête TOUS les egress de la room (HLS inclus) + la
  suppression de room ferme tout.
- Latence : le mode HLS ajoute ~10-20 s (comme YouTube). Si vous préférez
  la faible latence WebRTC pour un public réduit, passez
  `LIVE_VIEWER_MODE=webrtc` sur Vercel (effet immédiat, runtime).
