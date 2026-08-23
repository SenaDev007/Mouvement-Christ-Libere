# V2 — Feuille de route technique

## Mouvement Christ Libère

Document de planification pour la version 2 — intégration du média social complet, des appels WebRTC, et du calendrier liturgique.

---

## 1. Média social complet — Matrix / E2E

### Contexte

La V1 a livré un backoffice de gestion des canaux et une page publique qui présente la structure de la communauté. La V2 doit rendre les canaux **réellement fonctionnels** : messagerie temps réel, chiffrement de bout en bout, gestion des membres, modération.

### Choix technique : Matrix Synapse

**Pourquoi Matrix ?**
- Protocole ouvert, décentralisé, fédérable
- Chiffrement E2E natif (Olm/Megolm) — éprouvé par Signal
- Serveur open source auto-hébergeable (Synapse)
- Clients matures (Element, Cinny) qui peuvent être embeddés
- Pas de dépendance à un acteur commercial

**Architecture cible :**
```
[Utilisateur] ←→ [Next.js frontend] ←→ [API routes]
                       ↓
                [Matrix Synapse server]  ←→ [PostgreSQL]
                       ↓
                [Stockage chiffré E2E]
```

### Tâches

- [ ] Déployer un serveur Matrix Synapse sur un VPS (Hetzner/OVH)
- [ ] Configurer le chiffrement E2E obligatoire pour les canaux restreints
- [ ] Intégrer `matrix-js-sdk` dans le frontend Next.js
- [ ] Créer un composant `<ChannelView>` qui encapsule le client Matrix
- [ ] Synchroniser les utilisateurs NextAuth ↔ Matrix (SSO via OIDC)
- [ ] Mapper les rôles NextAuth aux power levels Matrix
- [ ] Tester le chiffrement E2E sur canaux restreints (cercle pasteurs)
- [ ] Implémenter la modération via bot Matrix (suppression, banissement)
- [ ] Documenter la procédure de récupération en cas de perte de clés

### Risques

- **Courbe d'apprentissage Matrix** : prévoir 2-3 semaines de R&D
- **Performance** : Synapse peut être gourmand, prévoir un VPS 4GB RAM minimum
- **Sauvegarde des clés** : critique — si un utilisateur perd ses clés, ses messages sont perdus

---

## 2. Appels audio/vidéo — WebRTC

### Contexte

Le cahier des charges prévoit des appels audio/vidéo style Telegram/WhatsApp, avec gestion des appels manqués, des appels live, et des appels d'urgence.

### Choix technique : LiveKit

**Pourquoi LiveKit ?**
- Open source, scalable, qualité reconnue
- SDK React Native + Web (partage de code)
- SFU (Selective Forwarding Unit) — pas de charge serveur P2P
- Intégration Matrix possible (LiveKit + Matrix pour appels dans canaux)

**Architecture cible :**
```
[Appelant] ←→ [LiveKit SDK] ←→ [LiveKit Server] ←→ [Récepteur]
                     ↓
              [API Next.js] ←→ [PostgreSQL Call table]
```

### Tâches

- [ ] Déployer un serveur LiveKit (Cloud ou self-hosted)
- [ ] Intégrer `livekit-client` dans le frontend
- [ ] Créer le composant `<CallScreen>` (interface d'appel plein écran)
- [ ] Implémenter la sonnerie côté récepteur (notification push + son)
- [ ] Gérer l'historique d'appels manqués (table `Call`)
- [ ] Implémenter les appels vidéo en live (jusqu'à 50 participants)
- [ ] Implémenter le mécanisme d'« appel d'urgence » (contourne le DND)
- [ ] Tester la qualité sur connexions faibles (3G, zones rurales)
- [ ] Intégrer les notifications push (OneSignal ou FCM)
- [ ] Implémenter le mode picture-in-picture

### Risques

- **Coût infrastructure** : LiveKit Cloud ~$0.004/min/participant — prévoir budget
- **Complexité WebRTC** : NAT traversal, ICE candidates, codecs
- **Mobile** : React Native + WebRTC peut être capricieux sur anciens appareils

---

## 3. Calendrier liturgique

### Contexte

Le cahier des charges (section 35) prévoit un calendrier liturgique intégré avec les fêtes bibliques, les shabbats, et des rappels automatiques.

### Choix technique : Calendrier personnalisé + API

**Architecture :**
- Table `LiturgicalEvent` dans PostgreSQL
- Page `/calendrier` avec vue mensuelle + vue liste
- Notifications push configurables par utilisateur
- Option « repos shabbatique » (suspend les notifications du vendredi soir au samedi soir)

### Tâches

- [ ] Créer le modèle `LiturgicalEvent` dans Prisma
- [ ] Peupler le calendrier avec les 7 fêtes bibliques
- [ ] Calculer automatiquement les dates (calendrier hébraïque luni-solaire)
- [ ] Créer la page `/calendrier` avec vue mensuelle interactive
- [ ] Implémenter les rappels (notifications push, email)
- [ ] Associer des enseignements à chaque fête
- [ ] Implémenter l'option « repos shabbatique »
- [ ] Ajouter le calendrier au backoffice
- [ ] Internationaliser les noms de fêtes (FR, EN, HE)

### Fêtes à intégrer (calendrier 2025-2026)

| Fête | Date hébraïque | Date grégorienne 2025 |
|---|---|---|
| Pessah (Pâque) | 14 Nisan | 12 avril 2025 |
| Matsot (Pain sans levain) | 15-21 Nisan | 13-19 avril 2025 |
| Réshit (Prémices) | 16 Nisan | 14 avril 2025 |
| Shavouot (Pentecôte) | 6 Sivan | 1 juin 2025 |
| Yom Terouah (Trompettes) | 1 Tishri | 23 septembre 2025 |
| Yom Kippour (Expiation) | 10 Tishri | 2 octobre 2025 |
| Soukkot (Tabernacles) | 15-21 Tishri | 7-13 octobre 2025 |

---

## 4. Autres fonctionnalités V2

### 4.1 Authentification utilisateurs (NextAuth)
### 4.2 Notifications push
### 4.3 Modération avancée
### 4.4 Multi-langue + sous-titrage IA

---

## 5. Planning estimatif

| Phase | Durée | Livrables |
|---|---|---|
| V2.0 — Auth + Notifications | 4-6 semaines | NextAuth, push, préférences |
| V2.1 — Calendrier liturgique | 3-4 semaines | Calendrier complet, rappels |
| V2.2 — Messagerie Matrix | 8-10 semaines | Synapse, SDK, E2E, modération |
| V2.3 — Appels WebRTC | 6-8 semaines | LiveKit, appels 1-1, groupe, urgence |
| V2.4 — Multi-langue + sous-titrage | 4-6 semaines | next-intl, Whisper |

**Total V2 : 25-34 semaines (6-8 mois)**

---

## 6. Budget infrastructure annuel (V2)

| Poste | Coût estimé |
|---|---|
| VPS Matrix Synapse (4GB RAM) | 300-600 €/an |
| LiveKit Cloud (1000 min/mois) | 50-100 €/an |
| OneSignal push | 0 € |
| Domaines + DNS | 50 €/an |
| Sauvegardes | 100 €/an |
| Monitoring | 100 €/an |
| **Total V2** | **600-950 €/an** |
