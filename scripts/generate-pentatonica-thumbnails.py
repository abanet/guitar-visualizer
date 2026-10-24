#!/usr/bin/env python3
"""Genera la miniatura de cada vídeo de "Pentatónica menor / mayor: improvisa" (los de
generate-pentatonic-mix.js en modo penta-menor/penta-mayor: PentatonicaMenor_A_FormaE.mp4, …) estampando
sobre su plantilla tres textos: "<Tono> MENOR|MAYOR" en la pincelada amarilla, "Forma <X>" en la placa
turquesa y el acorde de la base en el hueco de "IMPROVISA SOBRE ____" (Xm7 en la menor, X6 en la mayor).
Diseño aprobado por Alberto el 2026-10-23 (ChatGPT, chat "Conceptos y miniatura pentatónica"); las dos
plantillas vacías son las de ese chat. Mismo método que las demás series: solo se estampa texto, centrado
por tinta real (helpers de generate-bpm-thumbnails.py).

Requiere: pip3 install pillow

Uso:
  python3 scripts/generate-pentatonica-thumbnails.py [--only PentatonicaMenor_A] [--out <dir>]

Recorre las dos carpetas de vídeos y deja <nombre del vídeo>.jpg en ~/guitar-visualizer-assets/miniaturas-pentatonica.
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

ASSETS = '~/guitar-visualizer-assets/miniaturas-pentatonica'
# Serie → (carpeta de vídeos, plantilla, rótulo, sufijo del acorde de la base).
SERIES = {
    'PentatonicaMenor': ('~/Downloads/Am7_pentatonica120Compases_95bpm/PentatonicaMenor', 'plantilla_menor.png', 'MENOR', 'm7'),
    'PentatonicaMayor': ('~/Downloads/pentatonicamayor120Compases_95bpm/PentatonicaMayor', 'plantilla_mayor.png', 'MAYOR', '6'),
}
VIDEO_RE = re.compile(r'^(?P<serie>Pentatonica(?:Menor|Mayor))_(?P<key>[A-G][sb]?)_Forma(?P<forma>[CAGED])(?P<cerrada>_Cerrada)?\.mp4$')
# Medidas geométricas sobre las plantillas (1672x941, iguales en las dos): pincelada amarilla x 1067-1647,
# y 44-236 (cajas por dentro de los bordes rotos); placa turquesa x 1169-1615, y 217-362 (borde ~8 px);
# raya de "SOBRE ____" x 524-629 a y 900, con la línea de texto de "SOBRE" en y 867-899.
BOX_TONO = (1120, 78, 1595, 202)
BOX_PLACA = (1200, 240, 1585, 340)
BOX_ACORDE = (522, 864, 640, 896)
AMARILLO = (255, 222, 0)  # el de "95 BPM" y "MEJORAR"


def main():
    p = argparse.ArgumentParser(description='Miniaturas de Pentatónica menor/mayor: tonalidad, forma y acorde sobre la plantilla.')
    p.add_argument('--font', default='~/Library/Fonts/Anton-Regular.ttf')
    p.add_argument('--only', help='Solo los vídeos cuyo nombre empiece por este texto (p.ej. PentatonicaMenor_A)')
    p.add_argument('--out', default=ASSETS)
    args = p.parse_args()

    font_path = str(Path(args.font).expanduser())
    out_dir = Path(args.out).expanduser()
    out_dir.mkdir(parents=True, exist_ok=True)

    # Un único tamaño por hueco para toda la serie, calculado con el texto más largo posible, para que
    # todas las miniaturas de la lista se vean iguales.
    f_tono = _bpm.tamano_que_cabe('F# MENOR', BOX_TONO, font_path, 130, 0)
    f_placa = _bpm.tamano_que_cabe('Forma C cerrada', BOX_PLACA, font_path, 90, 0)
    f_acorde = _bpm.tamano_que_cabe('F#m7', BOX_ACORDE, font_path, 60, 0)

    n = 0
    for serie, (carpeta, plantilla, rotulo, sufijo) in SERIES.items():
        d = Path(carpeta).expanduser()
        if not d.is_dir():
            print(f'  aviso: no existe {d}', file=sys.stderr)
            continue
        tpl = Image.open(Path(ASSETS).expanduser() / plantilla).convert('RGB')
        for f in sorted(d.glob('*.mp4')):
            if args.only and not f.name.startswith(args.only):
                continue
            m = VIDEO_RE.match(f.name)
            if not m or m['serie'] != serie:
                print(f'  aviso: nombre no reconocido, se omite: {f.name}', file=sys.stderr)
                continue
            tono = m['key'][:-1] + '#' if m['key'].endswith('s') else m['key']
            img = tpl.copy()
            _bpm.estampar(img, f'{tono} {rotulo}', BOX_TONO, f_tono, (8, 8, 8), 0, (0, 0, 0))
            _bpm.estampar(img, f"Forma {m['forma']}{' cerrada' if m['cerrada'] else ''}", BOX_PLACA, f_placa, (255, 255, 255), 0, (0, 0, 0))
            _bpm.estampar(img, tono + sufijo, BOX_ACORDE, f_acorde, AMARILLO, 0, (0, 0, 0))
            img.save(out_dir / (f.stem + '.jpg'), quality=93)
            n += 1
    print(f'Listo: {n} miniaturas en {out_dir} (tono a {f_tono.size}px, placa a {f_placa.size}px, acorde a {f_acorde.size}px)')


if __name__ == '__main__':
    main()
