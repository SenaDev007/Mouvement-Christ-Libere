# Christ Libère

Plateforme numérique centralisée pour le ministère de **PAM** (Afrika Alkebulane Pamela Dali) et du **Pasteur Kongo** — témoignages, enseignements, vidéos, vie de communauté, et backoffice complet de gestion.

## Stack technique

- **Next.js 16** (App Router, TypeScript, Turbopack)
- **Tailwind CSS 4** + shadcn/ui (New York style) + Lucide icons
- **Prisma ORM** + **PostgreSQL** (Neon — serverless compatible)
- **NextAuth.js** (prévu V2)
- Design system : **Concept D — Pourpre prophétique & Or sacré**
- Polices : **Cormorant Garamond** (titres) + **Inter** (corps)

## Structure

### Site public
- `/` — Accueil (hero, stats, présentation duale PAM/Kongo, dernier enseignement, témoignages)
- `/biographie` — Frise chronologique
- `/temoignages` — Témoignages filtrables
- `/enseignements` — Enseignements bibliques
- `/videos` — Vidéos & lives
- `/communaute` — Canaux de communauté
- `/contribuer` — Dons et dîmes
- `/contact` — Formulaire de demande d'appel

### Backoffice (protégé)
- `/admin/login` — Authentification
- `/admin/dashboard` — Vue d'ensemble + stats
- `/admin/servants` — Gestion serviteurs (CRUD)
- `/admin/biographies` — Jalons biographiques (CRUD)
- `/admin/testimonies` — Témoignages (CRUD + statut modération)
- `/admin/teachings` — Enseignements (CRUD)
- `/admin/videos` — Vidéos (CRUD)
- `/admin/lives` — Lives programmés (CRUD)
- `/admin/channels` — Canaux communauté (CRUD)
- `/admin/users` — Utilisateurs (CRUD)
- `/admin/contact-requests` — Demandes de contact (marquer traité/archiver)
- `/admin/donations` — Dons reçus (lecture)

## Démarrage local

### Prérequis
- Node.js 20+ ou Bun 1.3+
- Une base PostgreSQL (Neon, Supabase, ou locale)

### Installation

```bash
bun install
```

### Configuration environnement

Copier `.env.example` en `.env.local` et remplir :

```bash
cp .env.example .env.local
```

Variables critiques :
- `DATABASE_URL` — URL PostgreSQL pooler (avec `?pgbouncer=true&connection_limit=1`)
- `DIRECT_URL` — URL PostgreSQL directe (pour migrations)
- `ADMIN_DEFAULT_PASSWORD` — Mot de passe backoffice
- `SESSION_SECRET` — Secret pour signature cookies

### Base de données

```bash
# 1. Pousser le schéma
bun run db:push

# 2. Peupler avec les données initiales
bun run db:seed

# 3. (Optionnel) Explorer la base
bun run db:studio
```

### Démarrage

```bash
bun run dev    # http://localhost:3000
bun run lint   # ESLint
```

## Déploiement Vercel

### 1. Connecter le repo
1. Aller sur [vercel.com](https://vercel.com)
2. Importer le repo GitHub `SenaDev007/Mouvement-Christ-Libere`
3. Framework preset : **Next.js** (auto-détecté)

### 2. Configurer les variables d'environnement
Dans Project Settings → Environment Variables :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | `postgresql://...pooler...?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | `postgresql://...direct...` (sans pgbouncer) |
| `ADMIN_DEFAULT_PASSWORD` | Votre mot de passe admin fort |
| `SESSION_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://votre-domaine.vercel.app` |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | `https://votre-domaine.vercel.app` |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `mouvementchristlibere.org` |

### 3. Déploiement
- Vercel build automatiquement à chaque push
- Le build exécute `prisma generate` automatiquement (postinstall)
- Pour pousser le schéma sur Neon : `bun run db:push` en local

### 4. Domaines personnalisés
Dans Vercel → Project → Settings → Domains :
- `mouvementchristlibere.org` (principal)
- `amela.dali.mouvementchristlibere.org` (sous-domaine PAM)
- `pasteurkongo.mouvementchristlibere.org` (sous-domaine Pasteur Kongo)

Le routing multi-sous-domaines est géré par `src/proxy.ts`.

## Backoffice — Accès

1. Aller sur `/admin/login`
2. Saisir le mot de passe défini dans `ADMIN_DEFAULT_PASSWORD`
3. Session valide 8 heures (cookie httpOnly signé HMAC-SHA256)

**⚠️ Sécurité** : Changer `ADMIN_DEFAULT_PASSWORD` en production par un mot de passe fort (min 16 caractères).

## Architecture multi-tenant

| Sous-domaine | Serviteur actif |
|---|---|
| `amela.dali.<domain>` | PAM |
| `pasteurkongo.<domain>` | Pasteur Kongo |
| `<domain>` (root) | Commun (les deux) |

Le routing est géré par `src/proxy.ts` (convention Next.js 16, remplace `middleware.ts`).

## Modèle de données

Schéma Prisma complet dans `prisma/schema.prisma` :

- **Servant** — PAM, Pasteur Kongo
- **Biography** — Frise chronologique
- **Testimony** — Témoignages (avec statut TO_DISCERN / CONFIRMED / ARCHIVED)
- **Teaching** — Enseignements (niveau Découverte / Intermédiaire / Avancé)
- **Video** — Vidéos archivées
- **LiveStream** — Lives programmés (statut SCHEDULED / LIVE / ENDED)
- **Community** + **Channel** + **Message** — Média social intégré
- **User** — Utilisateurs (rôles hiérarchiques)
- **Call** — Appels audio/vidéo
- **ContactRequest** — Demandes de contact
- **Donation** — Dons reçus

## Design system

- **Palette** : Violet impérial `#2A0E3D`, Or sacré `#C9A227`, Ivoire chaud `#FAF6EF`
- **Typographies** : Cormorant Garamond (titres), Inter (corps)
- **Iconographie** : motifs hébraïques au trait fin (menorah, chofar)
- **Angles** : peu arrondis (4-8px) pour sobriété géométrique
- **Mode sombre** : natif (violet impérial)

## Roadmap

Voir le cahier des charges pour le phasage complet (MVP → V4).

- **MVP (livré)** : Site vitrine + backoffice CRUD + base PostgreSQL
- **V1** : Streaming multiplateforme, média social complet
- **V2** : Messagerie E2E, appels WebRTC, calendrier liturgique
- **V3** : Carte des dispersés, app mobile, sous-titrage IA
- **V4** : Mode bunker, réseau Samuel (mesh), scale international

## Licence

Tous les contenus appartiennent à leurs auteurs. Usage personnel et non commercial.
