#!/usr/bin/env node
/*
 * Genera en lote los vídeos de "Arpegios dentro de escala" (pestaña homónima de la app) para
 * una escala/tónica. Dos modos, igual que la pestaña:
 *
 *  - MODO DIAPOSITIVAS (por defecto, sin --xml): ejercicio sintético de un compás por grado
 *    diatónico, con un audio corto tipo click/metrónomo (obligatorio --bpm, el audio no lo
 *    trae — no hace falta grabar guitarra real, el arpegio siempre es un subconjunto de las
 *    notas de la posición, así que el vídeo lo dirige por completo la app).
 *  - MODO TEMA (con --xml): usa un MusicXML + audio reales (los mismos que cargarías en la
 *    pestaña Audio & XML) — respeta SUS compases/tempo, un vídeo por posición siguiendo el
 *    audio real completo, con sus repeticiones. El tempo lo trae el XML (--bpm se ignora).
 *    Ajusta también "Compases por ciclo" con --cyclelen/--whole-theme si lo cambiaste en la
 *    app (si no, se queda en el valor por defecto de la app, que puede no ser el que usaste).
 *
 * La escala se indica DIRECTAMENTE con --root/--scale/--quality (usa siempre el digitado CAGED
 * automático de cada posición). Solo hace falta el config.json exportado desde la pestaña
 * ("Exportar config.json (lote)", paso 4) si corregiste a mano alguna posición en el paso 2 y
 * quieres conservar esa corrección — esas correcciones viven en el localStorage del navegador,
 * así que exportarlas es la única forma de pasárselas al script.
 *
 * Por cada posición CAGED (por defecto las 5: E, D, C, A, G):
 *  1. Abre la app en Chrome headless (Playwright).
 *  2. (Modo tema) Carga el XML y ajusta "Compases por ciclo" si se indicó.
 *  3. En página, genera la posición y la envía al visualizador EXACTAMENTE por el mismo
 *     camino que el botón "Ver en Visualizador" de la pestaña (llama a asGenerate() y
 *     asSendToEditor() reales, no una reimplementación en Node — así el script no se
 *     desincroniza cada vez que cambia la lógica de la pestaña, como pasó antes).
 *  4. Carga el audio compartido (el mismo fichero para las 5 posiciones) y arranca la
 *     reproducción real; Playwright graba ese vídeo por debajo (sin audio, WebM) durante toda
 *     la duración del audio (+ --extra segundos).
 *  5. ffmpeg mezcla el vídeo silencioso con el audio real y lo recodifica a .mp4.
 *
 * Antes de grabar nada, hace una PASADA DE VALIDACIÓN (sobre la progresión diatónica sintética,
 * independiente del modo): genera las 5 posiciones (sin audio ni vídeo) y comprueba que cada
 * una tiene digitado y que sus acordes diatónicos comparten alguna nota con la posición (si no,
 * esa nota/acorde saldría sin fotograma en el vídeo). Si alguna posición no tiene NADA que
 * mostrar, aborta antes de gastar tiempo grabando; los casos parciales (algún acorde suelto sin
 * nota común) solo avisan — asSendToEditor() ya los salta con gracia.
 *
 * Uso:
 *   node scripts/generate-scale-arpeggio-videos.js --root C --scale major --quality sevenths \
 *     --audio click_80bpm.m4a --bpm 80 --out ./video-out
 *   node scripts/generate-scale-arpeggio-videos.js --root C --scale major --xml tema.xml \
 *     --audio tema.m4a --cyclelen 14 --out ./video-out
 *
 * Opciones:
 *   --app <path>          Ruta al HTML de la app (por defecto: guitarvisualizer.html)
 *   --root <nota>           Tónica, p.ej. C, F#, Bb (con --scale, alternativa a --config)
 *   --scale <clave>         Escala (clave interna, p.ej. major, dorian, harmonic_minor — ver
 *                           SEQ_SCALE_FORMULAS en guitarvisualizer.html)
 *   --quality <sevenths|triads|pentatonic>  Qué resaltar de cada acorde (por defecto: sevenths).
 *                           "pentatonic" resalta la pentatónica de cada acorde (mayor si el
 *                           acorde es mayor, menor en cualquier otro caso) en vez de sus chord
 *                           tones. En modo tema el ACORDE en sí sale del XML tal cual siempre —
 *                           --quality solo decide qué se ilumina de él (chord tones o pentatónica)
 *                           y, en modo diapositivas, también la lista de acordes diatónicos.
 *   --config <path>         config.json exportado desde la pestaña — solo si corregiste alguna
 *                           posición a mano y quieres conservar esa corrección (si no, usa
 *                           --root/--scale/--quality directamente, sin exportar nada)
 *   --xml <path>            MusicXML real → activa el MODO TEMA (ver arriba)
 *   --cyclelen <n>          "Compases por ciclo" (modo tema) — el mismo valor que pusiste en
 *                           Audio & XML. Sin esto se queda en el valor por defecto (12).
 *   --whole-theme            "Compases por ciclo" = Tema completo (excluyente con --cyclelen)
 *   --audio <path>         Audio compartido para las 5 posiciones (obligatorio)
 *   --bpm <n>               Tempo del audio — obligatorio en modo diapositivas (sin --xml); en
 *                           modo tema se ignora (el tempo, posiblemente variable, lo trae el XML)
 *   --out <dir>             Carpeta de salida (por defecto: ./video-out — normalmente conviene
 *                           apuntarlo a la MISMA carpeta donde están el XML/audio de origen)
 *   --visconfig <path>      JSON con el "Configuración" (gv_vis) tal cual lo ves en tu propio
 *                           navegador — Playwright arranca con un perfil limpio, sin ese
 *                           localStorage, así que sin esto usa los valores por defecto de la app
 *                           (proporciones de nota, anillo de notas comunes, parpadeo, fantasma
 *                           de escala, "Mástil:" notas/intervalos/auto/inversiones (noteDisplay),
 *                           etc. pueden NO coincidir con lo que ves en pantalla).
 *                           Consíguelo con `localStorage.getItem('gv_vis')` en la consola del
 *                           navegador donde tengas el ejercicio configurado, y guárdalo en un
 *                           archivo .json. nextPreview se fuerza a true siempre, encima de esto.
 *   --positions-lib <path>  JSON con las formas CAGED corregidas a mano (mismo formato exacto
 *                           que localStorage['gv_arpscale_positions'] del navegador: claves
 *                           "root|scale|posLabel" → [{string,fret},...]) — se inyecta en el
 *                           localStorage de la página ANTES de generar cada posición, así que
 *                           asActiveNotes() la usa exactamente igual que en tu navegador, sin
 *                           tener que repetir --config por cada tónica/escala. Por defecto usa
 *                           scripts/lib/caged-scale-positions.json si existe (ahí vive la
 *                           librería versionada del repo — commitéala cuando corrijas una forma
 *                           nueva en el navegador: `localStorage.getItem('gv_arpscale_positions')`
 *                           te da el JSON completo). --config sigue funcionando igual y, si
 *                           trae su propia customNotesByPosition, gana sobre la librería para
 *                           esa forma concreta.
 *   --positions <lista>     Formas a generar, coma-separadas (por defecto: config.positions,
 *                           normalmente E,D,C,A,G)
 *   --no-closed-variant     Para cada posición con cuerdas al aire (detectado en la validación)
 *                           se genera TAMBIÉN su gemela cerrada: la misma forma CAGED 12 trastes
 *                           más arriba, sin cuerdas al aire (<nombre>_formaX_cerrada.mp4). Esta
 *                           flag lo desactiva y genera solo la variante abierta de siempre.
 *                           Requiere la validación (no funciona con --skip-validate).
 *   --extra <seg>           Segundos extra al final de cada vídeo (por defecto: 2)
 *   --strict                Si algún acorde de alguna posición no comparte ninguna nota con
 *                           ella (avisado en la validación), aborta en vez de solo avisar.
 *   --skip-validate         Salta la pasada de validación y va directa a grabar.
 *   --concurrency <n>       Vídeos en paralelo (por defecto: 1)
 *   --width/--height        Tamaño del viewport grabado (por defecto: 1600x900)
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);

const AS_POS_LABELS = ['E', 'D', 'C', 'A', 'G'];

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) { out[key] = true; }
      else { out[key] = next; i++; }
    }
  }
  return out;
}

async function waitFfmpeg() {
  try { await execFileP('ffmpeg', ['-version']); }
  catch (e) { throw new Error('No se encuentra "ffmpeg" en el PATH. Instálalo antes de continuar (p.ej. "brew install ffmpeg").'); }
}

async function getAudioDurationSeconds(audioPath) {
  try {
    await execFileP('ffmpeg', ['-i', audioPath]);
    throw new Error('ffmpeg no devolvió metadata');
  } catch (e) {
    const stderr = e.stderr || '';
    const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (!m) throw new Error('No se pudo leer la duración de ' + audioPath);
    return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]);
  }
}

// Genera cada posición (SIN audio ni grabación) y comprueba, con las mismas funciones reales
// de la app, que hay algo que mostrar: notas de posición + al menos un acorde diatónico cuyo
// subconjunto de chord tones caiga dentro de esa posición (exactamente lo que asBuildArpeggioSVG
// necesita para no devolver null, ver guitarvisualizer.html).
async function validatePositions({ appUrl, cfg, positions, positionsLib }) {
  // channel:'chrome' usa el Chrome del sistema en vez del Chromium propio de Playwright — este
  // último dejó de tener build para macOS 13 en versiones recientes de Playwright ("Playwright
  // does not support chromium on mac13"), y el Chrome instalado no tiene ese problema.
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage();
  const results = [];
  try {
    await page.goto(appUrl);
    await page.waitForFunction(() => typeof asGenerate === 'function', null, { timeout: 20000 });
    // Librería de formas corregidas a mano (ver --positions-lib) — misma clave/formato que el
    // propio localStorage del navegador, así asActiveNotes() la usa sin más.
    if (positionsLib) await page.evaluate((lib) => localStorage.setItem('gv_arpscale_positions', JSON.stringify(lib)), positionsLib);
    for (const posLabel of positions) {
      const r = await page.evaluate(({ cfg, posLabel }) => {
        showTab('arpscale'); // asegura que #asScale tiene sus <option> (asInit) antes de fijar el valor
        const posIdx = AS_POS_LABELS.indexOf(posLabel);
        if (posIdx < 0) return { posLabel, error: 'Forma desconocida: ' + posLabel };
        document.getElementById('asRoot').value = cfg.root;
        document.getElementById('asScale').value = cfg.scale;
        document.getElementById('asPos').value = String(posIdx);
        document.getElementById('asQuality').value = cfg.quality;
        const custom = (cfg.customNotesByPosition || {})[posLabel];
        if (custom && custom.length) asSetCustomNotes(cfg.root, cfg.scale, posLabel, custom);
        asGenerate();
        const notes = asActiveNotes();
        if (!notes.length) return { posLabel, error: 'No se pudo generar el digitado de esta posición.' };
        if (!asState.chords.length) return { posLabel, error: 'Esta escala no tiene acordes diatónicos limpios de ese tipo (prueba con tríadas).' };
        const frets = notes.map(n => n.fret);
        const fretMin = Math.max(0, Math.min(...frets) - 1);
        const fretMax = Math.min(24, Math.max(...frets) + 1);
        const missingSubset = [];
        asState.chords.forEach(c => {
          const info = asChordInfo(c.chord);
          const svg = asBuildArpeggioSVG(notes, info, c.chord, fretMin, fretMax);
          if (!svg) missingSubset.push(c.chord);
        });
        return {
          posLabel, ok: true,
          noteCount: notes.length,
          chords: asState.chords.map(c => c.chord),
          expectedDegrees: (SEQ_SCALE_FORMULAS[cfg.scale] || []).length,
          missingSubset,
          hasOpenStrings: notes.some(n => n.fret === 0),
        };
      }, { cfg, posLabel });
      results.push(r);
    }
  } finally {
    await browser.close();
  }
  return results;
}

function printValidationReport(results) {
  console.log('\n── Validación de posiciones ──');
  let hardFail = false, anyWarn = false;
  for (const r of results) {
    if (r.error) {
      hardFail = true;
      console.log(`  ✗ Forma ${r.posLabel}: ${r.error}`);
      continue;
    }
    const degNote = r.chords.length < r.expectedDegrees
      ? ` (${r.chords.length}/${r.expectedDegrees} grados con acorde limpio)` : '';
    const openNote = r.hasOpenStrings ? ' · tiene cuerdas al aire → se generará también la variante cerrada (+12 trastes)' : '';
    console.log(`  ✓ Forma ${r.posLabel}: ${r.noteCount} notas · ${r.chords.length} acordes${degNote}${openNote} — ${r.chords.join(', ')}`);
    if (r.missingSubset.length) {
      anyWarn = true;
      console.log(`    ⚠ sin ninguna nota en común con esta posición (saldrán sin fotograma): ${r.missingSubset.join(', ')}`);
    }
  }
  console.log('');
  return { hardFail, anyWarn };
}

// Busca, en el vídeo silencioso YA grabado, el primer fotograma en el que la marca de
// calibración (cuadro blanco pintado en la esquina superior izquierda, ver runOne) aparece —
// devuelve su pts_time (segundos, en la propia línea de tiempo del vídeo crudo) o null si por lo
// que sea no se detecta (p.ej. si la marca se quitó antes de que se grabase ni un solo fotograma).
async function detectMarkerFrameTime(videoPath, tmpDir) {
  const statsPath = path.join(tmpDir, `marker-stats-${process.pid}-${Date.now()}.log`);
  try {
    await execFileP('ffmpeg', [
      '-i', videoPath,
      '-vf', `crop=48:48:0:0,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=${statsPath}`,
      '-f', 'null', '-',
    ]);
    const text = fs.readFileSync(statsPath, 'utf8');
    const lines = text.split('\n');
    // OJO: Chromium pinta en BLANCO (about:blank) los primerísimos fotogramas de cualquier
    // página, ANTES de que el CSS de la app (tema oscuro) llegue a aplicarse — como la grabación
    // empieza en cuanto se crea la página (antes incluso de navegar a la URL), el fotograma 0 casi
    // siempre YA sale "blanco" por esto, sin relación ninguna con nuestra marca (bug encontrado:
    // detectaba t=0.000s SIEMPRE, dando un recorte demasiado CORTO — vídeo por detrás del audio en
    // vez de por delante). Por eso no basta con el primer fotograma "brillante": hace falta haber
    // visto ANTES un fotograma realmente OSCURO (el tema oscuro de la app ya pintado, cuadro en su
    // estado negro) — solo entonces cuenta el siguiente salto a blanco como nuestra marca real.
    let sawDark = false;
    for (let i = 0; i < lines.length; i++) {
      const pm = lines[i].match(/pts_time:([0-9.]+)/);
      if (!pm) continue;
      const vm = (lines[i + 1] || '').match(/YAVG=([0-9.]+)/);
      if (!vm) continue;
      const y = parseFloat(vm[1]);
      if (!sawDark) { if (y < 60) sawDark = true; continue; }
      if (y > 180) return parseFloat(pm[1]); // blanco (255) tras haber confirmado el fondo oscuro
    }
    return null;
  } finally {
    fs.unlink(statsPath, () => {});
  }
}

async function runOne({ appUrl, cfg, posLabel, variant, xmlPath, cycleLen, wholeTheme, audioPath, audioDuration, bpm, extraSec, width, height, outDir, tmpDir, visConfig, positionsLib }) {
  const tag = variant === 'closed12' ? `forma${posLabel}_cerrada` : `forma${posLabel}`;
  const log = (msg) => console.log(`[${tag}] ${msg}`);

  // channel:'chrome' usa el Chrome del sistema en vez del Chromium propio de Playwright — este
  // último dejó de tener build para macOS 13 en versiones recientes de Playwright ("Playwright
  // does not support chromium on mac13"), y el Chrome instalado no tiene ese problema.
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: { dir: tmpDir, size: { width, height } },
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => log('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') log('console.error: ' + m.text()); });

  const recordStartAt = Date.now();
  let playStartAt = null;
  let playStartCurrentTime = 0;
  let stepError = null;
  let flipTimestamp = null;
  try {
    log('cargando app…');
    await page.goto(appUrl);
    await page.waitForFunction(() => typeof asGenerate === 'function', null, { timeout: 20000 });
    // v5 — CALIBRACIÓN POR MARCA VISUAL (bug reportado: incluso esperando 4s a que el audio se
    // estabilice antes de medir, quedaba un adelanto residual de ~0.3s, constante y reproducible
    // — el propio arranque del grabador de vídeo de Playwright/Chromium tarda un poco en empezar
    // a capturar fotogramas de verdad, y ESE retraso no tiene nada que ver con el audio, así que
    // ninguna mejora del lado del audio podía corregirlo). En vez de asumir que el fotograma 0 del
    // vídeo crudo corresponde al instante en que Node leyó recordStartAt (Date.now() tras el
    // await de newPage(), con su propio retraso variable de ida y vuelta al navegador — ver el
    // mismo problema ya documentado y resuelto para el audio en scripts/lib/batch-sessions.js),
    // se pinta un cuadrado blanco en la esquina superior izquierda en un instante conocido con
    // precisión (performance.now() DENTRO del navegador) y luego, sobre el vídeo YA grabado, se
    // busca el fotograma exacto en el que ese cuadrado aparece (ver más abajo, tras cerrar la
    // página) — así el "instante real del fotograma 0" se mide directamente en el propio vídeo,
    // sin depender de ninguna suposición sobre cuánto tarda en arrancar el grabador.
    flipTimestamp = await page.evaluate(() => new Promise((resolve) => {
      const marker = document.createElement('div');
      marker.id = '__syncMarker';
      marker.style.cssText = 'position:fixed;top:0;left:0;width:48px;height:48px;background:#000;z-index:2147483647;pointer-events:none;';
      document.body.appendChild(marker);
      // Doble rAF: dejar que el navegador pinte el cuadro NEGRO al menos una vez antes de pasar a
      // blanco — si se cambia a blanco en el mismo fotograma en que se crea el elemento, con mala
      // suerte el vídeo podría no llegar a capturar nunca el estado "negro" de referencia.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          marker.style.background = '#fff';
          resolve(performance.timeOrigin + performance.now());
        });
      });
    }));
    // Ya no hace falta el cuadro en pantalla (ni en el resto del vídeo ni en la miniatura) — el
    // recorte inicial (más abajo) de sobra se lo lleva por delante de todas formas, pero quitarlo
    // ya evita depender de eso.
    await page.evaluate(() => { const m = document.getElementById('__syncMarker'); if (m) m.remove(); });
    // Miniatura de la siguiente posición: apagada por defecto en la app (hay que activarla en
    // Configuración) — para estos vídeos la queremos siempre encendida. Si se pasó --visconfig
    // (el "Configuración" exacto que se ve en pantalla en el navegador real — Playwright arranca
    // con un perfil nuevo, sin ese localStorage), se aplica ENCIMA de los valores por defecto de
    // la app y nextPreview se fuerza siempre a true por último, para que --visconfig no pueda
    // desactivarlo sin querer.
    // applyVisConfig() (no solo localStorage.setItem) para que el DOM refleje el config YA en
    // este load — si no, campos que no son casillas simples de "Elementos" (p.ej. el <select>
    // "Mástil:" notas/intervalos, cfg.noteDisplay) se quedan con el valor por defecto del HTML
    // hasta que algo más los repinte (bug reportado: "eso tiene que ir en el fichero de
    // configuración" — ya vive en gv_vis, pero aplicar solo el localStorage no bastaba).
    await page.evaluate((vc) => { const cfg = { ...getVisConfig(), ...(vc || {}), nextPreview: true }; localStorage.setItem('gv_vis', JSON.stringify(cfg)); applyVisConfig(cfg); }, visConfig || null);
    // Librería de formas corregidas a mano (ver --positions-lib) — misma clave/formato que el
    // propio localStorage del navegador, así asActiveNotes() la usa sin más.
    if (positionsLib) await page.evaluate((lib) => localStorage.setItem('gv_arpscale_positions', JSON.stringify(lib)), positionsLib);

    if (xmlPath) {
      // MODO TEMA: carga el XML real ANTES de generar la posición, para que cycles.length>0 y
      // asSendToEditor() coloque los fotogramas sobre los compases/tempo reales del tema (ver
      // guitarvisualizer.html, asSendToEditor) en vez del pase corto sintético.
      log('cargando XML…');
      await page.setInputFiles('#xmlPicker', [xmlPath]);
      await page.waitForFunction(() => typeof cycles !== 'undefined' && cycles.length > 0, null, { timeout: 20000 });
      // "Compases por ciclo" (Audio & XML): tiene que coincidir con lo que validaste en la app —
      // si no se indica, se queda en el valor por defecto (12), que puede no ser el real.
      if (wholeTheme) {
        log('ajustando "Compases por ciclo" a Tema completo…');
        await page.evaluate(() => setCycleToWholeTheme());
      } else if (cycleLen) {
        log(`ajustando "Compases por ciclo" a ${cycleLen}…`);
        await page.evaluate((n) => applyCycleLen(n), cycleLen);
      }
    }

    log('generando posición y enviando al visualizador…');
    const result = await page.evaluate(({ cfg, posLabel, variant }) => {
      showTab('arpscale');
      const posIdx = AS_POS_LABELS.indexOf(posLabel);
      document.getElementById('asRoot').value = cfg.root;
      document.getElementById('asScale').value = cfg.scale;
      document.getElementById('asPos').value = String(posIdx);
      document.getElementById('asQuality').value = cfg.quality;
      const custom = (cfg.customNotesByPosition || {})[posLabel];
      if (custom && custom.length) asSetCustomNotes(cfg.root, cfg.scale, posLabel, custom);
      asGenerate();
      if (variant === 'closed12') {
        // Variante "cerrada": la MISMA forma CAGED, 12 trastes más arriba (una octava), sin
        // cuerdas al aire — se usa el propio mecanismo de "corrección manual" (paso 2) para
        // que asActiveNotes()/asSendToEditor() la traten exactamente igual que la abierta.
        // asActiveNotes(), NO asState.notes: este último es SIEMPRE la forma generada en bruto
        // (asGenerate() no consulta corrección alguna) — si había una corrección a mano o de la
        // librería (--positions-lib) para esta forma, desplazar asState.notes la habría ignorado
        // y la cerrada habría salido con la forma SIN corregir +12 (bug reportado en la práctica:
        // ver el mismo fallo ya corregido para el tope de trastes, línea de arriba en el historial).
        const shifted = asActiveNotes().map((n) => ({ string: n.string, fret: n.fret + 12 }));
        if (shifted.some((n) => n.fret > 24)) return { error: 'La variante cerrada (+12) se sale del mástil modelado (traste 24).' };
        asSetCustomNotes(cfg.root, cfg.scale, posLabel, shifted);
        asGenerate(); // recalcula asState con la posición desplazada ya guardada
      }
      if (!asState.chords.length) return { error: 'Esta escala no tiene acordes diatónicos limpios de ese tipo.' };
      // Deja un traste vacío a la derecha del mástil (si no, la nota más aguda queda pegada al
      // borde) — "Mostrar el mástil hasta el traste" ya soporta esto (añade trastes vacíos si el
      // valor es mayor que la nota más alta), solo hay que fijarlo igual al mismo fretMax que
      // va a usar asSendToEditor() (+1, no +2 — ver ese mismo comentario allí).
      // OJO: asState.notes es SIEMPRE la forma CAGED recién generada (sin desplazar) — asGenerate()
      // no consulta la corrección manual, solo asActiveNotes() lo hace. En la variante 'closed12'
      // esto calculaba el tope sobre la posición SIN desplazar (frets 0-3) en vez de la desplazada
      // (frets 12-16 reales), dejando un tope demasiado bajo que luego "Zona ampliada" recortaba a
      // una ventana de un solo traste (bug reportado: "todas las notas amontonadas en una columna
      // en la forma C cerrada"). asActiveNotes() usa la posición real (desplazada o no) siempre.
      {
        const frets = asActiveNotes().map((n) => n.fret);
        const fretMax = Math.min(24, Math.max(...frets) + 1);
        setMaxFretsShown(fretMax);
      }
      asSendToEditor(); // mismo camino que el botón — genera frames, fija bgAuto, showTab('player')
      return { ok: true, bars: totalBars, chords: asState.chords.map((c) => c.chord) };
    }, { cfg, posLabel, variant });
    if (result && result.error) throw new Error(result.error);
    log(`ok: ${result.bars} compases (${result.chords.join(', ')})`);

    log('cargando audio…');
    await page.setInputFiles('#audioPicker', [audioPath]);
    await page.waitForFunction(() => { const el = document.getElementById('audioStatus'); return el && el.classList.contains('ok'); }, null, { timeout: 20000 });
    // En modo tema el tempo (posiblemente variable) ya lo trae el XML — no lo pisamos con --bpm.
    if (!xmlPath && bpm) await page.evaluate((v) => { document.getElementById('bpmInput').value = String(v); }, bpm);

    await page.evaluate(() => { if (!document.body.classList.contains('presentation')) togglePresentation(); if (typeof stopAll === 'function') stopAll(); });
    await page.waitForTimeout(300);

    const total = audioDuration + extraSec;
    log(`grabando… (~${total.toFixed(1)}s)`);
    // Ojo: el evento 'playing' (o el chequeo inmediato) no dispara EXACTAMENTE en el sample 0 —
    // para cuando lo capturamos, audioEl.currentTime ya puede ir unas décimas por delante (decode/
    // buffering del m4a). Si no se corrige, el vídeo (recortado en este instante de reloj) queda
    // desplazado esa misma cantidad respecto al audio real (bug reportado: cambios de compás
    // desincronizados, "en el tiempo y" — sonaba justo esa fracción de negra de retraso).
    // v2 (bug reportado: "el vídeo va ~1.1s por delante del audio en todo el ejercicio, como si
    // el compás fuera de 3/4"): una única muestra justo al detectar 'playing' seguía sin ser
    // fiable — el arranque del decodificador puede dejar audioEl.currentTime desfasado más de lo
    // que una sola lectura corrige.
    // v3 (bug reportado: "la sincronización de los vídeos era perfecta" y ahora el primer golpe
    // de audio ya suena con el mástil mostrando el SIGUIENTE tiempo — vídeo adelantado desde el
    // primer compás, en audios .m4a reales largos ~5min): dos muestras a solo 400-900ms de
    // 'playing' seguían cayendo dentro de la ventana en la que el decodificador de un m4a real
    // puede tener un micro-parón de calentamiento — extrapolar desde ahí hacia atrás SOBRESTIMA
    // t0 (recorta de más, el vídeo queda adelantado exactamente lo que duró ese parón). Probado
    // con 12 muestras cada 150ms en 0.6s-2.4s tras 'playing' — MISMO bug (confirmado a mano,
    // fotograma a fotograma: la transición real de la cuenta atrás cae ~0.58s ANTES en el vídeo
    // que en el audio real): ese parón de calentamiento dura más de los 600ms con los que
    // empezaba a muestrear — cualquier regresión hecha ENTERAMENTE dentro del tramo posterior al
    // parón reproduce el mismo sesgo, tome las muestras que tome, porque ya no puede "ver" cuánto
    // duró el parón que quedó ANTES de la primera muestra.
    // v4: en vez de extrapolar hacia atrás desde muestras tempranas, se espera LARGO (4s tras
    // 'playing' — de sobra para que cualquier parón de arranque del decodificador ya haya
    // terminado) y solo ENTONCES se muestrea, varias veces seguidas (100ms aparte, para promediar
    // el ruido de redondeo sin volver a acercarse a la zona de riesgo). Con reproducción ya
    // completamente estable, t0 = t_muestra - c_muestra*1000 de CADA muestra por separado
    // (asumiendo velocidad de reproducción exactamente 1, garantizado en audio HTML normal) y se
    // usa la MEDIANA — inmune a que la ventana de muestreo temprana capturase o no un parón.
    const stampInfo = await page.evaluate(() => new Promise((resolve) => {
      const sample = () => ({ t: performance.timeOrigin + performance.now(), c: audioEl.currentTime });
      const afterPlaying = () => {
        const samples = [];
        let n = 0;
        const tick = () => {
          samples.push(sample());
          n++;
          if (n < 6) setTimeout(tick, 100);
          else resolve(samples);
        };
        setTimeout(tick, 4000);
      };
      startIt();
      if (!audioEl.paused && audioEl.currentTime > 0) { afterPlaying(); return; }
      const onPlaying = () => { audioEl.removeEventListener('playing', onPlaying); afterPlaying(); };
      audioEl.addEventListener('playing', onPlaying);
      setTimeout(afterPlaying, 2000);
    }));
    // t0 = instante real (wall clock) en que audioEl.currentTime habría sido 0 — mediana de
    // (muestra.t - muestra.c*1000) sobre todas las muestras, ya con reproducción estable.
    const t0Candidates = stampInfo.map((s) => s.t - s.c * 1000).sort((a, b) => a - b);
    const nS = t0Candidates.length;
    const t0 = nS % 2 ? t0Candidates[(nS - 1) / 2] : (t0Candidates[nS / 2 - 1] + t0Candidates[nS / 2]) / 2;
    playStartAt = t0;
    playStartCurrentTime = 0;
    const spread = t0Candidates[nS - 1] - t0Candidates[0]; // ms — debería ser pequeño (<50ms)
    log(`arranque real (t0) de ${nS} muestras estables (audio en ${stampInfo[0].c.toFixed(3)}s-${stampInfo[nS - 1].c.toFixed(3)}s) · dispersión=${spread.toFixed(1)}ms (¿pequeña? si no, algo va mal)`);
    await page.waitForTimeout(total * 1000);
    await page.evaluate(() => { if (typeof pauseIt === 'function') pauseIt(); });
  } catch (e) {
    stepError = e;
  }

  const videoObj = page.video();
  await page.close().catch(() => {});
  await context.close().catch(() => {});
  await browser.close().catch(() => {});

  if (stepError) throw stepError;
  if (!videoObj) throw new Error('No se generó ningún vídeo (context sin recordVideo).');
  const silentPath = await videoObj.path();
  // T_v = instante real (wall clock) del fotograma 0 del vídeo crudo — calibrado con la marca
  // visual (ver arriba) en vez de asumido igual a recordStartAt (Date.now() justo tras el await
  // de newPage(), que no tiene por qué coincidir con cuándo el grabador empezó a capturar de
  // verdad — precisamente la causa del adelanto residual de ~0.3s ya confirmado a mano). Con
  // fallback a recordStartAt si la marca no se detecta, para no romper el vídeo por completo.
  let videoStartRef = recordStartAt;
  if (flipTimestamp != null) {
    try {
      const markerPtsTime = await detectMarkerFrameTime(silentPath, tmpDir);
      if (markerPtsTime != null) {
        videoStartRef = flipTimestamp - markerPtsTime * 1000;
        log(`marca de calibración detectada en t=${markerPtsTime.toFixed(3)}s del vídeo crudo`);
      } else {
        log('aviso: no se detectó la marca de calibración en el vídeo crudo — uso recordStartAt (menos preciso)');
      }
    } catch (e) {
      log('aviso: fallo detectando la marca de calibración (' + e.message + ') — uso recordStartAt (menos preciso)');
    }
  }
  const trimOffsetSec = Math.max(0, ((playStartAt || videoStartRef) - videoStartRef) / 1000 - playStartCurrentTime);

  // Nombre base = el del XML (modo tema) o, sin XML (modo diapositivas), el del audio — así el
  // vídeo queda emparejado con el ejercicio de esa carpeta en vez de un genérico "arpegios_..."
  // igual en las tres carpetas de un lote (pedido: "quiero que sea el mismo del xml que esté en
  // el directorio seguida de _formaC").
  const baseName = path.basename(xmlPath || audioPath, path.extname(xmlPath || audioPath));
  // "Mástil:" (noteDisplay, ver --visconfig) también en el nombre — así un lote en Notas y otro en
  // Intervalos del mismo ejercicio no se pisan entre sí (pedido: "que el nombre lleve la palabra
  // Notas"/"Intervalos" según la opción usada).
  const noteDisplayLabels = { notes: 'Notas', intervals: 'Intervalos', auto: 'Auto', inversions: 'Inversiones' };
  const noteDisplayTag = noteDisplayLabels[(visConfig && visConfig.noteDisplay) || 'auto'] || 'Auto';
  const outPath = path.join(outDir, `${baseName}_${noteDisplayTag}_${tag}.mp4`);
  log(`mezclando audio con ffmpeg (recortando ${trimOffsetSec.toFixed(2)}s de arranque)…`);
  // Recorte EXACTO por timestamp de fotograma (filtro trim+setpts), no por keyframe: "-ss" ANTES
  // de "-i" busca al keyframe más cercano y puede desviarse del punto real hasta un GOP entero —
  // eso se notaba como el vídeo ligeramente desfasado del metrónomo/cambio de acorde (mismo fix
  // que ya lleva scripts/lib/batch-sessions.js, portado aquí — ver bug reportado: "el metrónomo y
  // los compases cambian... en el tiempo 'y'").
  await execFileP('ffmpeg', [
    '-y',
    '-i', silentPath,
    '-i', audioPath,
    '-filter_complex', `[0:v]trim=start=${trimOffsetSec.toFixed(3)},setpts=PTS-STARTPTS[v];[1:a]apad=pad_dur=${extraSec}[a]`,
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20',
    '-c:a', 'aac', '-b:a', '192k',
    '-shortest',
    outPath,
  ]);
  log('listo: ' + outPath);
  return outPath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const usage = 'Uso:\n'
    + '  node scripts/generate-scale-arpeggio-videos.js --root C --scale major --audio <audio> --bpm <n> [--quality sevenths] [--out <dir>]\n'
    + '  node scripts/generate-scale-arpeggio-videos.js --config <config.json> --audio <audio> --bpm <n> [--out <dir>]\n'
    + '(--config solo hace falta si corregiste alguna posición a mano en el paso 2 y quieres conservar esa corrección — si no, usa --root/--scale directamente.)';
  if (!args.audio || (!args.config && !(args.root && args.scale))) {
    console.error(usage);
    process.exit(1);
  }
  const xmlPath = args.xml ? path.resolve(args.xml) : null;
  if (!xmlPath && !args.bpm) { console.error('Falta --bpm (tempo del audio compartido) — obligatorio en modo diapositivas (sin --xml).'); process.exit(1); }
  if (args.cyclelen && args['whole-theme']) { console.error('--cyclelen y --whole-theme son excluyentes.'); process.exit(1); }
  await waitFfmpeg();

  const appPath = path.resolve(args.app || path.join(__dirname, '..', 'guitarvisualizer.html'));
  const appUrl = 'file://' + appPath;
  const cfg = args.config
    ? JSON.parse(fs.readFileSync(path.resolve(args.config), 'utf8'))
    : { root: args.root, scale: args.scale, quality: args.quality || 'sevenths', positions: AS_POS_LABELS, customNotesByPosition: {} };
  const visConfig = args.visconfig ? JSON.parse(fs.readFileSync(path.resolve(args.visconfig), 'utf8')) : null;
  // --positions-lib: por defecto, la librería versionada del repo (scripts/lib/caged-scale-
  // positions.json) si existe — así cualquier forma corregida a mano por Alberto en su
  // navegador y guardada ahí se aplica siempre, sin tener que pasar --config cada vez.
  const positionsLibPath = args['positions-lib']
    ? path.resolve(args['positions-lib'])
    : path.join(__dirname, 'lib', 'caged-scale-positions.json');
  const positionsLib = fs.existsSync(positionsLibPath) ? JSON.parse(fs.readFileSync(positionsLibPath, 'utf8')) : null;
  if (positionsLib) console.log(`Librería de formas corregidas: ${positionsLibPath} (${Object.keys(positionsLib).length} entrada[s])`);
  const audioPath = path.resolve(args.audio);
  const outDir = path.resolve(args.out || './video-out');
  fs.mkdirSync(outDir, { recursive: true });
  const bpm = args.bpm ? parseFloat(args.bpm) : null;
  const cycleLen = args.cyclelen ? parseInt(args.cyclelen, 10) : null;
  const wholeTheme = !!args['whole-theme'];
  const extraSec = args.extra ? parseFloat(args.extra) : 2;
  const width = args.width ? parseInt(args.width, 10) : 1600;
  const height = args.height ? parseInt(args.height, 10) : 900;
  const concurrency = args.concurrency ? Math.max(1, parseInt(args.concurrency, 10)) : 1;
  const positions = (args.positions ? String(args.positions).split(',') : (cfg.positions || AS_POS_LABELS)).map((s) => s.trim().toUpperCase());

  console.log(`Escala: ${cfg.root} ${cfg.scale} (${cfg.quality}) · posiciones: ${positions.join(', ')}`);

  // Jobs: por defecto una entrada 'open' por posición; si la posición usa cuerdas al aire (lo
  // sabe la validación) se añade además su gemela 'closed12' (misma forma, +12 trastes, sin
  // cuerdas al aire) — salvo que se pida --no-closed-variant.
  let jobs = positions.map((posLabel) => ({ posLabel, variant: 'open' }));
  if (!args['skip-validate']) {
    console.log('Validando las posiciones antes de grabar nada…');
    const results = await validatePositions({ appUrl, cfg, positions, positionsLib });
    const { hardFail, anyWarn } = printValidationReport(results);
    if (hardFail) { console.error('Hay posiciones sin nada que mostrar — corrígelas en la pestaña (paso 2) y vuelve a exportar el config.json.'); process.exit(1); }
    if (anyWarn && args.strict) { console.error('Hay acordes sueltos sin nota en común con su posición y se pasó --strict — abortando.'); process.exit(1); }
    if (!args['no-closed-variant']) {
      const openSet = new Set(results.filter((r) => r.ok && r.hasOpenStrings).map((r) => r.posLabel));
      jobs = positions.flatMap((posLabel) => openSet.has(posLabel)
        ? [{ posLabel, variant: 'open' }, { posLabel, variant: 'closed12' }]
        : [{ posLabel, variant: 'open' }]);
    }
  } else {
    console.log('(validación saltada por --skip-validate — tampoco se generan variantes cerradas: hace falta saber qué posiciones tienen cuerdas al aire)');
  }

  const audioDuration = await getAudioDurationSeconds(audioPath);
  console.log(`Audio: ${audioPath} (${audioDuration.toFixed(1)}s, ${bpm} bpm) · ${jobs.length} vídeo(s) a generar`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-arpscale-'));
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < jobs.length) {
      const { posLabel, variant } = jobs[idx++];
      const out = await runOne({ appUrl, cfg, posLabel, variant, xmlPath, cycleLen, wholeTheme, audioPath, audioDuration, bpm, extraSec, width, height, outDir, tmpDir, visConfig, positionsLib });
      results.push(out);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log(`\n${results.length}/${jobs.length} vídeos generados en ${outDir}`);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
