#!/bin/bash
# ⭐ V3.74.1 — Vérification PRODUCTION du correctif du relais email.
#
# Scénario complet (les mêmes appels que le bouton « Paramétrage ») :
#  ① Login secrétariat (SUPER_ADMIN seed)
#  ② Paramétrage : emailKongo ← adresse de TEST (inconnue de la base,
#    格式 gmail — prouve la voie StaffSetting)
#  ③ GET courrier : la résolution serviteur:kongo pointe sur l'adresse de test
#  ④ Attente du redéploiement Railway : POST direct /api/email/send vers
#     l'adresse de test — le VIEUX code répond 403 « Destinataire inconnu »,
#     le NOUVEAU passe la garde (200 = envoyé via Resend)
#  ⑤ Courrier RÉEL via l'API du secrétariat (toUserId serviteur:kongo) —
#     la chaîne complète utilisée par l'interface : résolution → relais →
#     garde StaffSetting → Resend
#  ⑥ Nettoyage : paramétrage effacé, résolution revenue à l'adresse du compte
set -u
SEC="https://secretariat.mouvementchristlibere.com"
API="https://api.mouvementchristlibere.com"
JAR="/home/z/my-project/scripts/cookies-secretariat-param.txt"
ADRESSE_TEST="parametrage.test.v374@gmail.com"

OK=0; KO=0
verif() { # étiquette, code retour (0=ok)
  if [ "$2" -eq 0 ]; then OK=$((OK+1)); echo "  ✔ $1"; else KO=$((KO+1)); echo "  ✗ $1"; fi
}

echo "── ① Login secrétariat ───────────────────────────────────"
LOGIN=$(curl -sS -c "$JAR" -X POST "$SEC/secretariat/api/login" \
  -H "Content-Type: application/json" \
  -d '{"name":"pam@christ-libere.org","password":"PamChristLibere2026!"}' \
  --max-time 30)
echo "$LOGIN" | grep -q '"success":true'; verif "login SUPER_ADMIN (Pam)" $?

echo ""
echo "── ② Paramétrage : emailKongo ← adresse de test ──────────"
PARAM=$(curl -sS -b "$JAR" -X POST "$SEC/secretariat/api/courrier" \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"parametrer\",\"emailKongo\":\"$ADRESSE_TEST\"}" \
  --max-time 30)
echo "  $PARAM" | head -c 400; echo ""
echo "$PARAM" | grep -q '"success":true'; verif "paramétrage enregistré (StaffSetting)" $?
echo "$PARAM" | grep -q "\"emailKongo\":\"$ADRESSE_TEST\""; verif "réponse porte l'adresse paramétrée" $?

echo ""
echo "── ③ Résolution : serviteur:kongo → adresse de test ──────"
ETAT=$(curl -sS -b "$JAR" "$SEC/secretariat/api/courrier" --max-time 30)
echo "$ETAT" | grep -q "\"emailKongo\":\"$ADRESSE_TEST\""; verif "GET courrier : parametres.emailKongo = adresse de test" $?
echo "$ETAT" | grep -q "{\"id\":\"serviteur:kongo\"[^}]*$ADRESSE_TEST\|\"serviteur:kongo\"[^)]*$ADRESSE_TEST"; verif "destinataire serviteur:kongo résolu vers l'adresse de test" $?

echo ""
echo "── ④ Attente du redéploiement Railway (garde StaffSetting) ─"
DEPLOYE=0
for i in $(seq 1 24); do
  R=$(curl -sS --max-time 25 -X POST "$API/api/email/send" \
    -H "Content-Type: application/json" \
    -d "{\"to\":\"$ADRESSE_TEST\",\"subject\":\"Probe garde StaffSetting V3.74.1\",\"html\":\"<p>Probe de déploiement — ignorer.</p>\",\"text\":\"Probe.\",\"category\":\"TEST\"}" \
    -w "\n%{http_code}")
  CODE=$(echo "$R" | tail -1)
  if [ "$CODE" = "200" ]; then
    echo "  ✔ nouveau backend en ligne (tentative $i) — garde StaffSetting : ENVOI AUTORISÉ"
    echo "    $(echo "$R" | head -n -1 | head -c 200)"
    DEPLOYE=1; OK=$((OK+1)); break
  elif echo "$R" | grep -q "Destinataire inconnu"; then
    echo "  … ancien code encore en ligne (403) — tentative $i/24"; sleep 30
  else
    echo "  ? statut inattendu ($CODE) : $(echo "$R" | head -n -1 | head -c 200)"; sleep 15
  fi
done
[ "$DEPLOYE" = "1" ]; verif "relais : adresse paramétrée AUTORISÉE (plus de 403)" $?

echo ""
echo "── ⑤ Courrier réel via l'API (chaîne complète) ───────────"
COURRIER=$(curl -sS -b "$JAR" -X POST "$SEC/secretariat/api/courrier" \
  -H "Content-Type: application/json" \
  -d "{\"toUserId\":\"serviteur:kongo\",\"sujet\":\"Test — bouton Paramétrage (automatique)\",\"message\":\"Test de bout en bout du paramétrage des adresses : ce courrier part vers l'adresse paramétrée via la même chaîne que le bouton. Aucune action nécessaire.\"}" \
  --max-time 45)
echo "  $(echo "$COURRIER" | head -c 400)"
echo "$COURRIER" | grep -q '"success":true'; verif "courrier envoyé (résolution → relais → garde → Resend)" $?
echo "$COURRIER" | grep -q "$ADRESSE_TEST"; verif "le message confirme l'adresse paramétrée" $?

echo ""
echo "── ⑥ Nettoyage : paramétrage effacé ──────────────────────"
EFFACE=$(curl -sS -b "$JAR" -X POST "$SEC/secretariat/api/courrier" \
  -H "Content-Type: application/json" \
  -d '{"action":"parametrer","emailKongo":""}' \
  --max-time 30)
echo "  $(echo "$EFFACE" | head -c 300)"
echo "$EFFACE" | grep -q "paramétrage effacé\|effacé"; verif "paramétrage effacé (retour à la résolution par défaut)" $?
FINAL=$(curl -sS -b "$JAR" "$SEC/secretariat/api/courrier" --max-time 30)
echo "$FINAL" | grep -q '"emailKongo":null'; verif "état final : parametres.emailKongo = null (état initial restauré)" $?
echo "$FINAL" | grep -q "pasteur.kongo@christ-libere.org"; verif "résolution revenue sur l'adresse du compte (seed)" $?

echo ""
echo "═══ RÉSULTAT : $OK ✔ / $KO ✗ ═══"
exit $([ "$KO" -eq 0 ] && echo 0 || echo 1)
