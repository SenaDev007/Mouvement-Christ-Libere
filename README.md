# Mouvement Christ Libère

Plateforme numérique centralisée pour le ministère de **PAM** (Afrika Alkebulane Pamela Dali) et du **Pasteur Kongo** — témoignages, enseignements, vidéos, et vie de communauté.

## Vision

Bâtir une infrastructure de Royaume : centraliser, sécuriser, et rayonner — au service du rassemblement des fils d'Israël dispersés, en préparation au retour du Maître Yeshoua au son du chofar.

## Stack technique

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS 4** + shadcn/ui (composants 21st.dev)
- **Prisma ORM** (SQLite en dev, PostgreSQL prévu en production)
- **NextAuth.js** pour l'authentification (V2)
- Design system : **Concept D — Pourpre prophétique & Or sacré**

## Structure multi-tenant

| Sous-domaine | Serviteur actif |
|---|---|
| `amela.dali.<domain>` | PAM |
| `pasteurkongo.<domain>` | Pasteur Kongo |
| `<domain>` (root) | Commun (les deux) |

Le routing multi-sous-domaines est géré par `src/proxy.ts` (convention Next.js 16).

## Démarrage

```bash
bun install
bun run dev    # http://localhost:3000
bun run lint   # ESLint
```

## Pages principales

- `/` — Accueil (hero, stats, présentation duale, dernier enseignement, témoignages à la une)
- `/biographie` — Frise chronologique PAM / Pasteur Kongo
- `/temoignages` — Témoignages filtrables (thème, serviteur, statut)
- `/enseignements` — Enseignements bibliques (recherche, niveau, serviteur)
- `/videos` — Vidéos & lives (lecteur style YouTube, badge EN DIRECT)
- `/communaute` — Canaux (texte, voix, restreints E2E)
- `/contribuer` — Dons et dîmes (carte, virement, mobile money, crypto)
- `/contact` — Formulaire de demande d'appel

## Roadmap

Voir le cahier des charges (`/download/Cahier_des_charges_Plateforme_Royaume_Yeshoua.pdf`) pour le phasage complet en 5 versions (MVP → V4).

## Design system

- **Palette** : Violet impérial `#2A0E3D`, Or sacré `#C9A227`, Ivoire chaud `#FAF6EF`
- **Typographies** : Cormorant Garamond (titres), Inter (corps)
- **Iconographie** : motifs hébraïques au trait fin (menorah, chofar), jamais ésotérique

## Conformité

- RGPD (transparence, minimisation, droit à l'effacement)
- Modération transparente (charte publique, journal d'audit)
- Protection des mineurs (DM désactivé, contrôle parental)
- Droits audio/vidéo : propriété exclusive des auteurs, usage personnel uniquement

## Licence

Tous les contenus appartiennent à leurs auteurs. Usage personnel et non commercial.
