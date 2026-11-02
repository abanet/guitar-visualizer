#!/usr/bin/env python3
"""Miniaturas de TodoRitmos SIN recuadro: el número del tempo va directamente sobre la imagen, a la izquierda
de la palabra "BPM" que ya trae la plantilla, centrado en vertical con ella.

Por qué (Alberto, 2026-10-28, ritmo Funk Even 16ths): el recuadro negro liso de las plantillas anteriores
(generate-bpm-thumbnails.py) "queda como un pegote". Las plantillas nuevas las genera ChatGPT sin recuadro y con
la zona del número oscura y desenfocada; aquí solo se estampa el número (crema con contorno oscuro y sombra, como
el título) y el logo ORIGINAL de BanetMasa (ChatGPT lo redibuja deformado, así que la plantilla va sin logo).

La posición NO se pasa a mano: en cada plantilla se busca la palabra "BPM" (píxeles claros en la franja de abajo)
y el número se coloca a su izquierda con su mismo centro vertical — así vale aunque ChatGPT la mueva unos píxeles
entre variantes.

Plantillas en --templates (nombres fijos): plantilla_sin_recuadro_chatgpt.png (tempos fijos) y
plantilla_<tipo>_chatgpt.png para los progresivos, con <tipo>: calentamiento (incrN-progresivo con N=5),
escalera1 (incr1-progresivo), escalera2 (incr2-progresivo), zigzag, baja, piramide.

Uso:
  python3 scripts/generate-rhythm-thumbnails-sinrecuadro.py \\
    --templates ~/guitar-visualizer-assets/fuentes-descargas/JazzFunkGroovin/thumbnails \\
    --videos ~/guitar-visualizer-assets/fuentes-descargas/JazzFunkGroovin \\
    --out ~/guitar-visualizer-assets/fuentes-descargas/JazzFunkGroovin/thumbnails
"""
import argparse
import re
import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

LOGO = '~/guitar-visualizer-assets/logo/Logo con fondo transparente.png'
FONT = '~/Library/Fonts/Anton-Regular.ttf'
W, H = 1280, 720


def tipo_de(stem):
    """Plantilla que toca a cada vídeo según su nombre (<Ritmo>-<a>[-<b>-incrN-<tipo>])."""
    m = re.search(r'-(\d+)-(\d+)-incr(\d+)-([a-z]+)$', stem)
    if not m:
        n = re.search(r'-(\d+)$', stem)
        return ('sin_recuadro', n.group(1)) if n else (None, None)
    a, b, inc, t = m.groups()
    if t == 'progresivo':
        t = {'1': 'escalera1', '2': 'escalera2'}.get(inc, 'calentamiento')
    return t, f'{a}-{b}'


def logo_transparente():
    """El PNG "con fondo transparente" en realidad trae fondo blanco: se quita el blanco conectado con los bordes
    (el blanco de la B queda a salvo dentro de la púa negra)."""
    lg = Image.open(Path(LOGO).expanduser()).convert('RGB')
    w, h = lg.size
    px = lg.load()
    mask = Image.new('L', (w, h), 255)
    m = mask.load()
    vistos = set()
    q = deque([(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)])
    while q:
        x, y = q.popleft()
        if (x, y) in vistos or not (0 <= x < w and 0 <= y < h):
            continue
        vistos.add((x, y))
        if min(px[x, y]) < 200:
            continue
        m[x, y] = 0
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    out = lg.convert('RGBA')
    out.putalpha(mask.filter(ImageFilter.GaussianBlur(0.8)))
    return out


def caja_bpm(img):
    """Caja de la palabra BPM: el mayor bloque de filas con píxeles claros en la franja inferior central."""
    p = img.load()
    filas = []
    for y in range(470, 715):
        n = sum(1 for x in range(560, 900) if (lambda c: c[0] > 215 and c[1] > 200 and c[2] > 170)(p[x, y]))
        filas.append((y, n))
    # bloque continuo más largo de filas con bastante tinta
    mejor, actual = [], []
    for y, n in filas:
        if n >= 12:
            actual.append(y)
        else:
            if len(actual) > len(mejor):
                mejor = actual
            actual = []
    if len(actual) > len(mejor):
        mejor = actual
    if len(mejor) < 30:
        return None
    y0, y1 = mejor[0], mejor[-1]
    xs = [x for y in range(y0, y1 + 1) for x in range(560, 900) if (lambda c: c[0] > 215 and c[1] > 200 and c[2] > 170)(p[x, y])]
    return min(xs), y0, max(xs), y1


def fondo_banda(img):
    """Última fila de la banda roja de los progresivos (None si la plantilla no la tiene)."""
    p = img.load()
    ultima = None
    for y in range(420, 600):
        n = sum(1 for x in range(30, 520, 2) if (lambda c: c[0] > 170 and c[1] < 60 and c[2] < 60)(p[x, y]))
        if n > 120:
            ultima = y
    return ultima


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--templates', required=True)
    ap.add_argument('--videos', required=True, help='Carpeta (se busca dentro) con los .mp4 del ritmo')
    ap.add_argument('--out', required=True)
    ap.add_argument('--size', type=int, default=150, help='Tamaño del número (px a 1280x720)')
    ap.add_argument('--gap', type=int, default=34, help='Separación entre el número y BPM')
    a = ap.parse_args()
    tdir, out = Path(a.templates).expanduser(), Path(a.out).expanduser()
    out.mkdir(parents=True, exist_ok=True)
    font = ImageFont.truetype(str(Path(FONT).expanduser()), a.size)
    logo = logo_transparente().resize((120, 120), Image.LANCZOS)
    stems = sorted({v.stem for v in Path(a.videos).expanduser().rglob('*.mp4') if 'prueba' not in v.parts})
    bases = {}
    hechos = 0
    for stem in stems:
        t, txt = tipo_de(stem)
        if not t:
            print('  ? sin tempo en el nombre:', stem)
            continue
        if t not in bases:
            f = tdir / f'plantilla_{t}_chatgpt.png'
            if not f.exists():
                print('  ✗ falta plantilla', f.name)
                bases[t] = None
                continue
            im = Image.open(f).convert('RGB').resize((W, H), Image.LANCZOS)
            caja = caja_bpm(im)
            if not caja:
                print('  ✗ no encuentro "BPM" en', f.name)
                bases[t] = None
                continue
            banda = fondo_banda(im)
            im = im.convert('RGBA')
            im.alpha_composite(logo, (22, 14))
            bases[t] = (im, caja, banda)
            print(f'  {f.name}: BPM en {caja}' + (f', banda roja hasta y={banda}' if banda else ''))
        if not bases[t]:
            continue
        im, (bx0, by0, bx1, by1), banda = bases[t]
        im = im.copy()
        # Con banda roja encima (progresivos) la banda queda pegada a "BPM" y no hay sitio para el número grande:
        # se iguala su altura a la de la palabra BPM (sin contorno), que leído junto queda "60-140 BPM" como una
        # sola etiqueta. El tamaño sale de la plantilla, así que es el mismo para todos los de ese tipo.
        f = font
        if banda:
            alto_bpm = by1 - by0
            while f.size > 40:
                g0, g1 = f.getbbox('0123456789')[1::2]
                if g1 - g0 <= alto_bpm:
                    break
                f = ImageFont.truetype(f.path, f.size - 1)
        x0, y0, x1, y1 = f.getbbox(txt)
        px = bx0 - a.gap - x1
        py = (by0 + by1) / 2 - (y0 + y1) / 2
        if px + x0 < 30:
            print('  ✗ no cabe', stem)
            continue
        sombra = Image.new('RGBA', im.size, (0, 0, 0, 0))
        ImageDraw.Draw(sombra).text((px + 6, py + 8), txt, font=f, fill=(0, 0, 0, 200), stroke_width=10, stroke_fill=(0, 0, 0, 200))
        im = Image.alpha_composite(im, sombra.filter(ImageFilter.GaussianBlur(6)))
        capa = Image.new('RGBA', im.size, (0, 0, 0, 0))
        ImageDraw.Draw(capa).text((px, py), txt, font=f, fill=(250, 240, 220, 255), stroke_width=8, stroke_fill=(30, 10, 10, 255))
        Image.alpha_composite(im, capa).convert('RGB').save(out / f'{stem}.png')
        hechos += 1
    print(f'{hechos}/{len(stems)} miniaturas en {out}')
    if hechos < len(stems):
        sys.exit(1)


if __name__ == '__main__':
    main()
