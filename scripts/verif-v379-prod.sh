#!/bin/bash
# ⭐ V3.79 — Vérification production après déploiement Vercel.
#
# Page dédiée Adoration & Louanges (Afrika, chantre de l'Éternel) :
#  ① /adoration-louanges en ligne : hero, identité chantre, cartes
#     catégories scindées, recherche, citation ;
#  ② navigation : entrée « Adoration & Louanges » dans les chunks JS
#     (menu Médias) + footer + carte page Afrika ;
#  ③ /admin/adoration protégé (307 → login) et présent dans les chunks ;
#  ④ /videos inchangé (aucune régression de la médiathèque).
set -u
DOMAINE="https://www.mouvementchristlibere.com"
ATTEMPTS=0
OK=0; KO=0
verif() { # étiquette, condition (0=ok)
  if [ "$2" -eq 0 ]; then OK=$((OK+1)); echo "  ✔ $1"; else KO=$((KO+1)); echo "  ✗ $1"; fi
}

echo "── Attente du déploiement Vercel (marqueur V3.79) ─────────"
HTML_ADORATION=""
while [ $ATTEMPTS -lt 40 ]; do
  HTML_ADORATION=$(curl -sL "$DOMAINE/adoration-louanges" 2>/dev/null)
  CODE=$(curl -sL -o /dev/null -w "%{http_code}" "$DOMAINE/adoration-louanges" 2>/dev/null)
  if [ "$CODE" = "200" ] && echo "$HTML_ADORATION" | grep -q "Chantre de l"; then
    echo "  ✔ V3.79 en ligne (tentative $((ATTEMPTS+1)))"
    break
  fi
  ATTEMPTS=$((ATTEMPTS+1)); echo "  … attente ($ATTEMPTS/40) code=$CODE"; sleep 20
done

echo "── ① /adoration-louanges : la page dédiée ────────────────"
CODE=$(curl -sL -o /dev/null -w "%{http_code}" "$DOMAINE/adoration-louanges"); verif "HTTP 200" $([ "$CODE" = "200" ] && echo 0 || echo 1)
echo "$HTML_ADORATION" | grep -q "Chantre de l"; verif "hero : kicker « Chantre de l'Éternel »" $?
echo "$HTML_ADORATION" | grep -q "Adoration &"; verif "hero : titre « Adoration & … »" $?
echo "$HTML_ADORATION" | grep -q "Afrika Alkebulane Pamela Dali"; verif "identité de la chantre (Afrika Alkebulane Pamela Dali)" $?
echo "$HTML_ADORATION" | grep -q "Artiste · Chantre de l"; verif "rôle « Artiste · Chantre de l'Éternel »" $?
echo "$HTML_ADORATION" | grep -q "Rechercher un chant"; verif "barre de recherche dédiée (« Rechercher un chant »)" $?
echo "$HTML_ADORATION" | grep -q "Prochainement — restez connectés"; verif "cartes de catégories avec état vide élégant" $?
echo "$HTML_ADORATION" | grep -q "Psaume 22:4"; verif "citation bas de page (Psaume 22:4)" $?
echo "$HTML_ADORATION" | grep -q "toratio\|aspect-video\|Chargement"; verif "rendu SSR de la vue (squelette/chargement)" $?

echo "── ② Navigation + footers + page Afrika ───────────────────"
CHUNKS=$(echo "$HTML_ADORATION" | grep -oE '/_next/static/chunks/[a-z0-9]+\.js' | sort -u | head -40)
TROUVE_NAV=1
for c in $CHUNKS; do
  JS=$(curl -s "$DOMAINE$c" 2>/dev/null)
  echo "$JS" | grep -q '"/adoration-louanges"' && TROUVE_NAV=0
done
verif "lien « /adoration-louanges » dans les chunks (menu Médias / cartes)" $TROUVE_NAV
HTML_ACCUEIL=$(curl -sL "$DOMAINE/" 2>/dev/null)
echo "$HTML_ACCUEIL" | grep -q '"/adoration-louanges"\|href="/adoration-louanges"'; verif "footer accueil : lien Adoration & Louanges" $?
HTML_AFRIKA=$(curl -sL "$DOMAINE/afrika" 2>/dev/null)
echo "$HTML_AFRIKA" | grep -q 'href="/adoration-louanges"'; verif "page Afrika : carte « Adoration & Louanges »" $?

echo "── ③ Back-office /admin/adoration ────────────────────────"
# Sans session : 307 vers /admin/login (route existante + protégée).
CODE_ADMIN=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAINE/admin/adoration" 2>/dev/null)
[ "$CODE_ADMIN" = "307" ] || [ "$CODE_ADMIN" = "302" ]; verif "/admin/adoration protégé (307 → login, obtenu: $CODE_ADMIN)" $?
HTML_LOGIN=$(curl -sL "$DOMAINE/admin/adoration" 2>/dev/null)
echo "$HTML_LOGIN" | grep -q "login\|Connexion"; verif "redirection vers la connexion admin" $?
# Le module est dans les bundles admin (chunks de la page de login).
CHUNKS_LOGIN=$(echo "$HTML_LOGIN" | grep -oE '/_next/static/chunks/[a-z0-9]+\.js' | sort -u | head -40)
TROUVE_MODULE=1
for c in $CHUNKS_LOGIN; do
  JS=$(curl -s "$DOMAINE$c" 2>/dev/null)
  echo "$JS" | grep -q "Adoration & Louanges" && TROUVE_MODULE=0
done
verif "module « Adoration & Louanges » présent dans les bundles" $TROUVE_MODULE

echo "── ④ /videos : aucune régression ─────────────────────────"
CODE_V=$(curl -sL -o /dev/null -w "%{http_code}" "$DOMAINE/videos"); verif "HTTP /videos = 200 (obtenu: $CODE_V)" $([ "$CODE_V" = "200" ] && echo 0 || echo 1)
HTML_VIDEOS=$(curl -sL "$DOMAINE/videos" 2>/dev/null)
echo "$HTML_VIDEOS" | grep -q "Vidéos & Lives\|Enseignements vidéo"; verif "hero /videos inchangé" $?

echo "──────────────────────────────────────────────────────────"
echo "$OK vérifications OK, $KO échecs"
[ $KO -eq 0 ] && echo "V3.79 : PRODUCTION VALIDÉE ✔" || echo "V3.79 : ÉCHECS ⚠"
exit $([ $KO -eq 0 ] && echo 0 || echo 1)
