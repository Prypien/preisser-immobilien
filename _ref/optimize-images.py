#!/usr/bin/env python3
"""Erzeugt WebP-Varianten der Originalbilder für srcset.

Aufruf:  python3 _ref/optimize-images.py [nur-dieser-dateiname ...]
Quelle:  assets/img/original/<name>.<ext>  ->  assets/img/<name>-<breite>.webp
"""
import os, sys
from PIL import Image

SRC = 'assets/img/original'
OUT = 'assets/img'
WIDTHS = [400, 640, 900, 1280, 1800, 2400]
QUALITY = 78

# Bilder, die nicht skaliert werden (Icons, Logos, Favicons)
SKIP = {'favicon.png', 'apple-touch-icon.png', 'logo-preisser.svg'}
ONLY = set(sys.argv[1:])

manifest = {}
for name in sorted(os.listdir(SRC)):
    if name in SKIP or name.endswith('.webp') or name.endswith('.svg'):
        continue
    if ONLY and name not in ONLY:
        continue
    path = os.path.join(SRC, name)
    stem = os.path.splitext(name)[0]
    im = Image.open(path)
    if im.mode in ('P', 'RGBA', 'LA'):
        im = im.convert('RGBA')
    else:
        im = im.convert('RGB')
    ow, oh = im.size
    made = []
    for w in WIDTHS:
        if w > ow:
            continue
        h = round(oh * w / ow)
        out = os.path.join(OUT, f'{stem}-{w}.webp')
        im.resize((w, h), Image.LANCZOS).save(out, 'WEBP', quality=QUALITY, method=6)
        made.append((w, h, os.path.getsize(out)))
    # Originalbreite immer mitliefern, falls kleiner als kleinste Zielbreite
    if not made:
        out = os.path.join(OUT, f'{stem}-{ow}.webp')
        im.save(out, 'WEBP', quality=QUALITY, method=6)
        made.append((ow, oh, os.path.getsize(out)))
    manifest[name] = {'orig': (ow, oh), 'variants': made}
    print(f'{name:38s} {ow}x{oh} -> ' + ', '.join(f'{w}w ({s//1024}KB)' for w, _, s in made))

total = sum(s for v in manifest.values() for _, _, s in v['variants'])
print(f'\nSumme WebP: {total/1024/1024:.1f} MB')
