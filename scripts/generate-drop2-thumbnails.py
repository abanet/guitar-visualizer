#!/usr/bin/env python3
"""Genera una miniatura por cada vídeo "<Acorde>Drop2.mp4" (triadas Drop 2) estampando el nombre del
acorde (C, Cm, F#dim, Bbaug...) sobre la pincelada amarilla vacía de la plantilla. Mismo método que
generate-triad-thumbnails.py: solo se estampa el nombre, tamaño uniforme para todo el lote y centrado
por tinta real (helpers de generate-bpm-thumbnails.py).

Requiere: pip3 install pillow

Uso:
  python3 scripts/generate-drop2-thumbnails.py \\
    --videos-dir ~/Downloads/TriadasDrop2_RevisarBackingAUG \\
    [--template ~/guitar-visualizer-assets/miniaturas-drop2-prototipo/plantilla_TriadasDrop2.png] \\
    [--font ~/Library/Fonts/Anton-Regular.ttf] [--only C,F#dim] [--out <dir>]

Las miniaturas se nombran como el vídeo pero con .jpg (p.ej. F#dimDrop2.jpg) en <videos-dir>/thumbnails.
"""
import argparse
import importlib.util
import re
import sys
from pathlib import Path

from PIL import Image, ImageFont

_spec = importlib.util.spec_from_file_location('bpm_thumbs', Path(__file__).with_name('generate-bpm-thumbnails.py'))
_bpm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_bpm)

VIDEO_RE = re.compile(r'^(?P<chord>[A-G][#b]?(?:m|dim|aug)?)Drop2\.mp4$')
# Medida geométricamente sobre la plantilla (1672x941): la pincelada amarilla ocupa x 886-1552, y 299-457;
# esta caja interior queda cubierta de amarillo al 98,5 %.
DEFAULT_BOX = (960, 318, 1478, 438)
DEFAULT_TEMPLATE = '~/guitar-visualizer-assets/miniaturas-drop2-prototipo/plantilla_TriadasDrop2.png'


def main():
    p = argparse.ArgumentParser(description='Miniaturas de triadas Drop 2: nombre del acorde sobre la plantilla.')
    p.add_argument('--videos-dir', required=True, help='Carpeta con los <Acorde>Drop2.mp4')
    p.add_argument('--template', default=DEFAULT_TEMPLATE)
    p.add_argument('--font', default='~/Library/Fonts/Anton-Regular.ttf')
    p.add_argument('--box', type=_bpm.parse_box, default=DEFAULT_BOX, help='Caja del nombre: izq,arriba,der,abajo')
    p.add_argument('--color', type=_bpm.parse_color, default=(8, 8, 8))
    p.add_argument('--tam-max', type=int, default=400)
    p.add_argument('--only', help='Solo estos acordes, coma-separados (p.ej. C,F#dim) — para pruebas')
    p.add_argument('--out', help='Carpeta destino (por defecto <videos-dir>/thumbnails)')
    args = p.parse_args()

    videos_dir = Path(args.videos_dir).expanduser()
    font_path = Path(args.font).expanduser()
    out_dir = Path(args.out).expanduser() if args.out else videos_dir / 'thumbnails'
    only = set(args.only.split(',')) if args.only else None

    items = []
    for f in sorted(videos_dir.glob('*.mp4')):
        m = VIDEO_RE.match(f.name)
        if not m:
            print(f'  aviso: nombre no reconocido, se omite: {f.name}', file=sys.stderr)
            continue
        items.append((f, m['chord']))
    if not items:
        sys.exit(f'No se encontró ningún vídeo reconocible en {videos_dir}')

    # Tamaño uniforme calculado con TODOS los acordes del lote (aunque --only filtre).
    todos = sorted({c for _, c in items}, key=len)
    tam = _bpm.tamano_uniforme(todos, args.box, str(font_path), args.tam_max, 0)
    font = ImageFont.truetype(str(font_path), tam)
    widest = max(todos, key=lambda t: font.getbbox(t)[2] - font.getbbox(t)[0])
    print(f'Tamaño uniforme: {tam}px (limitado por "{widest}")')

    tpl = Image.open(Path(args.template).expanduser()).convert('RGB')
    out_dir.mkdir(parents=True, exist_ok=True)
    n = 0
    for f, chord in items:
        if only and chord not in only:
            continue
        img = tpl.copy()
        _bpm.estampar(img, chord, args.box, font, args.color, 0, (0, 0, 0))
        out = out_dir / (f.stem + '.jpg')
        img.save(out, quality=93)
        n += 1
        print(out.name)
    print(f'\nListo: {n} miniaturas en {out_dir}')


if __name__ == '__main__':
    main()
