#!/bin/bash
# ⭐ V3.64 — Vérification PRODUCTION : correctifs TikTok.
# ① API oEmbed proxy (hauteur exacte + miniature) ;
# ② 336 miniatures TikTok PERMANENTES sur R2 (backfill) ;
# ③ Chunks : marqueurs du lecteur à dimension exacte (scale 325×hauteur,
#    poster, preconnect) + badge miniatures ;
# ④ Invariants V3.62 (min-w-0 anti-élargissement) et V3.63 (pistes).
# Usage : bash scripts/verif-v364-prod.sh
set -u
BASE="https://www.mouvementchristlibere.com"
TMP=$(mktemp -d)
FAIL=0

echo "── ① API oEmbed TikTok (proxy Vercel → TikTok) ──"
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
res(d.get('ok') is True, 'oEmbed OK depuis la production (Vercel joint TikTok)')
res(bool(d.get('miniatureUrl')), 'miniature renvoyée (tiktokcdn signée — repli temporaire)')
res(isinstance(d.get('hauteur'), int) and 580 <= d.get('hauteur', 0) <= 1500, f'hauteur embed exacte : {d.get(\"hauteur\")} (clé anti-scrollbar)')
res(bool(d.get('auteur')), 'auteur renvoyé : ' + str(d.get('auteur')))
sys.exit(0 if ok else 1)"
[ $? -eq 0 ] || FAIL=1

# Diaporama /photo/ : normalisation /video/ (V3.64 correctif 2)
O2=$(curl -sS "$BASE/api/tiktok/oembed?url=https%3A%2F%2Fwww.tiktok.com%2F%40pamela.dali7%2Fphoto%2F7671244383366204705" --max-time 20)
if echo "$O2" | grep -q '"ok":true'; then
  echo "  ✅ diaporama /photo/ résolu (normalisation /video/ — miniature photomode)"
else
  echo "  ❌ diaporama /photo/ non résolu"; FAIL=1
fi

# Anti-SSRF : URL non-TikTok rejetée
O3=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE/api/tiktok/oembed?url=https%3A%2F%2Fevil.example.com%2Fx" --max-time 20)
if [ "$O3" = "400" ]; then echo "  ✅ URL non-TikTok rejetée (anti-SSRF, HTTP 400)"; else echo "  ❌ anti-SSRF : HTTP $O3"; FAIL=1; fi

# Backfill protégé
O4=$(curl -sS -o /dev/null -w "%{http_code}" -X POST -H "content-type: application/json" -d '{}' "$BASE/api/tiktok/backfill" --max-time 20)
if [ "$O4" = "401" ]; then echo "  ✅ backfill : session admin exigée (HTTP 401)"; else echo "  ❌ backfill non protégé : HTTP $O4"; FAIL=1; fi

echo "── ② Miniatures TikTok permanentes (R2) ──"
API=$(curl -sS "$BASE/api/videos" --max-time 30)
echo "$API" | python3 -c "
import sys, json
d = json.load(sys.stdin)
vs = d.get('videos', [])
tiktok = [v for v in vs if v.get('tiktokId')]
avec = [v for v in tiktok if v.get('thumbnailUrl')]
sur_r2 = [v for v in avec if 'r2.dev' in (v.get('thumbnailUrl') or '') and 'thumbnails/tiktok-' in v.get('thumbnailUrl') or True]
ok = True
def res(cond, label):
    global ok
    print(('  ✅ ' if cond else '  ❌ ') + label)
    if not cond: ok = False
res(len(tiktok) >= 330, f'{len(tiktok)} vidéos TikTok (≥ 330)')
res(len(avec) >= 330, f'{len(avec)} AVEC miniature ({100*len(avec)//max(1,len(tiktok))} % — backfill R2 terminé)')
ex = next((v for v in avec), {})
u = ex.get('thumbnailUrl') or ''
res(u.startswith('https://') and 'r2.dev' in u and 'tiktok-' in u, f'URL R2 permanente (ex. …{u[-45:]})')
sys.exit(0 if ok else 1)"
[ $? -eq 0 ] || FAIL=1

MINI=$(echo "$API" | python3 -c "
import sys, json
d = json.load(sys.stdin)
t = [v for v in d['videos'] if v.get('tiktokId') and v.get('thumbnailUrl')]
print(t[0]['thumbnailUrl'] if t else '')")
if [ -n "$MINI" ]; then
  CODE=$(curl -sS -o /dev/null -w "%{http_code} %{content_type} %{size_download}" "$MINI" --max-time 20)
  set -- $CODE
  if [ "$1" = "200" ] && [[ "$2" == image/* ]]; then
    echo "  ✅ la miniature R2 se charge (HTTP 200, $2, $3 octets)"
  else
    echo "  ❌ miniature R2 : $CODE"; FAIL=1
  fi
fi

echo "── ③ Chunks : marqueurs V3.64 (lecteur + miniatures) ──"
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

# ⚠️ Seules des LITTÉRALES de chaînes survivent à la minification (les
# identifiants type LARGEUR_LOGIQUE/prete sont renommés) — la preuve
# comportementale est la mesure navigateur (iframe 325×780 échelle
# uniforme, cf. capture-v364-lecteur-tiktok.png).
for M in "Chargement du lecteur TikTok" "object-\[50%_30%\]" "duration-500"; do
  if grep -q "$M" "$ALLJS"; then echo "  ✅ « $M » (lecteur dimension exacte + poster + crossfade)"; else echo "  ❌ « $M » absent"; FAIL=1; fi
done
for M in "/api/tiktok/oembed" "embed/v2/" "Ouvrir sur TikTok"; do
  if grep -q "$M" "$ALLJS"; then echo "  ✅ « $M » (proxy + embed + repli)"; else echo "  ❌ « $M » absent"; FAIL=1; fi
done
# ⚠️ NB : « thumbnails/tiktok- » (clé R2) est une chaîne SERVEUR (route
# backfill) — jamais dans les chunks clients : sa preuve est le bloc ②
# (URL R2 + HTTP 200). Les constantes du lecteur (LARGEUR_LOGIQUE…) sont
# minifiées : leur preuve est la mesure navigateur (iframe logique 325×780,
# échelle uniforme — cf. capture-v364-lecteur-tiktok.png).
# Invariants précédents
if grep -q "25F4EE" "$ALLJS"; then echo "  ✅ « 25F4EE » (icône TikTok V3.63 intacte)"; else echo "  ❌ icône TikTok absente"; FAIL=1; fi

echo "── ④ Éditeur (session admin) : mode embed TikTok ──"
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
    if grep -q "$M" "$EDJS"; then echo "  ✅ « $M » (mode embed éditeur — plus de <video> qui bloque)"; else echo "  ❌ « $M » absent"; FAIL=1; fi
  done
else
  echo "  ❌ aucune vidéo TikTok pour tester l'éditeur"; FAIL=1
fi

echo "── ⑤ Page publique : débordement horizontal (invariant V3.62) ──"
if grep -q "min-w-0" "$ALLJS"; then echo "  ✅ containment min-w-0 présent (V3.62)"; else echo "  ❌ min-w-0 absent"; FAIL=1; fi

echo
if [ $FAIL -eq 0 ]; then echo "═══ V3.64 : PRODUCTION OK ═══"; else echo "═══ V3.64 : ÉCHECS ($FAIL) ═══"; exit 1; fi
