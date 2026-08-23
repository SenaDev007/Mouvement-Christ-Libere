# Déploiement Matrix Synapse — Mouvement Christ Libère

## Vue d'ensemble

Matrix Synapse est le serveur qui gère la messagerie chiffrée de bout en bout (E2E) de la plateforme. Il s'agit d'un composant indépendant de Next.js, déployé sur un VPS séparé pour des raisons de performance et de sécurité.

## Architecture

```
[Utilisateur] ←→ [Next.js frontend] ←→ [API routes]
                       ↓
                [Matrix Synapse server]  ←→ [PostgreSQL (Neon)]
                       ↓
                [Chiffrement E2E (Olm/Megolm)]
```

## Prérequis

- VPS avec 4GB RAM minimum (recommandé 8GB)
- Domaine configuré (ex: `matrix.mouvementchristlibere.org`)
- Certificat SSL (Let's Encrypt)
- Docker installé (recommandé pour le déploiement)

## Étapes de déploiement

### 1. Préparer le VPS

```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Installer Docker Compose
sudo apt install docker-compose-plugin -y
```

### 2. Configurer le DNS

Ajouter les enregistrements DNS suivants :

```
matrix.mouvementchristlibere.org  A  <IP_VPS>
matrix.mouvementchristlibere.org  AAAA  <IPv6_VPS>
```

### 3. Créer la configuration Synapse

```bash
# Générer la configuration initiale
docker run -it --rm \
    -v /srv/matrix/synapse:/data \
    -e SYNAPSE_SERVER_NAME=mouvementchristlibere.org \
    -e SYNAPSE_REPORT_STATS=yes \
    matrixdotorg/synapse:latest generate
```

### 4. Configurer `homeserver.yaml`

Éditer `/srv/matrix/synapse/homeserver.yaml` :

```yaml
server_name: mouvementchristlibere.org
public_baseurl: https://matrix.mouvementchristlibere.org/

# Base de données PostgreSQL (utiliser une DB dédiée sur Neon ou un PostgreSQL local)
database:
  name: psycopg2
  args:
    user: matrix
    password: <PASSWORD>
    database: matrix
    host: <DB_HOST>
    port: 5432
    cpumin: 5
    cpumax: 10

# Chiffrement E2E
encryption_enabled_by_default_for_room_type: invite

# Fédération (optionnel — désactiver pour un serveur privé)
federation_domain_whitelist: []

# Rate limiting
rc_messages_per_second: 0.5
rc_message_burst_count: 5

# Logs
log_config: /data/mouvementchristlibere.org.log.config
```

### 5. Configurer le reverse proxy (Nginx + Let's Encrypt)

```nginx
server {
    listen 443 ssl http2;
    server_name matrix.mouvementchristlibere.org;

    ssl_certificate /etc/letsencrypt/live/matrix.mouvementchristlibere.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/matrix.mouvementchristlibere.org/privkey.pem;

    location / {
        proxy_pass http://localhost:8008;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Client well-known
    location /.well-known/matrix/client {
        return 200 '{"m.homeserver": {"base_url": "https://matrix.mouvementchristlibere.org"}}';
        add_header Content-Type application/json;
        add_header Access-Control-Allow-Origin *;
    }
}
```

### 6. Démarrer Synapse

```bash
# Créer le réseau Docker
docker network create matrix

# Démarrer Synapse
docker run -d \
    --name synapse \
    --network matrix \
    -v /srv/matrix/synapse:/data \
    -p 8008:8008 \
    matrixdotorg/synapse:latest

# Vérifier les logs
docker logs -f synapse
```

### 7. Créer le bot de modération

```bash
# Créer un utilisateur bot
docker exec -it synapse register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008

# Répondre :
# - New user localpart: modbot
# - Password: <MOT_DE_PASSE_FORT>
# - User admin: Yes
```

### 8. Configurer les variables d'environnement

Dans Vercel (Project Settings → Environment Variables) :

```
NEXT_PUBLIC_MATRIX_HOMESERVER_URL=https://matrix.mouvementchristlibere.org
MATRIX_ADMIN_USER=@modbot:mouvementchristlibere.org
MATRIX_ADMIN_PASSWORD=<MOT_DE_PASSE_FORT>
```

### 9. Tester la connexion

```bash
# Vérifier que le serveur répond
curl https://matrix.mouvementchristlibere.org/_matrix/client/versions

# Doit renvoyer quelque chose comme :
# {"versions":["v1.11",...]}
```

## Synchronisation NextAuth ↔ Matrix

### Création de compte automatique

Quand un utilisateur s'inscrit sur Next.js (NextAuth), il faut automatiquement créer un compte Matrix correspondant. Cela se fait via l'API d'administration de Synapse :

```typescript
// src/lib/matrix-sync.ts
import { createMatrixClient } from "./matrix";

export async function createMatrixUser(userId: string, password: string) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL}/_synapse/admin/v1/users/@${userId}:mouvementchristlibere.org`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${await getAdminToken()}`,
      },
      body: JSON.stringify({
        password,
        admin: false,
        deactivated: false,
      }),
    }
  );

  return response.ok;
}
```

### SSO via OIDC (recommandé en production)

Pour éviter de stocker les mots de passe Matrix, configurer le SSO OIDC :

1. Installer [Synapse OIDC Provider](https://github.com/matrix-org/synapse/blob/develop/docs/openid.md)
2. Configurer NextAuth comme fournisseur OIDC
3. Les utilisateurs se connectent une seule fois sur Next.js, et sont automatiquement authentifiés sur Matrix

## Sauvegarde des clés E2E

**Critique** : Les clés de chiffrement E2E sont stockées côté client. Si un utilisateur perd son appareil sans sauvegarde, ses messages sont perdus.

### Solution : Key backup

Activer le key backup dans Synapse pour permettre la récupération :

```yaml
# homeserver.yaml
encryption_enabled_by_default_for_room_type: invite
```

Côté client, implémenter l'export des clés :

```typescript
// Export des clés pour sauvegarde
const keys = await client.crypto.exportRoomKeys();
const encrypted = encryptKeyBackup(keys, userPassphrase);
// Sauvegarder `encrypted` localement (téléchargement)
```

## Modération

### Bot de modération

Le bot `@modbot:mouvementchristlibere.org` peut :

- Supprimer des messages (via redaction)
- Bannir des utilisateurs
- Verrouiller des canaux
- Déléguer la modération à des humains

### Journal d'audit

Toutes les actions de modération sont consignées dans une room Matrix dédiée `#moderation-log:mouvementchristlibere.org`, accessible uniquement aux super-admins.

## Monitoring

- **Healthcheck** : `GET /_matrix/health`
- **Métriques** : `GET /_synapse/metrics` (Prometheus)
- **Logs** : `docker logs synapse`

## Sauvegardes

### Quotidiennes

```bash
# Sauvegarde de la DB Matrix (si locale)
pg_dump -U matrix matrix > /backups/matrix-$(date +%Y%m%d).sql

# Sauvegarde des fichiers Synapse (clés, médias)
tar -czf /backups/synapse-$(date +%Y%m%d).tar.gz /srv/matrix/synapse
```

### Restauration

```bash
# Restaurer la DB
psql -U matrix matrix < /backups/matrix-20260101.sql

# Restaurer les fichiers
tar -xzf /backups/synapse-20260101.tar.gz -C /
```

## Risques et mitigations

| Risque | Mitigation |
|---|---|
| Perte de clés E2E | Key backup + export régulier |
| Surcharge du serveur | Rate limiting + scaling horizontal |
| Censure du serveur | Hébergement multi-juridictionnel + fédération de secours |
| Faille de sécurité | Mises à jour régulières + audit annuel |
| Dérive autoritaire | Journal d'audit public + procédure d'appel |

## Coûts estimés

| Poste | Coût mensuel |
|---|---|
| VPS Hetzner CX32 (4 vCPU, 8GB RAM) | 12 € |
| Domaine matrix.* | 1 € |
| Sauvegardes (S3) | 2 € |
| **Total** | **~15 €/mois** |
