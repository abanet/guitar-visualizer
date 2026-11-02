#!/usr/bin/env python3
"""Miniaturas de la serie "Pista de batería" (temas reales, TodoRitmos; baterías sacadas de Moises).

Por qué (Alberto, 2026-11-01): la serie YA tenía diseño, el de la única pista publicada (The Girls Next Door,
https://www.youtube.com/watch?v=INL1UxsOJ0I): fondo negro con marco y detalles verde lima, "PISTA DE BATERÍA /
TOCA ENCIMA" arriba a la izquierda, batería a la derecha, título enorme en blanco y cursiva, el grupo en verde entre
dos rayas y los BPM en el recuadro de abajo. Pidió seguir con ese formato (una primera propuesta con un batería
inventado quedó descartada). ChatGPT rehízo esa miniatura como plantilla vacía y aquí se estampa, desde el
config.json de cada carpeta (title, author, bpm):
  - TÍTULO: blanco, Anton inclinado como cursiva, una o dos líneas, en la zona oscura de la izquierda.
  - GRUPO: verde lima con espaciado, centrado entre las dos rayas; si no cabe en el hueco se recortan las rayas
    (mínimo 40 px de raya a cada lado) y, si aún no cabe, se reduce la letra.
  - BPM: número blanco grande + "BPM" verde pequeño, en el hueco del recuadro redondeado.

Uso:
  python3 scripts/generate-real-rhythm-thumbnails.py \\
    --template ~/guitar-visualizer-assets/fuentes-descargas/Moises/_miniaturas/plantilla_PistaBateria_original_chatgpt.png \\
    --dirs ~/guitar-visualizer-assets/fuentes-descargas/Moises \\
    --out ~/guitar-visualizer-assets/fuentes-descargas/Moises/_miniaturas
"""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1280, 720
FONT = '~/Library/Fonts/Anton-Regular.ttf'
BLANCO, VERDE, FONDO = (238, 238, 236, 255), (224, 239, 5, 255), (1, 13, 23, 255)
INCLINACION = 0.16                 # cursiva simulada (desplazamiento horizontal por píxel de alto)
TIT_X0, TIT_X1 = 50, 690           # zona del título: entre el borde y el pie del platillo
TIT_Y0, TIT_Y1 = 248, 452   # el grupo (~50 px de alto) va centrado en las rayas de y=495
RAYA_Y0, RAYA_Y1 = 493, 497        # rayas verdes del grupo (medidas sobre la plantilla)
RAYA_IZQ, RAYA_DER = (54, 189), (529, 665)
BPM_X0, BPM_X1, BPM_CY = 168, 322, 607


def fuente(tam):
    return ImageFont.truetype(str(Path(FONT).expanduser()), tam)


def ancho_espaciado(txt, f, esp):
    return sum(f.getlength(ch) for ch in txt) + esp * (len(txt) - 1)


def capa_texto(txt, f, color, esp=0, inclinar=False):
    """Texto en una capa RGBA ajustada (con sombra), opcionalmente inclinado; devuelve (capa, desplazamiento y)."""
    bb = f.getbbox(txt)
    asc, alto = bb[1], bb[3] - bb[1]   # la capa empieza justo en la parte de arriba del texto real
    ancho = int(ancho_espaciado(txt, f, esp)) + 40
    pad = int(alto * INCLINACION) + 20 if inclinar else 20
    capa = Image.new('RGBA', (ancho + pad, alto + 40), (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    x = 10
    for ch in txt:
        d.text((x, 20 - asc), ch, font=f, fill=color)
        x += f.getlength(ch) + esp
    if inclinar:
        # Transformación afín: los píxeles de arriba se desplazan a la derecha (cursiva).
        capa = capa.transform(capa.size, Image.AFFINE, (1, INCLINACION, -INCLINACION * capa.size[1], 0, 1, 0),
                              Image.BICUBIC)
    sombra = Image.new('RGBA', capa.size, (0, 0, 0, 0))
    sombra.putalpha(capa.getchannel('A').filter(ImageFilter.GaussianBlur(5)).point(lambda a: int(a * 0.8)))
    out = Image.new('RGBA', capa.size, (0, 0, 0, 0))
    out.alpha_composite(sombra.crop((0, 0, capa.size[0] - 4, capa.size[1] - 6)), (4, 6))
    out.alpha_composite(capa)
    return out, 20


def alto_bloque(ls, t):
    f = fuente(t)
    altos = [f.getbbox(l)[3] - f.getbbox(l)[1] for l in ls]
    return sum(altos) + int(t * 0.12) * (len(ls) - 1)


def lineas_titulo(titulo):
    """Una línea si cabe a buen tamaño; si no, dos partiendo por el espacio más centrado (como 'THE GIRLS / NEXT DOOR').
    El tamaño se ajusta al ancho Y al alto real de la zona, para no pisar el grupo de debajo."""
    ancho, alto = TIT_X1 - TIT_X0 - 40, TIT_Y1 - TIT_Y0
    for t in range(150, 60, -2):
        if fuente(t).getlength(titulo) <= ancho and alto_bloque([titulo], t) <= alto:
            break
    if t >= 104 or ' ' not in titulo:
        return [titulo], t
    pal = titulo.split(' ')
    i = min(range(1, len(pal)), key=lambda i: abs(len(' '.join(pal[:i])) - len(' '.join(pal[i:]))))
    ls = [' '.join(pal[:i]), ' '.join(pal[i:])]
    for t2 in range(130, 50, -2):
        if max(fuente(t2).getlength(l) for l in ls) <= ancho and alto_bloque(ls, t2) <= alto:
            break
    return (ls, t2) if t2 > t else ([titulo], t)


def estampar(base, c):
    im = base.copy()
    # TÍTULO
    ls, t = lineas_titulo(c['title'].upper())
    f = fuente(t)
    sep = int(t * 0.12)
    total = alto_bloque(ls, t)
    y = TIT_Y0 + (TIT_Y1 - TIT_Y0 - total) // 2
    for l in ls:
        im.alpha_composite(capa_texto(l, f, BLANCO, inclinar=True)[0], (TIT_X0 - 10, y - 20))
        y += f.getbbox(l)[3] - f.getbbox(l)[1] + sep
    # GRUPO entre las rayas
    autor = c['author'].upper()
    d = ImageDraw.Draw(im)
    cx = (RAYA_IZQ[1] + RAYA_DER[0]) // 2
    ta, esp = 50, 5
    min_raya = 40
    hueco_max = (RAYA_DER[1] - min_raya) - (RAYA_IZQ[0] + min_raya) - 40
    while ancho_espaciado(autor, fuente(ta), esp) > hueco_max and ta > 26:
        ta -= 2
    fa = fuente(ta)
    wa = ancho_espaciado(autor, fa, esp)
    hueco = wa + 40
    if hueco > RAYA_DER[0] - RAYA_IZQ[1]:
        # Recortar las rayas por dentro, simétricas respecto al centro.
        d.rectangle((cx - hueco / 2, RAYA_Y0 - 1, RAYA_IZQ[1] + 1, RAYA_Y1), fill=FONDO)
        d.rectangle((RAYA_DER[0] - 1, RAYA_Y0 - 1, cx + hueco / 2, RAYA_Y1), fill=FONDO)
    ca, _ = capa_texto(autor, fa, VERDE, esp=esp)
    alto_a = fa.getbbox(autor)[3] - fa.getbbox(autor)[1]
    im.alpha_composite(ca, (int(cx - wa / 2) - 10, (RAYA_Y0 + RAYA_Y1) // 2 - alto_a // 2 - 20))
    # BPM: número y "BPM" alineados por abajo; con 3 cifras se reduce el número para no tocar el icono.
    num = str(c['bpm'])
    tn, fb, gap = 92, fuente(30), 10
    while fuente(tn).getlength(num) + gap + fb.getlength('BPM') > BPM_X1 - BPM_X0 and tn > 50:
        tn -= 2
    fn = fuente(tn)
    wn, wb = fn.getlength(num), fb.getlength('BPM')
    x = BPM_X0 + (BPM_X1 - BPM_X0 - (wn + gap + wb)) / 2
    bn = fn.getbbox(num)
    alto_n = bn[3] - bn[1]
    y_n = BPM_CY - alto_n // 2
    im.alpha_composite(capa_texto(num, fn, BLANCO)[0], (int(x) - 10, y_n - 20))
    bb = fb.getbbox('BPM')
    im.alpha_composite(capa_texto('BPM', fb, VERDE)[0], (int(x + wn + gap) - 10, y_n + alto_n - (bb[3] - bb[1]) - 20))
    return im


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--template', required=True)
    ap.add_argument('--dirs', required=True, help='Carpeta con una subcarpeta por tema (config.json)')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    base = Image.open(Path(a.template).expanduser()).convert('RGB').resize((W, H), Image.LANCZOS).convert('RGBA')
    out = Path(a.out).expanduser()
    out.mkdir(parents=True, exist_ok=True)
    hechos = 0
    for cfg in sorted(Path(a.dirs).expanduser().glob('*/config.json')):
        if cfg.parent.name.startswith('_'):
            continue
        estampar(base, json.loads(cfg.read_text())).convert('RGB').save(out / f'{cfg.parent.name}.png')
        hechos += 1
    print(f'{hechos} miniaturas en {out}')


if __name__ == '__main__':
    main()
