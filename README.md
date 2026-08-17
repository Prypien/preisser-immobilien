# preisser-immobilien.de

Statische Website der Preißer Immobilien GmbH — reines HTML, CSS und
JavaScript, ohne Framework, Bundler oder externe Laufzeitabhängigkeiten.
Nachbau des früheren Webflow-Auftritts im selben Designsystem.

## Aufbau

```
index.html                  Startseite
impressum.html              Impressum und Datenschutzerklärung

assets/css/styles.css       Tokens, Grundgerüst, Abschnitte

assets/js/main.js           Navigation, Kartenstapel, Einblenden beim Scrollen

assets/fonts/               Instrument Sans + Poppins, selbst gehostet (DSGVO)
assets/img/                 WebP-Varianten für srcset
assets/img/original/        Ausgangsdateien, aus denen die Varianten entstehen
_ref/                       Werkzeuge für Abgleich und Prüfung
```

Die Seite ist bewusst streng am früheren Auftritt gehalten, einschließlich
seiner Eigenheiten wie dem Fließtext in Arial 14 px. Abweichungen sind unten
aufgeführt und an den betroffenen Stellen im Stylesheet kommentiert.

## Lokal ansehen

```bash
python3 -m http.server 8787
```

Danach <http://localhost:8787> öffnen. Ein Build-Schritt ist nicht nötig —
die Dateien werden so ausgeliefert, wie sie im Repository liegen.

## Werkzeuge

Alle Skripte laufen aus dem Projektverzeichnis und brauchen nur Python 3
(mit Pillow), Node.js und ein installiertes Google Chrome.

| Skript | Zweck |
| --- | --- |
| `node _ref/sweep.mjs <url> [breiten…]` | Prüft eine Seite über viele Viewport-Breiten auf waagerechten Überlauf und zu kleine Tippziele |
| `node _ref/shoot.mjs <url> <präfix> <breiten…>` | Vollseiten-Screenshots mit exakt emuliertem Viewport |
| `node _ref/measure.mjs <url> <breite> <datei.json>` | Nimmt Position, Größe und Stil jedes sichtbaren Elements auf |
| `python3 _ref/diff.py <breite>` | Vergleicht zwei Messungen und meldet Abweichungen |
| `python3 _ref/compare.py <breite>` | Stellt Original und Nachbau nebeneinander |
| `python3 _ref/tile.py <bild> <präfix>` | Zerlegt einen langen Screenshot in betrachtbare Kacheln |
| `python3 _ref/optimize-images.py [dateien…]` | Erzeugt die WebP-Varianten aus `assets/img/original/` |
| `node _ref/find-overflow.mjs <url> <breite> [auswahl]` | Grenzt ein, welcher Abschnitt einen waagerechten Überlauf verursacht |

Beispiel — nach einer Änderung prüfen, ob nichts über den Rand läuft:

```bash
node _ref/sweep.mjs http://localhost:8787/index.html
```

## Bilder ergänzen

Ausgangsdatei nach `assets/img/original/` legen, dann:

```bash
python3 _ref/optimize-images.py meine-datei.jpg
```

Das erzeugt `assets/img/meine-datei-<breite>.webp` für alle sinnvollen
Breiten. Im Markup werden diese über `srcset` und `sizes` eingebunden.

## Abweichungen vom früheren Webflow-Auftritt

Inhalte und Bilder sind unverändert übernommen. Bewusst anders gelöst sind
Fehler und Lücken des Originals; sie sind an den betroffenen Stellen im
Stylesheet kommentiert. Die wichtigsten:

- Navigation auf Telefon und Tablet (im Original fehlte sie dort ganz)
- Sprachauszeichnung, Sprungmarke, Fokusringe, ARIA-Zustände
- Bilder als WebP mit `srcset`, Schriften lokal statt von Google-Servern
- Bewegungen respektieren `prefers-reduced-motion`
- Die acht Merkmale stehen in zwei Reihen zu vier statt in drei Spalten
- Vera von HeyVera ergänzt: als achtes Merkmal und in der Telefonkarte
