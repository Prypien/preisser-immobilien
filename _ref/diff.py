#!/usr/bin/env python3
"""Vergleicht zwei Layout-Messungen und meldet die Abweichungen.

    python3 _ref/diff.py 1440 [toleranz-px]

Verglichen werden Elemente, die sich über ihren Text eindeutig zuordnen lassen.
"""
import json, sys

vw = sys.argv[1]
tol = int(sys.argv[2]) if len(sys.argv) > 2 else 4

o = json.load(open(f'_ref/measure/orig-{vw}.json'))
n = json.load(open(f'_ref/measure/neu-{vw}.json'))

print(f'Viewport {vw}:  Höhe Original {o["docHeight"]}  Nachbau {n["docHeight"]}  '
      f'({n["docHeight"] - o["docHeight"]:+d}px)')


def index(rows):
    by_text = {}
    for r in rows:
        t = r['text']
        if len(t) < 6:
            continue
        by_text.setdefault((r['tag'], t), []).append(r)
    return {k: v[0] for k, v in by_text.items() if len(v) == 1}


io, inn = index(o['rows']), index(n['rows'])
common = sorted(set(io) & set(inn), key=lambda k: io[k]['y'])
print(f'{len(common)} eindeutig zuordenbare Elemente '
      f'(nur im Original: {len(set(io)-set(inn))}, nur im Nachbau: {len(set(inn)-set(io))})\n')

worst = []
for k in common:
    a, b = io[k], inn[k]
    d = {f: b[f] - a[f] for f in ('x', 'y', 'w', 'h')}
    style = [f'{f}: {a[f]} -> {b[f]}' for f in ('fs', 'fw', 'ff', 'color', 'bg', 'radius', 'align')
             if a[f] != b[f]]
    off = max(abs(d['x']), abs(d['w']))
    if off > tol or style:
        worst.append((off, k, a, b, d, style))

worst.sort(key=lambda t: -t[0])
print(f'--- {len(worst)} Abweichungen (Toleranz {tol}px, ohne reine y-Verschiebung) ---')
for off, k, a, b, d, style in worst[:40]:
    print(f'[{k[0]}] "{k[1][:52]}"')
    print(f'    x {a["x"]}->{b["x"]} ({d["x"]:+d})   w {a["w"]}->{b["w"]} ({d["w"]:+d})   '
          f'y {a["y"]}->{b["y"]} ({d["y"]:+d})   h {a["h"]}->{b["h"]} ({d["h"]:+d})')
    for s in style:
        print(f'    {s}')

print('\n--- Nur im Original vorhanden ---')
for k in sorted(set(io) - set(inn), key=lambda k: io[k]['y'])[:20]:
    print(f'  [{k[0]}] "{k[1][:60]}"  y={io[k]["y"]}')
print('\n--- Nur im Nachbau vorhanden ---')
for k in sorted(set(inn) - set(io), key=lambda k: inn[k]['y'])[:20]:
    print(f'  [{k[0]}] "{k[1][:60]}"  y={inn[k]["y"]}')
