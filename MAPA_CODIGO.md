# Mapa del código — guitarvisualizer.html

La app es un único `guitarvisualizer.html` (~19.000 líneas, CSS y JS inline en 4 `<script>`). Este
mapa apunta a las piezas por **nombre de función** (los números de línea cambian con cada edición:
búscalas con `grep -n "function nombre"`).

## Estructura del ejercicio
- `cycles[]` / `masterBars` — el tema cargado, en vueltas ("ciclos"). Modos: `master`, `custom`
  (compases propios) y `ref` (reutiliza los de la vuelta 0). `makeCycleCustom(ci)` da compases
  propios a una vuelta `ref`.
- `getAllBars()` — todos los compases en orden. `getBarSegments(bar)` — acordes de un compás con su
  tiempo (admite 2 acordes por compás). `getTargetBars(ci)` — compases editables de una vuelta.
- Cada compás tiene `imgs[0..3]` (un slot por tiempo); un frame generado es
  `{type:'svg', data:<svg>, name, thumb, svgParsed}`.
- `loadXML(input)` — importa MusicXML de BiaB (solo la primera `<part>`; un compás sin armonía
  mantiene el último acorde). Lee tempo, `<fifths>` (tonalidad) y compás.

## Teoría de acordes
- `CHORD_INTERVALS`, `resolveChordDefs(quality)` — intervalos de cada calidad (`R`, `3`/`b3`,
  `5`/`b5`, `7`/`b7`…), tolerante a mayúsculas ("Maj7") y a alteraciones.
- `parseChord(chord)`, `spellNote(root, interval, st)` — notas con la grafía de la tónica real.
- `noteToSt`, `NTS`, `STRING_OPEN_ST`, `getNoteStAtFret` — alturas y mástil (cuerda 0 = 6ª, Mi grave).

## Frames del mástil (formato compartido)
- `generateNeckSVG(voicing, chord, fretStart, fretEnd, msg, showEcho)` — dibuja un voicing
  `{frets, strings, notes, intervals[, fingers]}` con **cualquier número de notas**. Tónica
  (`intervals[i]==='R'`) en rojo `#E53935`, resto cian `#26C6DA`. Marca `data-gen="triads"`.
  `msg` se hornea como `data-msg` y sale en la fila de mensaje del visualizador.
- `svgStringToParsed(svg)` — SVG → `{notes:[{cx,cy,r,fill,label,isRoot,st,semi,string,fret}], …}`;
  es lo que reproduce el visualizador. Las notas salen en el orden de los círculos del SVG.

## Pestaña Tríadas (generación)
- `autoGenerateTriads()` — punto de entrada de todos los botones "Generar" de la pestaña. Construye
  `flat` (un elemento por segmento de acorde del XML: `{bi, chord, beat, ci}`) y despacha a la
  estrategia activa. Ancho de mástil compartido por el lote (`sharedFretEnd`,
  `bumpMaxFretsShownIfNeeded`).
- Estrategias de tríadas (3 notas): voice leading libre (`generateTriadVoiceLeading`,
  `triadCandidates`, `triadDistance`, `TRIAD_STRING_GROUPS`), eje fijo y zona fija (`opts.filter`),
  misma figura (`buildFixedShapeVoicings`), zona por vuelta, barrido (`buildSweepSlots`), figura por
  vuelta (`triadPerLapRows`).
- Exclusión entre estrategias: handlers `onTriad*Change()` y helpers `deactivateTriadSweep`,
  `deactivateTriadPerLapShape`, `deactivateTriadDrop2Cycle`.
- Las opciones de estas estrategias **no** se guardan en la sesión: se guardan los frames generados.

### Drop 2 por ciclos (Goodrick) — v4.4.0, los 6 ciclos desde v4.5.0
Cuatriadas drop 2 de 4 voces encadenadas por un ciclo diatónico. Cuerdas 4-3-2-1; ciclos 2-7 o
automático (sale de los acordes del XML).
- `DROP2_STRING_SETS` (`'4-3-2-1' → [2,3,4,5]`), `DROP2_OPEN_MIDI`, `DROP2_INV_NAMES`,
  `DROP2_CYCLE_RULES` (ciclo → sentido: 2/4/6 `'down'`, 3/5/7 `'up'`), `DROP2_CYCLE_COMMON` (notas
  comunes por cambio: 2 y 7 → 1, 4 y 5 → 2, 3 y 6 → 3), `DROP2_CYCLE_NAMES`.
- `drop2ChordTones(chord)` — las 4 notas (R, 3ª, 5ª, 7ª) con grafía e intervalo; `null` si no es
  cuatriada.
- `drop2Candidates(tones, strings, maxFret)` — todos los drop 2 del acorde en el juego de cuerdas
  (posición cerrada c0<c1<c2<c3 → orden grave→agudo c2,c0,c1,c3). `inv` = inversión por el bajo.
- `drop2Step(prevMidi, nextTones, dir)` — regla del ciclo: voz que está en el acorde siguiente se
  queda; las demás se mueven 1-2 semitonos (`dir`). `null` si alguna no tiene destino o si el
  resultado no tiene las 4 notas del acorde siguiente.
- `drop2CycleBetween(a, b)` — ciclo por la distancia entre letras de las fundamentales (D→G = 4).
- `drop2StepAuto(prevMidi, nextTones, dir, prevChord, nextChord)` — con `dir='auto'` prueba los dos
  sentidos (en mayor solo uno da las 4 notas; si valieran ambos, desempata `drop2CycleBetween`).
- `generateDrop2Cycle(chords, opts)` — función pura. `opts`: `strings`, `startInv` ('auto'|0-3),
  `refFret`, `cycle` (2-7 o `'auto'`; por defecto 4), `minFret` (3), `maxSpan` (4), `maxFret` (17). Reinicia en el voicing inicial
  cada vez que el primer acorde se repite justo después de sí mismo (cambio de vuelta); un segmento
  sin cuatriada tras uno válido mantiene el último acorde. Arranque automático: el voicing que
  recorre la vuelta sin saltos y queda más cerca de `refFret`. Si una posición baja de `minFret`,
  la figura sube una octava (`jumped`) y se avisa; si pasa de `maxFret` (ciclos que suben), baja
  una. Devuelve `{out, warnings, startDesc, restarts, cyclesUsed}`.
- `applyDrop2CycleToEditor(all, barLoc, flat)` — escribe los frames (vía `generateNeckSVG` →
  `svgStringToParsed`, con `msg` "Drop 2 · <inversión>") y deja el modo en Tríadas.
- UI: tarjeta "Drop 2 por ciclos (Goodrick)" en la pestaña Tríadas (`#triadDrop2Cycle`,
  `#triadDrop2Strings`, `#triadDrop2Inv`, `#triadDrop2RefFret`, `#triadDrop2CycleSel`);
  `onTriadDrop2CycleChange`, `generateDrop2CycleFromUI`. El selector de ciclo arranca en automático.
- Señales: placa ◀n (baja, abajo a la izquierda de la nota) o ▶n (sube, abajo a la derecha) en
  `renderSVGStatic`; la leyenda `#drop2Legend` cambia flecha y texto según el sentido
  (`updateDrop2Legend(on, notes)`).
- Notas guía (opción `#triadDrop2Guides`, apagada por defecto): `applyDrop2CycleToEditor` añade
  `voicing.guides` (3ª/7ª según `TN_GUIDE_IVS`) → `data-guide` en `generateNeckSVG` → `note.guide`
  en `svgStringToParsed` → anillo dorado `.guide-ring` (r+4, #FFE033) en `renderSVGStatic`; entrada
  `#drop2LegendGuide` en la leyenda. Con guías, las voces que se quedan llevan `data-move="0"` →
  placa "═" gris (mismo hueco que ◀/▶), el aro blanco de nota común no se dibuja (`noRing`, marca
  `drop2Guides` del frame) y la leyenda cambia a `#drop2LegendStay`. El anillo va sobre el borde (r).
  Script: `generate-triad-videos.js --drop2 --drop2-guides [--intervals]` (`--intervals` activa la
  placa de intervalo `intervalBadge` de la configuración de vis).
- Reproducción: la ruta de tríadas, sin cambios (ver abajo). Las voces se emiten siempre en orden
  de cuerda grave→aguda, así que cada voz desliza por su cuerda.
- Test: `node tools/test-drop2-cycle.js [--xml <ruta>]` (por defecto
  `~/guitar-visualizer-assets/pruebaGoodrick/BossaCuartasD.XML`).
- Pendiente para menor melódica/armónica: `CHORD_INTERVALS` no tiene el menor con 7ª mayor
  (`DmMaj7` cae a tríada menor; `D-maj7` se lee como D7).

## Reproducción (ruta de tríadas)
- `tick()` — bucle de reproducción; decide frame actual/siguiente.
- `animateVoiceLeading(fromNotes, toParsed, ms, chord)` — deslizamiento entre frames. Empareja las
  notas **por índice** (`min(longitudes)`), sin suponer 3 notas.
- `paintTriadGhosts(...)` — fantasmas de la siguiente posición y anillo blanco de notas comunes
  (`getTriadCommonAnchor()`, opción `triadCommonAnchor`); compara por coordenadas, no por número de
  notas.
- `renderSVGStatic(parsed)`, `noteDisplayLabel(note, modo, chord)` — dibujo y etiquetas según el
  selector "Mástil:" (notas/intervalos).

## Otros generadores con "3" fijo (no tocar al ampliar a 4 notas)
"Explora una tríada" (`generateExploreTriad*`, bucles `[0,1,2]`), secuencias (`SS_TRIAD_STRING_GROUPS`,
`ssInversionsFor`) y tríada abierta (`DROP2_TRIAD_SHAPES`, `buildDrop2Voicing` — es la "tríada
abierta" de 3 notas del PDF, no la cuatriada drop 2 de Goodrick).

## Scripts (Node, fuera de la app)
`scripts/` — generación de vídeos por lotes con Playwright + ffmpeg (`generate-*.js`),
miniaturas y catalogación de YouTube (`catalog-*.js`). `tools/` — tests y fixtures.
