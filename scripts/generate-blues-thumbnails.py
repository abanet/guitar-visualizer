#!/usr/bin/env python3
"""Miniaturas de las escalas de blues y de la mezcla de pentatónicas (generate-pentatonic-mix.js en modos
blues-menor, blues-mayor, mezcla-blues y mezcla): EscalaMenorDeBlues_A_FormaE.mp4, MezclaPentatonicas_G_FormaC.mp4…

Plantillas de ChatGPT aprobadas por Alberto (10-26: BLUES MENOR v2, BLUES MAYOR v1, BLUES MAYOR + MENOR v1;
11-01: PENTATÓNICAS MAYOR + MENOR v1), con la misma composición que la pentatónica sola
(generate-pentatonica-thumbnails.py) y los mismos huecos, medidos otra vez sobre estas plantillas (coinciden):
  - pincelada amarilla → "<tono>" a secas (Alberto 11-01: "nunca hemos puesto más que la tonalidad"),
  - placa turquesa     → "Forma <X> [cerrada]",
  - "IMPROVISA SOBRE ____" → "<tono>7": todas las bases son blues de dominantes (I7-IV7-V7) a 90 bpm.

Uso:
  python3 scripts/generate-blues-thumbnails.py [--only EscalaMenorDeBlues_A] [--out <dir>]
Deja <nombre del vídeo>.jpg en ~/guitar-visualizer-assets/miniaturas-blues.
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

ASSETS = '~/guitar-visualizer-assets/miniaturas-blues'
BASE = '~/Downloads/BluesMayorG90bpm_ParaMezclaPentatonicas'
SERIES = {
    'EscalaMenorDeBlues': (BASE + '/EscalasDeBlues', 'plantilla_BluesMenor_v2.png'),
    'EscalaMayorDeBlues': (BASE + '/EscalasDeBlues', 'plantilla_BluesMayor_v1.png'),
    'MezclaEscalasDeBlues': (BASE + '/EscalasDeBlues', 'plantilla_BluesMezcla_v1.png'),
    'MezclaPentatonicas': (BASE + '/MezclaPentatonicas', 'plantilla_PentatonicasMezcla_v1.png'),
}
VIDEO_RE = re.compile(r'^(?P<serie>[A-Za-z]+)_(?P<key>[A-G][sb]?)_Forma(?P<forma>[CAGED])(?P<cerrada>_Cerrada)?\.mp4$')
# Mismos huecos que generate-pentatonica-thumbnails.py (plantillas 1672x941; medidas 11-01: pincelada
# x 1093-1620 y 53-208, placa x 1168-1614 y 216-361, raya de "SOBRE" igual).
BOX_TONO = (1120, 78, 1595, 202)
BOX_PLACA = (1200, 240, 1585, 340)
BOX_ACORDE = (522, 864, 640, 896)
AMARILLO = (255, 222, 0)


def main():
    p = argparse.ArgumentParser(description='Miniaturas de escalas de blues y mezcla de pentatónicas.')
    p.add_argument('--font', default='~/Library/Fonts/Anton-Regular.ttf')
    p.add_argument('--only')
    p.add_argument('--out', default=ASSETS)
    args = p.parse_args()
    font_path = str(Path(args.font).expanduser())
    out_dir = Path(args.out).expanduser()
    out_dir.mkdir(parents=True, exist_ok=True)
    f_tono = _bpm.tamano_que_cabe('F#', BOX_TONO, font_path, 130, 0)
    f_placa = _bpm.tamano_que_cabe('Forma C cerrada', BOX_PLACA, font_path, 90, 0)
    f_acorde = _bpm.tamano_que_cabe('F#7', BOX_ACORDE, font_path, 60, 0)
    n = 0
    for serie, (carpeta, plantilla) in SERIES.items():
        d = Path(carpeta).expanduser()
        if not d.is_dir():
            print(f'  aviso: no existe {d}', file=sys.stderr)
            continue
        tpl = Image.open(Path(ASSETS).expanduser() / plantilla).convert('RGB')
        for f in sorted(d.glob(serie + '_*.mp4')):
            if args.only and not f.name.startswith(args.only):
                continue
            m = VIDEO_RE.match(f.name)
            if not m or m['serie'] != serie:
                print(f'  aviso: nombre no reconocido, se omite: {f.name}', file=sys.stderr)
                continue
            tono = m['key'][:-1] + '#' if m['key'].endswith('s') else m['key']
            img = tpl.copy()
            _bpm.estampar(img, tono, BOX_TONO, f_tono, (8, 8, 8), 0, (0, 0, 0))
            _bpm.estampar(img, f"Forma {m['forma']}{' cerrada' if m['cerrada'] else ''}", BOX_PLACA, f_placa, (255, 255, 255), 0, (0, 0, 0))
            _bpm.estampar(img, tono + '7', BOX_ACORDE, f_acorde, AMARILLO, 0, (0, 0, 0))
            img.save(out_dir / (f.stem + '.jpg'), quality=93)
            n += 1
    print(f'Listo: {n} miniaturas en {out_dir}')


if __name__ == '__main__':
    main()
