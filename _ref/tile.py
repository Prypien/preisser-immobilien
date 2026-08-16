#!/usr/bin/env python3
"""Schneidet einen Vollseiten-Screenshot in Kacheln zum Betrachten.

    python3 _ref/tile.py shots/orig-1440.png shots/tiles/orig-1440 [kachelhoehe] [zielbreite]
"""
import sys, os
from PIL import Image

src = sys.argv[1]
prefix = sys.argv[2]
tile_h = int(sys.argv[3]) if len(sys.argv) > 3 else 1100
target_w = int(sys.argv[4]) if len(sys.argv) > 4 else 760

os.makedirs(os.path.dirname(prefix) or '.', exist_ok=True)
im = Image.open(src).convert('RGB')
w, h = im.size

# leere (einfarbige) Endkacheln abschneiden
bbox = im.crop((0, 0, w, h)).getbbox()
last = h
px = im.load()
for y in range(h - 1, 0, -1):
    row = {px[x, y] for x in range(0, w, 37)}
    if len(row) > 1:
        last = y + 1
        break
im = im.crop((0, 0, w, last))
h = last

n = 0
for top in range(0, h, tile_h):
    bot = min(top + tile_h, h)
    t = im.crop((0, top, w, bot))
    if target_w != w:
        t = t.resize((target_w, max(1, round(t.height * target_w / w))), Image.LANCZOS)
    t.save(f'{prefix}-{n:02d}.png')
    n += 1
print(f'{src}: {w}x{h} -> {n} Kacheln')
