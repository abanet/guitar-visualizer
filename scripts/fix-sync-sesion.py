#!/usr/bin/env python3
"""Mide y corrige el desfase imagen-audio de un vídeo de sesión (generate-videos-from-sessions.js).

Por qué (Alberto, 2026-11-05, muestra del ii-V-I): "el primer punto del metrónomo que se enciende con el primer golpe
es el segundo círculo" → la imagen iba ~600 ms ADELANTADA (casi un pulso). Una medida solo de fase (módulo un pulso)
no lo ve, así que aquí se compara el encendido del PUNTO 1 (el grande, el del primer tiempo) con el primer golpe
fuerte del audio, que en las bases de BiaB es el tiempo 1 del compás 3, tras 2 compases de cuenta en silencio.
Después desplaza la imagen (tpad clonando el primer fotograma si va adelantada, o recorte si va retrasada) y vuelve
a medir. Los guiones de octubre (sync.py y fixsync_corto.py) se perdieron con el scratchpad; esto los sustituye.

Uso: python3 scripts/fix-sync-sesion.py <video.mp4> [--out <salida.mp4>] [--solo-medir]
Requiere ffmpeg y numpy. Vídeo de 1600x900 con el metrónomo de 4 puntos arriba a la derecha.
"""
import argparse, subprocess
import numpy as np

W, H, FPS = 1600, 900, 25.0
PUNTOS = [(1422, 90), (1454, 91), (1483, 91), (1512, 91)]


def primer_golpe(v):
    pcm = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', v, '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], capture_output=True).stdout
    a = np.frombuffer(pcm, np.int16).astype(float)
    env = np.sqrt(np.convolve(a ** 2, np.ones(40) / 40, 'same'))[::40]
    return float(np.argmax(env > env.max() * 0.15) * 40 / 8000)


def encendidos_punto1(v, desde, dur):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-ss', str(desde), '-t', str(dur), '-i', v, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W)
    out, prev = [], None
    for i, f in enumerate(fr):
        # el punto 1 es más grande y siempre algo más claro: se le resta peso para no confundirlo con "encendido"
        act = int(np.argmax([f[y - 3:y + 4, x - 3:x + 4].mean() * (0.6 if k == 0 else 1) for k, (x, y) in enumerate(PUNTOS)]))
        if act == 0 and prev not in (None, 0):
            out.append(desde + i / FPS)
        prev = act
    return out


def medir(v):
    t_a = primer_golpe(v)
    ons = encendidos_punto1(v, max(0, t_a - 4), 8)
    if not ons:
        raise SystemExit('no encuentro el encendido del punto 1')
    t_v = min(ons, key=lambda t: abs(t - t_a))
    return t_a, t_v, t_v - t_a      # negativo = imagen adelantada


def main():
    p = argparse.ArgumentParser()
    p.add_argument('video')
    p.add_argument('--out')
    p.add_argument('--solo-medir', action='store_true')
    a = p.parse_args()
    t_a, t_v, d = medir(a.video)
    print(f'primer golpe {t_a:.2f} s, punto 1 {t_v:.2f} s → imagen {"adelantada" if d < 0 else "retrasada"} {abs(d)*1000:.0f} ms')
    if a.solo_medir or abs(d) < 0.03:
        return
    out = a.out or a.video.replace('.mp4', '_sincronizado.mp4')
    vf = f'tpad=start_duration={-d:.3f}:start_mode=clone' if d < 0 else f'trim=start={d:.3f},setpts=PTS-STARTPTS'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', a.video, '-vf', vf, '-c:v', 'libx264', '-crf', '18', '-preset', 'fast',
                    '-c:a', 'copy', '-shortest', out], check=True)
    print('corregido →', out, '·', 'ahora: %+.0f ms' % (medir(out)[2] * 1000))


if __name__ == '__main__':
    main()
