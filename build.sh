#!/bin/sh
# Stellt in dist/ genau das zusammen, was die Website zum Laufen braucht.
#
# Nicht mit ausgeliefert werden:
#   _ref/                 Werkzeuge und Referenzdateien des alten Auftritts
#   shots/                Screenshots
#   assets/img/original/  Ausgangsdateien, aus denen die WebP-Varianten entstehen
#
# Aufruf:  sh build.sh
# Ergebnis: dist/ — das Verzeichnis, das der Hoster veröffentlicht.

set -eu

ZIEL=dist
rm -rf "$ZIEL"
mkdir -p "$ZIEL"

cp index.html impressum.html "$ZIEL/"
cp -R assets "$ZIEL/assets"
rm -rf "$ZIEL/assets/img/original"

# Kopf- und Zwischenspeicher-Regeln; Cloudflare Pages und Netlify lesen diese Datei.
cp _headers "$ZIEL/_headers" 2>/dev/null || true

echo "Fertig: $ZIEL"
du -sh "$ZIEL"
find "$ZIEL" -type f | wc -l | sed 's/^ */Dateien: /'
