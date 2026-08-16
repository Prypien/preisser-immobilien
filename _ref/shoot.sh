#!/bin/zsh
# Screenshot-Helfer: shoot.sh <url> <prefix>
# Erzeugt Vollseiten-Screenshots bei 1440 / 768 / 375 px Breite.
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
URL="$1"
PREFIX="$2"
OUT="${3:-shots}"
mkdir -p "$OUT"
shoot() {
  "$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --virtual-time-budget=9000 --window-size="$1,$2" \
    --screenshot="$OUT/$PREFIX-$1.png" "$URL" >/dev/null 2>&1
}
shoot 1440 9600
shoot 768 12000
shoot 375 15000
ls -la "$OUT" | grep "$PREFIX"
