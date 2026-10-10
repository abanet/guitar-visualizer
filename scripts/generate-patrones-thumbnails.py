#!/usr/bin/env python3
"""Genera la miniatura de cada vídeo de "Patrones melódicos de la escala mayor" (los que produce
generate-scale-sequences.js: EscalasPorTerceras_C_FormaE_40-120bpm.mp4, …) estampando sobre la plantilla
tres textos: el nombre del ejercicio en la pincelada amarilla, "Forma <X>" en la placa y, en grande en el
hueco de debajo, "<Tono> MAYOR".
Mismo método que las demás series: solo se estampa texto, centrado por tinta real (helpers de
generate-bpm-thumbnails.py).

Requiere: pip3 install pillow

Uso:
  python3 scripts/generate-patrones-thumbnails.py [--only EscalasPorTerceras_C] [--out <dir>]
    [--template ~/guitar-visualizer-assets/miniaturas-patrones-prototipo/plantilla_PatronesMelodicos.png]

Recorre ~/Downloads/EscalasPor*/ y deja <nombre del vídeo>.jpg en ~/guitar-visualizer-assets/miniaturas-patrones
(de ahí las lee scripts/catalog-patrones.js).
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

# Carpeta/prefijo del vídeo → rótulo de la pincelada.
EJERCICIOS = {
    'EscalasPorTerceras': 'TERCERAS', 'EscalasPorTriadas': 'TRIADAS', 'EscalasPorSeptimas': 'ARPEGIOS DE 7ª',
    'EscalasPorGruposDe3': 'GRUPOS DE 3', 'EscalasPorGruposDe4': 'GRUPOS DE 4', 'EscalasPorTercerasAlternas': 'TERCERAS ALTERNAS',
    'EscalasPorSextas': 'SEXTAS', 'EscalasPorTriadasZigzag': 'TRIADAS EN ZIGZAG',
}
VIDEO_RE = re.compile(r'^(?P<ej>EscalasPor[A-Za-z0-9]+)_(?P<key>[A-G][sb]?)_Forma(?P<forma>[CAGED])(?P<cerrada>_Cerrada)?_\d+-\d+bpm\.mp4$')
# Medidas geométricas sobre la plantilla (1672x941): pincelada amarilla x 951-1651, y 68-231 (interior
# cubierto al 98,5 %: 1027,86-1575,213); placa de borde amarillo x 1225-1614, y 254-317.
BOX_EJ = (1035, 96, 1567, 203)
BOX_PLACA = (1245, 263, 1594, 308)
# Hueco oscuro bajo la placa, entre el velocímetro (x < 1245) y la pala (y > 470).
BOX_TONO = (1250, 342, 1590, 452)
DEFAULT_TEMPLATE = '~/guitar-visualizer-assets/miniaturas-patrones-prototipo/plantilla_PatronesMelodicos.png'


def main():
    p = argparse.ArgumentParser(description='Miniaturas de Patrones melódicos: ejercicio + tonalidad y forma sobre la plantilla.')
    p.add_argument('--videos-root', default='~/Downloads')
    p.add_argument('--template', default=DEFAULT_TEMPLATE)
    p.add_argument('--font', default='~/Library/Fonts/Anton-Regular.ttf')
    p.add_argument('--only', help='Solo los vídeos cuyo nombre empiece por este texto (p.ej. EscalasPorTerceras_C)')
    p.add_argument('--out', default='~/guitar-visualizer-assets/miniaturas-patrones')
    args = p.parse_args()

    root = Path(args.videos_root).expanduser()
    font_path = str(Path(args.font).expanduser())
    out_dir = Path(args.out).expanduser()
    out_dir.mkdir(parents=True, exist_ok=True)
    tpl = Image.open(Path(args.template).expanduser()).convert('RGB')

    # Un tamaño por rótulo de ejercicio (cada serie tiene el suyo), con tope de altura común para que los
    # nombres cortos no salgan desproporcionados; un único tamaño para todas las placas.
    f_placa = _bpm.tamano_que_cabe('Forma C cerrada', BOX_PLACA, font_path, 80, 0)
    f_tono = _bpm.tamano_que_cabe('Db MAYOR', BOX_TONO, font_path, 160, 0)
    fuentes = {ej: _bpm.tamano_que_cabe(txt, BOX_EJ, font_path, 104, 0) for ej, txt in EJERCICIOS.items()}

    n = 0
    for ej, txt in EJERCICIOS.items():
        d = root / ej
        if not d.is_dir():
            continue
        for f in sorted(d.glob('*.mp4')):
            if args.only and not f.name.startswith(args.only):
                continue
            m = VIDEO_RE.match(f.name)
            if not m or m['ej'] != ej:
                print(f'  aviso: nombre no reconocido, se omite: {f.name}', file=sys.stderr)
                continue
            tono = m['key'].replace('s', '#') if m['key'].endswith('s') else m['key']
            placa = f"Forma {m['forma']}{' cerrada' if m['cerrada'] else ''}"
            img = tpl.copy()
            _bpm.estampar(img, txt, BOX_EJ, fuentes[ej], (8, 8, 8), 0, (0, 0, 0))
            _bpm.estampar(img, placa, BOX_PLACA, f_placa, (255, 255, 255), 0, (0, 0, 0))
            _bpm.estampar(img, f'{tono} MAYOR', BOX_TONO, f_tono, (255, 255, 255), 0, (0, 0, 0))
            img.save(out_dir / (f.stem + '.jpg'), quality=93)
            n += 1
    print(f'Listo: {n} miniaturas en {out_dir} (placa a {f_placa.size}px, tono a {f_tono.size}px; ejercicios: ' + ', '.join(f'{t} {fuentes[e].size}px' for e, t in EJERCICIOS.items()) + ')')


if __name__ == '__main__':
    main()
