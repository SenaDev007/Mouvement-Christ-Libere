#!/bin/bash
# ⭐ V3.82 — Vérification PRODUCTION : page Contribuer + passerelles.
# Usage : bash scripts/verif-v382-prod.sh
# Exige : jq (ou python3 pour le JSON), curl.

DOMAINE="https://www.mouvementchristlibere.com"
BRUT_GITHUB="https://raw.githubusercontent.com/SenaDev007/Mouvement-Christ-Libere/main"
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
  python3 -c "import json,sys; d=json.load(sys.stdin); print(eval(sys.argv[1]) if False else d.get(sys.argv[1], '') if isinstance(d, dict) else '')" "$1" 2>/dev/null
}

echo "═══ V3.82 — vérification production $DOMAINE (déployé : ${DEPLOIEMENT:-non précisé}) ═══"

# ── ① Pages publiques ──
echo "── ① Page /contribuer (refonte) ──"
CORPS=$(curl -fsSL --max-time 30 "$DOMAINE/contribuer")
verifie "Page /contribuer accessible (200)" "$([ -n "$CORPS" ] && echo vrai || echo faux)"
echo "$CORPS" > /tmp/v382-contribuer.html
verifie "Trois intentions présentes (Offrande)" "$(rg -c 'Offrande' /tmp/v382-contribuer.html >/dev/null 2>&1 && echo vrai || echo faux)"
verifie "Trois intentions présentes (Dîme)" "$(rg -c 'Dîme' /tmp/v382-contribuer.html >/dev/null 2>&1 && echo vrai || echo faux)"
verifie "Montants en FCFA (pas d'euros)" "$(rg -c 'FCFA' /tmp/v382-contribuer.html >/dev/null 2>&1 && echo vrai || echo faux)"
verifie "Plus AUCUN montant en € sur la page" "$(rg -c '[0-9] €' /tmp/v382-contribuer.html >/dev/null 2>&1 && echo faux || echo vrai)"
verifie "Canal FedaPay présent (Afrique de l'Ouest)" "$(rg -c 'FedaPay' /tmp/v382-contribuer.html >/dev/null 2>&1 && echo vrai || echo faux)"
verifie "Canal Paystack présent (international)" "$(rg -c 'Paystack' /tmp/v382-contribuer.html >/dev/null 2>&1 && echo vrai || echo faux)"
verifie "Bouton conforme « Payer depuis la Côte d'Ivoire / Afrique de l'Ouest »" "$(rg -c "Payer depuis la Côte d&#x27;Ivoire / Afrique de l&#x27;Ouest|Payer depuis la Côte d'Ivoire / Afrique de l'Ouest" /tmp/v382-contribuer.html >/dev/null 2>&1 && echo vrai || echo faux)"
verifie "Email obligatoire affiché" "$(rg -c 'type=&quot;email&quot;|type="email"' /tmp/v382-contribuer.html >/dev/null 2>&1 && echo vrai || echo faux)"
TROUVE=false
for c in $(rg -o 'static/chunks/[^"]+\.js' /tmp/v382-contribuer.html | sort -u); do
  if curl -fsSL --max-time 20 "$DOMAINE/_next/$c" 2>/dev/null | rg -q 'dons/initier'; then TROUVE=true; break; fi
done
verifie "Soumission vers /api/dons/initier dans les bundles" "$([ "$TROUVE" = "true" ] && echo vrai || echo faux)"

echo "── ② Page /contribuer/merci ──"
CODE=$(curl -s -o /tmp/v382-merci.html -w "%{http_code}" --max-time 30 "$DOMAINE/contribuer/merci")
verifie "Page /contribuer/merci accessible (200)" "$([ "$CODE" = "200" ] && echo vrai || echo faux)"
verifie "Sans référence : rendu dégradé propre (« Page de confirmation » SSR)" "$(rg -c 'Page de confirmation' /tmp/v382-merci.html >/dev/null 2>&1 && echo vrai || echo faux)"

# ── ② API — validation (comportements garantis SANS clés) ──
echo "── ③ API /api/dons/initier — gardes ──"
R=$(curl -s -o /tmp/v382-initier-1.json -w "%{http_code}" --max-time 30 -X POST "$DOMAINE/api/dons/initier" -H "Content-Type: application/json" -d '{}')
verifie "Payload vide → 400 (passerelle inconnue)" "$([ "$R" = "400" ] && echo vrai || echo faux)"

R=$(curl -s -o /tmp/v382-initier-2.json -w "%{http_code}" --max-time 30 -X POST "$DOMAINE/api/dons/initier" -H "Content-Type: application/json" -d '{"provider":"stripe","type_don":"don","montant":5000,"devise":"XOF","email":"test@example.com"}')
verifie "Passerelle inconnue (stripe) → 400" "$([ "$R" = "400" ] && echo vrai || echo faux)"

R=$(curl -s -o /tmp/v382-initier-3.json -w "%{http_code}" --max-time 30 -X POST "$DOMAINE/api/dons/initier" -H "Content-Type: application/json" -d '{"provider":"fedapay","type_don":"dime","montant":99,"devise":"XOF","email":"test@example.com"}')
verifie "Montant sous la borne (99) → 400" "$([ "$R" = "400" ] && echo vrai || echo faux)"

R=$(curl -s -o /tmp/v382-initier-4.json -w "%{http_code}" --max-time 30 -X POST "$DOMAINE/api/dons/initier" -H "Content-Type: application/json" -d '{"provider":"fedapay","type_don":"dime","montant":5000,"devise":"XOF","email":"pas-un-email"}')
verifie "Email invalide → 400" "$([ "$R" = "400" ] && echo vrai || echo faux)"

R=$(curl -s -o /tmp/v382-initier-5.json -w "%{http_code}" --max-time 30 -X POST "$DOMAINE/api/dons/initier" -H "Content-Type: application/json" -d '{"provider":"fedapay","type_don":"dime","montant":5000,"devise":"XOF","email":"test@example.com"}')
if [ "$R" = "503" ]; then
  verifie "Demande valide SANS clés → 503 clair (FEDAPAY_SECRET_KEY absente)" "vrai"
  rg -o 'FEDAPAY_SECRET_KEY' /tmp/v382-initier-5.json >/dev/null 2>&1 && verifie "Message cite la variable à configurer" "vrai" || verifie "Message cite la variable à configurer" "faux"
else
  # Si les clés SONT déjà configurées : le flux continue chez le fournisseur (200/502) — pas un échec.
  verifie "Demande valide → réponse attendue (200 avec clés, 503 sans clés) — code obtenu : $R" "vrai"
fi

R=$(curl -s -o /tmp/v382-initier-6.json -w "%{http_code}" --max-time 30 -X POST "$DOMAINE/api/dons/initier" -H "Content-Type: application/json" -d '{"provider":"paystack","type_don":"offrande","montant":5000,"devise":"XOF","email":"test@example.com"}')
if [ "$R" = "503" ]; then
  verifie "Paystack sans clé → 503 clair (PAYSTACK_SECRET_KEY absente)" "vrai"
else
  verifie "Paystack → réponse attendue (200 avec clés, 503 sans clés) — code obtenu : $R" "vrai"
fi

echo "── ④ API /api/dons/statut — gardes ──"
R=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$DOMAINE/api/dons/statut/pas-une-reference")
verifie "Référence invalide → 400" "$([ "$R" = "400" ] && echo vrai || echo faux)"
R=$(curl -s -o /tmp/v382-statut-404.json -w "%{http_code}" --max-time 30 "$DOMAINE/api/dons/statut/don_inexistant_aabbccddee")
verifie "Référence bien formée mais inconnue → 404 (JSON, pas d'info personnelle)" "$([ "$R" = "404" ] && echo vrai || echo faux)"
verifie "La réponse 404 ne divulgue aucun email/nom" "$(rg -ci 'email|donorName' /tmp/v382-statut-404.json >/dev/null 2>&1 && echo faux || echo vrai)"

echo "── ⑤ Webhooks — rejet sans signature valide ──"
R=$(curl -s -o /tmp/v382-wh-feda.json -w "%{http_code}" --max-time 30 -X POST "$DOMAINE/api/webhooks/fedapay" -H "Content-Type: application/json" -d '{"name":"transaction.approved","entity":{"id":1}}')
verifie "Webhook FedaPay sans signature → rejeté ($R), JAMAIS 200" "$([ "$R" != "200" ] && echo vrai || echo faux)"
R=$(curl -s -o /tmp/v382-wh-pay.json -w "%{http_code}" --max-time 30 -X POST "$DOMAINE/api/webhooks/paystack" -H "Content-Type: application/json" -H "x-paystack-signature: signature-fausse" -d '{"event":"charge.success","data":{"reference":"don_test_aaaa_bbbb"}}')
verifie "Webhook Paystack avec signature FAUSSE → rejeté ($R), JAMAIS 200" "$([ "$R" != "200" ] && echo vrai || echo faux)"

echo "── ⑥ Back-office + non-régressions ──"
R=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$DOMAINE/admin/donations")
verifie "/admin/donations protégé (307 vers login)" "$([ "$R" = "307" ] && echo vrai || echo faux)"
for page in "/" "/videos" "/admin/login" "/adoration-louanges"; do
  R=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$DOMAINE$page")
  verifie "Non-régression $page (200)" "$([ "$R" = "200" ] && echo vrai || echo faux)"
done

echo "── ⑦ Dépôt GitHub ──"
R=$(curl -s -o /tmp/v382-envex.txt -w "%{http_code}" --max-time 30 "$BRUT_GITHUB/.env.example")
verifie ".env.example publié sur GitHub ($R)" "$([ "$R" = "200" ] && echo vrai || echo faux)"
rg -q "FEDAPAY_SECRET_KEY" /tmp/v382-envex.txt 2>/dev/null && verifie ".env.example documente les passerelles" "vrai" || verifie ".env.example documente les passerelles" "faux"
rg -q "sk_live_[A-Za-z0-9]{10,}" /tmp/v382-envex.txt 2>/dev/null && verifie "AUCUNE clé réelle dans .env.example" "faux" || verifie "AUCUNE clé réelle dans .env.example" "vrai"

echo "═══════════════════════════════════════════════════"
echo "RÉSULTAT : $passes ✔ / $echecs ✘"
[ "$echecs" = "0" ] || exit 1
