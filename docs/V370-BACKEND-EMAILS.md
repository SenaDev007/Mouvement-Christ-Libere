# ⭐ V3.70 — Backend sur api.mouvementchristlibere.com + relais email Resend

Le backend Railway (Yeshua Connect + relais) répond désormais sur son domaine
officiel : **https://api.mouvementchristlibere.com**

## Ce qui change

### 1. Emails automatiques — DOUBLE chemin d'envoi (src/lib/email.ts)
```
                    RESEND_API_KEY sur VERCEL ?
                            │
              ┌── OUI ──────┴────── NON ──┐
              │                            │
     Envoi DIRECT (V3.69)        RELAIS BACKEND (V3.70)
     api.resend.com              POST https://api.mouvementchristlibere.com/api/email/send
                                       │ (server-to-server, zéro clé navigateur)
                                       ▼
                              Backend Railway — RESEND_API_KEY ✓
                                       ▼
                                 api.resend.com
```
- Expéditeur unique : **noreply@mouvementchristlibere.com** (EMAIL_EXPEDITEUR).
- La clé Resend vit sur **Railway** (choix du pasteur) : les OTP « Mot de
  passe oublié » (4 pages login), les courriers au serviteur depuis le
  secrétariat et les notifications de demande **partent via le relais** tant
  que RESEND_API_KEY n'est pas posée sur Vercel.
- Si un jour la clé est AUSSI posée sur Vercel → envoi direct automatiquement
  (le relais devient le secours). Aucun code à changer.
- Journal OutgoingEmail conservé côté frontend (statut + erreur + id Resend).

### 2. Relais sécurisé (backend/src/routes/email.ts)
| Garde-fou | Détail |
|---|---|
| Anti-relais | destinataire = compte existant en base OU EMAIL_KONGO / EMAIL_PAM / PASTEUR_EMAIL — jamais d'adresse arbitraire |
| Expéditeur FIXE | noreply@… imposé par le backend (pas d'usurpation) |
| Rate-limit | 30/h par IP, 12/h par destinataire (fenêtre glissante) |
| Tailles | objet ≤ 200, html/text ≤ 60 000 |
| Secret partagé | EMAIL_SERVICE_SECRET (Vercel + Railway) → header X-Email-Secret exigé (recommandé) |
| Diagnostique | GET https://api.mouvementchristlibere.com/api/email/health |

### 3. Socket.io (Yeshua Connect)
`src/lib/chat/socket-client.ts` — priorité : `NEXT_PUBLIC_API_URL` → en
production sans variable : **https://api.mouvementchristlibere.com** (plus
jamais localhost par erreur) → localhost:3001 en dev local uniquement.

## Checklist de configuration

### Vercel (plateforme principale)
| Variable | Valeur | Note |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.mouvementchristlibere.com` | **à mettre à jour** (remplace l'URL *.up.railway.app) |
| `RESEND_API_KEY` | *(optionnel)* | si posée → envoi direct ; sinon relais Railway |
| `EMAIL_SERVICE_SECRET` | *(recommandé)* | même valeur que Railway |
| `EMAIL_KONGO` / `EMAIL_PAM` | adresses des serviteurs | déjà utilisés par V3.69 |

### Railway (backend)
| Variable | Valeur | Note |
|---|---|---|
| `RESEND_API_KEY` | clé Resend | ✅ déjà configurée |
| `EMAIL_SERVICE_SECRET` | *(recommandé)* | même valeur que Vercel |
| `EMAIL_EXPEDITEUR` | *(optionnel)* | défaut : noreply@mouvementchristlibere.com |
| `CORS_ORIGIN` | `https://mouvementchristlibere.com,https://admin.mouvementchristlibere.com,https://secretariat.mouvementchristlibere.com,https://tresorerie.mouvementchristlibere.com` | à vérifier selon les domaines actifs |

**Domaine** : Railway → Settings → Networking → Custom Domain →
`api.mouvementchristlibere.com` (CNAME Railway dans le DNS Cloudflare), puis
vérifier : `curl https://api.mouvementchristlibere.com/api/email/health`.

### Resend
Domaine **mouvementchristlibere.com** vérifié (SPF/DKIM) — sinon Resend
refuse les envois depuis noreply@ (erreur 403 visible dans OutgoingEmail et
`/api/email/health`).

## Test de bout en bout (après déploiement)
1. `curl https://api.mouvementchristlibere.com/api/health` → statut ok (backend en ligne).
2. `curl https://api.mouvementchristlibere.com/api/email/health` → `"resend": "configuré ✓"`.
3. Sur mouvementchristlibere.com/login → « Mot de passe oublié ? » → saisir
   l'email d'un compte réel → le code arrive par email (journal OutgoingEmail
   côté base : statut ENVOYE).
4. Secrétariat → Courrier → envoyer un message à un serviteur → reçu +
   historique ENVOYE.
