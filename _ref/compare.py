#!/usr/bin/env python3
"""Stellt Original und Nachbau nebeneinander und schneidet das Ergebnis in Kacheln.

    python3 _ref/compare.py 1440 [kachelhoehe] [zielbreite-pro-seite]

Links = Original, rechts = Nachbau. Beide werden am Seitenanfang ausgerichtet.
"""
import sys, os, glob
from PIL import Image, ImageDraw

vw = sys.argv[1]
tile_h = int(sys.argv[2]) if len(sys.argv) > 2 else 1100
side_w = int(sys.argv[3]) if len(sys.argv) > 3 else 620


def trim(path):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    px = im.load()
    last = h
    for y in range(h - 1, 0, -1):
        if len({px[x, y] for x in range(0, w, 31)}) > 1:
            last = y + 1
            break
    return im.crop((0, 0, w, last))


a = trim(f'shots/orig-{vw}.png')
b = trim(f'shots/neu-{vw}.png')
print(f'Original {a.size}   Nachbau {b.size}   Differenz Höhe: {b.size[1] - a.size[1]:+d}px')

scale = side_w / a.width
a = a.resize((side_w, round(a.height * scale)), Image.LANCZOS)
b = b.resize((side_w, round(b.height * scale)), Image.LANCZOS)

H = max(a.height, b.height)
gap = 16
canvas = Image.new('RGB', (side_w * 2 + gap, H), (255, 0, 255))
canvas.paste(a, (0, 0))
canvas.paste(b, (side_w + gap, 0))

out = f'shots/sbs{vw}'
for f in glob.glob(out + '-*.png'):
    os.remove(f)
n = 0
for top in range(0, H, tile_h):
    t = canvas.crop((0, top, canvas.width, min(top + tile_h, H)))
    d = ImageDraw.Draw(t)
    d.text((6, 4), f'ORIGINAL  y={top}', fill=(255, 0, 0))
    d.text((side_w + gap + 6, 4), f'NACHBAU  y={top}', fill=(255, 0, 0))
    t.save(f'{out}-{n:02d}.png')
    n += 1
print(f'{n} Kacheln -> {out}-NN.png')
