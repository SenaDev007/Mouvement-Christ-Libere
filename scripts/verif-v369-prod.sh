#!/usr/bin/env bash
# ⭐ V3.69 — Vérification PRODUCTION : emails Resend + accréditation.
# Usage : bash scripts/verif-v369-prod.sh
set -u
OK=0; KO=0
v() { if [ "$1" = "0" ]; then OK=$((OK+1)); echo "  ✓ $2"; else KO=$((KO+1)); echo "  ✗ $2"; fi; }
DOM="https://www.mouvementchristlibere.com"
ADM="https://admin.mouvementchristlibere.com"
SEC="https://secretariat.mouvementchristlibere.com"
TRE="https://tresorerie.mouvementchristlibere.com"

echo "═══ ① « Mot de passe oublié » sur les 4 pages de connexion ═══"
# NB : /login et /admin/login utilisent useSearchParams SANS Suspense → rendu
# client uniquement : le libellé vit dans les CHUNKS JS, pas dans le HTML
# (les pages staff, avec <Suspense>, l'exposent aussi en SSR).
verifie_page() {
  local url="$1" nom="$2" hote="$3"
  local code html
  code=$(curl -s -o /tmp/v369-login.html -w "%{http_code}" --max-time 25 "$url")
  if [ "$code" != "200" ]; then v 1 "$nom : code $code"; return; fi
  if grep -q "Mot de passe oublié" /tmp/v369-login.html; then
    v 0 "$nom : 200 + bloc présent (HTML)"; return
  fi
  html=$(cat /tmp/v369-login.html)
  local chunks trouve=0 c
  chunks=$(echo "$html" | grep -o '/_next/static/chunks/[^"]*\.js' | sort -u | head -25)
  for c in $chunks; do
    if curl -s --max-time 20 "$hote$c" 2>/dev/null | grep -q "Mot de passe oublié"; then trouve=1; break; fi
  done
  [ "$trouve" = "1" ] && v 0 "$nom : 200 + bloc présent (chunk JS — rendu client)" || v 1 "$nom : bloc absent (HTML + chunks)"
}
verifie_page "$DOM/login" "Membre" "$DOM"
verifie_page "$ADM/admin/login" "Admin" "$ADM"
verifie_page "$SEC/secretariat/login" "Secrétariat" "$SEC"
verifie_page "$TRE/tresorerie/login" "Trésorerie" "$TRE"

echo "═══ ② API forgot-password — validation ═══"
R=$(curl -s --max-time 25 -X POST "$DOM/api/auth/forgot-password" -H "Content-Type: application/json" -d '{"email":"pas-un-email"}' -w "\n%{http_code}")
code=$(echo "$R" | tail -1)
echo "$R" | head -1 | grep -q "Adresse email invalide" && [ "$code" = "400" ] && v 0 "email invalide → 400 + message exact" || v 1 "email invalide → $code"

echo "═══ ③ API forgot-password — route complète + table OTP (DDL prod) ═══"
# Un email syntaxiquement valide mais sans compte : le parcours interroge
# PasswordResetOtp (rate-limit) puis User — une réponse 404 « aucun compte »
# PROUVE que la table existe en production (sinon 500) et que la route est vivante.
R=$(curl -s --max-time 25 -X POST "$DOM/api/auth/forgot-password" -H "Content-Type: application/json" -d '{"email":"inexistant.v369@mouvementchristlibere.com"}' -w "\n%{http_code}")
code=$(echo "$R" | tail -1)
echo "$R" | head -1 | grep -q "Aucun compte" && [ "$code" = "404" ] && v 0 "compte inconnu → 404 propre (tables PasswordResetOtp/User interrogées)" || v 1 "compte inconnu → $code : $(echo "$R" | head -1 | head -c 120)"

echo "═══ ④ API reset-password — validation + table ═══"
R=$(curl -s --max-time 25 -X POST "$DOM/api/auth/reset-password" -H "Content-Type: application/json" -d '{"email":"inexistant.v369@mouvementchristlibere.com","code":"12345","newPassword":"12345678"}' -w "\n%{http_code}")
code=$(echo "$R" | tail -1)
echo "$R" | head -1 | grep -q "6 chiffres" && [ "$code" = "400" ] && v 0 "code malformé → 400 (validation)" || v 1 "code malformé → $code"
R=$(curl -s --max-time 25 -X POST "$DOM/api/auth/reset-password" -H "Content-Type: application/json" -d '{"email":"inexistant.v369@mouvementchristlibere.com","code":"123456","newPassword":"123456789"}' -w "\n%{http_code}")
code=$(echo "$R" | tail -1)
echo "$R" | head -1 | grep -q "Aucun code actif" && [ "$code" = "400" ] && v 0 "aucun OTP → 400 propre (findMany PasswordResetOtp OK)" || v 1 "aucun OTP → $code : $(echo "$R" | head -1 | head -c 120)"

echo "═══ ⑤ Gardes des nouvelles routes staff ═══"
R=$(curl -s --max-time 25 "$SEC/secretariat/api/courrier" -w "\n%{http_code}")
code=$(echo "$R" | tail -1)
echo "$R" | head -1 | grep -q "Non authentifié" && [ "$code" = "401" ] && v 0 "/secretariat/api/courrier sans session → 401 JSON" || v 1 "courrier GET → $code"
R=$(curl -s --max-time 25 -X POST "$SEC/secretariat/api/courrier" -H "Content-Type: application/json" -d '{"sujet":"test","message":"message test"}' -w "\n%{http_code}")
code=$(echo "$R" | tail -1)
[ "$code" = "401" ] && v 0 "/secretariat/api/courrier POST sans session → 401 JSON" || v 1 "courrier POST → $code"
redir=$(curl -s -o /dev/null -w "%{http_code} %{redirect_url}" --max-time 25 "$SEC/secretariat/courrier")
echo "$redir" | grep -q "^307" && echo "$redir" | grep -q "secretariat/login" && v 0 "page /secretariat/courrier → 307 vers login (protégée)" || v 1 "page courrier → $redir"

echo "═══ ⑥ API staff (accréditation) — garde ═══"
R=$(curl -s --max-time 25 -X POST "$ADM/admin/api/staff" -H "Content-Type: application/json" -d '{"name":"X","email":"x@x.fr","password":"12345678","role":"SECRETARY"}' -w "\n%{http_code}")
code=$(echo "$R" | tail -1)
[ "$code" = "401" ] && v 0 "POST /admin/api/staff sans session → 401 JSON (route vivante)" || v 1 "staff POST → $code"

echo "═══ ⑦ Régression rapide (pages publiques V3.68 intactes) ═══"
for p in "/" "/rendez-vous" "/annonces"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 25 "$DOM$p")
  [ "$code" = "200" ] && v 0 "$p → 200" || v 1 "$p → $code"
done
HTML=$(curl -s --max-time 25 "$DOM/")
echo "$HTML" | grep -q 'theme-color" content="#000000"' && v 0 "palette V3.68 conservée (theme-color noir)" || v 1 "theme-color regressé"

echo "═══ RÉSULTAT : $OK ✓ / $KO ✗ ═══"
[ "$KO" = "0" ] && echo "V3.69 PRODUCTION CONFORME" || exit 1
