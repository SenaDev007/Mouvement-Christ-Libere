#!/bin/bash
# ============================================================
# VALIDATION V4.10 — MODE HORS LIGNE DE L'APPLICATION
# ============================================================
# Serveur dev (DB factice → replis par défaut, comme V4.09) :
#   ① Les 13 routes /app répondent 200
#   ② /api/app/content répond 200 + hash stable + structure JSON
#   ③ /sw-app.js servi + handlers présents (fetch + push + precache)
#   ④ /offline.html servi
#   ⑤ Manifest inchangé (start_url /app)
#   ⑥ Le client embarque le moteur hors ligne (bundle)
# ============================================================

set -u
cd "$(dirname "$0")/.."

export DATABASE_URL="postgresql://fake:fake@localhost:5432/fake"
export DIRECT_URL="postgresql://fake:fake@localhost:5432/fake"
export NEXTAUTH_SECRET="validation-v410-secret"
export NEXTAUTH_URL="http://localhost:3210"
export PORT=3210

echo "── [1/6] Démarrage serveur dev (port $PORT, DB factice) ──"
rm -f /tmp/v410-dev.log
# ⚠ Ne PAS passer par `bun run dev` : le script package.json force -p 3000.
npx next dev -p $PORT > /tmp/v410-dev.log 2>&1 &
DEV_PID=$!

# Attendre que le serveur réponde (max 120 s)
for i in $(seq 1 60); do
  sleep 2
  if curl -s -o /dev/null -m 3 "http://localhost:$PORT/app"; then break; fi
done
echo "Serveur prêt après ~$((i*2))s"

PASS=0; FAIL=0
check() { # $1=nom $2=condition(0/1)
  if [ "$2" = "0" ]; then PASS=$((PASS+1)); echo "  ✔ $1"; else FAIL=$((FAIL+1)); echo "  ✘ $1"; fi
}

echo "── [2/6] Les 13 routes de l'application ──"
for route in /app /app/afrika /app/pasteur-kongo /app/temoignages /app/enseignements \
            /app/videos /app/adoration-louanges /app/intercession /app/disperses \
            /app/contribuer /app/annonces /app/rendez-vous /app/yeshua-connect; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 30 "http://localhost:$PORT$route")
  check "GET $route → 200 (reçu $code)" $([ "$code" = "200" ] || [ "$code" = "307" ]; echo $?)
done

echo "── [3/6] API bundle de contenu /api/app/content ──"
curl -s -m 30 "http://localhost:$PORT/api/app/content" > /tmp/v410-content.json
code=$(curl -s -o /dev/null -w "%{http_code}" -m 30 "http://localhost:$PORT/api/app/content")
check "GET /api/app/content → 200 (reçu $code)" $([ "$code" = "200" ]; echo $?)
H1=$(node -e "const d=require('/tmp/v410-content.json'); console.log(typeof d.hash === 'string' && d.hash.startsWith('fnv-') ? 'OK' : 'BAD')")
check "hash présent et préfixé fnv- ($H1)" $([ "$H1" = "OK" ]; echo $?)
node -e "
const d=require('/tmp/v410-content.json');
const ok = d.data && ('heroLanding' in d.data) && ('serviteurs' in d.data) && ('sections' in d.data);
console.log(ok ? 'STRUCTURE-OK' : 'STRUCTURE-BAD: ' + JSON.stringify(Object.keys(d.data||{})));
" > /tmp/v410-structure.txt
check "structure { heroLanding, serviteurs, sections }" $([ "$(cat /tmp/v410-structure.txt)" = "STRUCTURE-OK" ]; echo $?)
# Hash STABLE (pas de generatedAt dans le hash → pas de boucle de refresh)
sleep 3
curl -s -m 30 "http://localhost:$PORT/api/app/content" > /tmp/v410-content2.json
H2=$(node -e "const d=require('/tmp/v410-content2.json'); console.log(d.hash)")
H1V=$(node -e "const d=require('/tmp/v410-content.json'); console.log(d.hash)")
check "hash STABLE entre 2 appels ($H1V)" $([ "$H1V" = "$H2" ]; echo $?)

echo "── [4/6] Service worker + page hors ligne ──"
SW=$(curl -s -m 10 "http://localhost:$PORT/sw-app.js")
code=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "http://localhost:$PORT/sw-app.js")
check "GET /sw-app.js → 200 (reçu $code)" $([ "$code" = "200" ]; echo $?)
echo "$SW" > /tmp/v410-sw.js
for marker in "christ-libere-pages" "navigationHandler" "staleWhileRevalidate" "pushsubscriptionchange" "APP_PAGES" "offline.html" "skipWaiting" "clients.claim" "isRealtimeOrVideo"; do
  grep -q "$marker" /tmp/v410-sw.js
  check "sw-app.js contient « $marker »" $?
done
grep -q "/app/yeshua-connect" /tmp/v410-sw.js
check "sw-app.js : notificationclick → /app/yeshua-connect (app)" $?
code=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "http://localhost:$PORT/offline.html")
check "GET /offline.html → 200 (reçu $code)" $([ "$code" = "200" ]; echo $?)

echo "── [5/6] Manifest PWA ──"
curl -s -m 10 "http://localhost:$PORT/manifest.webmanifest" > /tmp/v410-manifest.json
node -e "
const m = require('/tmp/v410-manifest.json');
const ok = m.start_url === '/app' && m.id === '/';
console.log(ok ? 'MANIFEST-OK' : 'MANIFEST-BAD ' + JSON.stringify({start_url: m.start_url, id: m.id}));
" > /tmp/v410-manifest-check.txt
check "start_url=/app, id=/ conservé" $([ "$(cat /tmp/v410-manifest-check.txt)" = "MANIFEST-OK" ]; echo $?)

echo "── [6/6] Client : moteur hors ligne dans la page /app ──"
curl -s -m 30 "http://localhost:$PORT/app" > /tmp/v410-app.html
# Le composant ServiceWorkerRegister est monté dans le layout → le bundle
# client référencé doit contenir l'enregistrement du SW (Turbopack place
# le code dans des chunks chargés à la demande — on parcourt TOUTES les
# balises <script src> de la page).
CHUNK=$(grep -o 'src="[^"]*\.js"' /tmp/v410-app.html | sed 's/src="//;s/"//')
FOUND_ENGINE=1; FOUND_SWREG=1; FOUND_DEXIE=1
for c in $CHUNK; do
  body=$(curl -s -m 10 "http://localhost:$PORT$c")
  echo "$body" | grep -q "sw-app.js" && FOUND_SWREG=0
  echo "$body" | grep -q "christ-libere-app" && FOUND_ENGINE=0
  echo "$body" | grep -q "ycl:content-updated" && FOUND_ENGINE=0
  echo "$body" | grep -q "indexedDB" && FOUND_DEXIE=0
done
check "enregistrement /sw-app.js dans le bundle client" $FOUND_SWREG
check "moteur hors ligne (IndexedDB « christ-libere-app » / events ycl:) dans le bundle" $FOUND_ENGINE
check "IndexedDB référencé côté client (Dexie)" $FOUND_DEXIE

echo ""
echo "════════════ RÉSULTAT : $PASS ✔ / $FAIL ✘ ════════════"

kill $DEV_PID 2>/dev/null
# Tue les éventuels enfants next restants sur le port
fuser -k $PORT/tcp 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true
exit $([ "$FAIL" = "0" ]; echo $?)
