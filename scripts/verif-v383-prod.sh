#!/bin/bash
# ⭐ V3.83 — Vérification PRODUCTION : boutons « Payer », module
# Passerelles de paiement (back-office), journal de transactions (fix 404).
# Usage : bash scripts/verif-v383-prod.sh
# Exige : curl, rg, python3.

DOMAINE="https://www.mouvementchristlibere.com"
DOMAINE_ADMIN="https://admin.mouvementchristlibere.com"
DEPLOIEMENT="$1"   # commit attendu (facultatif — juste affiché)

passes=0
echecs=0

verifie() {
  local libelle="$1"
  local condition="$2"
  if [ "$condition" = "vrai" ]; then
    passes=$((passes + 1))
    echo "  ✔ $libelle"
  else
    echecs=$((echecs + 1))
    echo "  ✘ $libelle"
  fi
}

json() {
  python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get(sys.argv[1], '') if isinstance(d, dict) else '')" "$1" 2>/dev/null
}

echo "═══ V3.83 — vérification production $DOMAINE (déployé : ${DEPLOIEMENT:-non précisé}) ═══"

# ── ① Boutons « Payer » de la section ④ ──
echo "── ① Page /contribuer — boutons « Payer » + icône billet ──"
CODE=$(curl -s -o /tmp/v383-contribuer.html -w "%{http_code}" --max-time 30 "$DOMAINE/contribuer")
verifie "Page /contribuer accessible (200)" "$([ "$CODE" = "200" ] && echo vrai || echo faux)"
verifie "Nouveau libellé sobre « Payer » rendu" "$(rg -c '>Payer<' /tmp/v383-contribuer.html >/dev/null 2>&1 && echo vrai || echo faux)"
verifie "Ancien libellé long FedaPay SUPPRIMÉ" "$(rg -c "Payer depuis la Côte d" /tmp/v383-contribuer.html >/dev/null 2>&1 && echo faux || echo vrai)"
verifie "Ancien libellé long Paystack SUPPRIMÉ" "$(rg -c "Faire un don depuis l" /tmp/v383-contribuer.html >/dev/null 2>&1 && echo faux || echo vrai)"
verifie "Cartes toujours distinguées : FedaPay + zone locale" "$(rg -c 'FedaPay' /tmp/v383-contribuer.html >/dev/null 2>&1 && rg -c "Afrique de l.{1,8}Ouest" /tmp/v383-contribuer.html >/dev/null 2>&1 && echo vrai || echo faux)"
verifie "Cartes toujours distinguées : Paystack + International" "$(rg -c 'Paystack' /tmp/v383-contribuer.html >/dev/null 2>&1 && rg -c 'International' /tmp/v383-contribuer.html >/dev/null 2>&1 && echo vrai || echo faux)"
ICONE=false
for c in $(rg -o 'static/chunks/[^"]+\.js' /tmp/v383-contribuer.html | sort -u); do
  if curl -fsSL --max-time 20 "$DOMAINE/_next/$c" 2>/dev/null | rg -q 'banknote'; then ICONE=true; break; fi
done
verifie "Icône billet (Banknote) dans les bundles" "$([ "$ICONE" = "true" ] && echo vrai || echo faux)"

# ── ② Module back-office Passerelles de paiement ──
echo "── ② Module /admin/paiements (super admins) ──"
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$DOMAINE/admin/paiements")
verifie "Page /admin/paiements → 307 login (garde proxy intacte)" "$([ "$CODE" = "307" ] && echo vrai || echo faux)"
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$DOMAINE_ADMIN/admin/paiements")
verifie "Page /admin/paiements sur le sous-domaine admin → 307 login" "$([ "$CODE" = "307" ] && echo vrai || echo faux)"

R=$(curl -s -o /tmp/v383-api-get.json -w "%{http_code}" --max-time 30 "$DOMAINE/admin/api/paiements")
verifie "GET /admin/api/paiements sans session → 401 JSON (garde propre)" "$([ "$R" = "401" ] && echo vrai || echo faux)"
verifie "401 JSON explicite (pas de 307 HTML)" "$(rg -c '"error"' /tmp/v383-api-get.json >/dev/null 2>&1 && echo vrai || echo faux)"

R=$(curl -s -o /tmp/v383-api-put.json -w "%{http_code}" --max-time 30 -X PUT "$DOMAINE/admin/api/paiements" -H "Content-Type: application/json" -d '{"provider":"fedapay","activee":true}')
verifie "PUT /admin/api/paiements sans session → 401 (aucune écriture possible)" "$([ "$R" = "401" ] && echo vrai || echo faux)"
R=$(curl -s -o /tmp/v383-api-post.json -w "%{http_code}" --max-time 30 -X POST "$DOMAINE/admin/api/paiements" -H "Content-Type: application/json" -d '{"provider":"fedapay"}')
verifie "POST (test) /admin/api/paiements sans session → 401" "$([ "$R" = "401" ] && echo vrai || echo faux)"

# Message 503 réorienté vers le back-office (tant que la clé n'est pas posée).
R=$(curl -s -o /tmp/v383-initier.json -w "%{http_code}" --max-time 30 -X POST "$DOMAINE/api/dons/initier" -H "Content-Type: application/json" -d '{"provider":"fedapay","type_don":"don","montant":5000,"devise":"XOF","email":"test@example.com"}')
DETAIL=$(json detail < /tmp/v383-initier.json)
verifie "Initiation FedaPay sans clé → 503 avec aide vers /admin/paiements" "$([ "$R" = "503" ] && echo vrai || echo faux)"
verifie "Le message d'aide cite /admin/paiements" "$(echo "$DETAIL" | rg -c '/admin/paiements' >/dev/null 2>&1 && echo vrai || echo faux)"
R=$(curl -s -o /tmp/v383-initier-2.json -w "%{http_code}" --max-time 30 -X POST "$DOMAINE/api/dons/initier" -H "Content-Type: application/json" -d '{"provider":"paystack","type_don":"don","montant":5000,"devise":"XOF","email":"test@example.com"}')
verifie "Initiation Paystack sans clé → 503 avec aide vers /admin/paiements" "$([ "$R" = "503" ] && rg -c '/admin/paiements' /tmp/v383-initier-2.json >/dev/null 2>&1 && echo vrai || echo faux)"

# Webhooks : toujours rejetés sans signature valide (comportement V3.82 conservé).
R=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 -X POST "$DOMAINE/api/webhooks/fedapay" -H "Content-Type: application/json" -d '{"name":"transaction.approved"}')
verifie "Webhook FedaPay sans signature → jamais 200" "$([ "$R" != "200" ] && echo vrai || echo faux)"
R=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 -X POST "$DOMAINE/api/webhooks/paystack" -H "Content-Type: application/json" -d '{"event":"charge.success"}')
verifie "Webhook Paystack sans signature → jamais 200" "$([ "$R" != "200" ] && echo vrai || echo faux)"

# ── ③ Journal de transactions du back-office (fix 404) ──
echo "── ③ Journal /admin/tresorerie/transactions (fix 404) ──"
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$DOMAINE/admin/tresorerie/transactions")
verifie "Page journal sur www → 307 login (plus JAMAIS 404)" "$([ "$CODE" = "307" ] && echo vrai || echo faux)"
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$DOMAINE_ADMIN/admin/tresorerie/transactions")
verifie "Page journal sur admin.mouvementchristlibere.com → 307 login (l'ancien chemin du 404)" "$([ "$CODE" = "307" ] && echo vrai || echo faux)"

# Lien corrigé dans /admin/donations : la page est derrière la garde de
# session (307 → login) — la page de connexion redirige APRÈS authent
# vers le chemin demandé, le lien corrigé est vérifié par les sources
# (validate-v383.cjs A7) et par la page journal elle-même ci-dessous.
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$DOMAINE/admin/donations")
verifie "/admin/donations → 307 login (page intacte)" "$([ "$CODE" = "307" ] && echo vrai || echo faux)"

# ── ④ Non-régressions ──
echo "── ④ Non-régressions ──"
for chemin in "/" "/videos" "/admin/login" "/adoration-louanges" "/contribuer/merci"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$DOMAINE$chemin")
  verifie "$chemin → 200" "$([ "$CODE" = "200" ] && echo vrai || echo faux)"
done
R=$(curl -s -o /tmp/v383-statut.json -w "%{http_code}" --max-time 30 "$DOMAINE/api/dons/statut/don_lz3k9f2a_4b1c2d3e4f")
verifie "/api/dons/statut référence bien formée inconnue → 404 JSON (V3.82 conservé)" "$([ "$R" = "404" ] && echo vrai || echo faux)"
verifie "404 sans AUCUNE donnée personnelle" "$(rg -c 'Don introuvable' /tmp/v383-statut.json >/dev/null 2>&1 && echo vrai || echo faux)"
R=$(curl -s -o /tmp/v383-statut-3.json -w "%{http_code}" --max-time 30 "$DOMAINE/api/dons/statut/n-importe-quoi")
verifie "/api/dons/statut référence mal formée → 400 (validation conservée)" "$([ "$R" = "400" ] && echo vrai || echo faux)"

echo
echo "════════════════════════════════════════════════"
echo "Résultat : $passes ✔ / $echecs ✘"
[ "$echecs" = "0" ] && exit 0 || exit 1
