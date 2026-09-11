#!/bin/bash
# ⭐ V3.63 — Test RÉEL du rendu des incrustations vidéo V2 (piste timeline).
# Génère deux vidéos de test, superpose la V2 par-dessus la V1 pendant une
# fenêtre [2 s, 4 s] (chaîne EXACTE de video-render.ts, y compris le décalage
# setpts=PTS-STARTPTS+st/TB — sans lui, les images V2 sont épuisées quand
# enable s'active), puis VERIFIE par analyse U/V des pixels :
#   ① la V2 (fond rouge) couvre la V1 pendant la fenêtre ;
#   ② la V1 (fond bleu) reparaît APRÈS la fin de la V2 (eof_action=pass) ;
#   ③ la durée de sortie = durée de la V1 (la base commande le temps) ;
#   ④ le rognage -ss/-t de la source V2 fonctionne.
set -u
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
FF=$(node -e "console.log(require('ffmpeg-static'))")
PASS=0; FAIL=0
ok() { PASS=$((PASS+1)); echo "  ✅ $1"; }
ko() { FAIL=$((FAIL+1)); echo "  ❌ $1"; }

echo "── ① Vidéos de test (V1 bleu 6 s · V2 rouge 2 s @30 fps) ──"
"$FF" -y -f lavfi -i "color=c=0x2244cc:s=320x180:d=6:r=30" -c:v libx264 -preset ultrafast -pix_fmt yuv420p "$TMP/v1.mp4" -loglevel error && ok "V1 créée (6 s, bleu)" || ko "V1 impossible"
"$FF" -y -f lavfi -i "color=c=0xcc2222:s=320x180:d=2:r=30" -c:v libx264 -preset ultrafast -pix_fmt yuv420p "$TMP/v2.mp4" -loglevel error && ok "V2 créée (2 s, rouge)" || ko "V2 impossible"

echo "── ② Chaîne V3.63 EXACTE (V2 décalée à 2 s, fenêtre [2, 4]) ──"
"$FF" -y -i "$TMP/v1.mp4" -i "$TMP/v2.mp4" \
  -filter_complex "[0:v]null[vbase];[1:v]fps=30,scale=320:180:force_original_aspect_ratio=increase,crop=320:180,setsar=1,setpts=PTS-STARTPTS+2.000/TB[v2in1];[vbase][v2in1]overlay=x=0:y=0:enable='between(t,2.000,4.000)':eof_action=pass[ov1];[ov1]null[vout]" \
  -map "[vout]" -c:v libx264 -preset ultrafast "$TMP/sortie.mp4" -loglevel error && ok "rendu V2 réussi" || ko "rendu V2 échoué"

echo "── ③ Vérifications pixel (U,V — bleu : U haut V bas · rouge : U bas V haut) ──"
DUREE=$("$FF" -i "$TMP/sortie.mp4" 2>&1 | grep -o "Duration: [0-9:.]*" | head -1)
echo "  $DUREE (attendu 6 s)"
echo "$DUREE" | grep -q "Duration: 00:00:06" && ok "durée = base V1 (6 s)" || ko "durée inattendue"

analyseUV() {
  "$FF" -y -ss "$1" -i "$2" -frames:v 1 -vf "crop=40:40:140:70,format=yuv420p" -f rawvideo "$TMP/f.raw" -loglevel error 2>/dev/null
  python3 -c "
d = open('$TMP/f.raw','rb').read()
u = sum(d[1600:2000])/400; v = sum(d[2000:2400])/400
print(f'{u:.0f},{v:.0f}')"
}
AVANT=$(analyseUV 1 "$TMP/sortie.mp4")
PENDANT=$(analyseUV 2.9 "$TMP/sortie.mp4")
APRES=$(analyseUV 5 "$TMP/sortie.mp4")
echo "  t=1 s (V1 attendue)  : U,V = $AVANT"
echo "  t=2.9 s (V2 attendue) : U,V = $PENDANT"
echo "  t=5 s (V1 attendue)  : U,V = $APRES"

python3 - "$AVANT" "$PENDANT" "$APRES" << 'EOF'
import sys
ok, ko = 0, 0
def check(label, cond):
    global ok, ko
    print(f"  {'✅' if cond else '❌'} {label}")
    if cond: ok += 1
    else: ko += 1

avant, pendant, apres = [tuple(float(x) for x in a.split(",")) for a in sys.argv[1:4]]
# bleu 0x2244cc : U≈193 (haut), V≈103 (bas) ; rouge 0xcc2222 : U≈103, V≈203
check("t=1 s : V1 visible (bleu, U>130)", avant[0] > 130)
check("t=1 s : V1 visible (bleu, V<130)", avant[1] < 130)
check("t=2.9 s : V2 PAR-DESSUS (rouge, U<130)", pendant[0] < 130)
check("t=2.9 s : V2 PAR-DESSUS (rouge, V>130)", pendant[1] > 130)
check("t=5 s : V1 REPARUE après fin V2 (bleu)", apres[0] > 130 and apres[1] < 130)
sys.exit(0 if ko == 0 else 1)
EOF
[ $? -eq 0 ] && ok "fenêtre V2 + retour V1 PROUVÉS" || ko "fenêtre V2 incorrecte"

echo "── ④ Trim -ss/-t (V2 rognée : 0.5 s → 2 s de sa source) ──"
"$FF" -y -i "$TMP/v1.mp4" -ss 0.5 -t 1.5 -i "$TMP/v2.mp4" \
  -filter_complex "[0:v]null[vbase];[1:v]fps=30,scale=320:180:force_original_aspect_ratio=increase,crop=320:180,setsar=1,setpts=PTS-STARTPTS+2.000/TB[v2in1];[vbase][v2in1]overlay=x=0:y=0:enable='between(t,2.000,3.500)':eof_action=pass[ov1];[ov1]null[vout]" \
  -map "[vout]" -c:v libx264 -preset ultrafast "$TMP/sortie-trim.mp4" -loglevel error && ok "rendu V2 rognée réussi" || ko "rendu V2 rognée échoué"
P2=$(analyseUV 2.9 "$TMP/sortie-trim.mp4")
echo "  t=2.9 s : U,V = $P2"
python3 -c "
u, v = [float(x) for x in '$P2'.split(',')]
import sys; sys.exit(0 if (u < 130 and v > 130) else 1)" && ok "V2 rognée visible dans sa fenêtre" || ko "V2 rognée invisible"

echo "═══ test-v2-v363 : $PASS ✅ / $FAIL ❌ ═══"
rm -rf "$TMP"
[ $FAIL -eq 0 ]
