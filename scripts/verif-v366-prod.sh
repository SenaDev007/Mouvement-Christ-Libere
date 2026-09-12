#!/bin/bash
# ⭐ V3.66 — Vérification PRODUCTION du Secrétariat & Trésorerie.
# Poll le déploiement Vercel puis vérifie les routes en prod.
# Usage : bash scripts/verif-v366-prod.sh

DOMAINE="https://www.mouvementchristlibere.com"
SECRETARIAT="https://secretariat.mouvementchristlibere.com"
TRESORERIE="https://tresorerie.mouvementchristlibere.com"

echo "⏳ Attente du déploiement V3.66 (page publique /rendez-vous)…"
DEPLOIE=0
for i in $(seq 1 40); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$DOMAINE/rendez-vous" 2>/dev/null)
  if [ "$CODE" = "200" ]; then
    CORPS=$(curl -s --max-time 10 "$DOMAINE/rendez-vous" 2>/dev/null)
    if echo "$CORPS" | grep -q "Demander un rendez-vous"; then
      echo "✅ V3.66 déployée (tentative $i)"
      DEPLOIE=1
      break
    fi
  fi
  sleep 15
done

if [ "$DEPLOIE" = "0" ]; then
  echo "❌ Déploiement non détété après 10 min — vérifier Vercel"
  exit 1
fi

echo ""
echo "── Page publique /rendez-vous ──"
CORPS=$(curl -s --max-time 10 "$DOMAINE/rendez-vous")
echo "$CORPS" | grep -q "Demander un rendez-vous" && echo "  ✓ titre rendu" || echo "  ✗ titre"
echo "$CORPS" | grep -q "Pasteur Kongo" && echo "  ✓ serviteurs proposés" || echo "  ✗ serviteurs"

echo "── Garde de session (domaine principal) ──"
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$DOMAINE/secretariat/dashboard")
LOC=$(curl -s -o /dev/null -w "%{redirect_url}" --max-time 10 "$DOMAINE/secretariat/dashboard")
[ "$CODE" = "307" ] || [ "$CODE" = "302" ] && echo "$LOC" | grep -q "login" && echo "  ✓ /secretariat/dashboard → login ($CODE)" || echo "  ✗ /secretariat/dashboard ($CODE → $LOC)"
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$DOMAINE/tresorerie/dashboard")
LOC=$(curl -s -o /dev/null -w "%{redirect_url}" --max-time 10 "$DOMAINE/tresorerie/dashboard")
[ "$CODE" = "307" ] || [ "$CODE" = "302" ] && echo "$LOC" | grep -q "login" && echo "  ✓ /tresorerie/dashboard → login ($CODE)" || echo "  ✗ /tresorerie/dashboard ($CODE → $LOC)"

echo "── Pages de connexion ──"
CORPS=$(curl -s --max-time 10 "$DOMAINE/secretariat/login")
echo "$CORPS" | grep -q "Secrétariat" && echo "  ✓ login secrétariat rendu" || echo "  ✗ login secrétariat"
CORPS=$(curl -s --max-time 10 "$DOMAINE/tresorerie/login")
echo "$CORPS" | grep -q "Trésorerie" && echo "  ✓ login trésorerie rendu" || echo "  ✗ login trésorerie"

echo "── API : authentification exigée (JSON 401, pas de HTML) ──"
R=$(curl -s --max-time 10 "$DOMAINE/secretariat/api/stats")
echo "$R" | grep -q "Non authentifié" && echo "  ✓ secrétariat API 401 JSON" || echo "  ✗ secrétariat API: $R"
R=$(curl -s --max-time 10 "$DOMAINE/tresorerie/api/stats")
echo "$R" | grep -q "Non authentifié" && echo "  ✓ trésorerie API 401 JSON" || echo "  ✗ trésorerie API: $R"
R=$(curl -s --max-time 10 "$DOMAINE/admin/api/staff")
echo "$R" | grep -q "Non authentifié" && echo "  ✓ accréditation API 401 JSON" || echo "  ✗ accréditation API: $R"

echo "── API publique rendez-vous (validation active) ──"
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$DOMAINE/api/rendez-vous" -H "Content-Type: application/json" -d '{}')
[ "$CODE" = "400" ] && echo "  ✓ POST vide → 400 (route vivante)" || echo "  ✗ POST vide → $CODE"

echo ""
echo "ℹ️  Sous-domaines DNS (à configurer si pas déjà) :"
for host in "$SECRETARIAT" "$TRESORERIE"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$host/" 2>/dev/null)
  if [ "$CODE" = "000" ]; then
    echo "  ⏳ $(echo $host | sed 's|https://||') : DNS pas encore configuré (cf. Cloudflare + Vercel)"
  else
    LOC=$(curl -s -o /dev/null -w "%{redirect_url}" --max-time 8 "$host/" 2>/dev/null)
    echo "  ✓ $(echo $host | sed 's|https://||') répond ($CODE → $LOC)"
  fi
done
