#!/usr/bin/env python3
"""Miniaturas de "EL LICK DE LA SEMANA" (vocabulario de blues y rock, BanetMasa).

Plantillas de ChatGPT aprobadas por Alberto (11-02), una por nivel con la pincelada de abajo a la izquierda de su color:
N1 verde, N2 azul, N3 naranja, N4 rojo, T (turnarounds) morado — ~/guitar-visualizer-assets/miniaturas-licks/
plantilla_licks_{N1,N2,N3,N4,T}.png. Aquí solo se estampan los textos (no se retoca la imagen):
  - hueco central: el nombre de la frase en dos líneas (1ª blanca, 2ª amarilla), sacado de la lista de frases
    (~/guitar-visualizer-assets/vocabulario-blues-rock-lista.md) por su número;
  - pincelada: "NIVEL 1 · Nº 05" / "TURNAROUND · Nº 01" (numeración por nivel: se pueden añadir frases a un nivel
    sin renumerar);
  - recuadro negro: el rango de tempos del vídeo ("80-120 BPM").

Uso: python3 scripts/generate-lick-thumbnails.py [--dir ~/Downloads/_SUBIR_BanetMasa/4_Licks_54] [--out <dir>]
Lee los nombres de fichero Lick_<código>_<a>-<b>bpm.mp4 y deja <código>.jpg.
"""
import argparse
import importlib.util
import re
from pathlib import Path

from PIL import Image

_spec = importlib.util.spec_from_file_location('bpm_thumbs', Path(__file__).with_name('generate-bpm-thumbnails.py'))
_bpm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_bpm)

ASSETS = Path('~/guitar-visualizer-assets/miniaturas-licks').expanduser()
LISTA = Path('~/guitar-visualizer-assets/vocabulario-blues-rock-lista.md').expanduser()
FONT = str(Path('~/Library/Fonts/Anton-Regular.ttf').expanduser())
BOX_L1, BOX_L2 = (60, 360, 760, 520), (60, 535, 760, 690)       # hueco central (medido en la maqueta aprobada)
BOX_PLACA, BOX_BPM = (90, 780, 690, 880), (1275, 785, 1615, 875)
# Texto de la pincelada: oscuro sobre verde/naranja, blanco sobre azul/rojo/morado (contraste).
PLACA_COLOR = {'N1': (15, 15, 15), 'N2': (255, 255, 255), 'N3': (15, 15, 15), 'N4': (255, 255, 255), 'T': (255, 255, 255)}


def nombres():
    """Número de la lista (1..48, T1..T12) → nombre de la frase."""
    out = {}
    for l in LISTA.read_text().splitlines():
        m = re.match(r'^\| (T?\d+) \| ([^|]+) \|', l)
        if m:
            out[m[1]] = m[2].strip()
    return out


def dos_lineas(txt):
    w = txt.upper().split()
    if len(w) == 1:
        return [w[0], '']
    i = min(range(1, len(w)), key=lambda k: abs(len(' '.join(w[:k])) - len(' '.join(w[k:]))))
    return [' '.join(w[:i]), ' '.join(w[i:])]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', default='~/Downloads/_SUBIR_BanetMasa/4_Licks_54')
    ap.add_argument('--out', default=str(ASSETS / 'licks'))
    a = ap.parse_args()
    out = Path(a.out).expanduser(); out.mkdir(parents=True, exist_ok=True)
    N = nombres(); n = 0
    for f in sorted(Path(a.dir).expanduser().glob('Lick_*.mp4')):
        m = re.match(r'Lick_(N(\d)-(\d\d)|T-(\d\d))_(\d+)-(\d+)bpm\.mp4$', f.name)
        if not m:
            print('  aviso: nombre no reconocido', f.name); continue
        if m[2]:
            lvl, k = 'N' + m[2], int(m[3]); num = str((int(m[2]) - 1) * 12 + k); placa = f'NIVEL {m[2]} · Nº {k:02d}'
        else:
            lvl, k = 'T', int(m[4]); num = f'T{k}'; placa = f'TURNAROUND · Nº {k:02d}'
        l1, l2 = dos_lineas(N[num])
        im = Image.open(ASSETS / f'plantilla_licks_{lvl}.png').convert('RGB')
        # Las dos líneas del nombre al MISMO tamaño (el que quepa en la más larga), para que no baile la tipografía.
        fn = min((_bpm.tamano_que_cabe(t, b, FONT, 170, 0) for t, b in [(l1, BOX_L1), (l2, BOX_L2)] if t), key=lambda f: f.size)
        for txt, box, col, f in [(l1, BOX_L1, (255, 255, 255), fn), (l2, BOX_L2, (255, 214, 64), fn),
                                 (placa, BOX_PLACA, PLACA_COLOR[lvl], None), (f'{m[5]}-{m[6]} BPM', BOX_BPM, (255, 255, 255), None)]:
            if txt:
                _bpm.estampar(im, txt, box, f or _bpm.tamano_que_cabe(txt, box, FONT, 170, 0), col, 0, (0, 0, 0))
        im.save(out / f'{m[1]}.jpg', quality=92); n += 1
    print(f'{n} miniaturas en {out}')


if __name__ == '__main__':
    main()
