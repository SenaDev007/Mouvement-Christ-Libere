#!/bin/bash
# ⭐ V3.60 — Test réel des filtres cinéma + transitions xfade avec ffmpeg-static.
# Génère 2 segments colorés (rouge, bleu) puis teste :
#   ① chaque chaîne de filtre cinéma (acceptée par ffmpeg ?)
#   ② la chaîne xfade + acrossfade complète (comme à l'export)
set -u
cd "$(dirname "$0")/.."
FF=node_modules/ffmpeg-static/ffmpeg
TMP=$(mktemp -d)
FAIL=0

echo "── 1) Segments de test (2 × 2 s, rouge puis bleu, avec audio silencieux) ──"
$FF -y -f lavfi -i "color=c=red:s=320x180:d=2" -f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=44100" -map 0:v -map 1:a -shortest -c:v libx264 -preset ultrafast -c:a aac "$TMP/a.mp4" -loglevel error && echo "  ✅ segment A" || { echo "  ❌ segment A"; FAIL=1; }
$FF -y -f lavfi -i "color=c=blue:s=320x180:d=2" -f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=44100" -map 0:v -map 1:a -shortest -c:v libx264 -preset ultrafast -c:a aac "$TMP/b.mp4" -loglevel error && echo "  ✅ segment B" || { echo "  ❌ segment B"; FAIL=1; }

echo "── 2) Chaînes de FILTRES CINÉMA (chaque filtre appliqué au segment A) ──"
declare -A FILTRES=(
  [tealorange]="colorbalance=rs=-0.08:bs=0.12:rh=0.10:bh=-0.12,eq=contrast=1.15:saturation=1.2"
  [film35]="eq=contrast=1.08:saturation=0.92:gamma=1.05,curves=r='0/0.03 0.5/0.52 1/0.97':g='0/0.02 0.5/0.5 1/0.98':b='0/0.05 0.5/0.53 1/0.95',vignette=PI/7"
  [golden]="colorbalance=rs=0.12:gs=0.05:bs=-0.10:rh=0.15:bh=-0.15,eq=saturation=1.15:brightness=0.05:contrast=1.05"
  [bleach]="eq=contrast=1.35:saturation=0.45:brightness=0.05"
  [dreamy]="eq=contrast=0.95:saturation=1.1:brightness=0.08,curves=all='0/0.05 0.5/0.55 1/0.95',gblur=sigma=1.0"
  [hdr]="eq=contrast=1.25:saturation=1.35:gamma=0.92,curves=all='0/0.06 0.25/0.28 0.75/0.78 1/0.96'"
  [muted]="eq=contrast=1.05:saturation=0.65:gamma=1.02,curves=r='0/0.06 0.5/0.5 1/0.94':g='0/0.06 0.5/0.52 1/0.95':b='0/0.08 0.5/0.55 1/0.97'"
  [bluenight]="colorbalance=rs=-0.10:bs=0.18:rh=-0.05:bh=0.08,eq=contrast=1.15:saturation=0.9:brightness=-0.04"
  [cyberpunk]="colorbalance=rs=-0.05:bs=0.15:rh=0.10:gh=0.03:bh=-0.10,eq=contrast=1.3:saturation=1.5,curves=b='0/0.12 0.5/0.55 1/0.9'"
  [pastel]="eq=contrast=0.9:saturation=0.8:brightness=0.12,curves=all='0/0.1 0.5/0.55 1/0.92'"
  [vhs]="eq=saturation=1.3:contrast=1.05,curves=r='0/0.1 0.5/0.55 1/0.9':b='0/0.1 0.5/0.5 1/0.95',noise=alls=8:allf=t,vignette=PI/6"
  [noirbleu]="format=gray,eq=contrast=1.4,colorbalance=bs=0.15:rs=-0.05"
)
for nom in "${!FILTRES[@]}"; do
  if $FF -y -i "$TMP/a.mp4" -vf "${FILTRES[$nom]}" -t 1 -c:v libx264 -preset ultrafast "$TMP/f-$nom.mp4" -loglevel error 2>"$TMP/err.txt"; then
    echo "  ✅ filtre $nom"
  else
    echo "  ❌ filtre $nom — $(head -c 200 "$TMP/err.txt")"; FAIL=1
  fi
done

echo "── 3) Chaîne XFADE + ACROSSFADE complète (celle de l'export) ──"
# 3 types représentatifs : wiperight (pro), fadeblack (pro), distance (glitch)
for type in wiperight fadeblack distance; do
  CMD="-y -i $TMP/a.mp4 -i $TMP/b.mp4 -filter_complex \"[0:v][1:v]xfade=transition=$type:duration=0.5:offset=1.5[vout];[0:a][1:a]acrossfade=d=0.5[aout]\" -map [vout] -map [aout] -c:v libx264 -preset ultrafast -c:a aac $TMP/x-$type.mp4"
  if eval $FF $CMD -loglevel error 2>"$TMP/err.txt"; then
    DUR=$($FF -i "$TMP/x-$type.mp4" 2>&1 | grep -oP 'Duration: [0-9:.]+' | head -1)
    echo "  ✅ xfade $type ($DUR)"
  else
    echo "  ❌ xfade $type — $(head -c 200 "$TMP/err.txt")"; FAIL=1
  fi
done

echo "── 4) Chaîne xfade TROIS segments (imbrication, comme 3 clips) ──"
$FF -y -i "$TMP/a.mp4" -i "$TMP/b.mp4" -i "$TMP/a.mp4" -filter_complex "[0:v][1:v]xfade=transition=smoothleft:duration=0.5:offset=1.5[v1];[v1][2:v]xfade=transition=zoomin:duration=0.5:offset=3.0[vout];[0:a][1:a]acrossfade=d=0.5[a1];[a1][2:a]acrossfade=d=0.5[aout]" -map "[vout]" -map "[aout]" -c:v libx264 -preset ultrafast -c:a aac "$TMP/x3.mp4" -loglevel error && echo "  ✅ 3 segments chaînés (smoothleft + zoomin)" || { echo "  ❌ 3 segments"; FAIL=1; }

echo
if [ "$FAIL" = "0" ]; then echo "════ TOUS LES TESTS FFMPEG V3.60 PASSENT ════"; else echo "════ ÉCHECS DÉTECTÉS ════"; fi
rm -rf "$TMP"
exit $FAIL
