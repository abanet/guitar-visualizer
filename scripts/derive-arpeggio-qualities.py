#!/usr/bin/env python3
"""Añade a la Librería de arpegios las formas maj7 y m7b5, derivadas de las de 7 y m7 en la MISMA posición CAGED.

Por qué (Alberto, 2026-10-29): las bases nuevas (ii-V-I, ii-V-i menor, ciclo de cuartas, I-vi-ii-V) llevan maj7 y
m7b5, y la Librería solo tenía 7, m7, mayor y menor (expand-arpeggio-library.py). Dibujarlas a mano son 120 formas;
pero en una caja CAGED el arpegio maj7 es el de 7 con la b7 un traste más arriba, y el m7b5 es el m7 con la 5ª un
traste más abajo — misma digitación, una nota movida. Si la 5ª está al aire (traste 0) no se puede bajar: pasa a la
cuerda grave de al lado (+5 trastes, +4 entre Sol y Si). Si la nota movida cae donde ya hay otra, no se duplica.

Uso: python3 scripts/derive-arpeggio-qualities.py <libreria_completa.json> --out <libreria_con_maj7_m7b5.json>
"""
import argparse, importlib.util, json, random, string
from pathlib import Path

_spec = importlib.util.spec_from_file_location('exp', Path(__file__).with_name('expand-arpeggio-library.py'))
exp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(exp)

# Intervalo entre cuerdas al aire (cuerda i → i+1, 0 = Mi grave): 5 salvo Sol→Si (cuerda 3→4) que es 4.
SALTO = {0: 5, 1: 5, 2: 5, 3: 4, 4: 5}


def deriva(entrada, de, a, nuevo):
    raiz, _ = exp.parte(entrada['name'])
    notas = []
    for n in entrada['notes']:
        if n['interval'] != de:
            notas.append(dict(n))
            continue
        paso = 1 if a == '7' else -1
        cuerda, traste = n['string'], n['fret'] + paso
        if traste < 0:                       # 5ª al aire: a la cuerda grave de al lado
            if cuerda == 0:
                continue
            cuerda -= 1
            traste += SALTO[cuerda]
        st = (n['st'] + paso) % 12
        if any(m['string'] == cuerda and m['fret'] == traste for m in notas + entrada['notes'] if m is not n):
            continue
        notas.append({**n, 'string': cuerda, 'fret': traste, 'st': st, 'interval': a,
                      'note': exp.deletrea(raiz, a, st), 'isRoot': False})
    notas.sort(key=lambda m: (m['string'], m['fret']))
    pos = entrada['arpPos']
    return {'id': ''.join(random.choices(string.ascii_lowercase + string.digits, k=10)), 'type': 'svg',
            'name': f'{raiz}{nuevo} arpegio ({pos})', 'folder': entrada['folder'], 'arpPos': pos,
            'arpAvgFret': sum(m['fret'] for m in notas) / len(notas), 'chordName': raiz + nuevo,
            'notes': notas, 'slots': []}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('libreria')
    p.add_argument('--out', required=True)
    a = p.parse_args()
    d = json.load(open(a.libreria))
    nuevas = []
    for e in d['entries']:
        if ' arpegio (' not in e.get('name', '') or not e.get('notes'):
            continue
        _, cal = exp.parte(e['name'])
        if cal == '7':
            nuevas.append(deriva(e, 'b7', '7', 'maj7'))
        elif cal == 'm7':
            nuevas.append(deriva(e, '5', 'b5', 'm7b5'))
    # La triada MAYOR en forma D venía incompleta en las 12 tonalidades (Alberto 10-29, cadencia andaluza: "el arpegio de
    # G no sale completo"): a la forma dibujada a mano en su día le faltaba la tónica en la 2ª cuerda (G en el traste 8).
    # El arpegio de 7 en forma D sí la tiene, y una triada es su arpegio de 7 sin la b7: se rehace así. Comprobado que
    # en las demás formas (y en las menores) triada = 7ª sin la 7ª, salvo octava.
    sept = {e['name'].replace('7 arpegio', ' arpegio'): e for e in d['entries'] if e.get('notes') and exp.parte(e['name'])[1] == '7'}
    for e in d['entries']:
        if e.get('notes') and exp.parte(e['name'])[1] == '' and e.get('arpPos') == 'D' and e['name'].replace(' arpegio', ' arpegio') in sept:
            fuente = sept[e['name']]
            e['notes'] = [dict(n) for n in fuente['notes'] if n['interval'] != 'b7']
            e['arpAvgFret'] = sum(n['fret'] for n in e['notes']) / len(e['notes'])
    viejas = [e for e in d['entries'] if not any(e.get('name', '').startswith(n['chordName'] + ' arpegio') for n in nuevas)]
    json.dump({'folders': d['folders'], 'entries': viejas + nuevas}, open(a.out, 'w'))
    print(f'+{len(nuevas)} formas (maj7 y m7b5) → {a.out} ({len(viejas) + len(nuevas)} entradas)')


if __name__ == '__main__':
    main()
