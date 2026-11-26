#!/usr/bin/env bash
# The macOS app icons ("macOS pre-Tahoe" geometry): a 1024×1024 canvas with the icon body at
# 824×824, inset 100 px, and a soft shadow below it. Icon Composer's command-line exporter has no
# such preset (assets/README.md), so this builds them from the exported universal icons.
#
#   zharf/brand/make-macos-icons.sh <tree>     # after `node scripts/export-brand-icons.ts`
#
# Needs ImageMagick 7 (`magick`). Writes into zharf/overrides/assets/*.
set -euo pipefail
tree="${1:?usage: make-macos-icons.sh <tree>}"
out="$(cd "$(dirname "$0")/.." && pwd)/overrides/assets"

make_one() {
  local src="$tree/assets/$1" dst="$out/$2"
  mkdir -p "$(dirname "$dst")"
  magick -size 1024x1024 xc:none \
    \( "$src" -resize 824x824 -alpha extract -background black -alpha shape \
       -channel A -evaluate multiply 0.45 +channel -blur 0x14 \) -geometry +100+112 -composite \
    \( "$src" -resize 824x824 \) -geometry +100+100 -composite \
    -define png:color-type=6 "$dst"
}

make_one prod/black-universal-1024.png prod/black-macos-1024.png
make_one dev/blueprint-universal-1024.png dev/blueprint-macos-1024.png
make_one nightly/nightly-universal-1024.png nightly/nightly-macos-1024.png
echo "wrote macOS icons into $out"
