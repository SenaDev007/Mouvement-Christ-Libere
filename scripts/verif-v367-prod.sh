#!/bin/bash
# ⭐ V3.67 — Vérification PRODUCTION : multicaisse, gouvernance, publics.
# Usage : bash scripts/verif-v367-prod.sh
set -u

DOM="mouvementchristlibere.com"
OK=0; KO=0

vert() { printf "\033[32m✓\033[0m %s\n" "$1"; OK=$((OK+1)); }
rouge() { printf "\033[31m✗\033[0m %s\n" "$1"; KO=$((KO+1)); }
teste() { # teste <nom> <attendu> <obtenu>
  if [ "$2" = "$3" ]; then vert "$1 ($3)"; else rouge "$1 (attendu $2, obtenu $3)"; fi
}

echo "⭐ V3.67 — Vérification production ($DOM)"
echo "================================================"

# ── ① Pages publiques ─────────────────────────────────────────────────────
echo "① Pages publiques"
teste "accueil 200" 200 "$(curl -s -o /dev/null -w '%{http_code}' https://www.$DOM/)"
teste "annonces 200" 200 "$(curl -s -o /dev/null -w '%{http_code}' https://www.$DOM/annonces)"
teste "rendez-vous 200" 200 "$(curl -s -o /dev/null -w '%{http_code}' https://www.$DOM/rendez-vous)"
teste "suivi 200" 200 "$(curl -s -o /dev/null -w '%{http_code}' https://www.$DOM/rendez-vous/suivi)"

# Contenus clés
curl -s https://www.$DOM/ | grep -q 'cta-rdv-pulse' && vert "CTA hero pulsant présent (cta-rdv-pulse)" || rouge "CTA hero pulsant ABSENT"
curl -s https://www.$DOM/ | grep -q 'Demander un rendez-vous' && vert "libellé CTA hero" || rouge "libellé CTA hero absent"
curl -s https://www.$DOM/ | grep -q '/rendez-vous' && vert "lien /rendez-vous (header)" || rouge "lien /rendez-vous absent"
curl -s https://www.$DOM/annonces | grep -q 'Annonces' && vert "page /annonces rendue" || rouge "page /annonces vide"
curl -s https://www.$DOM/contact | grep -q '/annonces' && vert "lien /annonces dans la nav (page contact)" || rouge "lien /annonces absent de la nav"
curl -s https://www.$DOM/rendez-vous/suivi | grep -q 'Suivre ma demande' && vert "page suivi : titre" || rouge "page suivi : titre absent"

# ── ② API publique de suivi ───────────────────────────────────────────────
echo "② API suivi public"
R=$(curl -s "https://www.$DOM/api/rendez-vous/suivi?code=MCL-AAAAAA")
echo "$R" | grep -q '"error"' && vert "code inconnu → erreur propre (pas de fuite)" || rouge "réponse inattendue : $R"
teste "format invalide → 400" 400 "$(curl -s -o /dev/null -w '%{http_code}' 'https://www.$DOM/api/rendez-vous/suivi?code=XYZ')"

# ── ③ Espaces : pages + gardes JSON ──────────────────────────────────────
echo "③ Espaces (sous-domaines — chemins COMPLETS)"
teste "login secrétariat 200" 200 "$(curl -s -o /dev/null -w '%{http_code}' https://secretariat.$DOM/secretariat/login)"
teste "login trésorerie 200" 200 "$(curl -s -o /dev/null -w '%{http_code}' https://tresorerie.$DOM/tresorerie/login)"

# APIs sans session → 401 JSON (pas de 307 HTML)
for api in "secretariat/api/caisses" "tresorerie/api/caisses" "tresorerie/api/audit" "secretariat/api/audit" "tresorerie/api/caisse"; do
  ESPACE="${api%%/*}"
  CHEMIN="${api#*/}"
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "https://$ESPACE.$DOM/$ESPACE/$CHEMIN")
  teste "$api → 401" 401 "$CODE"
done
R=$(curl -s "https://tresorerie.$DOM/tresorerie/api/caisses")
echo "$R" | grep -q 'Non authentifié' && vert "401 JSON propre (caisses)" || rouge "corps inattendu : $R"

# ── ④ Fix /admin/api/staff (bilan ②) ─────────────────────────────────────
echo "④ Fix /admin/api/staff"
R=$(curl -s -i "https://admin.$DOM/admin/api/staff" | head -1)
echo "$R" | grep -q " 401 " && vert "GET /admin/api/staff → 401 (plus de 307 HTML)" || rouge "réponse : $R"
R=$(curl -s "https://admin.$DOM/admin/api/staff")
echo "$R" | grep -q 'Non authentifié' && vert "corps JSON 401 (staff)" || rouge "corps : $R"

# ── ⑤ Page annonces : noindex NON (page publique, indexable) ─────────────
echo "⑤ En-têtes"
H=$(curl -s -I "https://www.$DOM/annonces" | grep -i "x-robots-tag" | head -1)
[ -z "$H" ] && vert "/annonces indexable (pas de noindex — voulu)" || rouge "noindex inattendu sur /annonces : $H"
H=$(curl -s -I "https://tresorerie.$DOM/login" | grep -i "x-robots-tag" | head -1)
[ -n "$H" ] && vert "noindex trésorerie conservé" || rouge "noindex trésorerie perdu"

# ── Résumé ────────────────────────────────────────────────────────────────
echo "================================================"
echo "$OK ✓ / $KO ✗"
[ $KO -eq 0 ] && echo "V3.67 EN LIGNE ET CONFORME" || echo "VÉRIFIER LES ✗ CI-DESSUS"
exit $([ $KO -eq 0 ] && echo 0 || echo 1)
