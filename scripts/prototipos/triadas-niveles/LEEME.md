# Prototipo: tríadas sobre un tema en tres niveles

Prototipos usados el 2026-10-07 para generar The River, Let It Be, Sultans of Swing y Stand by Me
en nivel 1 (un grupo de cuerdas) y nivel 2 (una zona). Pendiente de integrar en la app y en
`scripts/generate-triad-videos.js`; aquí solo se guardan para no perderlos.

- `nivel1-forma-fija.js` — una forma FIJA por acorde en un grupo de cuerdas, elegida para que el
  tema entero mueva los dedos lo mínimo. `--groups 3` = cuerdas 1-2-3, `--groups 0` = cuerdas 2-3-4.
- `nivel2-zona.js` — zona de 4 trastes sin mover la mano, solo cuerdas 1-2-3 y 2-3-4, forma fija
  por acorde, y que no comparta más de un traste con la zona del nivel 1.
- `lote-cuatro-temas.sh` — los tres vídeos de cada tema, uno detrás de otro.
- `vis-triadfull.json` — config de vis: fondo `triadFull` (notas del acorde que suena por todo el
  mástil, tónica rojiza).

Los dos scripts parchean `generateTriadVoiceLeading` desde fuera, fuerzan nombres de nota
(`globalNoteDisplay='notes'`) y renderizan fotograma a fotograma con un reloj virtual
(`performance.now`, `requestAnimationFrame`, temporizadores y `audioEl.currentTime`), en vez de
grabar la pantalla en directo. Llevan rutas absolutas a `~/guitar-visualizer`.

    node scripts/prototipos/triadas-niveles/nivel1-forma-fija.js --xml tema.XML --audio tema.m4a \
      --out ./salida --groups 3 --invs 0 --width 1920 --height 1080 \
      --vis-config scripts/prototipos/triadas-niveles/vis-triadfull.json
