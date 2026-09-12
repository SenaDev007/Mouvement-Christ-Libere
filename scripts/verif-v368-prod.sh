#!/usr/bin/env bash
# ⭐ V3.68 — Vérification PRODUCTION : refonte palette noir/or/feu.
# Usage : bash scripts/verif-v368-prod.sh
set -u
OK=0; KO=0
v() { if [ "$1" = "0" ]; then OK=$((OK+1)); echo "  ✓ $2"; else KO=$((KO+1)); echo "  ✗ $2"; fi; }
DOM="https://www.mouvementchristlibere.com"
ADM="https://admin.mouvementchristlibere.com"

echo "═══ ① Pages publiques (200) ═══"
for p in "/" "/pam" "/pasteur-kongo" "/temoignages" "/enseignements" "/videos" "/communaute" "/contribuer" "/contact" "/rendez-vous" "/annonces"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 25 "$DOM$p")
  [ "$code" = "200" ] && v 0 "$p → 200" || v 1 "$p → $code"
done

echo "═══ ② theme-color noir dans le HTML ═══"
HTML=$(curl -s --max-time 25 "$DOM/")
echo "$HTML" | grep -q 'theme-color" content="#000000"' && v 0 "meta theme-color = #000000" || v 1 "theme-color manquant"

echo "═══ ③ CSS compilé : zéro violet, noir/feu/or présents (TOUS chunks) ═══"
CSS_URLS=$(echo "$HTML" | grep -o '/_next/static/[^"]*\.css' | sort -u)
if [ -n "$CSS_URLS" ]; then
  CSS=$(for u in $CSS_URLS; do curl -s --max-time 25 "$DOM$u"; done)
  echo "$CSS" | grep -qiE "2A0E3D|8C5FA8|FAF6EF|1E0F2B|1A0826|3D1A54" && v 1 "violet résiduel dans CSS compilé" || v 0 "aucun violet dans CSS compilé (tous chunks)"
  n=$(echo "$CSS" | grep -oiE "000000|FF7A1A|C9A227" | wc -l)
  [ "$n" -gt 100 ] && v 0 "noir/feu/or dominants ($n occurrences)" || v 1 "noir/feu/or insuffisants ($n)"
  echo "$CSS" | grep -q "logo-halo-feu" && v 0 "classe halo feu logo présente" || v 1 "halo feu absent"
  echo "$CSS" | grep -qiE -- "--color-fire:#FF7A1A|--color-fire: #FF7A1A" && v 0 "token --color-fire défini" || v 1 "token feu absent"
  echo "$CSS" | grep -q "cta-rdv-pulse" && v 0 "CTA RDV pulsant conservé (V3.67)" || v 1 "CTA RDV perdu"
else
  v 1 "URL CSS introuvable"
fi

echo "═══ ④ Assets de partage (fond noir) ═══"
for a in "/og-image.png" "/favicon.ico" "/manifest-512.png" "/icon.png"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$DOM$a")
  [ "$code" = "200" ] && v 0 "$a → 200" || v 1 "$a → $code"
done
# coin de l'og-image = noir pur (via range binaire, PNG signature)
curl -s --max-time 20 "$DOM/og-image.png?v=noir-2026-09" -o /tmp/og-prod.png
python3 -c "
from PIL import Image
im = Image.open('/tmp/og-prod.png').convert('RGB')
px = im.getpixel((5, 5))
import sys; sys.exit(0 if sum(px) < 30 else 1)
" && v 0 "og-image : coin noir pur (palette logo)" || v 1 "og-image pas noir"

echo "═══ ⑤ Manifest PWA ═══"
MAN=$(curl -s --max-time 20 "$DOM/manifest.webmanifest")
echo "$MAN" | grep -q '"theme_color": "#000000"' && v 0 "manifest theme_color noir" || v 1 "theme_color incorrect"
echo "$MAN" | grep -q '"background_color": "#000000"' && v 0 "manifest background_color noir" || v 1 "background_color incorrect"

echo "═══ ⑥ Back-office admin (base noire) ═══"
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 25 "$ADM/admin")
[ "$code" = "200" ] || [ "$code" = "307" ] && v 0 "/admin → $code (307 = garde login, normal)" || v 1 "/admin → $code"
HTMLL=$(curl -s --max-time 25 "$ADM/admin/login")
echo "$HTMLL" | grep -q 'theme-color" content="#000000"' && v 0 "admin login theme-color noir" || v 1 "admin theme-color incorrect"
CSSA=$(echo "$HTMLL" | grep -o '/_next/static/[^"]*\.css' | head -1)
[ -n "$CSSA" ] && curl -s --max-time 25 "$ADM$CSSA" | grep -qiE "2A0E3D|8C5FA8" && v 1 "violet dans CSS admin" || v 0 "CSS admin sans violet"

echo "═══ ⑦ Sous-domaines staff ═══"
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 25 "https://secretariat.mouvementchristlibere.com/secretariat/login")
[ "$code" = "200" ] && v 0 "secreteriat /secretariat/login → 200" || v 1 "secreteriat → $code"
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 25 "https://tresorerie.mouvementchristlibere.com/tresorerie/login")
[ "$code" = "200" ] && v 0 "tresorerie /tresorerie/login → 200" || v 1 "tresorerie → $code"

echo "═══ RÉSULTAT : $OK ✓ / $KO ✗ ═══"
[ "$KO" = "0" ] && echo "V3.68 PRODUCTION CONFORME" || exit 1
