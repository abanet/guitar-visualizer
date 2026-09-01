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
 *   --quality <sevenths|triads>  Cualidad de los acordes diatónicos (por defecto: sevenths;
 *                           en modo tema solo se usa para la validación, no para el vídeo — los
 *                           acordes del vídeo salen del XML tal cual)
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
 *   --out <dir>             Carpeta de salida (por defecto: ./video-out)
 *   --positions <lista>     Formas a generar, coma-separadas (por defecto: config.positions,
 *                           normalmente E,D,C,A,G)
 *   --no-closed-variant     Para cada posición con cuerdas al aire (detectado en la validación)
 *                           se genera TAMBIÉN su gemela cerrada: la misma forma CAGED 12 trastes
 *                           más arriba, sin cuerdas al aire (arpegios_formaX_cerrada.mp4). Esta
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
async function validatePositions({ appUrl, cfg, positions }) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];
  try {
    await page.goto(appUrl);
    await page.waitForFunction(() => typeof asGenerate === 'function', null, { timeout: 20000 });
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
          const info = tnChordToneMap(c.chord);
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

async function runOne({ appUrl, cfg, posLabel, variant, xmlPath, cycleLen, wholeTheme, audioPath, audioDuration, bpm, extraSec, width, height, outDir, tmpDir }) {
  const tag = variant === 'closed12' ? `forma${posLabel}_cerrada` : `forma${posLabel}`;
  const log = (msg) => console.log(`[${tag}] ${msg}`);

  const browser = await chromium.launch({ headless: true });
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
  try {
    log('cargando app…');
    await page.goto(appUrl);
    await page.waitForFunction(() => typeof asGenerate === 'function', null, { timeout: 20000 });
    // Miniatura de la siguiente posición: apagada por defecto en la app (hay que activarla en
    // Configuración) — para estos vídeos la queremos siempre encendida.
    await page.evaluate(() => localStorage.setItem('gv_vis', JSON.stringify({ ...getVisConfig(), nextPreview: true })));

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
        const shifted = asState.notes.map((n) => ({ string: n.string, fret: n.fret + 12 }));
        if (shifted.some((n) => n.fret > 24)) return { error: 'La variante cerrada (+12) se sale del mástil modelado (traste 24).' };
        asSetCustomNotes(cfg.root, cfg.scale, posLabel, shifted);
        asGenerate(); // recalcula asState con la posición desplazada ya guardada
      }
      if (!asState.chords.length) return { error: 'Esta escala no tiene acordes diatónicos limpios de ese tipo.' };
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
    const stampInfo = await page.evaluate(() => new Promise((resolve) => {
      const stamp = () => resolve({ t: performance.timeOrigin + performance.now(), c: audioEl.currentTime });
      startIt();
      if (!audioEl.paused && audioEl.currentTime > 0) { stamp(); return; }
      const onPlaying = () => { audioEl.removeEventListener('playing', onPlaying); stamp(); };
      audioEl.addEventListener('playing', onPlaying);
      setTimeout(stamp, 2000);
    }));
    playStartAt = stampInfo.t;
    playStartCurrentTime = stampInfo.c || 0;
    log(`audio ya iba en ${playStartCurrentTime.toFixed(3)}s cuando se capturó el arranque (se compensa al recortar)`);
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
  const trimOffsetSec = Math.max(0, ((playStartAt || recordStartAt) - recordStartAt) / 1000 - playStartCurrentTime);

  const outPath = path.join(outDir, `arpegios_${tag}.mp4`);
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
    const results = await validatePositions({ appUrl, cfg, positions });
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
      const out = await runOne({ appUrl, cfg, posLabel, variant, xmlPath, cycleLen, wholeTheme, audioPath, audioDuration, bpm, extraSec, width, height, outDir, tmpDir });
      results.push(out);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log(`\n${results.length}/${jobs.length} vídeos generados en ${outDir}`);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
