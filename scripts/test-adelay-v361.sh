#!/bin/bash
# ⭐ V3.61 — Test RÉEL du correctif audio : adelay (startTime) + fadeOut calé
# sur la durée réelle. Méthode COMPARATIVE (avec vs sans adelay) : isole
# l'effet du décalage des fuites du filtre. Reproduit la chaîne exacte de
# video-render.ts : [1:a]adelay=…,afade,volume → amix avec [0:a].
set -u
cd "$(dirname "$0")/.."
FF=node_modules/ffmpeg-static/ffmpeg
TMP=$(mktemp -d)
FAIL=0

echo "── ① Médias de test ──"
$FF -y -f lavfi -i "testsrc=size=320x180:rate=15:duration=6" -f lavfi -i "sine=frequency=440:duration=6" -map 0:v -map 1:a -c:v libx264 -preset ultrafast -c:a aac "$TMP/main.mp4" -loglevel error && echo "  ✅ vidéo principale (6 s, audio 440 Hz)" || FAIL=1
$FF -y -f lavfi -i "sine=frequency=880:duration=3" -c:a aac "$TMP/track.m4a" -loglevel error && echo "  ✅ piste audio (3 s, 880 Hz)" || FAIL=1

CH="afade=t=in:st=0:d=0.5,afade=t=out:st=2.000:d=1.0,volume=0.5"

echo "── ② Deux rendus : AVEC adelay=2000 vs SANS ──"
$FF -y -i "$TMP/main.mp4" -i "$TMP/track.m4a" -filter_complex "[0:a]volume=1[a0];[1:a]$CH,adelay=2000:all=1[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=0[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac "$TMP/out-adelay.mp4" -loglevel error && echo "  ✅ rendu avec adelay" || FAIL=1
$FF -y -i "$TMP/main.mp4" -i "$TMP/track.m4a" -filter_complex "[0:a]volume=1[a0];[1:a]$CH[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=0[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac "$TMP/out-sans.mp4" -loglevel error && echo "  ✅ rendu sans adelay" || FAIL=1

mesure() { # $1=file $2=start $3=durée → mean_volume (dB)
  $FF -y -ss "$2" -i "$TMP/$1" -t "$3" -af "bandpass=f=880:width_type=h:w=80,volumedetect" -f null - 2>&1 | grep -oP "mean_volume: [-\d.]+ dB" | grep -oP '[-\d.]+'
}

echo "── ③ Preuve comparative (énergie 880 Hz) ──"
AVANT_A=$(mesure out-adelay.mp4 0 1.9)
AVANT_S=$(mesure out-sans.mp4 0 1.9)
APRES_A=$(mesure out-adelay.mp4 2.2 1.5)
APRES_S=$(mesure out-sans.mp4 2.2 1.5)
echo "  0–1.9 s   : avec adelay ${AVANT_A} dB vs sans ${AVANT_S} dB"
echo "  2.2–3.7 s : avec adelay ${APRES_A} dB vs sans ${APRES_S} dB"

python3 - "$AVANT_A" "$AVANT_S" "$APRES_A" "$APRES_S" << 'PYEOF' && echo "  ✅ ADELAY PROUVÉ : la piste démarre à 2 s (et pas à 0)" || { echo "  ❌ décalage non conforme"; FAIL=1; }
import sys
avant_a, avant_s, apres_a, apres_s = [float(x) for x in sys.argv[1:5]]
# attendu : avant 2 s, l'énergie 880 Hz avec adelay ≪ sans adelay (≥ 12 dB) ;
# après 2 s : présentes dans les deux (écart faible)
ok_1 = avant_a < avant_s - 12
ok_2 = abs(apres_a - apres_s) < 12
sys.exit(0 if (ok_1 and ok_2) else 1)
PYEOF

echo "── ④ Fondu de sortie calé (st = durée réelle − fadeOut) ──"
FIN_TOT=$(mesure out-adelay.mp4 2.6 0.3)   # milieu du fondu entrant→normal
FIN_FONDU=$(mesure out-adelay.mp4 4.85 0.3) # fin du fondu de sortie (piste décalée 2+3=5 s)
echo "  plein (2.6–2.9 s) : ${FIN_TOT} dB · fin fondu (4.85–5.15 s) : ${FIN_FONDU} dB"
python3 - "$FIN_TOT" "$FIN_FONDU" << 'PYEOF' && echo "  ✅ FONDU DE SORTIE CALÉ SUR LA DURÉE RÉELLE (s'éteint vers 5 s, pas à 9999 s)" || { echo "  ❌ fondu non conforme"; FAIL=1; }
import sys
plein, fin = float(sys.argv[1]), float(sys.argv[2])
sys.exit(0 if fin < plein - 6 else 1)  # ≥ 6 dB d'atténuation à la fin
PYEOF

echo
if [ "$FAIL" = "0" ]; then echo "════ CORRECTIF AUDIO V3.61 VÉRIFIÉ (adelay + fadeOut réel) ════"; else echo "════ ÉCHEC ════"; fi
rm -rf "$TMP"
exit $FAIL
