#!/usr/bin/env python3
"""Crea el .SGU de Band-in-a-Box de un ritmo nuevo de TodoRitmos copiando uno que ya funciona y cambiando
solo el título y la batería (RealDrums), para no tener que elegirla a mano en el RealDrums Picker.

Por qué así (2026-10-25): el RealDrums Picker de BiaB está dibujado a medida y no expone nada al sistema de
accesibilidad, así que no se puede manejar desde AppleScript; en cambio el .SGU es un fichero sencillo:
  - byte 0 'I', byte 1 = longitud del título, el título y luego 00 <60 - longitud> (campo fijo de 60
    bytes con los ceros comprimidos en una racha);
  - la batería: b2 01 <nombre> 00 ff 00 ff 00 <166 - longitud> (mismo esquema, campo de 166).
Comprobado sobre los 12 .SGU de CanalGuitarra/BandInABox/Ritmos. El nombre de la batería es el de su
carpeta en Drums/ y, si tiene variaciones, el de la primera (p.ej. "Salsa^1-HiHat,Ride").
El compás y el silencio de las pistas van en la plantilla. SoloDrumsBase.SGU (4/4) la guardó BiaB con todo
silenciado salvo Drums (Alberto 10-25: "es importante que las pistas que no son drums estén silenciadas"; la
primera tanda copiada de BluesRock128.SGU no lo tenía). Para 3/4 hace falta una base de vals igual de silenciada.

Uso: python3 scripts/make-biab-sgu.py SalsaBachata [Salsa^ …] [--base SoloDrumsBase.SGU]
Deja <nombre sin ^>.SGU en la carpeta Ritmos.
"""
import argparse
from pathlib import Path

RITMOS = Path('/Volumes/BanetMasa/CanalGuitarra/BandInABox/Ritmos')
DRUMS = Path('/Volumes/BanetMasa/Band-in-a-Box/Drums')


def nombre_bateria(rd):
    d = DRUMS / rd
    if not d.is_dir():
        raise SystemExit(f'No existe la batería {rd} en {DRUMS}')
    vars_ = sorted(p.name for p in d.iterdir() if p.is_dir() and p.name.startswith(rd + '1-'))
    return vars_[0] if vars_ else rd


def crear(base, titulo, bateria):
    b = base
    tl = b[1]
    assert b[0:1] == b'I' and b[2 + tl] == 0 and b[3 + tl] == 60 - tl, 'cabecera inesperada en la plantilla'
    t = titulo.encode('latin-1')[:60]
    b = b'I' + bytes([len(t)]) + t + b'\x00' + bytes([60 - len(t)]) + b[4 + tl:]
    i = b.find(b'\xb2\x01')
    j = b.find(b'\x00', i + 2)
    assert i > 0 and b[j:j + 5] == b'\x00\xff\x00\xff\x00' and b[j + 5] == 166 - (j - i - 2), 'campo de batería inesperado'
    d = bateria.encode('latin-1')
    return b[:i + 2] + d + b'\x00\xff\x00\xff\x00' + bytes([166 - len(d)]) + b[j + 6:]


def main():
    p = argparse.ArgumentParser()
    p.add_argument('drums', nargs='+')
    p.add_argument('--base', default='SoloDrumsBase.SGU')
    a = p.parse_args()
    base = (RITMOS / a.base).read_bytes()
    for rd in a.drums:
        nombre = rd.rstrip('^')
        out = RITMOS / f'{nombre}.SGU'
        out.write_bytes(crear(base, nombre, nombre_bateria(rd)))
        print(f'✓ {out.name}  ({nombre_bateria(rd)})')


if __name__ == '__main__':
    main()
