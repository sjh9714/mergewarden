#!/usr/bin/env bash
# PNG frames -> palette-optimized GIF. Levers: WIDTH, GIF_FPS, COLORS.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
FRAMES="$HERE/_frames"
OUT="${OUT:-$HERE/../docs/assets/quiet-edit.gif}"
WIDTH="${WIDTH:-1120}"
GIF_FPS="${GIF_FPS:-20}"
COLORS="${COLORS:-96}"

ffmpeg -y -framerate 30 -i "$FRAMES/frame_%05d.png" \
  -vf "fps=$GIF_FPS,scale=$WIDTH:-1:flags=lanczos,split[s0][s1];\
[s0]palettegen=max_colors=$COLORS:stats_mode=diff[p];\
[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
  -loop 0 "$OUT"
ls -lh "$OUT"
