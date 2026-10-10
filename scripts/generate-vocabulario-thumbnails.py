#!/usr/bin/env python3
"""Miniaturas de la serie "Vocabulario pentatónico" (vídeos de scripts/_proto-frases.js:
FraseE1_formaE_Am_60-120bpm.mp4, …; el número va por forma: E1, E2, D1…). Estampa tres textos sobre la plantilla: el nombre de la frase en la
franja crema entre comillas, el número de frase en el círculo y la forma en la etiqueta. Mismo método que
las demás series: solo se estampa texto, centrado por tinta real (helpers de generate-bpm-thumbnails.py).

Uso: python3 scripts/generate-vocabulario-thumbnails.py [--videos <dir>] [--out <dir>] [--only FraseE]
"""
import argparse
import importlib.util
import re
import sys
from pathlib import Path

from PIL import Image

_spec = importlib.util.spec_from_file_location('bpm_thumbs', Path(__file__).with_name('generate-bpm-thumbnails.py'))
_bpm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_bpm)

VIDEO_RE = re.compile(r'^Frase(?P<num>[A-G]\d+)_(?P<clave>[A-Za-z0-9]+)_Am_\d+-\d+bpm\.mp4$')
# Clave de la frase (scripts/_proto-frases-data.js) → (rótulo de la franja, etiqueta de la forma).
# El rótulo es el NOMBRE PROPIO de la frase (lo que la distingue de otras en la misma forma), nunca la forma.
FRASES = {
    'formaE': ('EL BENDING CLÁSICO', 'Forma E'), 'formaD': ('BENDING EN 1ª CUERDA', 'Forma D'), 'formaC': ('DOBLE PULL-OFF', 'Forma C'),
    'formaA': ('BAJADA LIGADA', 'Forma A'), 'formaG': ('SUBIDA A LA TÓNICA', 'Forma G'),
}
# Medidas sobre la plantilla (1672x941): franja crema cubierta al 98,5 % en 696,64-1476,244; círculo de
# centro 1432,408 y unos 110 px de radio interior; etiqueta de borde ámbar con interior 1255,550-1612,603.
BOX_NOMBRE = (716, 86, 1456, 222)
BOX_NUM = (1362, 348, 1502, 468)
BOX_FORMA = (1272, 560, 1596, 594)
DEFAULT_TEMPLATE = '~/guitar-visualizer-assets/miniaturas-vocabulario-prototipo/plantilla_VocabularioPentatonico.png'


def main():
    p = argparse.ArgumentParser(description='Miniaturas de Vocabulario pentatónico: frase, número y forma sobre la plantilla.')
    p.add_argument('--videos', default='~/Downloads/VocabularioPentatonico')
    p.add_argument('--template', default=DEFAULT_TEMPLATE)
    p.add_argument('--font', default='~/Library/Fonts/Anton-Regular.ttf')
    p.add_argument('--only', help='Solo los vídeos cuyo nombre empiece por este texto')
    p.add_argument('--names', help='Lista de nombres de vídeo separados por comas (para muestras, sin que existan los vídeos)')
    p.add_argument('--out', default='~/guitar-visualizer-assets/miniaturas-vocabulario')
    args = p.parse_args()

    font_path = str(Path(args.font).expanduser())
    out_dir = Path(args.out).expanduser()
    out_dir.mkdir(parents=True, exist_ok=True)
    tpl = Image.open(Path(args.template).expanduser()).convert('RGB')
    names = args.names.split(',') if args.names else sorted(f.name for f in Path(args.videos).expanduser().glob('*.mp4'))

    # Un único tamaño para todos los nombres (el del más largo), para que la serie sea uniforme.
    f_nombre = _bpm.tamano_que_cabe(max((v[0] for v in FRASES.values()), key=len), BOX_NOMBRE, font_path, 150, 0)
    f_num = _bpm.tamano_que_cabe('E8', BOX_NUM, font_path, 150, 0)
    f_forma = _bpm.tamano_que_cabe('Forma G', BOX_FORMA, font_path, 60, 0)
    n = 0
    for name in names:
        if args.only and not name.startswith(args.only):
            continue
        m = VIDEO_RE.match(name)
        if not m or m['clave'] not in FRASES:
            print(f'  aviso: nombre no reconocido, se omite: {name}', file=sys.stderr)
            continue
        nombre, forma = FRASES[m['clave']]
        img = tpl.copy()
        _bpm.estampar(img, nombre, BOX_NOMBRE, f_nombre, (38, 20, 8), 0, (0, 0, 0))
        _bpm.estampar(img, m['num'], BOX_NUM, f_num, (255, 226, 150), 0, (0, 0, 0))
        _bpm.estampar(img, forma, BOX_FORMA, f_forma, (255, 226, 150), 0, (0, 0, 0))
        img.save(out_dir / (Path(name).stem + '.jpg'), quality=93)
        n += 1
    print(f'Listo: {n} miniaturas en {out_dir} (nombre a {f_nombre.size}px, número a {f_num.size}px, forma a {f_forma.size}px)')


if __name__ == '__main__':
    main()
