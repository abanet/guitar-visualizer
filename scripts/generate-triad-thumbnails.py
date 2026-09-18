#!/usr/bin/env python3
"""Genera una miniatura por cada vídeo "TodasTriadas" estampando el nombre del acorde
(C, Cm, F#m...) sobre la plantilla que corresponda a su tipo (Mayor/Menor) y modo
(Horizontal/Vertical/Aleatorio). Las plantillas ya traen resaltado el modo en amarillo y la
pincelada del nombre en blanco; aquí solo se estampa el nombre — no se retoca nada más.

Reutiliza las funciones de ajuste de fuente de generate-bpm-thumbnails.py (tamaño uniforme para
todo el lote, centrado por tinta real).

Requiere: pip3 install pillow

Uso:
  python3 scripts/generate-triad-thumbnails.py \\
    --videos-dir ~/Downloads/TodasTriadasEnMastil-C90 \\
    --templates-dir ~/Downloads/TodasTriadasEnMastil-C90/thumbnails \\
    --font ~/Library/Fonts/Anton-Regular.ttf \\
    [--only C,Cm] [--out <dir>]

Las miniaturas se nombran como el vídeo pero con .png (p.ej. Cm_TodasTriadas_Azar_90bpm.png).
Nombres de plantilla esperados: plantillaTriadas{Mayores|Menores}_{Horizontal|Vertical|Aleatorio}.png
(el modo "Azar" de los vídeos usa la plantilla "Aleatorio").
"""
import argparse
import importlib.util
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# Reutiliza helpers del script de BPM (nombre con guiones: no importable con "import").
_spec = importlib.util.spec_from_file_location('bpm_thumbs', Path(__file__).with_name('generate-bpm-thumbnails.py'))
_bpm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_bpm)

VIDEO_RE = re.compile(r'^(?P<chord>[A-G][#b]?m?)_TodasTriadas_(?P<mode>[A-Za-z]+)_(?P<bpm>\d+)bpm\.mp4$')
MODE_TO_TEMPLATE = {'Horizontal': 'Horizontal', 'Vertical': 'Vertical', 'Azar': 'Aleatorio'}

# Medida sobre las 6 plantillas: la pincelada cubre esta caja al ~100% en todas (mismo sitio en
# Mayores y Menores, en los tres modos), así que se comparte una sola caja.
DEFAULT_BOX = (348, 256, 630, 372)


def main():
    p = argparse.ArgumentParser(description='Miniaturas de TodasTriadas: nombre del acorde sobre plantilla.')
    p.add_argument('--videos-dir', required=True, help='Carpeta con los <Acorde>_TodasTriadas_<Modo>_<bpm>bpm.mp4')
    p.add_argument('--templates-dir', required=True, help='Carpeta con las 6 plantillas')
    p.add_argument('--font', required=True)
    p.add_argument('--box', type=_bpm.parse_box, default=DEFAULT_BOX, help='Caja del nombre: izq,arriba,der,abajo')
    p.add_argument('--color', type=_bpm.parse_color, default=(8, 8, 8))
    p.add_argument('--tam-max', type=int, default=400)
    p.add_argument('--only', help='Solo estos acordes, coma-separados (p.ej. C,Cm) — para pruebas')
    p.add_argument('--out', help='Carpeta destino (por defecto <templates-dir>/generadas)')
    args = p.parse_args()

    videos_dir = Path(args.videos_dir).expanduser()
    tpl_dir = Path(args.templates_dir).expanduser()
    font_path = Path(args.font).expanduser()
    out_dir = Path(args.out).expanduser() if args.out else tpl_dir / 'generadas'
    only = set(args.only.split(',')) if args.only else None

    items = []
    for f in sorted(videos_dir.glob('*.mp4')):
        m = VIDEO_RE.match(f.name)
        if not m:
            print(f'  aviso: nombre no reconocido, se omite: {f.name}', file=sys.stderr)
            continue
        if m['mode'] not in MODE_TO_TEMPLATE:
            print(f'  aviso: modo desconocido "{m["mode"]}", se omite: {f.name}', file=sys.stderr)
            continue
        items.append((f, m['chord'], m['mode']))
    if not items:
        sys.exit(f'No se encontró ningún vídeo reconocible en {videos_dir}')

    # Tamaño uniforme calculado con TODOS los acordes del lote (aunque --only filtre), para que una
    # prueba con C/Cm salga exactamente al mismo tamaño que saldrá en el lote completo.
    todos = sorted({c for _, c, _ in items}, key=len)
    tam = _bpm.tamano_uniforme(todos, args.box, str(font_path), args.tam_max, 0)
    font = ImageFont.truetype(str(font_path), tam)
    widest = max(todos, key=lambda t: font.getbbox(t)[2] - font.getbbox(t)[0])
    print(f'Tamaño uniforme: {tam}px (limitado por "{widest}")')

    out_dir.mkdir(parents=True, exist_ok=True)
    cache = {}
    n = 0
    for f, chord, mode in items:
        if only and chord not in only:
            continue
        tipo = 'Menores' if chord.endswith('m') else 'Mayores'
        tpl = tpl_dir / f'plantillaTriadas{tipo}_{MODE_TO_TEMPLATE[mode]}.png'
        if not tpl.exists():
            sys.exit(f'Falta la plantilla: {tpl}')
        if tpl not in cache:
            cache[tpl] = Image.open(tpl).convert('RGB')
        img = cache[tpl].copy()
        _bpm.estampar(img, chord, args.box, font, args.color, 0, (0, 0, 0))
        out = out_dir / (f.stem + '.png')
        img.save(out)
        n += 1
        print(f'{out.name}')
    print(f'\nListo: {n} miniaturas en {out_dir}')


if __name__ == '__main__':
    main()
