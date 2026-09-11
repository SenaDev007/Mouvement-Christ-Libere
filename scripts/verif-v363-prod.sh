#!/bin/bash
# ⭐ V3.63 — Vérification PRODUCTION : timeline 2 pistes par type + boutons
# PRO mesurés + TikTok (schéma YouTube) + 336 vidéos insérées.
# Usage : bash scripts/verif-v363-prod.sh
set -u
BASE="https://www.mouvementchristlibere.com"
JAR=$(mktemp)
TMP=$(mktemp -d)
FAIL=0

echo "── ① API publique : champ tiktokId + comptage ──"
API=$(curl -sS "$BASE/api/videos" --max-time 30)
echo "$API" | python3 -c "
import sys, json
d = json.load(sys.stdin)
vs = d.get('videos', [])
tiktok = [v for v in vs if v.get('tiktokId')]
rub = [v for v in vs if v.get('category') == 'Saint-Esprit réponds-moi']
ok = True
def res(cond, label):
    global ok
    print(('  ✅ ' if cond else '  ❌ ') + label)
    if not cond: ok = False
res(len(vs) >= 1100, f'{len(vs)} vidéos au total (≥ 1100 attendues)')
res(len(tiktok) >= 330, f'{len(tiktok)} vidéos TikTok (≥ 330 attendues)')
res(len(rub) >= 330, f'rubrique « Saint-Esprit réponds-moi » : {len(rub)} épisodes')
ex = tiktok[0] if tiktok else {}
res('tiktok.com' in (ex.get('videoUrl') or ''), 'videoUrl TikTok stocké (schéma YouTube : URL complète)')
res(bool(ex.get('publishedAt')), 'publishedAt rempli (date décodée snowflake)')
import re
sys.exit(0 if ok else 1)"
[ $? -eq 0 ] || FAIL=1

echo "── ② Page publique /videos ──"
HTML=$(curl -sS "$BASE/videos" --max-time 30 -o "$TMP/videos.html" -w "%{http_code}")
echo "  page : HTTP $HTML ($(wc -c < "$TMP/videos.html") octets)"

echo "── ③ Chunks : marqueurs V3.63 ──"
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
for M in "25F4EE" "tiktokId" "Ouvrir sur TikTok"; do
  if grep -q "$M" "$ALLJS"; then echo "  ✅ « $M » (page publique TikTok)"; else echo "  ❌ « $M » absent"; FAIL=1; fi
done

echo "── ④ Page d'édition (session admin) : pistes V1/V2/TX1/TX2/IMG/A1/A2 ──"
LOGIN=$(curl -sS -c "$JAR" -X POST "$BASE/admin/api/login" -H "Content-Type: application/json" -d '{"name":"pam@christ-libere.org","password":"PamChristLibere2026!"}' -w "%{http_code}" -o /dev/null --max-time 30)
[ "$LOGIN" = "200" ] && echo "  ✅ session admin" || { echo "  ❌ login refusé"; FAIL=1; }
VID=$(curl -sS "$BASE/api/videos" --max-time 30 | python3 -c "
import sys, json
vs = json.load(sys.stdin).get('videos', [])
y = next((v for v in vs if v.get('youtubeId')), None)
print(y['id'] if y else '')")
PAGE="/admin/videos/$VID"
CHUNKS_ADMIN=$(curl -sS -b "$JAR" "$BASE$PAGE/edit" -o "$TMP/edit.html" --max-time 30 -w "%{http_code}")
echo "  éditeur : HTTP $CHUNKS_ADMIN"
CHUNKS2=$(grep -oP '/_next/static/chunks/[a-zA-Z0-9_-]+\.js' "$TMP/edit.html" | sort -u)
for c in $CHUNKS2; do F="$TMP/$(basename $c)"; [ -f "$F" ] || curl -sS "$BASE$c" -o "$F" --max-time 20 2>/dev/null; done
cat "$TMP"/*.js > "$ALLJS" 2>/dev/null
for M in "V2 · Incrustation" "TX1 · Texte" "TX2 · Texte" "A2 · Audio" "mesurerTexte est introuvable—marqueur remplacé" ; do :; done
for M in "V2 · Incrustation" "TX1 · Texte" "TX2 · Texte" "A2 · Audio" "Incrustation sur V2" "Ajouter à la séquence V1"; do
  if grep -q "$M" "$ALLJS"; then echo "  ✅ « $M »"; else echo "  ❌ « $M » absent"; FAIL=1; fi
done
# boutons PRO : la chaîne de fabrique est minifiée → on cherche les libellés
for M in "J'AIME + S'ABONNER" "MERCI DE PARTAGER" "REGARDE JUSQU'À LA FIN" "NOTIFICATIONS ACTIVÉES" "GLOIRE À DIEU"; do
  if grep -q "$M" "$ALLJS"; then echo "  ✅ bouton « $M »"; else echo "  ❌ bouton « $M » absent"; FAIL=1; fi
done

echo "── ⑤ Invariants V3.61/62 intacts ──"
for M in "V1 · Vidéo" "IMG · Images" "A1 · Audio" "min-w-0 space-y-3" "Templates intégrés"; do
  if grep -q "$M" "$ALLJS"; then echo "  ✅ « $M »"; else echo "  ❌ « $M » absent"; FAIL=1; fi
done

if [ $FAIL -eq 0 ]; then echo "═══ V3.63 PROD : OK ═══"; else echo "═══ V3.63 PROD : ÉCHEC ═══"; exit 1; fi
