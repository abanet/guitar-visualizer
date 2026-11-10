#!/usr/bin/env python3
"""Sustituye en la Librería de arpegios las formas maj7 y m7b5 DERIVADAS por las que Alberto tiene dibujadas en Neck
Diagrams 2 (ficheros .fbd, XML), transportadas a las 12 tonalidades.

Por qué (Alberto, 2026-10-29 y 11-05): las maj7/m7b5 sacadas de las de 7 y m7 moviendo una nota
(derive-arpeggio-qualities.py) no tenían "muy buena pinta"; el 11-05 señaló que las formas buenas las tiene en Neck
Diagrams ("ArpegiosGMaj7.fbd"). Cada .fbd trae las 5 formas en el orden C, A, G, E, D, la mayoría repetidas
(intervalos y nombres de nota): se toman las distintas en orden. En el .fbd la cuerda 1 es la Mi aguda y la tónica es
el punto con <noteName>; en la Librería la cuerda 0 es la Mi grave.
Cada forma se transporta con la misma regla que expand-arpeggio-library.py: la colocación más baja sin trastes
negativos (la app ya prueba ±12 al elegir). Se conservan id, carpeta y nombre de las entradas que sustituye.

Uso: python3 scripts/import-neck-arpeggios.py <libreria.json> --out <nueva.json>
       [--maj7 "/Volumes/BanetMasa/esquemas NECK/ArpegiosNuevoDiseño/ArpegiosGMaj7.fbd"]
       [--m7b5 "/Volumes/BanetMasa/esquemas NECK/ArpegiosNuevoDiseño/ArpegiosBm7b5.fbd"]
"""
import argparse, importlib.util, json, re
from pathlib import Path

_spec = importlib.util.spec_from_file_location('exp', Path(__file__).with_name('expand-arpeggio-library.py'))
exp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(exp)

DIR = '/Volumes/BanetMasa/esquemas NECK/ArpegiosNuevoDiseño/'
ORDEN = ['C', 'A', 'G', 'E', 'D']
AL_AIRE = [4, 9, 2, 7, 11, 4]            # Mi grave … Mi aguda (cuerda 0 … 5 de la Librería)
INTERVALOS = {'maj7': {0: 'R', 4: '3', 7: '5', 11: '7'}, 'm7b5': {0: 'R', 3: 'b3', 6: 'b5', 10: 'b7'}}


def formas_fbd(path):
    """Las formas distintas del .fbd, en orden: lista de [(cuerda Librería, traste)], tónica (pc)."""
    x = open(path, encoding='utf-8').read()
    vistas, out = set(), []
    for trozo in x.split('<titleElement')[1:]:
        puntos, raiz = [], None
        for d in re.findall(r'<dot>(.*?)</dot>', trozo, re.S):
            s = int(re.search(r'<stringNumber>(\d+)', d).group(1)); f = int(re.search(r'<fret>(\d+)', d).group(1))
            c = 6 - s
            puntos.append((c, f))
            if re.search(r'<noteName>', d):
                raiz = (AL_AIRE[c] + f) % 12
        clave = tuple(sorted(puntos))
        if puntos and clave not in vistas:
            vistas.add(clave)
            out.append((sorted(puntos), raiz))
    if len(out) != 5:
        raise SystemExit(f'{path}: esperaba 5 formas distintas y hay {len(out)}')
    return out


def entrada_nueva(vieja, puntos, raiz_fbd, calidad):
    tonica, _ = exp.parte(vieja['name'])
    d = (exp.pc(tonica) - raiz_fbd) % 12
    trastes = [f for _, f in puntos]
    desp = min((s for s in (d - 12, d, d + 12) if min(trastes) + s >= 0), key=lambda s: max(trastes) + s)
    notas = []
    for c, f in puntos:
        st = (AL_AIRE[c] + f + desp) % 12
        iv = INTERVALOS[calidad][(st - exp.pc(tonica)) % 12]
        notas.append({'string': c, 'fret': f + desp, 'st': st, 'note': exp.deletrea(tonica, iv, st), 'interval': iv, 'isRoot': iv == 'R'})
    notas.sort(key=lambda m: (m['string'], m['fret']))
    return {**vieja, 'notes': notas, 'arpAvgFret': sum(m['fret'] for m in notas) / len(notas)}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('libreria')
    p.add_argument('--out', required=True)
    p.add_argument('--maj7', default=DIR + 'ArpegiosGMaj7.fbd')
    p.add_argument('--m7b5', default=DIR + 'ArpegiosBm7b5.fbd')
    a = p.parse_args()
    d = json.load(open(a.libreria))
    fuentes = {'maj7': formas_fbd(a.maj7), 'm7b5': formas_fbd(a.m7b5)}
    n = 0
    for i, e in enumerate(d['entries']):
        if ' arpegio (' not in e.get('name', '') or not e.get('notes'):
            continue
        _, cal = exp.parte(e['name'])
        if cal in fuentes and e.get('arpPos') in ORDEN:
            puntos, raiz = fuentes[cal][ORDEN.index(e['arpPos'])]
            d['entries'][i] = entrada_nueva(e, puntos, raiz, cal)
            n += 1
    json.dump(d, open(a.out, 'w'))
    print(f'{n} formas sustituidas (maj7 y m7b5 de Neck Diagrams) → {a.out}')


if __name__ == '__main__':
    main()
