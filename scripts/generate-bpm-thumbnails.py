#!/usr/bin/env python3
"""Genera una miniatura por tempo estampando el BPM sobre una plantilla.

Basado en el script que pasó Alberto: mismo algoritmo de ajuste de fuente
(getbbox, centrado por tinta real) y guía de depuración (_guia.png), pero
parametrizado por CLI en vez de un bloque de configuración fijo arriba del
archivo, para encajar con el resto de scripts/*.js del proyecto — y con
--audio-dir el rango de BPM se lee de los nombres de archivo reales del lote
en vez de asumirlo a mano, para que nunca se desincronice si algún tempo
falta o sobra.

Requiere: pip3 install pillow

Uso (rango de BPM fijo, como el script original):
  python3 scripts/generate-bpm-thumbnails.py --template plantilla.png \\
    --prefix AfroCubanoBolero --bpm-start 60 --bpm-end 160 --step 5 \\
    --box 520,240,760,440 --font ~/Library/Fonts/Anton-Regular.ttf \\
    --out ~/Downloads/afrocubanobolero_60_160_5/thumbnails

Uso (BPM detectado de los .m4a reales de un lote, recomendado):
  python3 scripts/generate-bpm-thumbnails.py --template plantilla.png \\
    --prefix AfroCubanoBolero --audio-dir ~/Downloads/afrocubanobolero_60_160_5 \\
    --box 520,240,760,440 --font ~/Library/Fonts/Anton-Regular.ttf \\
    --out ~/Downloads/afrocubanobolero_60_160_5/thumbnails
"""
import argparse
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

AUDIO_EXT_RE = re.compile(r'\.(m4a|mp3|wav|aac|aiff?|caf)$', re.IGNORECASE)


def bpm_from_filename(name):
    """Mismo criterio que bpmFromFilename() en scripts/render-rhythm-video.js:
    quita un '_render'/'-render' final (si lo hay) y lee los dígitos finales."""
    stem = Path(name).stem
    stem = re.sub(r'[_\-\s]*render$', '', stem, flags=re.IGNORECASE)
    m = re.search(r'(\d+)\s*$', stem)
    return int(m.group(1)) if m else None


def detect_bpms_from_audio_dir(audio_dir):
    files = [f for f in Path(audio_dir).iterdir() if f.is_file() and AUDIO_EXT_RE.search(f.name)]
    bpms = set()
    for f in files:
        bpm = bpm_from_filename(f.name)
        if bpm is None:
            print(f'  aviso: no se pudo leer el BPM de "{f.name}" — se omite.', file=sys.stderr)
            continue
        bpms.add(bpm)
    if not bpms:
        sys.exit(f'No se encontró ningún audio con BPM reconocible en {audio_dir}')
    return sorted(bpms)


def parse_box(s):
    parts = [int(p.strip()) for p in s.split(',')]
    if len(parts) != 4:
        raise argparse.ArgumentTypeError('--box necesita 4 números: izquierda,arriba,derecha,abajo')
    return tuple(parts)


def parse_color(s):
    parts = [int(p.strip()) for p in s.split(',')]
    if len(parts) != 3:
        raise argparse.ArgumentTypeError('color necesita 3 números: r,g,b')
    return tuple(parts)


def tamano_que_cabe(texto, caja, ruta_fuente, tam_max, borde):
    ancho = caja[2] - caja[0]
    alto = caja[3] - caja[1]
    for tam in range(tam_max, 5, -1):
        f = ImageFont.truetype(ruta_fuente, tam)
        x0, y0, x1, y1 = f.getbbox(texto, stroke_width=borde)
        if (x1 - x0) <= ancho and (y1 - y0) <= alto:
            return f
    return ImageFont.truetype(ruta_fuente, 6)


def tamano_uniforme(textos, caja, ruta_fuente, tam_max, borde):
    """Un solo tamaño de fuente para TODO el lote (el mayor que quepa para el
    texto MÁS restrictivo, normalmente el de más dígitos) — sin esto, un "60"
    (2 cifras, más estrecho) sale visiblemente más grande que un "100" (3
    cifras), porque cada uno se autoajusta por separado y el más corto crece
    más antes de tocar el borde de la caja. Búsqueda descendente encadenada:
    cada texto usa como techo el tamaño que ya encajó para el anterior, así
    el resultado converge al mínimo común sin recalcular desde tam_max cada vez.
    """
    techo = tam_max
    for t in textos:
        f = tamano_que_cabe(t, caja, ruta_fuente, techo, borde)
        techo = f.size
    return techo


def estampar(img, texto, caja, font_obj, color, borde_px, borde_color):
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = font_obj.getbbox(texto, stroke_width=borde_px)
    cx = (caja[0] + caja[2]) / 2
    cy = (caja[1] + caja[3]) / 2
    # centrado por la tinta real, no por la caja tipográfica
    px = cx - (x0 + x1) / 2
    py = cy - (y0 + y1) / 2
    d.text((px, py), texto, font=font_obj, fill=color, stroke_width=borde_px, stroke_fill=borde_color)
    return font_obj.size


def main():
    p = argparse.ArgumentParser(description='Genera una miniatura por tempo estampando el BPM sobre una plantilla.')
    p.add_argument('--template', required=True, help='Imagen base SIN número')
    p.add_argument('--prefix', required=True, help='Para que los nombres casen con los .m4a, p.ej. AfroCubanoBolero')
    p.add_argument('--audio-dir', help='Carpeta con los .m4a del lote — detecta el BPM de cada uno por su nombre (recomendado, evita desincronizarse a mano)')
    p.add_argument('--bpm-start', type=int, help='BPM inicial (si no se usa --audio-dir)')
    p.add_argument('--bpm-end', type=int, help='BPM final (si no se usa --audio-dir)')
    p.add_argument('--step', type=int, default=5, help='Incremento de BPM (por defecto 5, solo con --bpm-start/--bpm-end)')
    p.add_argument('--box', required=True, type=parse_box, help='Caja del número: izquierda,arriba,derecha,abajo en píxeles')
    p.add_argument('--font', required=True, help='Ruta a la fuente .ttf/.otf')
    p.add_argument('--color', type=parse_color, default=(255, 255, 255), help='Color del número, r,g,b (por defecto blanco)')
    p.add_argument('--tam-max', type=int, default=400, help='Tope de tamaño de fuente (por defecto 400)')
    p.add_argument('--border-px', type=int, default=0, help='Grosor del contorno; 0 = sin contorno')
    p.add_argument('--border-color', type=parse_color, default=(0, 0, 0), help='Color del contorno, r,g,b')
    p.add_argument('--zero-pad', action='store_true', help='Rellena con ceros: 060, 065... (por defecto no)')
    p.add_argument('--no-uniform-size', action='store_true', help='Autoajustar el tamaño de fuente número a número (por defecto: un único tamaño para todo el lote, el que quepa para el texto más restrictivo — evita que un "60" salga más grande que un "100")')
    p.add_argument('--no-guide', action='store_true', help='No generar _guia.png con la caja dibujada')
    p.add_argument('--out', default='thumbnails', help='Carpeta destino (se crea sola; por defecto ./thumbnails)')
    args = p.parse_args()

    if args.audio_dir and (args.bpm_start is not None or args.bpm_end is not None):
        p.error('--audio-dir y --bpm-start/--bpm-end son excluyentes.')
    if not args.audio_dir and (args.bpm_start is None or args.bpm_end is None):
        p.error('Hace falta --audio-dir, o --bpm-start y --bpm-end.')

    template_path = Path(args.template).expanduser()
    font_path = Path(args.font).expanduser()
    out_dir = Path(args.out).expanduser()
    if not template_path.exists():
        sys.exit(f'No existe la plantilla: {template_path}')
    if not font_path.exists():
        sys.exit(f'No existe la fuente: {font_path}')

    if args.audio_dir:
        audio_dir = Path(args.audio_dir).expanduser()
        if not audio_dir.exists():
            sys.exit(f'No existe la carpeta de audio: {audio_dir}')
        bpms = detect_bpms_from_audio_dir(audio_dir)
        print(f'BPM detectados en {audio_dir}: {", ".join(str(b) for b in bpms)}')
    else:
        bpms = list(range(args.bpm_start, args.bpm_end + 1, args.step))

    base = Image.open(template_path).convert('RGB')
    out_dir.mkdir(parents=True, exist_ok=True)

    if not args.no_guide:
        g = base.copy()
        ImageDraw.Draw(g).rectangle(args.box, outline=(255, 0, 0), width=3)
        g.save(out_dir / '_guia.png')
        print(f'Guía: {out_dir / "_guia.png"}  (comprueba que la caja está bien antes de mirar el resto)')

    textos = [f'{bpm:03d}' if args.zero_pad else str(bpm) for bpm in bpms]

    font_uniforme = None
    if not args.no_uniform_size:
        tam = tamano_uniforme(textos, args.box, str(font_path), args.tam_max, args.border_px)
        font_uniforme = ImageFont.truetype(str(font_path), tam)
        print(f'Tamaño uniforme para todo el lote: {tam}px (limitado por "{max(textos, key=len)}")')

    for bpm, texto in zip(bpms, textos):
        img = base.copy()
        f = font_uniforme if font_uniforme else tamano_que_cabe(texto, args.box, str(font_path), args.tam_max, args.border_px)
        tam = estampar(img, texto, args.box, f, args.color, args.border_px, args.border_color)
        nombre = f'{args.prefix}-{texto}.png'
        img.save(out_dir / nombre)
        print(f'{nombre:40s} fuente {tam}px')

    print(f'\nListo. {out_dir.resolve()}')


if __name__ == '__main__':
    main()
