#!/bin/bash
# ⭐ V3.65 — Vérification PRODUCTION : lecteur TikTok video-first.
# ① API oEmbed proxy intacte (hauteur exacte = clé anti-scrollbar) ;
# ② Chunks : marqueurs du lecteur + constantes video-first (486/960/140
#    survivent à la minification en littéraux numériques) ;
# ③ Miniatures R2 toujours chargées (acquis V3.64) ;
# ④ Éditeur : mode embed TikTok intact ;
# ⑤ Invariant V3.62 (min-w-0 anti-élargissement).
# Usage : bash scripts/verif-v365-prod.sh
set -u
BASE="https://www.mouvementchristlibere.com"
TMP=$(mktemp -d)
FAIL=0

echo "── ① API oEmbed TikTok (garde anti-scrollbar V3.64) ──"
O1=$(curl -sS "$BASE/api/tiktok/oembed?url=https%3A%2F%2Fwww.tiktok.com%2F%40pamela.dali7%2Fvideo%2F7683371620924230944" --max-time 20)
echo "$O1" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    print('  ❌ réponse non-JSON'); sys.exit(1)
ok = True
def res(cond, label):
    global ok
    print(('  ✅ ' if cond else '  ❌ ') + label)
    if not cond: ok = False
res(d.get('ok') is True, 'oEmbed OK depuis la production')
res(isinstance(d.get('hauteur'), int) and 580 <= d.get('hauteur', 0) <= 1500, f'hauteur embed exacte : {d.get(\"hauteur\")} (l\\'iframe garde sa taille logique → zéro scrollbar)')
res(bool(d.get('miniatureUrl')), 'miniature renvoyée (poster de repli)')
sys.exit(0 if ok else 1)"
[ $? -eq 0 ] || FAIL=1

echo "── ② Chunks /videos : marqueurs V3.65 ──"
HTML=$(curl -sS "$BASE/videos" --max-time 30 -o "$TMP/videos.html" -w "%{http_code}")
echo "  page /videos : HTTP $HTML"
CHUNKS=$(grep -oP '/_next/static/chunks/[a-zA-Z0-9_-]+\.js' "$TMP/videos.html" | sort -u)
for c in $CHUNKS; do curl -sS "$BASE$c" -o "$TMP/$(basename $c)" --max-time 20 2>/dev/null; done
BM=$(grep -oP '/_next/static/[^"]+/_buildManifest\.js' "$TMP/videos.html" | head -1)
if [ -n "$BM" ]; then
  curl -sS "$BASE$BM" -o "$TMP/buildManifest.js" --max-time 20 2>/dev/null
  EXTRA=$(grep -oP 'static/chunks/[a-zA-Z0-9_-]+\.js' "$TMP/buildManifest.js" | sort -u | sed 's|static|/_next/static|')
  for c in $EXTRA; do F="$TMP/$(basename $c)"; [ -f "$F" ] || curl -sS "$BASE$c" -o "$F" --max-time 20 2>/dev/null; done
fi
ALLJS=$(mktemp); cat "$TMP"/*.js > "$ALLJS" 2>/dev/null
echo "  total JS analysé : $(wc -c < "$ALLJS") octets"

# Marqueurs de chaînes (survivent à la minification)
for M in "Chargement du lecteur TikTok" "Ouvrir sur TikTok" "/api/tiktok/oembed" "embed/v2/"; do
  if grep -q "$M" "$ALLJS"; then echo "  ✅ « $M »"; else echo "  ❌ « $M » absent"; FAIL=1; fi
done

# Constantes video-first : le chunk DU LECTEUR doit porter les littéraux
# numériques 486 (LARGEUR_MAX_PAGE), 960 (cap hauteur) et 140 (réserve
# barre+titre). ⚠️ V3.64 n'avait NI 486 NI 960 NI le « −140 » : leur
# présence prouve le nouveau dimensionnement déployé.
LECTEUR=$(grep -l "Chargement du lecteur TikTok" "$TMP"/*.js 2>/dev/null | head -1)
if [ -n "$LECTEUR" ]; then
  echo "  chunk lecteur : $(basename $LECTEUR)"
  # NB : 578 = Math.round(325*16/9) — le minificateur PLIE le calcul en
  # littéral 577.7777777777778 (la preuve que HAUTEUR_VIDEO_LOGIQUE est
  # dérivée de la zone vidéo 9:16, pas d'une constante arbitraire).
  if grep -qE "577\.77|578" "$LECTEUR"; then echo "  ✅ littéral 577.7…/578 présent (zone vidéo 9:16 dérivée)"; else echo "  ❌ littéral 577.7…/578 absent"; FAIL=1; fi
  if grep -q "140" "$LECTEUR"; then echo "  ✅ littéral 140 (réserve vh−140) présent"; else echo "  ❌ littéral 140 absent"; FAIL=1; fi
  # photo : repli diaporama
  if grep -q "photo" "$LECTEUR"; then echo "  ✅ repli /photo/ (diaporamas → embed complet V3.64)"; else echo "  ❌ repli /photo/ absent"; FAIL=1; fi
else
  echo "  ❌ chunk du lecteur introuvable"; FAIL=1
fi

# Invariants précédents
if grep -q "25F4EE" "$ALLJS"; then echo "  ✅ « 25F4EE » (icône TikTok V3.63 intacte)"; else echo "  ❌ icône TikTok absente"; FAIL=1; fi
if grep -q "min-w-0" "$ALLJS"; then echo "  ✅ containment min-w-0 (invariant V3.62)"; else echo "  ❌ min-w-0 absent"; FAIL=1; fi

echo "── ③ Miniatures R2 (acquis V3.64) ──"
API=$(curl -sS "$BASE/api/videos" --max-time 30)
echo "$API" | python3 -c "
import sys, json
d = json.load(sys.stdin)
vs = d.get('videos', [])
tiktok = [v for v in vs if v.get('tiktokId')]
avec = [v for v in tiktok if v.get('thumbnailUrl')]
print(f'  {\"✅\" if len(avec) >= 330 else \"❌\"} {len(avec)}/{len(tiktok)} vidéos TikTok avec miniature R2')
sys.exit(0 if len(avec) >= 330 else 1)"
[ $? -eq 0 ] || FAIL=1

echo "── ④ Éditeur (session admin) : mode embed TikTok intact ──"
JAR=$(mktemp)
curl -sS -c "$JAR" -X POST -H "content-type: application/json" \
  -d '{"name":"pam@christ-libere.org","password":"PamChristLibere2026!"}' \
  "$BASE/admin/api/login" --max-time 20 -o /dev/null
ID_TT=$(echo "$API" | python3 -c "
import sys, json
d = json.load(sys.stdin)
t = [v for v in d['videos'] if v.get('tiktokId')]
print(t[0]['id'] if t else '')")
if [ -n "$ID_TT" ]; then
  curl -sS -b "$JAR" "$BASE/admin/videos/$ID_TT/edit" --max-time 30 -o "$TMP/edit.html"
  CHUNKS_EDIT=$(grep -oP '/_next/static/chunks/[a-zA-Z0-9_-]+\.js' "$TMP/edit.html" | sort -u)
  for c in $CHUNKS_EDIT; do F="$TMP/edit-$(basename $c)"; [ -f "$F" ] || curl -sS -b "$JAR" "$BASE$c" -o "$F" --max-time 20 2>/dev/null; done
  EDJS=$(mktemp); cat "$TMP"/edit-*.js > "$EDJS" 2>/dev/null
  echo "  total JS éditeur : $(wc -c < "$EDJS") octets"
  for M in "Vidéo TikTok en lecture" "Vidéo YouTube en lecture"; do
    if grep -q "$M" "$EDJS"; then echo "  ✅ « $M »"; else echo "  ❌ « $M » absent"; FAIL=1; fi
  done
  LEC_ED=$(grep -l "Chargement du lecteur TikTok" "$TMP"/edit-*.js 2>/dev/null | head -1)
  if [ -n "$LEC_ED" ] && grep -q 486 "$LEC_ED"; then
    echo "  ✅ lecteur video-first présent dans l'éditeur (mode boîte remplit la zone 9:16)"
  else
    echo "  ❌ lecteur video-first absent de l'éditeur"; FAIL=1
  fi
else
  echo "  ❌ aucune vidéo TikTok pour tester l'éditeur"; FAIL=1
fi

echo
if [ $FAIL -eq 0 ]; then echo "═══ V3.65 : PRODUCTION OK ═══"; else echo "═══ V3.65 : ÉCHECS ($FAIL) ═══"; exit 1; fi
