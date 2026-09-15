#!/bin/bash
# ⭐ V3.84 — Vérification PRODUCTION : chiffrement visible (badges) + module
# passerelles centré + toast PWA d'installation (navbar retirée).
# Usage : bash scripts/verif-v384-prod.sh
# Exige : curl, rg.

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

echo "═══ V3.84 — vérification production $DOMAINE (déployé : ${DEPLOIEMENT:-non précisé}) ═══"

# ── ① Toast PWA d'installation (site public) ──
echo "── ① Toast d'installation PWA — bundles du site public ──"
CODE=$(curl -s -o /tmp/v384-accueil.html -w "%{http_code}" --max-time 30 "$DOMAINE/")
verifie "Page d'accueil accessible (200)" "$([ "$CODE" = "200" ] && echo vrai || echo faux)"

CHUNKS_TROUVES=false
CHAINE_TOAST=""
for c in $(rg -o 'static/chunks/[^"]+\.js' /tmp/v384-accueil.html | sort -u); do
  CORPS=$(curl -fsSL --max-time 20 "$DOMAINE/_next/$c" 2>/dev/null)
  if echo "$CORPS" | rg -q 'mcl-pwa-install-ne-plus-afficher'; then
    CHUNKS_TROUVES=true
    CHAINE_TOAST="$CORPS"
    break
  fi
done
verifie "Toast InstallToast dans les bundles (clé mémoire « Ne plus afficher »)" "$([ "$CHUNKS_TROUVES" = "true" ] && echo vrai || echo faux)"
verifie "Bouton « Ne plus afficher » du toast dans les bundles" "$(echo "$CHAINE_TOAST" | rg -q 'Ne plus afficher' && echo vrai || echo faux)"
verifie "Mémoire de session (croix) dans les bundles" "$(echo "$CHAINE_TOAST" | rg -q 'mcl-pwa-install-ferme-session' && echo vrai || echo faux)"

# Animation d'entrée du toast dans le CSS de production.
CSS_ANIME=false
for s in $(rg -o 'static/chunks/[^"]+\.css' /tmp/v384-accueil.html | sort -u); do
  if curl -fsSL --max-time 20 "$DOMAINE/_next/$s" 2>/dev/null | rg -q 'toastInstallEntree'; then
    CSS_ANIME=true
    break
  fi
done
verifie "Animation d'entrée du toast (keyframes CSS)" "$([ "$CSS_ANIME" = "true" ] && echo vrai || echo faux)"

# Manifest PWA toujours servi (installation possible).
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$DOMAINE/manifest.webmanifest")
verifie "Manifest « Site public Christ Libère » toujours servi (200)" "$([ "$CODE" = "200" ] && echo vrai || echo faux)"

# ── ② Module passerelles : garde + badges de chiffrement ──
echo "── ② Module /admin/paiements — garde et contenu ──"
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$DOMAINE/admin/paiements")
verifie "Page /admin/paiements → 307 login (garde proxy intacte)" "$([ "$CODE" = "307" ] && echo vrai || echo faux)"
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$DOMAINE_ADMIN/admin/paiements")
verifie "Page /admin/paiements sur le sous-domaine admin → 307 login" "$([ "$CODE" = "307" ] && echo vrai || echo faux)"

R=$(curl -s -o /tmp/v384-api-get.json -w "%{http_code}" --max-time 30 "$DOMAINE/admin/api/paiements")
verifie "GET /admin/api/paiements sans session → 401 JSON (garde propre)" "$([ "$R" = "401" ] && echo vrai || echo faux)"
verifie "401 JSON explicite (pas de secret, pas de 307 HTML)" "$(rg -c '"error"' /tmp/v384-api-get.json >/dev/null 2>&1 && echo vrai || echo faux)"
R=$(curl -s -o /tmp/v384-api-put.json -w "%{http_code}" --max-time 30 -X PUT "$DOMAINE/admin/api/paiements" -H "Content-Type: application/json" -d '{"provider":"fedapay","activee":true}')
verifie "PUT /admin/api/paiements sans session → 401 (aucune écriture possible)" "$([ "$R" = "401" ] && echo vrai || echo faux)"

# Les pages admin chargent leurs chunks depuis la page de login (même build) :
# le centrage (mx-auto) et les badges de chiffrement vivent dans le chunk du
# composant paiements-client — vérifiés en E2E authentifié (non curl).

# ── ③ Non-régressions V3.82/V3.83 ──
echo "── ③ Non-régressions ──"
CODE=$(curl -s -o /tmp/v384-contribuer.html -w "%{http_code}" --max-time 30 "$DOMAINE/contribuer")
verifie "Page /contribuer accessible (200)" "$([ "$CODE" = "200" ] && echo vrai || echo faux)"
verifie "Boutons « Payer » de la section ④ toujours en place" "$(rg -c '>Payer<' /tmp/v384-contribuer.html >/dev/null 2>&1 && echo vrai || echo faux)"

R=$(curl -s -o /tmp/v384-initier.json -w "%{http_code}" --max-time 30 -X POST "$DOMAINE/api/dons/initier" -H "Content-Type: application/json" -d '{"provider":"paystack","type_don":"don","montant":5000,"devise":"XOF","email":"test@example.com"}')
verifie "Initiation Paystack sans clé → 503 (message d'aide /admin/paiements conservé)" "$([ "$R" = "503" ] && echo vrai || echo faux)"

# ⭐ V3.84 — Une clé FedaPay est désormais configurée via le back-office :
# l'initiation doit aboutir (200 + paymentUrl) ou répondre une erreur
# JSON EXPLICITE de NOTRE application — jamais le « error code: 502 »
# brut de Cloudflare (symptôme de l'ancien bug de parsing).
# Test sur le domaine Vercel DIRECT (contourne la couche Cloudflare qui
# remplace les corps d'erreur 5xx par du texte brut).
VERCEL_DIRECT="https://mouvement-christ-libere.vercel.app"
R=$(curl -s -o /tmp/v384-initier-fp.json -w "%{http_code}" --max-time 30 -X POST "$VERCEL_DIRECT/api/dons/initier" -H "Content-Type: application/json" -d '{"provider":"fedapay","type_don":"don","montant":5000,"devise":"XOF","email":"test@example.com"}')
if [ "$R" = "200" ]; then
  verifie "Initiation FedaPay (clé configurée) → 200 + paymentUrl (parsing v1/transaction réparé)" "$(rg -c 'paymentUrl' /tmp/v384-initier-fp.json >/dev/null 2>&1 && echo vrai || echo faux)"
else
  JSON_PROPRE=$(python3 -c "import json; d=json.load(open('/tmp/v384-initier-fp.json')); print('ok' if isinstance(d, dict) and 'error' in d else 'ko')" 2>/dev/null)
  verifie "Initiation FedaPay → réponse JSON explicite de l'application (pas le 502 brut Cloudflare) : $R" "$([ "$JSON_PROPRE" = "ok" ] && echo vrai || echo faux)"
fi

R=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 -X POST "$DOMAINE/api/webhooks/fedapay" -H "Content-Type: application/json" -d '{"name":"transaction.approved"}')
verifie "Webhook FedaPay sans signature → jamais 200" "$([ "$R" != "200" ] && echo vrai || echo faux)"
R=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 -X POST "$DOMAINE/api/webhooks/paystack" -H "Content-Type: application/json" -d '{"event":"charge.success"}')
verifie "Webhook Paystack sans signature → jamais 200" "$([ "$R" != "200" ] && echo vrai || echo faux)"

for PAGE in "/videos" "/admin/login" "/contribuer/merci"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$DOMAINE$PAGE")
  verifie "Page $PAGE → 200" "$([ "$CODE" = "200" ] && echo vrai || echo faux)"
done

echo "════════════════════════════════════════════════"
echo "Résultat : $passes ✔ / $echecs ✘"
[ "$echecs" = "0" ] || exit 1
