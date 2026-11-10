#!/usr/bin/env python3
"""Miniaturas de "Cromática a octavas" (11-06): plantilla de ChatGPT con la pincelada amarilla y la placa vacías.
Pincelada: "1ª POSICIÓN" o "SIN CUERDAS AL AIRE"; placa: "40-160 BPM" (la Anton no trae "→").
Uso: python3 scripts/generate-cromatica-thumbnails.py   → ~/guitar-visualizer-assets/miniaturas-cromatica/*.jpg
"""
import importlib.util
from pathlib import Path
from PIL import Image, ImageDraw

_spec = importlib.util.spec_from_file_location('bpm_thumbs', Path(__file__).with_name('generate-bpm-thumbnails.py'))
_bpm = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(_bpm)
D = Path('~/guitar-visualizer-assets/miniaturas-cromatica').expanduser()
FONT = str(Path('~/Library/Fonts/Anton-Regular.ttf').expanduser())
# v2 (11-06, Alberto: que tenga el estilo de "Localiza las notas", porque va en esa lista, pero que no se confunda):
# dos píldoras vacías, la amarilla para la posición y la turquesa para los bpm. Las píldoras están INCLINADAS (~5,7°,
# suben hacia la derecha; medido columna a columna): con una caja recta el texto se salía por arriba a la izquierda
# (Alberto 11-06), así que se escribe en horizontal y se gira. (centro x, centro y, largo útil, alto útil) sobre 1672x941.
PILDORA_POS = (400, 531, 430, 70)
PILDORA_BPM = (392, 650, 430, 70)
ANGULO = 5.7
# 11-06: "1ª posición" no se entendía bien → "con cuerdas al aire".
VIDEOS = {'Cromatica_a_octavas_40-160bpm': 'CON CUERDAS AL AIRE', 'Cromatica_a_octavas_cerrada_40-160bpm': 'SIN CUERDAS AL AIRE'}

tpl = Image.open(D / 'plantilla_CromaticaOctavas_v2.png').convert('RGB')


def estampar_girado(img, txt, pil, color):
    cx, cy, w, h = pil
    f = _bpm.tamano_que_cabe(txt, (0, 0, w, h), FONT, 72, 0)
    capa = Image.new('RGBA', (w + 40, h + 40), (0, 0, 0, 0))
    _bpm.estampar(capa, txt, (20, 20, 20 + w, 20 + h), f, color, 0, (0, 0, 0))
    capa = capa.rotate(ANGULO, resample=Image.BICUBIC, expand=True)
    img.paste(capa, (int(cx - capa.width / 2), int(cy - capa.height / 2)), capa)


for stem, txt in VIDEOS.items():
    img = tpl.copy()
    estampar_girado(img, txt, PILDORA_POS, (25, 30, 45))
    estampar_girado(img, '40 - 160 BPM', PILDORA_BPM, (25, 30, 45))
    img.save(D / f'{stem}.jpg', quality=93)
    print('✓', D / f'{stem}.jpg')
