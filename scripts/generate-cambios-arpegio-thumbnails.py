#!/usr/bin/env python3
"""Miniaturas de "Cambios entre arpegios de 7ª: I7 → IV7" (las 180 de catalog-cambios-arpegio.js: tres series —
tempo fijo 80 bpm, progresivo 65-100 y progresivo avanzado 100-140— × 12 tonalidades × 5 formas CAGED).

Plantilla de ChatGPT (11-04, encargada con la de blues mayor como referencia; mismos huecos que esa):
  - pincelada amarilla → "<I7> → <IV7>" (p. ej. "C7 → F7"),
  - placa turquesa     → "Forma <X>",
  - raya de "TEMPO"    → "80 BPM" / "65-100 BPM" / "100-140 BPM" según la serie.

Uso:
  python3 scripts/generate-cambios-arpegio-thumbnails.py [--only progresivo:Cambio_I7-IV7-C_FormaC] [--out <dir>]
Deja <serie>_<stem>.jpg (p. ej. progresivo_Cambio_I7-IV7-C_FormaC.jpg) en ~/guitar-visualizer-assets/miniaturas-cambios-arpegio
(las tres series comparten stem, por eso el prefijo).
"""
import argparse
import importlib.util
import json
from pathlib import Path

from PIL import Image, ImageDraw

_spec = importlib.util.spec_from_file_location('bpm_thumbs', Path(__file__).with_name('generate-bpm-thumbnails.py'))
_bpm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_bpm)

ASSETS = '~/guitar-visualizer-assets/miniaturas-cambios-arpegio'
PLANTILLA = 'plantilla_CambioI7IV7_v1.png'
PLAN = Path(__file__).with_name('.catalog-cambios-arpegio-plan.json')
IV = {'C': 'F', 'G': 'C', 'D': 'G', 'A': 'D', 'E': 'A', 'B': 'E', 'F#': 'B', 'Db': 'Gb', 'Ab': 'Db', 'Eb': 'Ab', 'Bb': 'Eb', 'F': 'Bb'}
TEMPO = {'fijo': '80 BPM', 'progresivo': '65-100 BPM', 'avanzado': '100-140 BPM'}
# Huecos medidos sobre la plantilla (1672x941), iguales a los de blues (generate-blues-thumbnails.py).
BOX_TONO = (1120, 78, 1595, 202)
BOX_PLACA = (1200, 240, 1585, 340)
BOX_TEMPO = (1200, 864, 1416, 895)
AMARILLO = (255, 222, 0)


def flecha(img, x0, x1, cy, grosor, color):
    """La Anton no trae "→": flecha dibujada (asta + punta) con el grosor del trazo de la letra."""
    d = ImageDraw.Draw(img)
    punta = grosor * 2.2
    d.rectangle((x0, cy - grosor / 2, x1 - punta * 0.8, cy + grosor / 2), fill=color)
    d.polygon([(x1 - punta * 1.4, cy - punta), (x1, cy), (x1 - punta * 1.4, cy + punta)], fill=color)


def medidas(a, b, tam, font_path):
    f = _bpm.ImageFont.truetype(font_path, tam)
    ba, bb = f.getbbox(a), f.getbbox(b)
    hueco = tam * 0.75
    return f, ba, bb, hueco, (ba[2] - ba[0]) + hueco + (bb[2] - bb[0]), max(ba[3], bb[3]) - min(ba[1], bb[1])


def tam_que_cabe_cambio(a, b, caja, font_path):
    for tam in range(130, 20, -1):
        *_, ancho, alto = medidas(a, b, tam, font_path)
        if ancho <= caja[2] - caja[0] and alto <= caja[3] - caja[1]:
            return tam
    return 20


def estampar_cambio(img, a, b, caja, font_path, color, tam):
    """"A7 → B7" centrado en la caja: texto + hueco para la flecha + texto."""
    f, ba, bb, hueco, ancho, alto = medidas(a, b, tam, font_path)
    cx, cy = (caja[0] + caja[2]) / 2, (caja[1] + caja[3]) / 2
    x = cx - ancho / 2
    top, bot = min(ba[1], bb[1]), max(ba[3], bb[3])
    y = cy - (top + bot) / 2
    d = ImageDraw.Draw(img)
    d.text((x - ba[0], y), a, font=f, fill=color)
    xa = x + (ba[2] - ba[0])
    flecha(img, xa + hueco * 0.15, xa + hueco * 0.85, cy, max(4, tam * 0.09), color)
    d.text((xa + hueco - bb[0], y), b, font=f, fill=color)


def main():
    p = argparse.ArgumentParser(description='Miniaturas de cambios de arpegio I7 → IV7.')
    p.add_argument('--font', default='~/Library/Fonts/Anton-Regular.ttf')
    p.add_argument('--only')
    p.add_argument('--out', default=ASSETS)
    args = p.parse_args()
    font_path = str(Path(args.font).expanduser())
    out_dir = Path(args.out).expanduser()
    out_dir.mkdir(parents=True, exist_ok=True)
    tpl = Image.open(Path(ASSETS).expanduser() / PLANTILLA).convert('RGB')
    f_placa = _bpm.tamano_que_cabe('Forma C', BOX_PLACA, font_path, 90, 0)
    f_tempo = _bpm.ImageFont.truetype(font_path, _bpm.tamano_uniforme(list(TEMPO.values()), BOX_TEMPO, font_path, 60, 0))
    # Un solo tamaño para todos los "I7 → IV7" (el de la pareja más ancha), como tamano_uniforme en las otras series.
    tam_cambio = min(tam_que_cabe_cambio(k + '7', v + '7', BOX_TONO, font_path) for k, v in IV.items())
    n = 0
    for e in json.loads(PLAN.read_text()):
        clave = f"{e['serie']}:{e['stem']}"
        if args.only and args.only not in clave:
            continue
        k = e['stem'].split('-')[2].split('_')[0]
        k = k[:-1] + '#' if k.endswith('s') else k
        forma = e['stem'][-1]
        img = tpl.copy()
        estampar_cambio(img, k + '7', IV[k] + '7', BOX_TONO, font_path, (8, 8, 8), tam_cambio)
        _bpm.estampar(img, f'Forma {forma}', BOX_PLACA, f_placa, (255, 255, 255), 0, (0, 0, 0))
        _bpm.estampar(img, TEMPO[e['serie']], BOX_TEMPO, f_tempo, AMARILLO, 0, (0, 0, 0))
        img.save(out_dir / f"{e['serie']}_{e['stem']}.jpg", quality=93)
        n += 1
    print(f'Listo: {n} miniaturas en {out_dir}')


if __name__ == '__main__':
    main()
