#!/bin/bash
# ⭐ V3.62 — Vérification PRODUCTION : correctif « l'écran s'élargit ».
# ① login admin  ② page post-production  ③ marqueurs du fix dans les chunks
# (les classNames survivent à la minification : elles sont des littéraux
# string dans le JSX compilé).
# Usage : bash scripts/verif-v362-prod.sh
set -u
BASE="https://www.mouvementchristlibere.com"
JAR=$(mktemp)
TMP=$(mktemp -d)
FAIL=0

echo "── ① Connexion admin ──"
LOGIN=$(curl -sS -c "$JAR" -X POST "$BASE/admin/api/login" \
  -H "Content-Type: application/json" \
  -d '{"name":"pam@christ-libere.org","password":"PamChristLibere2026!"}' \
  -w "\nHTTP_STATUS:%{http_code}" --max-time 30)
if echo "$LOGIN" | grep -q "HTTP_STATUS:200"; then echo "  ✅ session admin"; else echo "  ❌ login refusé"; FAIL=1; fi

echo "── ② Trouver une vidéo pour ouvrir la post-production ──"
VID=$(curl -sS -b "$JAR" "$BASE/admin/api/videos?limit=5" --max-time 30 | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    items = d.get('items', d if isinstance(d, list) else [])
    for v in items:
        if v.get('id'):
            print(v['id']); break
except Exception: pass")
if [ -z "$VID" ]; then echo "  ❌ aucune vidéo"; exit 1; fi
echo "  vidéo : $VID"

echo "── ③ Page post-production (HTML + chunks) ──"
PAGE="/admin/videos/$VID/edit"
STATUS=$(curl -sS -b "$JAR" -o "$TMP/edit.html" -w "%{http_code}" "$BASE$PAGE" --max-time 30)
echo "  page : HTTP $STATUS ($(wc -c < "$TMP/edit.html") octets)"
[ "$STATUS" = "200" ] || { echo "  ❌ page inaccessible"; exit 1; }

CHUNKS=$(grep -oP '/_next/static/chunks/[a-zA-Z0-9_-]+\.js' "$TMP/edit.html" | sort -u)
echo "  chunks directs : $(echo "$CHUNKS" | grep -c . || true)"
for c in $CHUNKS; do
  curl -sS "$BASE$c" -o "$TMP/$(basename $c)" --max-time 20 2>/dev/null
done

# buildManifest pour élargir aux chunks dynamiques (les panneaux sont chargés
# paresseusement) — V3.59/V3.60/V3.61 ont montré que les composants de la
# post-production vivent dans des chunks indirects.
BM=$(grep -oP '/_next/static/[^"]+/_buildManifest\.js' "$TMP/edit.html" | head -1)
if [ -n "$BM" ]; then
  curl -sS "$BASE$BM" -o "$TMP/buildManifest.js" --max-time 20 2>/dev/null
  EXTRA=$(grep -oP 'static/chunks/[a-zA-Z0-9_-]+\.js' "$TMP/buildManifest.js" | sort -u | sed 's|static|/_next/static|')
  NB_AVANT=$(ls "$TMP"/*.js 2>/dev/null | grep -v buildManifest | wc -l)
  for c in $EXTRA; do
    F="$TMP/$(basename $c)"
    [ -f "$F" ] || curl -sS "$BASE$c" -o "$F" --max-time 20 2>/dev/null
  done
  NB_APRES=$(ls "$TMP"/*.js 2>/dev/null | grep -v buildManifest | wc -l)
  echo "  chunks via buildManifest : +$((NB_APRES - NB_AVANT))"
fi

ALLJS=$(mktemp)
cat "$TMP"/*.js > "$ALLJS" 2>/dev/null
echo "  total JS analysé : $(wc -c < "$ALLJS") octets"

echo "── ④ Marqueurs du correctif V3.62 (classNames littérales) ──"
if grep -q "min-w-0 space-y-3" "$ALLJS"; then
  N=$(grep -o "min-w-0 space-y-3" "$ALLJS" | wc -l)
  echo "  ✅ colonnes de grille min-w-0 présentes (${N} occurrence(s))"
else
  echo "  ❌ « min-w-0 space-y-3 » introuvable — fix non déployé ?"; FAIL=1
fi
if grep -q "flex-1 min-w-0 overflow-x-auto" "$ALLJS"; then
  echo "  ✅ scroller timeline : flex-1 + min-w-0 + overflow-x-auto"
else
  echo "  ❌ scroller sans min-w-0 — fix non déployé ?"; FAIL=1
fi

echo "── ⑤ Invariants V3.61/V3.60 intacts ──"
for M in "Timeline multi-pistes" "V1 · Vidéo" "Templates intégrés" "Bibliothèque" "Pack PRO"; do
  if grep -q "$M" "$ALLJS"; then echo "  ✅ « $M »"; else echo "  ❌ « $M » absent"; FAIL=1; fi
done

echo "── ⑥ La MESURE décisive (navigateur headless) est faite séparément :"
echo "     document.scrollWidth DOIT égaler window.innerWidth sur la page d'édition."

if [ $FAIL -eq 0 ]; then echo "═══ V3.62 PROD : OK ═══"; else echo "═══ V3.62 PROD : ÉCHEC ═══"; exit 1; fi
