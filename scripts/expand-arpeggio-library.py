#!/usr/bin/env python3
"""Completa la Librería de arpegios (formato de "Exportar librería" de la app) transportando las formas.

Por qué (2026-10-26): las formas de "Crear arpegios desde una forma" solo existen en el navegador donde se
dibujaron (la buena estaba en Firefox: 104 entradas con notas); en Chrome y en las sesiones guardadas quedaron
solo los nombres. De dominante hay 5 formas CAGED completas de A7/B7/D7/G7 pero solo 2 del resto de tónicas.
Una forma de arpegio es la misma en cualquier tónica, desplazada: se toma una tónica con las 5 formas como
fuente y se transporta a las 12, re-deletreando cada nota por su intervalo (Bb, no A#).

Uso: python3 scripts/expand-arpeggio-library.py <libreria.json> --out <completa.json> [--fuente 7=A,m7=Em7]
     [--comprobar]   (compara las fuentes posibles entre sí y con las entradas a mano, sin escribir)
"""
import argparse, json, random, string, sys

LETRAS = 'CDEFGAB'
PC_LETRA = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
TONICAS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']  # mismos nombres que la app (ASH_KEYS)
PASOS = {'R': 0, 'b2': 1, '2': 1, '#2': 1, 'b3': 2, '3': 2, '4': 3, '#4': 3, 'b5': 4, '5': 4, '#5': 4,
         'b6': 5, '6': 5, 'bb7': 6, 'b7': 6, '7': 6}


def pc(nombre):
    p = PC_LETRA[nombre[0]]
    for c in nombre[1:]:
        p += 1 if c == '#' else -1 if c == 'b' else 0
    return p % 12


def deletrea(tonica, intervalo, st):
    letra = LETRAS[(LETRAS.index(tonica[0]) + PASOS[intervalo]) % 7]
    d = (st - PC_LETRA[letra] + 6) % 12 - 6
    return letra + ('#' * d if d > 0 else 'b' * -d)


def parte(nombre):
    m = nombre.split(' arpegio')[0]
    raiz = m[:2] if len(m) > 1 and m[1] in '#b' else m[:1]
    return raiz, m[len(raiz):]


def transporta(entrada, tonica):
    raiz, calidad = parte(entrada['name'])
    d = (pc(tonica) - pc(raiz)) % 12
    trastes = [n['fret'] for n in entrada['notes']]
    # el desplazamiento que deja la forma más abajo sin trastes negativos (la app ya prueba ±12 al elegir)
    desp = min((s for s in (d - 12, d, d + 12) if min(trastes) + s >= 0), key=lambda s: max(trastes) + s)
    notas = [{**n, 'fret': n['fret'] + desp, 'st': (n['st'] + d) % 12,
              'note': deletrea(tonica, n['interval'], (n['st'] + d) % 12)} for n in entrada['notes']]
    pos = entrada['arpPos']
    return {'id': ''.join(random.choices(string.ascii_lowercase + string.digits, k=10)), 'type': 'svg',
            'name': f'{tonica}{calidad} arpegio ({pos})', 'folder': entrada['folder'], 'arpPos': pos,
            'arpAvgFret': sum(n['fret'] for n in notas) / len(notas), 'chordName': tonica + calidad,
            'notes': notas, 'slots': []}


def huella(entrada, tonica):
    """Notas (cuerda, traste) de la entrada llevada a `tonica`, módulo octava, para comparar formas."""
    t = transporta(entrada, tonica)
    base = min(n['fret'] for n in t['notes'])
    return sorted((n['string'], n['fret'] - base) for n in t['notes'])


def main():
    p = argparse.ArgumentParser()
    p.add_argument('libreria')
    p.add_argument('--out')
    p.add_argument('--fuente', default='7=A,m7=Em7')
    p.add_argument('--comprobar', action='store_true')
    a = p.parse_args()
    d = json.load(open(a.libreria))
    arps = [e for e in d['entries'] if ' arpegio (' in e.get('name', '') and e.get('notes')]
    por = {}
    for e in arps:
        raiz, cal = parte(e['name'])
        por.setdefault(cal, {}).setdefault(raiz, {})[e['arpPos']] = e
    fuentes = dict(x.split('=') for x in a.fuente.split(','))

    if a.comprobar:
        for cal, raices in por.items():
            completas = [r for r, f in raices.items() if len(f) == 5]
            print(f'== {cal or "mayor"}: completas {completas}')
            for forma in 'EDCAG':
                vistas = {}
                for r, f in raices.items():
                    if forma in f:
                        vistas.setdefault(tuple(huella(f[forma], 'C')), []).append(r)
                print(f'  forma {forma}: {len(vistas)} variante(s) ' + ' | '.join(','.join(v) for v in vistas.values()))
        return

    out = [e for e in d['entries'] if not (' arpegio (' in e.get('name', ''))]
    for cal, raices in por.items():
        fuente = fuentes.get(cal) or next((r for r, f in raices.items() if len(f) == 5), None)
        fuente = fuente[:len(fuente) - len(cal)] if fuente and fuente.endswith(cal) and cal else fuente
        for tonica in TONICAS:
            for forma in 'EDCAG':
                propia = next((f[forma] for r, f in raices.items() if pc(r) == pc(tonica) and forma in f), None)
                if propia:
                    out.append(propia)  # lo dibujado a mano manda
                elif fuente and forma in raices.get(fuente, {}):
                    out.append(transporta(raices[fuente][forma], tonica))
    json.dump({'folders': d['folders'], 'entries': out}, open(a.out, 'w'))
    n = sum(1 for e in out if ' arpegio (' in e.get('name', ''))
    print(f'{n} formas de arpegio ({len(arps)} a mano) → {a.out}')


if __name__ == '__main__':
    main()
