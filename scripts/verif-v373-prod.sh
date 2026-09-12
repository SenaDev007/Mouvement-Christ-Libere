#!/bin/bash
# ⭐ V3.73 — Vérification production après déploiement Vercel.
# ① /rendez-vous : plus de bande logo, bouton « Retour au site » seul.
# ② /rendez-vous : sélecteur pays (recherche + drapeaux) dans les chunks.
# ③ Navbar : plus d'engrenage externe (« Paramètres de mon compte » absent),
#    entrée profil à l'icône engrenage présente.
set -u
DOMAINE="https://www.mouvementchristlibere.com"
ATTEMPTS=0
OK=0; KO=0
verif() { # étiquette, condition (0=ok)
  if [ "$2" -eq 0 ]; then OK=$((OK+1)); echo "  ✔ $1"; else KO=$((KO+1)); echo "  ✗ $1"; fi
}

echo "── Attente du déploiement Vercel (marqueur V3.73) ─────────"
while [ $ATTEMPTS -lt 30 ]; do
  HTML=$(curl -sL "$DOMAINE/rendez-vous" 2>/dev/null)
  if echo "$HTML" | grep -q "Retour au site"; then
    if ! echo "$HTML" | grep -q "logo-christ-libere-v2"; then
      echo "  ✔ V3.73 en ligne (tentative $((ATTEMPTS+1)))"; break
    fi
  fi
  ATTEMPTS=$((ATTEMPTS+1)); echo "  … attente ($ATTEMPTS/30)"; sleep 20
done

echo "── ① /rendez-vous : bande logo supprimée ─────────────────"
echo "$HTML" | grep -q "Retour au site"; verif "bouton « Retour au site » présent" $?
echo "$HTML" | grep -q "logo-christ-libere-v2"; [ $? -ne 0 ]; verif "AUCUN logo Christ Libère dans la page (bande supprimée)" $?
echo "$HTML" | grep -qi "<header[^>]*class=\"[^\"]*bg-\[#000000\]"; [ $? -ne 0 ]; verif "plus de bande noire <header> bg-[#000000]" $?
CODE=$(curl -sL -o /dev/null -w "%{http_code}" "$DOMAINE/rendez-vous"); verif "HTTP /rendez-vous = 200 (obtenu: $CODE)" $([ "$CODE" = "200" ] && echo 0 || echo 1)

echo "── ② /rendez-vous : sélecteur pays habituel ──────────────"
CHUNKS=$(echo "$HTML" | grep -oE '/_next/static/chunks/[a-z0-9]+\.js' | sort -u | head -40)
TROUVE_SELECTEUR=1; TROUVE_AUCUN=1; TROUVE_DRAPEAU=1
for c in $CHUNKS; do
  JS=$(curl -s "$DOMAINE$c" 2>/dev/null)
  echo "$JS" | grep -q "Rechercher un pays" && TROUVE_SELECTEUR=0
  echo "$JS" | grep -q "Aucun pays trouvé" && TROUVE_AUCUN=0
  echo "$JS" | grep -q "flagFromCountryCode\|fromCountryCode" && TROUVE_DRAPEAU=0
done
verif "chunk : champ « Rechercher un pays… »" $TROUVE_SELECTEUR
verif "chunk : aide « Aucun pays trouvé »" $TROUVE_AUCUN
verif "chunk : drapeaux (fromCountryCode) présents" $TROUVE_DRAPEAU
echo "$HTML" | grep -q "Ex. Bénin"; [ $? -ne 0 ]; verif "ancien champ libre « Ex. Bénin » absent" $?

echo "── ③ Navbar : engrenage incorporé au menu profil ─────────"
NAV_HTML=$(curl -sL "$DOMAINE/" 2>/dev/null)
NAV_CHUNKS=$(echo "$NAV_HTML" | grep -oE '/_next/static/chunks/[a-z0-9]+\.js' | sort -u | head -40)
ENGRENAGE_EXTERNE=1; ENTREE_MENU=1
for c in $NAV_CHUNKS; do
  JS=$(curl -s "$DOMAINE$c" 2>/dev/null)
  echo "$JS" | grep -q "Paramètres de mon compte" && ENGRENAGE_EXTERNE=0
  echo "$JS" | grep -q "Photo, nom, téléphone, pays" && ENTREE_MENU=0
done
[ $ENGRENAGE_EXTERNE -ne 0 ]; verif "plus d'engrenage externe (« Paramètres de mon compte » absent des chunks)" $?
verif "entrée menu « Photo, nom, téléphone, pays… » présente (engrenage dans le menu)" $ENTREE_MENU

echo "── ④ Page de suivi (cohérence du flux) ───────────────────"
SUIVI=$(curl -sL "$DOMAINE/rendez-vous/suivi" 2>/dev/null)
CODE_S=$(curl -sL -o /dev/null -w "%{http_code}" "$DOMAINE/rendez-vous/suivi")
verif "HTTP /rendez-vous/suivi = 200 (obtenu: $CODE_S)" $([ "$CODE_S" = "200" ] && echo 0 || echo 1)
echo "$SUIVI" | grep -q "Nouvelle demande"; verif "bouton « Nouvelle demande » conservé" $?
echo "$SUIVI" | grep -q "logo-christ-libere-v2"; [ $? -ne 0 ]; verif "bande logo absente de la page suivi" $?

echo "── ⑤ Non-régression site + API ───────────────────────────"
CODE_HOME=$(curl -sL -o /dev/null -w "%{http_code}" "$DOMAINE/")
verif "HTTP / = 200 (obtenu: $CODE_HOME)" $([ "$CODE_HOME" = "200" ] && echo 0 || echo 1)
CODE_API=$(curl -s -o /dev/null -w "%{http_code}" "https://api.mouvementchristlibere.com/api/health")
verif "API health = 200 (obtenu: $CODE_API)" $([ "$CODE_API" = "200" ] && echo 0 || echo 1)

echo ""
if [ $KO -eq 0 ]; then echo "✔ SUCCÈS — $OK/$((OK+KO)) vérifications"; else echo "✗ ÉCHEC — $KO échec(s) sur $((OK+KO))"; exit 1; fi
