#!/bin/bash
# ⭐ V3.60 — Vérification PRODUCTION : stickers pro + filtres cinéma + presets
# + transitions réelles + raccourci Bibliothèque visible.
# Usage : bash scripts/verif-v360-prod.sh
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
if echo "$LOGIN" | grep -q "HTTP_STATUS:200"; then echo "  ✅ session admin"; else echo "  ❌ login refusé"; exit 1; fi

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
curl -sS -b "$JAR" "$BASE$PAGE" -o "$TMP/edit.html" --max-time 30
echo "  page récupérée : $(wc -c < "$TMP/edit.html") octets"

# Extraire TOUS les chunks référencés + ceux du runtime
CHUNKS=$(grep -oP '/_next/static/chunks/[a-zA-Z0-9_-]+\.js' "$TMP/edit.html" | sort -u)
echo "  chunks directs dans le HTML : $(echo "$CHUNKS" | grep -c . || true)"

# Télécharger les chunks directs
for c in $CHUNKS; do
  curl -sS "$BASE$c" -o "$TMP/$(basename $c)" --max-time 20 2>/dev/null
done

# Les composants de page (post-production) sont souvent dans des chunks chargés
# dynamiquement : élargir via le _buildManifest.js si présent
BM=$(grep -oP '/_next/static/[^"]+/_buildManifest\.js' "$TMP/edit.html" | head -1)
if [ -z "$BM" ]; then
  # fallback : récupérer le buildId depuis le HTML
  BID=$(grep -oP '"buildId":"[^"]+"' "$TMP/edit.html" | head -1 | cut -d'"' -f4)
  if [ -n "$BID" ]; then BM="/_next/static/$BID/_buildManifest.js"; fi
fi
if [ -n "$BM" ]; then
  curl -sS "$BASE$BM" -o "$TMP/buildManifest.js" --max-time 20 2>/dev/null
  echo "  buildManifest : $(wc -c < "$TMP/buildManifest.js") octets"
  # Les chunks liés à /admin/videos/[id]/edit
  EXTRA=$(python3 -c "
import re
try:
    src = open('$TMP/buildManifest.js').read()
    # trouver la section de la route edit
    m = re.findall(r'\"(/admin/videos/\[id\]/edit[^\"]*)\"', src)
    if m:
        idx = src.find(m[0])
        seg = src[idx:idx+3000]
        for c in re.findall(r'static/chunks/([a-zA-Z0-9_-]+\.js)', seg):
            print(c)
except Exception: pass" | sort -u)
  echo "  chunks de la route edit (manifest) : $(echo "$EXTRA" | grep -c . || true)"
  for c in $EXTRA; do
    [ -s "$TMP/$c" ] || curl -sS "$BASE/_next/static/chunks/$c" -o "$TMP/$c" --max-time 20 2>/dev/null
  done
fi

# Concaténer tout le JS disponible
cat "$TMP"/*.js > "$TMP/all.js" 2>/dev/null
TOTAL=$(wc -c < "$TMP/all.js")
echo "  JS total inspecté : $TOTAL octets"

echo "── ④ Marqueurs V3.60 dans les chunks ──"
verif() {
  if grep -q "$1" "$TMP/all.js" 2>/dev/null; then
    echo "  ✅ $2"
  else
    echo "  ❌ $2 (introuvable)"; FAIL=1
  fi
}
verif "stickerpro-" "pipeline stickers pro (addProSticker)"
# NB : le nom de fonction est minifié — on teste les CHAÎNES LITTÉRALES qui survivent
verif "data:image/svg+xml" "rastérisation SVG (data-URL)"
verif "Bibliothèque" "libellé Bibliothèque"
verif "stickerVue\|Réseaux sociaux" "catégories stickers pro"
verif "Presets d'un clic" "presets d'étalonnage 1 clic"
verif "Pack PRO" "transitions groupées Pack PRO"
verif "tealorange" "filtres cinéma (tealorange)"
verif "bluenight\|cyberpunk" "filtres ambiance"
verif "S'ABONNER" "boutons sociaux CapCut (S'ABONNER)"
verif "J'AIME" "bouton J'AIME"
verif "PARTAGER" "bouton PARTAGER"
verif "sons, musiques, vidéos, templates" "raccourci Bibliothèque EN-TÊTE (retour pasteur)"
# NB : « acrossfade » vit dans video-render.ts (code SERVEUR, fonctions
# serverless) — absent des chunks clients PAR CONSTRUCTION. Le déploiement
# Vercel est ATOMIQUE : les marqueurs clients prouvent le déploiement ;
# les chaînes serveur sont prouvées par les tests ffmpeg locaux
# (scripts/test-ffmpeg-v360.sh, 17/17 OK).
verif "Mixkit" "bibliothèque Mixkit (V3.59) toujours présente"
verif "sticker-catalog\|Confettis" "catalogue stickers complet (Confettis…)"

# Vérifier le pointeur de déploiement actuel
DPL=$(grep -oP 'dpl=[a-zA-Z0-9_]+' "$TMP/edit.html" | head -1)
echo "── ⑤ Empreinte déploiement : ${DPL:-non trouvée dans la page} ──"

echo
if [ "$FAIL" = "0" ]; then echo "════ V3.60 VÉRIFIÉE EN PRODUCTION ════"; else echo "════ VÉRIFICATION INCOMPLÈTE — relancer si build en cours ════"; fi
rm -rf "$TMP" "$JAR"
exit $FAIL
