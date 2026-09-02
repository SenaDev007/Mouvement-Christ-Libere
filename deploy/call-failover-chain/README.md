# ⭐ V3.21 — Chaîne de repli des appels : LiveKit → Agora → Daily

## Directive

« **LiveKit** est la source de vérité. Si LiveKit a des problèmes, **Agora** prend
immédiatement le relais. Et si Agora a des problèmes, **Daily** prend automatiquement
le relais. » (pasteur, 2026-09-02)

```
NOUVEL APPEL ──▶ LiveKit (Cloud ou auto-hébergé Plan B)
                    │ échec (connexion impossible OU coupure en cours d'appel)
                    ▼
                 Agora ──── échec ───▶ Daily ──── échec ───▶ Plan C historique
                                                            (P2P 1-1 / Jitsi groupe)
```

- **Arbitrage 100 % serveur** (`/api/yeshua-connect/calls/media`) : le fournisseur de
  CHAQUE appel est persisté en base (`CallSignal.mediaProvider`) — l'appelant et le
  destinataire rejoignent toujours le MÊME réseau, même si l'appelant a basculé
  pendant la sonnerie.
- **Bascule à chaud** : le polling de statut (2 s) renvoie `mediaProvider` — si
  l'autre partie a déclenché un failover, notre média bascule sans raccrocher.
- **Santé partagée** (table `CallProviderHealth`) : un fournisseur défaillant entre
  en cooldown **5 minutes** → les nouveaux appels tombent directement sur son
  remplaçant ; à l'expiration, LiveKit redevient la source de vérité automatiquement.
- **Canaux vocaux** : même mécanique (table `VoiceMediaProvider`, clé par canal).

## Configuration (Vercel → Settings → Environment Variables)

Aucun redéploiement n'est nécessaire : les variables sont lues au runtime.

### 1. LiveKit — déjà configuré (source de vérité)

```
LIVEKIT_URL             wss://christ-libere.livekit.cloud   (Plan A — défaut)
LIVEKIT_API_KEY         …
LIVEKIT_API_SECRET      …
```

> Bascule Plan B (auto-hébergé) : voir `deploy/livekit-failover/README.md` —
> changer les 3 variables suffit, sans toucher au code.

### 2. Agora (repli n°1) — https://console.agora.io

1. Créer un compte **gratuit** (10 000 minutes/mois offertes).
2. Créer un **projet** de type « Appels audio/vidéo » avec **sécurité par token
   (App ID + App Certificate)** activée.
3. Copier dans Vercel :

```
AGORA_APP_ID            <App ID — 32 caractères>
AGORA_APP_CERTIFICATE   <Certificat primaire — 32 caractères>
```

⚠️ Les deux font exactement **32 caractères** (un token vide sinon — le générateur
vérifie les longueurs et échoue silencieusement).

4. Rien d'autre : le token RTC est généré côté serveur (`agora-token` — paquet
   officiel), la room est déterministe (`yeshua-call-<convId>`), aucun secret ne
   transite vers le navigateur.

### 3. Daily (repli n°2) — https://dashboard.daily.co

1. Créer un compte **gratuit** (2 000 minutes de visio offertes, pas de carte).
2. Copier la **clé API** (Developers → API keys) dans Vercel :

```
DAILY_API_KEY           <clé API>
```

3. Rien d'autre : les rooms privées (`yeshua-call-<convId>` / `yeshua-voice-<convId>`)
   sont créées à la demande par l'API REST côté serveur, meeting-token généré par
   appel. Un échec réseau Daily nourrit automatiquement la santé du fournisseur.

### Règle d'or

Un fournisseur **sans identifiants est simplement sauté** — la chaîne se dégrade
proprement (ex. LiveKit → Daily si Agora n'est pas configuré). Configurez Agora
d'abord (repli le plus généreux en minutes gratuites), Daily ensuite.

## Vérification après configuration

```bash
# Santé de la chaîne (authentifié) :
curl -H "Cookie: <session>" "https://mouvement-christ-libere.vercel.app/api/yeshua-connect/calls/media"
# → { "chain": ["livekit","agora","daily"], "current": "livekit" }
```

## Ce qui se voit côté utilisateur

- Badge discret sous le nom pendant l'appel : **« Réseau : LiveKit »** /
  **« Réseau : Agora (secours) »** / **« Réseau : Daily (secours) »**.
- Bandeau doré pendant la bascule : **« Bascule automatique vers le réseau de
  secours… »** — l'appel continue, personne ne raccroche.
- Journal d'appel inchangé (durées, manqués, refusés) — le fournisseur ne change
  RIEN à la signalisation ni à l'historique.
