# ⭐ Kit de bascule LiveKit — Christ Libère (Plan B)

## Objectif

Si **LiveKit Cloud** (`christ-libere.livekit.cloud`) cesse de fonctionner (clés expirées,
quota dépassé, service arrêté), ce kit permet de **reprendre le service en quelques minutes,
gratuitement**, sur une machine virtuelle gratuite à vie — **sans changer UNE SEULE LIGNE de code**
de l'application. Les appels Yeshua Connect, canaux vocaux, directs intra-canal et le module
Live (egress RTMP vers YouTube/Facebook) reprennent à l'identique.

## Architecture

```
[ Application Vercel ]  ──wss──▶  [ Caddy (TLS auto) ]  ──▶  [ LiveKit Server (Docker) ]
   (aucun code modifié)              live.votre-domaine.tld        VM Oracle Cloud gratuite
```

## 1. La VM gratuite (Oracle Cloud Always Free)

1. Créer un compte sur https://cloud.oracle.com (carte bancaire demandée à l'inscription,
   **rien n'est débité** sur le tier gratuit).
2. Créer une instance **VM.Standard.A1.Flex** : 4 OCPU ARM + 24 Go RAM (Always Free à vie),
   image **Ubuntu 22.04+** (ou Canonical Ubuntu 24.04), 10 To/mois de trafic sortant inclus —
   largement suffisant pour la communauté.
3. **Ouvrir les ports** dans deux endroits (les deux sont indispensables) :
   - *Security List / Network Security Group* Oracle (ingress) :
     - TCP `443` (wss TLS), TCP `80` (challenge Let's Encrypt)
     - TCP `7881` et UDP `7881` (média RTC)
     - UDP `3478` + TCP `3478` (TURN), UDP `5349` (TURN TLS)
   - Le pare-feu de la VM (au premier démarrage) :
     ```bash
     sudo iptables -I INPUT -j ACCEPT
     sudo netfilter-persistent save
     ```
4. Noter l'**IP publique** de la VM.

## 2. Un nom de domaine (obligatoire pour le TLS)

Les navigateurs bloquent `ws://` depuis un site HTTPS : LiveKit auto-hébergé DOIT être
servi en `wss://` (TLS). Deux options gratuites :

- **Vous avez un domaine** : créer un sous-domaine (ex. `live.votredomaine.com`) avec un
  enregistrement **A** vers l'IP de la VM.
- **Pas de domaine** : créer un sous-domaine gratuit sur https://www.duckdns.org
  (ex. `christ-libere.duckdns.org`) pointé vers l'IP de la VM. Caddy obtient et renouvelle
  le certificat Let's Encrypt automatiquement dans les deux cas.

## 3. Déployer le kit

Sur la VM (en SSH) :

```bash
# Docker + compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && exit   # puis se reconnecter

# Récupérer le kit (depuis ce dépôt, dossier deploy/livekit-failover/)
git clone https://github.com/SenaDev007/Mouvement-Christ-Libere.git
cd Mouvement-Christ-Libere/deploy/livekit-failover

# a) Générer la paire clé/secret LiveKit et la noter :
docker run --rm livekit/livekit-server --generate-keys
#    → API Key: APIxxxxxxxxxx
#    → API Secret: **************************

# b) Renseigner la clé dans livekit.yaml (remplacer devkey: devsecret)
nano livekit.yaml

# c) Renseigner le domaine dans Caddyfile (remplacer live.exemple.tld)
nano Caddyfile

# d) Démarrer :
docker compose up -d

# e) Vérifier :
curl http://localhost:7880            # → "OK"
docker compose logs -f livekit        # doit afficher "starting LiveKit server"
```

## 4. Basculer l'application (3 variables, ~2 minutes)

Dans **Vercel → Projet → Settings → Environment Variables**, remplacer :

| Variable | Ancienne valeur (Cloud) | Nouvelle valeur (auto-hébergé) |
|---|---|---|
| `LIVEKIT_URL` | `wss://christ-libere.livekit.cloud` | `wss://live.votre-domaine.tld` |
| `LIVEKIT_API_KEY` | (clé cloud) | `APIxxxxxxxxxx` (générée en 3a) |
| `LIVEKIT_API_SECRET` | (secret cloud) | `**************************` |

Puis **Deployments → bouton « ⋯ » → Redeploy** (les lambdas lisent ces variables au
démarrage à froid ; le redéploiement garantit la prise en compte immédiate).

C'est tout : les appels, canaux vocaux, directs intra-canal et lives reprennent.
La sonnerie, les journaux d'appel et le chat n'ont jamais dépendu de LiveKit
(V3.18 — voir worklog) et restent intacts pendant TOUTE la bascule.

> ℹ️ Retour au Cloud plus tard : remettre les 3 anciennes variables et redéployer.
> Le mode P2P (Plan C, appels 1-1 sans serveur) continue de fonctionner quel que
> soit le serveur LiveKit actif — c'est un filet de sécurité indépendant.

## Contenu du kit

| Fichier | Rôle |
|---|---|
| `docker-compose.yml` | LiveKit + Caddy (TLS automatique Let's Encrypt) |
| `livekit.yaml` | Configuration LiveKit (clés, RTC, TURN intégré) |
| `Caddyfile` | Reverse proxy wss → LiveKit, certificat auto |

## Supervision recommandée

```bash
docker compose ps                 # les deux services doivent être "running"
docker compose logs --tail=50 caddy
# Mémoire : la VM gratuite a 24 Go — LiveKit consomme ~200 Mo au repos
```

Sauvegarde : rien à sauvegarder (aucune donnée persistante — les rooms sont éphémères,
l'historique vit dans PostgreSQL Neon, pas sur la VM).
