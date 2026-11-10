#!/usr/bin/env python3
"""Miniaturas de los arpegios sueltos (una triada / una tetrada por todo el mástil, 5 formas).

Plantillas de ChatGPT elegidas por Alberto el 11-08: triadas = plantilla_ArpegiosTriadas_v1 (notas
sueltas; el de triángulos NO le gustó), tetradas = plantilla_ArpegiosTetradas_v1 (violeta, cuadriláteros).
Pincelada amarilla = acorde ("C MAYOR", "A MENOR" en triadas; símbolo "Cm7" en tetradas);
placa turquesa = notas del arpegio con su ortografía correcta ("C · Eb · G · Bb").
Salida: <carpeta de miniaturas>/<nombre del vídeo sin .mp4>.jpg
"""
import importlib.util, os, re, sys
from pathlib import Path
from PIL import Image

_sp = importlib.util.spec_from_file_location('bpm_thumbs', Path(__file__).with_name('generate-bpm-thumbnails.py'))
_bpm = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(_bpm)

A = Path.home() / 'guitar-visualizer-assets'
VIDEOS = A / 'arpegios-sueltos'
OUT = A / 'miniaturas-arpegios-sueltos'
FONT = str(Path.home() / 'Library/Fonts/Anton-Regular.ttf')
BOX_ACORDE = (1120, 82, 1595, 200)
BOX_NOTAS = (1200, 246, 1580, 330)
PLANTILLA = {'triadas': 'plantilla_ArpegiosTriadas_v1.png', 'tetradas': 'plantilla_ArpegiosTetradas_v1.png'}

LETRAS = 'CDEFGAB'
NAT = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
# (pasos de letra, semitonos) desde la tónica
CALIDAD = {
    '':     [(2, 4), (4, 7)],
    'm':    [(2, 3), (4, 7)],
    '7':    [(2, 4), (4, 7), (6, 10)],
    'm7':   [(2, 3), (4, 7), (6, 10)],
    'maj7': [(2, 4), (4, 7), (6, 11)],
    'm7b5': [(2, 3), (4, 6), (6, 10)],
}

def nota(raiz, pasos, semis):
    l = LETRAS[(LETRAS.index(raiz[0]) + pasos) % 7]
    pc_raiz = (NAT[raiz[0]] + raiz.count('#') - raiz.count('b')) % 12
    d = ((pc_raiz + semis) - NAT[l]) % 12
    d = d - 12 if d > 6 else d
    return l + ('#' * d if d > 0 else 'b' * -d)

# Como en el vídeo (la app pinta "A" en Ebm7b5, no "Bbb"): sin dobles alteraciones ni Cb/Fb/E#/B#.
SIMPLE = {'Bbb': 'A', 'Ebb': 'D', 'Abb': 'G', 'Dbb': 'C', 'Gbb': 'F', 'Cb': 'B', 'Fb': 'E', 'E#': 'F', 'B#': 'C'}

def notas(raiz, q):
    return [raiz] + [SIMPLE.get(n, n) for n in (nota(raiz, p, s) for p, s in CALIDAD[q])]

def main():
    OUT.mkdir(exist_ok=True)
    f_acorde = _bpm.tamano_que_cabe('F# MENOR', BOX_ACORDE, FONT, 130, 0)
    f_notas = _bpm.tamano_que_cabe('F# · A · C# · E', BOX_NOTAS, FONT, 80, 0)
    n = 0
    for serie in ('triadas', 'tetradas'):
        base = Image.open(OUT / PLANTILLA[serie]).convert('RGB')
        for v in sorted((VIDEOS / serie).glob('*_sincronizado.mp4')):
            m = re.match(r'Arpegio(?:Triada|Tetrada)-([A-G](?:s|b)?)(m7b5|maj7|m7|7|m)?_', v.name)
            raiz = m.group(1).replace('s', '#'); q = m.group(2) or ''
            if serie == 'triadas':
                rotulo = f"{raiz} {'MENOR' if q == 'm' else 'MAYOR'}"
            else:
                rotulo = raiz + q
            img = base.copy()
            _bpm.estampar(img, rotulo, BOX_ACORDE, f_acorde, (8, 8, 8), 0, (0, 0, 0))
            _bpm.estampar(img, ' · '.join(notas(raiz, q)), BOX_NOTAS, f_notas, (255, 255, 255), 0, (0, 0, 0))
            img.save(OUT / (v.stem + '.jpg'), quality=92); n += 1
            print(v.stem, '|', rotulo, '|', ' · '.join(notas(raiz, q)))
    print('hechas', n)

if __name__ == '__main__':
    main()
