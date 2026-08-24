# Déploiement Arweave — Coffre-fort numérique

## Vue d'ensemble

Le coffre-fort Arweave ancre les contenus (témoignages, enseignements, vidéos) sur la blockchain Arweave pour immutabilité. Arweave est un réseau de stockage permanent : une fois un contenu uploadé, il est conservé éternellement (200+ ans) sans frais récurrents.

## Mode démo vs Production

### Mode démo (par défaut)

Sans configuration, le coffre-fort fonctionne en **mode démo** :
- Calcule le hash SHA-256 du contenu (preuve d'intégrité)
- Ne fait pas d'upload réel sur Arweave
- Permet de tester l'interface et la logique de hachage

### Mode production

Avec une clé Arweave configurée, le coffre-fort fait un **ancrage réel** :
- Upload le contenu + hash sur Arweave
- Renvoie un `transaction ID` (txId) et une URL permanente (`https://arweave.net/{txId}`)
- Le contenu est immuable et accessible même si le site est censuré

## Configuration Arweave

### 1. Créer un wallet Arweave

```bash
# Installer arweave-deploy
npm install -g arweave-deploy

# Générer une clé (keyfile JSON)
arweave keyfile-create wallet.json
```

Ou via [ArConnect](https://arconnect.io) (extension navigateur).

### 2. Obtenir des tokens AR

Le wallet a besoin de tokens AR pour payer les transactions. Options :

- **Acheter sur un exchange** (Binance, KuCoin, Gate.io)
- **Faucet Arweave** (testnet seulement, pour développement)
- **Forever Storage** : coût unique basé sur la taille (~$0.005/KB au taux actuel)

### 3. Configurer les variables d'environnement

Dans Vercel (Project Settings → Environment Variables) :

```
ARWEAVE_WALLET_KEY=<contenu du fichier wallet.json>
```

Le contenu doit être la clé privée JSON complète :
```json
{"kty":"RSA","n":"...","e":"AQAB","d":"...","p":"...","q":"...","dp":"...","dq":"...","qi":"..."}
```

### 4. Tester

Une fois configurée, la page `/coffre-fort` passera automatiquement en mode production. Les ancres incluront un `arweaveTxId` et une URL permanente.

## Coûts

Arweave utilise un modèle de **paiement unique** (Forever Storage) :

| Taille contenu | Coût approximatif |
|---|---|
| 1 KB (témoignage court) | ~$0.005 |
| 10 KB (enseignement moyen) | ~$0.05 |
| 100 KB (enseignement long) | ~$0.50 |
| 1 MB (transcription vidéo) | ~$5 |

Pour un volume de 100 contenus par mois (~10 KB moyenne) : **~$5/mois**.

## Vérification d'intégrité

N'importe qui peut vérifier qu'un contenu n'a pas été altéré :

1. Récupérer le hash ancré sur Arweave (`https://arweave.net/{txId}`)
2. Calculer le hash SHA-256 du contenu actuel
3. Comparer les deux hashes — s'ils correspondent, le contenu est intact

L'API `/api/arweave/verifier` automatise cette vérification.

## Dead Man's Switch (optionnel)

Le cahier des charges prévoit un mécanisme de « commutateur d'homme mort » :
si PAM et le Pasteur Kongo cessent de manifester leur présence pendant une durée
prédéfinie, des contenus réservés sont automatiquement publiés via Arweave.

Implémentation : un job cron (Vercel Cron Jobs) vérifie la dernière activité,
et déclenche l'upload de contenus réservés si le délai est dépassé.

## Sécurité

- **Clé privée** : la clé Arweave (`ARWEAVE_WALLET_KEY`) est stockée dans les variables d'environnement Vercel, jamais dans le code
- **Immutabilité** : une fois ancré, un contenu ne peut PAS être modifié ni supprimé — c'est la garantie Arweave
- **Vérification publique** : n'importe qui peut vérifier l'intégrité sans clé d'API
- **Redondance** : le contenu existe sur le site + sur Arweave + sur les sauvegardes

## Limites actuelles

- La lib `arweave` n'est pas installée par défaut (import dynamique pour éviter les erreurs en mode démo)
- Pour activer le mode production : `bun add arweave` puis configurer `ARWEAVE_WALLET_KEY`
- Les vidéos (gros fichiers) ne sont pas ancrées directement — on ancre leur métadonnée + transcription
