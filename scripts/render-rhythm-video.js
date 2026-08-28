#!/usr/bin/env node
/*
 * Genera en lote los vídeos del módulo "Ritmo" (pantalla de tempo sin acordes, ver el bloque
 * MÓDULO RITMO/TEMPO en guitarvisualizer.html) a partir de una carpeta con varios audios —
 * típicamente el mismo groove exportado de BiaB a distintos tempos (rock_60.m4a … rock_150.m4a).
 *
 * Igual que generate-triad-videos.js: carga el audio DE VERDAD en el navegador y graba en
 * tiempo real con Playwright (recordVideo) mientras la app reproduce — no fotograma a fotograma.
 * (Se probó primero el enfoque "offline" descrito en NOTES.md, pintando cada frame a mano con
 * page.screenshot(); con pistas de varios minutos —los backing tracks de este módulo duran
 * bastante más que un ejercicio de tríadas— resultó muchísimo más lento que grabar en directo,
 * así que se descartó a favor de este pipeline ya probado.)
 *
 * El fundido a negro + logo del final SÍ es el mismo que en tríadas: se detectó que el módulo
 * Ritmo tenía su propio bucle de pintado (tvFrame) que nunca disparaba ese fundido —vivía solo
 * dentro de tick(), que el modo Ritmo no usa—, así que se extrajo a armEndFade() y se conectó
 * también a tvFrame() (ver guitarvisualizer.html). Con eso, grabar en directo ya produce el
 * mismo remate sin necesitar nada especial desde este script.
 *
 * El BPM de cada vídeo se lee del propio nombre de archivo (el nº final antes de la extensión:
 * rock_60.m4a → 60bpm). El nº de compases NO se pide a mano: lo calcula la propia app
 * (tvComputeBars(), "Calcular desde el audio") a partir de la duración real del archivo ya
 * cargado — el audio real siempre manda sobre cualquier duración teórica.
 *
 * Uso:
 *   node scripts/render-rhythm-video.js --dir ./mis-ritmos/rock
 *
 * <dir>/config.json (compartido para todo el lote — se puede exportar directamente desde el
 * botón "Exportar config.json (lote)" del panel de Ritmo en la app):
 *   {
 *     "style": "ROCK", "substyle": "Ballad", "colorPreset": "rock",
 *     "beats": 4, "introBars": 1, "offsetMs": 0, "extraSec": 2
 *   }
 * colorPreset es uno de los presets de TV_COLOR_PRESETS en guitarvisualizer.html (rock, funk,
 * jazz, blues, metal, pop) — controla el acento de color del diseño, no solo el texto.
 *
 * ---- MODO TEMPO PROGRESIVO (--xml) --------------------------------------------------------
 * Para un tema con cambios de tempo (BiaB exportado con un <sound tempo> por compás — ver el
 * mapa de tempo que ya usa Tríadas, ahora también el módulo Ritmo, ver guitarvisualizer.html):
 * un único XML + un único audio = un único vídeo, en vez de una carpeta con varios audios a BPM
 * fijo. El XML necesita al menos UN acorde de referencia (aunque el ritmo no lo use para nada
 * más) para que la app sepa dónde acaba la intro — igual que se explica en la propia tarjeta
 * "Ritmo" de la app. BPM base, nº de compases y duración se leen todos del XML/del propio motor
 * (tvGetDuration()), no hace falta pasarlos a mano.
 *
 *   node scripts/render-rhythm-video.js --xml tema.xml --audio tema.m4a \
 *     --style ROCK --substyle "Pop Ballad" --color-preset rock
 *
 * Para varios temas a la vez (--xml-dir): deja en la misma carpeta un par XML+audio por tema,
 * con el MISMO NOMBRE BASE (tema1.xml + tema1.m4a, tema2.xml + tema2.m4a…) y opcionalmente un
 * config.json compartido (mismas claves que arriba). Se generan de uno en uno, nunca en paralelo:
 *   node scripts/render-rhythm-video.js --xml-dir ./mis-ritmos/progresivos --style ROCK
 *
 * Antes de grabar cada tema se comprueba que su mapa de tempo (XML) tenga una progresión
 * coherente — mismo BPM de salto y mismo nº de compases entre saltos a lo largo del tema— y se
 * avisa en el log si algún salto no encaja con el patrón del resto, típico de un escalón de tempo
 * olvidado al montar el Tempo Track en BiaB. Por defecto solo AVISA y sigue generando el vídeo;
 * con --strict, un aviso grave aborta ese vídeo ANTES de abrir el navegador (en --xml-dir se salta
 * solo ese tema y sigue con el resto del lote; en --xml se aborta sin generar nada). Para revisar
 * los XML ANTES de generar nada: node scripts/check-tempo-xml.js --dir <carpeta> (ver ese script).
 *
 * Opciones propias de este modo (todas opcionales salvo --xml/--audio):
 *   --style/--substyle/--beats/--color-preset   Igual que en config.json (por defecto: los que
 *                                                traiga la app al cargar, p.ej. beats=4).
 *   --lang <es|en|fr|de|it|pt>                   Idioma de los textos en pantalla (por defecto:
 *                                                español — ver TV_I18N en guitarvisualizer.html).
 *   --intro-bars/--offset-ms                    Solo si quieres PISAR lo que detecta el XML
 *                                                (intro por el primer acorde, offset 0).
 *   --name <texto>                               Nombre base del archivo de salida (por defecto:
 *                                                se deriva del nombre del audio).
 *   --strict                                     Aborta (ese vídeo, o todo en modo --xml) si el
 *                                                XML tiene algún aviso grave de progresión de tempo.
 *
 * Opciones (ambos modos):
 *   --app <path>         Ruta al HTML de la app (por defecto: guitarvisualizer.html)
 *   --dir <path>          Carpeta con los audios + config.json (modo BPM fijo, ver arriba)
 *   --xml <path>          MusicXML con mapa de tempo (modo tempo progresivo, ver arriba)
 *   --audio <path>        Audio del tema (obligatorio junto a --xml)
 *   --extra <seg>         Segundos extra al final (modo --xml; en modo --dir viene de config.json)
 *   --out <dir>            Carpeta de salida (por defecto: ./video-out)
 *   --concurrency <n>      Vídeos en paralelo (solo modo --dir; por defecto: 1 — cada uno graba
 *                          en tiempo real, así que el lote entero tarda aprox. la suma de todas
 *                          las duraciones dividida entre la concurrencia)
 *   --width/--height       Tamaño del viewport grabado (por defecto: 1920x1080, la resolución
 *                          nativa del módulo)
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);
const { parseTempoByMeasure, analyzeTempoProgression } = require('./lib/tempo-progression');

const AUDIO_EXT_RE = /\.(m4a|mp3|wav|aac)$/i;
const XML_EXT_RE = /\.xml$/i;

// Avisa si la progresión de tempo del XML tiene algún salto de BPM o de compases que no encaja
// con el patrón del resto del tema — ver scripts/lib/tempo-progression.js. Antes de grabar nada,
// así el aviso queda arriba del todo del log y no se pierde entre el resto de líneas. Con
// strict=true, un aviso "grave" (severity 'warn') aborta ANTES de abrir el navegador — nunca deja
// generar un vídeo silenciosamente sobre un XML con la progresión rota.
function checkTempoProgression(xmlPath, log, strict) {
  const xmlText = fs.readFileSync(xmlPath, 'utf8');
  const { issues, note } = analyzeTempoProgression(parseTempoByMeasure(xmlText));
  if (note) { log(`tempo: ${note}`); return; }
  issues.forEach((i) => log(`${i.severity === 'warn' ? '⚠ POSIBLE ERROR DE TEMPO' : 'ℹ tempo'}: ${i.message}`));
  const grave = issues.filter((i) => i.severity === 'warn');
  if (strict && grave.length) {
    throw new Error(`--strict: ${grave.length} aviso(s) grave(s) de progresión de tempo — revisa el XML antes de generar el vídeo (usa check-tempo-xml.js para el detalle, o quita --strict para generarlo de todas formas).`);
  }
}

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
  catch (e) { throw new Error('No se encuentra "ffmpeg" en el PATH. Instálalo antes de continuar.'); }
}

// Ver el comentario equivalente en generate-triad-videos.js: se lee con ffmpeg directamente
// sobre el archivo en vez de audioEl.duration en el navegador (algunos encoders AAC hacen que
// el navegador reporte más duración de la real).
async function getAudioDurationSeconds(audioPath) {
  try {
    await execFileP('ffmpeg', ['-i', audioPath]);
    throw new Error('ffmpeg no devolvió metadata'); // no debería llegar aquí
  } catch (e) {
    const stderr = e.stderr || '';
    const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (!m) throw new Error('No se pudo leer la duración de ' + audioPath);
    return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]);
  }
}

// Empareja un XML con su audio en modo --xml-dir. BiaB no siempre exporta ambos con el mismo
// nombre exacto: lo habitual es que el audio lleve un sufijo extra, típicamente "_Render"
// (PopBalladProgresivo40-70-incr2.XML + PopBalladProgresivo40-70-incr2_Render.m4a — caso real,
// ago 2026). Primero se prueba el nombre exacto; si no, un prefijo compartido con el otro nombre
// (en cualquiera de los dos sentidos), exigiendo que lo que sobra empiece por un separador
// (_, -, espacio…) para no confundir "tema1" con "tema10".
function findMatchingAudio(files, xmlBase) {
  const candidates = files.filter((f) => AUDIO_EXT_RE.test(f));
  const exact = candidates.find((f) => path.parse(f).name === xmlBase);
  if (exact) return exact;
  const boundaryOk = (rest) => rest === '' || !/^[a-z0-9]/i.test(rest);
  const prefixMatches = candidates.filter((f) => {
    const b = path.parse(f).name;
    if (b.length > xmlBase.length && b.startsWith(xmlBase)) return boundaryOk(b.slice(xmlBase.length));
    if (xmlBase.length > b.length && xmlBase.startsWith(b)) return boundaryOk(xmlBase.slice(b.length));
    return false;
  });
  if (prefixMatches.length === 1) return prefixMatches[0];
  if (prefixMatches.length > 1) console.warn(`⚠ ${xmlBase}: varios audios podrían corresponder (${prefixMatches.join(', ')}) — renómbralos sin ambigüedad.`);
  return null;
}

// BPM = número final del nombre de archivo (sin extensión), ej. "Rock E12STSS_Render60" → 60.
function bpmFromFilename(file) {
  const name = path.parse(file).name;
  const m = name.match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : null;
}

// Detectada en la tanda "ritmoRock" (ago 2026): los .m4a exportados de BiaB a distintos tempos
// llevan un tramo de silencio real pegado al final —y crece con el BPM (11s a 60bpm, 5+min a
// 160bpm)—, probablemente porque BiaB renderiza a una longitud de pista fija en vez de recortar
// al nº de compases real. audioDuration (duración del contenedor, vía ffmpeg -i) incluye ese
// silencio, así que si se usa tal cual para la duración del vídeo, el nº de compases (bars) y el
// tiempo de grabación, el resultado es un vídeo/audio correctos en longitud pero con minutos de
// silencio pegados al final (el bug que reportó Alberto). Aquí buscamos dónde empieza el ÚLTIMO
// tramo de silencio y, si llega hasta el final del archivo, usamos ese punto como duración real
// del contenido en vez de la duración del contenedor.
async function detectContentDurationSeconds(audioPath, containerDuration) {
  const { stderr } = await execFileP('ffmpeg', [
    '-i', audioPath, '-af', 'silencedetect=noise=-40dB:d=1', '-f', 'null', '-',
  ]);
  const starts = [...stderr.matchAll(/silence_start:\s*([\d.]+)/g)].map((m) => parseFloat(m[1]));
  const ends = [...stderr.matchAll(/silence_end:\s*([\d.]+)/g)].map((m) => parseFloat(m[1]));
  if (!starts.length) return containerDuration; // sin silencios detectados: nada que recortar
  const lastStart = starts[starts.length - 1];
  const lastEnd = ends.length >= starts.length ? ends[ends.length - 1] : containerDuration; // sin silence_end: llega al EOF
  const reachesEnd = (containerDuration - lastEnd) < 0.5;
  const trimmedSec = containerDuration - lastStart;
  if (reachesEnd && trimmedSec >= 3) return Math.min(containerDuration, lastStart + 1.5); // +1.5s de margen (cola/reverb)
  return containerDuration;
}

// Corrección automática de sincronización (ago 2026): trimOffsetSec se basa en un timestamp
// medido en el navegador (evento 'playing' de audioEl) que resultó tener ruido de ±0.3-0.5s de
// una toma a otra —imperceptible a tempos bajos, pero muy visible a 160bpm, donde un solo tiempo
// dura 375ms (caso reportado por Alberto: la claqueta seguía encendida en el último tiempo varios
// cientos de ms después de que la música ya hubiera arrancado). En vez de fiarse solo de ese
// timestamp, se mide el desfase real en el propio .mp4 ya generado y se corrige el recorte con
// ese dato — ver SYNC_LONG_GAP_SEC/detectAudioOnsetNear/detectOverlayFadeNear más abajo.
const SYNC_LONG_GAP_SEC = 0.22; // hueco típico del click de conteo; un silencio musical breve no llega a esto
const SYNC_TOLERANCE_SEC = 0.05;
const SYNC_MAX_CORRECTION_SEC = 2; // por seguridad: no aplicar una "corrección" descabellada si la medición falla

// Busca, cerca de `nearSec` (el instante teórico en que debería acabar la claqueta, según
// config), el hueco de silencio "largo" (>= SYNC_LONG_GAP_SEC) cuyo final está MÁS CERCA de
// nearSec — ese es el patrón del click de conteo (blips cortos separados por huecos largos y
// regulares), y nearSec (derivado de bpm/introBars/offsetMs) predice ese instante con muy poco
// margen de error (decenas de ms) porque el conteo lo genera la propia app a tempo fijo.
// Antes se cogía el ÚLTIMO hueco largo dentro de toda la ventana [0, nearSec+windowAfterSec]: con
// pistas donde la primera nota real queda seguida de un silencio breve antes de la segunda (algo
// habitual en un rock ballad lento), ese hueco intermedio puede medir justo por encima de
// SYNC_LONG_GAP_SEC —sobre todo tras el reencode a AAC, que desplaza los límites unos ms— y al
// ser más tardío "ganaba" sobre el hueco real del click, moviendo el punto detectado un tiempo
// entero más tarde de lo real (bug real, ago 2026: la corrección automática "convergía" sobre ese
// hueco equivocado y dejaba el vídeo sistemáticamente un tiempo por detrás del audio real —
// reportado por Alberto: el "4" de la cuenta atrás seguía iluminado cuando ya sonaba el primer
// golpe). Coger el hueco más cercano a nearSec en vez del más tardío evita ese falso positivo.
async function detectAudioOnsetNear(mp4Path, nearSec, windowAfterSec) {
  const searchSec = nearSec + windowAfterSec;
  let stderr = '';
  try {
    const r = await execFileP('ffmpeg', [
      '-i', mp4Path, '-t', String(searchSec),
      '-af', 'highpass=f=60,silencedetect=noise=-30dB:d=0.05',
      '-f', 'null', '-',
    ], { maxBuffer: 1024 * 1024 * 64 });
    stderr = r.stderr || '';
  } catch (e) { stderr = e.stderr || ''; }
  const starts = [...stderr.matchAll(/silence_start:\s*([0-9.]+)/g)].map((m) => parseFloat(m[1]));
  const ends = [...stderr.matchAll(/silence_end:\s*([0-9.]+)/g)].map((m) => parseFloat(m[1]));
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < starts.length; i++) {
    const end = ends[i] !== undefined ? ends[i] : searchSec;
    if (end - starts[i] < SYNC_LONG_GAP_SEC || end > searchSec) continue;
    const dist = Math.abs(end - nearSec);
    if (dist < bestDist) { best = end; bestDist = dist; }
  }
  return best;
}

// Fin real de la claqueta: se mide la luminancia media de un recorte fijo de pantalla sobre la
// etiqueta "GET READY" (#tvCountdown .tv-countdown-lbl en guitarvisualizer.html — color
// #aab3c0 constante, no depende del colorPreset). Esa etiqueta está SIEMPRE en la misma posición
// mientras dura la claqueta y desaparece del todo al terminar, así que su luminancia es una señal
// limpia de un único vencimiento — a diferencia de un detector de escena genérico, que en las
// primeras pruebas confundía el simple cambio de DÍGITO del contador (cada tiempo, "2"→"1") con
// el final real de la claqueta y daba un punto varios cientos de ms antes de tiempo (bug real,
// ago 2026: la "corrección" automática convergía sobre esa señal equivocada).
async function detectOverlayFadeNear(mp4Path, nearSec, windowAfterSec) {
  const searchSec = nearSec + windowAfterSec;
  const { stdout } = await execFileP('ffmpeg', [
    '-i', mp4Path, '-t', String(searchSec),
    '-vf', 'crop=320:30:800:745,signalstats,metadata=print:file=-',
    '-f', 'null', '-',
  ], { maxBuffer: 1024 * 1024 * 64 });
  const samples = [];
  let pts = null;
  for (const line of stdout.split('\n')) {
    const pm = line.match(/pts_time:([0-9.]+)/);
    if (pm) { pts = parseFloat(pm[1]); continue; }
    const ym = line.match(/YAVG=([0-9.]+)/);
    if (ym && pts != null) samples.push({ t: pts, y: parseFloat(ym[1]) });
  }
  if (samples.length < 4) return null;
  const ys = samples.map((s) => s.y);
  const hi = Math.max(...ys), lo = Math.min(...ys);
  if (hi - lo < 10) return null; // sin contraste claro entre "etiqueta visible" y "fondo vacío"
  const threshold = (hi + lo) / 2;
  for (let i = 0; i < samples.length - 2; i++) {
    if (samples[i].y >= threshold && samples[i + 1].y < threshold && samples[i + 2].y < threshold) {
      const a = samples[i], b = samples[i + 1]; // interpolación lineal entre la última muestra alta y la primera baja
      return a.t + ((a.y - threshold) / (a.y - b.y)) * (b.t - a.t);
    }
  }
  return null;
}

// Mezcla el vídeo silencioso con el audio real y corrige la sincronización automáticamente
// (ver detectAudioOnsetNear/detectOverlayFadeNear más arriba). Compartida por runOne (modo BPM
// fijo) y runOneXml (modo tempo progresivo) — la única diferencia entre ambos es CÓMO se calcula
// expectedContentSec (el instante teórico en que debería acabar la claqueta), no qué se hace con
// ese número una vez calculado.
async function muxAndSync({ videoObj, tag, log, recordStartAt, playStartAt, audioPath, extraSec, outDir, appVersion, expectedContentSec }) {
  const silentPath = await videoObj.path();
  const trimOffsetSec = Math.max(0, ((playStartAt || recordStartAt) - recordStartAt) / 1000);

  const outPath = path.join(outDir, `${tag}.mp4`);
  const mux = (trimSec) => execFileP('ffmpeg', [
    '-y',
    '-i', silentPath,
    '-i', audioPath,
    '-filter_complex', `[0:v]trim=start=${trimSec.toFixed(3)},setpts=PTS-STARTPTS[v];[1:a]apad=pad_dur=${extraSec}[a]`,
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20',
    '-c:a', 'aac', '-b:a', '192k',
    '-metadata', `comment=Generado con Guitar Visualizer v${appVersion}`,
    '-shortest',
    outPath,
  ]);

  log(`mezclando audio con ffmpeg (recortando ${trimOffsetSec.toFixed(2)}s de arranque)…`);
  await mux(trimOffsetSec);

  // Comprobación + corrección de sincronización (ver detectAudioOnsetNear/detectOverlayFadeNear
  // más arriba). Solo aplica si hay claqueta (introBars>0) — sin ella no hay etiqueta que medir.
  if (expectedContentSec > 0) {
    let curTrim = trimOffsetSec;
    // Cada pasada corrige por el desfase medido, pero esa propia medición tiene su margen de
    // error — una sola pasada podía dejar un resto por encima de la propia tolerancia. Se repite
    // hasta entrar en tolerancia o agotar intentos.
    for (let attempt = 1; attempt <= 3; attempt++) {
      const audioOnset = await detectAudioOnsetNear(outPath, expectedContentSec, 3);
      const videoChange = audioOnset != null ? await detectOverlayFadeNear(outPath, expectedContentSec, 4) : null;
      if (audioOnset == null || videoChange == null) {
        log('⚠ no se pudo medir la sincronización automáticamente — revisar a mano si hay dudas');
        break;
      }
      const gap = audioOnset - videoChange;
      log(`comprobación de sync (intento ${attempt}): audio en ${audioOnset.toFixed(2)}s, vídeo cambia en ${videoChange.toFixed(2)}s (desfase ${(gap * 1000).toFixed(0)}ms)`);
      if (Math.abs(gap) <= SYNC_TOLERANCE_SEC) break;
      if (Math.abs(gap) >= SYNC_MAX_CORRECTION_SEC) {
        log('⚠ desfase medido demasiado grande para corregir automáticamente — revisar a mano');
        break;
      }
      // trim=start=X desplaza el contenido a "raw_time - X" en la salida: recortar MÁS (subir X)
      // adelanta el contenido (tiempos de salida más pequeños), no lo retrasa — de ahí el signo
      // negativo. Con el signo cambiado (bug real, ago 2026) cada intento empeoraba el desfase.
      curTrim = Math.max(0, curTrim - gap);
      log(`corrigiendo recorte de arranque: → ${curTrim.toFixed(3)}s…`);
      await mux(curTrim);
      if (attempt === 3) log('⚠ sigue fuera de tolerancia tras 3 intentos — revisar a mano');
    }
  }

  log(`✓ ${outPath}`);
  return outPath;
}

async function runOne({ appUrl, audioPath, bpm, cfg, extraSec, width, height, outDir, tmpDir }) {
  const tag = path.parse(audioPath).name;
  const log = (msg) => console.log(`[${tag}] ${msg}`);

  const audioDuration = await getAudioDurationSeconds(audioPath);
  const contentDuration = await detectContentDurationSeconds(audioPath, audioDuration);
  if (contentDuration < audioDuration - 1) {
    log(`⚠ silencio final detectado: recorto ${(audioDuration - contentDuration).toFixed(1)}s (contenido real ${contentDuration.toFixed(1)}s de ${audioDuration.toFixed(1)}s)`);
  }
  log(`bpm=${bpm} · compás=${cfg.beats || 4}/4 · audio ${contentDuration.toFixed(1)}s`);

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: { dir: tmpDir, size: { width, height } },
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => log('pageerror: ' + e.message));
  page.on('console', (m) => {
    // Ruido esperado: la app pinga scripts/server.js (servidor opcional del botón "Generar
    // vídeos por lotes" de la UI) cada 8s; no lo levantamos aquí y el fallo ya se maneja solo
    // (try/catch, ver batchCheckServer) — sin filtrarlo, un vídeo de 10 min deja ~75 líneas de
    // basura por trabajo y tapa cualquier error real.
    if (m.type() === 'error' && !/ERR_CONNECTION_REFUSED/.test(m.text())) log('console.error: ' + m.text());
  });

  // Ver el comentario largo en scripts/lib/batch-sessions.js sobre por qué el timestamp de
  // arranque se captura DENTRO del navegador y no con Date.now() en Node tras el await.
  const recordStartAt = Date.now();
  let playStartAt = null;
  let stepError = null;
  let appVersion = 'unknown';
  try {
    log('cargando app…');
    await page.goto(appUrl);
    appVersion = await page.evaluate(() => (typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'unknown'));

    log('configurando ejercicio de ritmo…');
    await page.evaluate((c) => {
      setExerciseType('rhythm');
      const setVal = (id, v) => { if (v === undefined || v === null) return; const e = document.getElementById(id); if (e) e.value = String(v); };
      setVal('tvCfgStyle', c.style); setVal('tvCfgSub', c.substyle);
      setVal('tvCfgBeats', c.beats); setVal('bpmInput', c.bpm);
      setVal('introCount', c.introBars); setVal('offsetMs', c.offsetMs);
      setVal('tvCfgColorPreset', c.colorPreset); setVal('tvCfgLang', c.lang);
      if (typeof updateIntroLbl === 'function') updateIntroLbl();
      if (typeof tvSync === 'function') tvSync();
    }, { style: cfg.style, substyle: cfg.substyle, beats: cfg.beats || 4, bpm, introBars: cfg.introBars || 0, offsetMs: cfg.offsetMs || 0, colorPreset: cfg.colorPreset, lang: cfg.lang });

    log('cargando audio…');
    await page.setInputFiles('#audioPicker', [audioPath]);
    await page.waitForFunction(() => {
      const el = document.getElementById('audioStatus');
      return el && el.classList.contains('ok');
    }, null, { timeout: 20000 });

    // Nº de compases real: NO se delega en tvComputeBars() (botón "Calcular desde el audio"),
    // porque esa función lee audioEl.duration —la duración del CONTENEDOR, que en estos archivos
    // incluye el silencio final baqueado por BiaB (ver detectContentDurationSeconds arriba)—.
    // Se replica su misma fórmula pero con contentDuration (el contenido real ya recortado).
    {
      const beats = cfg.beats || 4;
      const barSec = (60 / bpm) * beats;
      const introSec = (cfg.introBars || 0) * beats * (60 / bpm);
      const offSec = (cfg.offsetMs || 0) / 1000;
      const bars = Math.max(1, Math.round((contentDuration - introSec - offSec) / barSec));
      await page.evaluate((barsVal) => {
        const inp = document.getElementById('tvCfgBars'); if (inp) inp.value = barsVal;
        if (typeof tvSync === 'function') tvSync();
      }, bars);
    }

    await page.evaluate(() => {
      showTab('player');
      if (!document.body.classList.contains('presentation')) togglePresentation();
      stopAll();
    });
    await page.waitForTimeout(300); // deja asentar el layout de presentación

    const total = contentDuration + extraSec;
    log(`duración objetivo: ${total.toFixed(1)}s (contenido ${contentDuration.toFixed(1)}s + ${extraSec}s extra)`);

    playStartAt = await page.evaluate(() => new Promise((resolve) => {
      const stamp = () => resolve(performance.timeOrigin + performance.now());
      startIt();
      if (!audioEl.paused && audioEl.currentTime > 0) { stamp(); return; }
      const onPlaying = () => { audioEl.removeEventListener('playing', onPlaying); stamp(); };
      audioEl.addEventListener('playing', onPlaying);
      setTimeout(stamp, 2000); // failsafe: no colgarse si el evento no llega
    }));
    log(`grabando… (arranque: ${((playStartAt - recordStartAt) / 1000).toFixed(2)}s de setup a recortar)`);
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

  const beats = cfg.beats || 4;
  const expectedContentSec = (cfg.introBars || 0) * beats * (60 / bpm) + (cfg.offsetMs || 0) / 1000;
  return muxAndSync({ videoObj, tag, log, recordStartAt, playStartAt, audioPath, extraSec, outDir, appVersion, expectedContentSec });
}

// Modo tempo progresivo: un XML con mapa de tempo (<sound tempo> por compás, exportado de BiaB
// — ver el bloque MÓDULO RITMO/TEMPO en guitarvisualizer.html, ahora consciente de _tempoMap) +
// un único audio = un único vídeo. A diferencia de runOne, el BPM/nº de compases/duración NO se
// calculan aquí: se dejan en manos del propio motor (tvGetDuration(), tras cargar el XML), que
// ya sabe seguir los cambios de tempo compás a compás — replicar esa matemática en Node sería la
// forma más fácil de que este script y la app se desincronizaran entre sí con el tiempo.
async function runOneXml({ appUrl, xmlPath, audioPath, cfg, extraSec, width, height, outDir, tmpDir, tag, strict }) {
  const log = (msg) => console.log(`[${tag}] ${msg}`);

  const audioDuration = await getAudioDurationSeconds(audioPath);
  const contentDuration = await detectContentDurationSeconds(audioPath, audioDuration);
  if (contentDuration < audioDuration - 1) {
    log(`⚠ silencio final detectado: recorto ${(audioDuration - contentDuration).toFixed(1)}s (contenido real ${contentDuration.toFixed(1)}s de ${audioDuration.toFixed(1)}s)`);
  }
  checkTempoProgression(xmlPath, log, strict);

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: { dir: tmpDir, size: { width, height } },
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => log('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_CONNECTION_REFUSED/.test(m.text())) log('console.error: ' + m.text());
  });

  const recordStartAt = Date.now();
  let playStartAt = null;
  let stepError = null;
  let appVersion = 'unknown';
  let introBars = 0, baseBpm = 0, beats = cfg.beats || 4;
  try {
    log('cargando app…');
    await page.goto(appUrl);
    appVersion = await page.evaluate(() => (typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'unknown'));

    log('cargando XML (tempo progresivo)…');
    await page.setInputFiles('#xmlPicker', [xmlPath]);
    await page.waitForFunction(() => {
      const t3 = document.getElementById('t3');
      const err = document.getElementById('xmlStatus');
      if (err && err.classList.contains('err')) throw new Error('Error al leer el MusicXML');
      return t3 && t3.textContent && t3.textContent.length > 0;
    }, null, { timeout: 20000 });

    log('configurando ejercicio de ritmo…');
    await page.evaluate((c) => {
      setExerciseType('rhythm');
      const setVal = (id, v) => { if (v === undefined || v === null) return; const e = document.getElementById(id); if (e) e.value = String(v); };
      setVal('tvCfgStyle', c.style); setVal('tvCfgSub', c.substyle);
      setVal('tvCfgBeats', c.beats || 4);
      setVal('tvCfgColorPreset', c.colorPreset); setVal('tvCfgLang', c.lang);
      // introBars/offsetMs: el XML ya los ha rellenado al cargarlo (intro detectada por el
      // primer acorde de referencia, offset a 0) — solo se pisan si se han pasado explícitos.
      if (c.introBars !== undefined) setVal('introCount', c.introBars);
      if (c.offsetMs !== undefined) setVal('offsetMs', c.offsetMs);
      if (typeof updateIntroLbl === 'function') updateIntroLbl();
      if (typeof tvSync === 'function') tvSync();
    }, { style: cfg.style, substyle: cfg.substyle, beats: cfg.beats, colorPreset: cfg.colorPreset, introBars: cfg.introBars, offsetMs: cfg.offsetMs, lang: cfg.lang });

    log('cargando audio…');
    await page.setInputFiles('#audioPicker', [audioPath]);
    await page.waitForFunction(() => {
      const el = document.getElementById('audioStatus');
      return el && el.classList.contains('ok');
    }, null, { timeout: 20000 });

    await page.evaluate(() => {
      showTab('player');
      if (!document.body.classList.contains('presentation')) togglePresentation();
      stopAll();
    });
    await page.waitForTimeout(300); // deja asentar el layout de presentación

    const readBack = await page.evaluate(() => ({
      dur: tvGetDuration(),
      introBars: parseInt(document.getElementById('introCount').value) || 0,
      bpm: parseFloat(document.getElementById('bpmInput').value) || 0,
      beats: parseInt(document.getElementById('tvCfgBeats').value) || 4,
      bars: parseInt(document.getElementById('tvCfgBars').value) || 0,
      hasTempoMap: !!(window._tempoMap && Object.keys(window._tempoMap).length > 1),
    }));
    introBars = readBack.introBars; baseBpm = readBack.bpm; beats = readBack.beats;
    if (!readBack.hasTempoMap) log('⚠ el XML no trae mapa de tempo (o solo un valor) — se generará como BPM fijo normal, revisa si es lo esperado');
    log(`bpm base=${baseBpm} (del XML) · compás=${beats}/4 · intro=${introBars} compases · ${readBack.bars} compases · duración teórica ${readBack.dur.toFixed(1)}s`);

    const total = Math.max(readBack.dur, contentDuration) + extraSec;
    log(`duración objetivo: ${total.toFixed(1)}s (teórica ${readBack.dur.toFixed(1)}s · audio ${contentDuration.toFixed(1)}s + ${extraSec}s extra)`);

    playStartAt = await page.evaluate(() => new Promise((resolve) => {
      const stamp = () => resolve(performance.timeOrigin + performance.now());
      startIt();
      if (!audioEl.paused && audioEl.currentTime > 0) { stamp(); return; }
      const onPlaying = () => { audioEl.removeEventListener('playing', onPlaying); stamp(); };
      audioEl.addEventListener('playing', onPlaying);
      setTimeout(stamp, 2000); // failsafe: no colgarse si el evento no llega
    }));
    log(`grabando… (arranque: ${((playStartAt - recordStartAt) / 1000).toFixed(2)}s de setup a recortar)`);
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

  const expectedContentSec = baseBpm > 0 ? introBars * beats * (60 / baseBpm) : 0;
  return muxAndSync({ videoObj, tag, log, recordStartAt, playStartAt, audioPath, extraSec, outDir, appVersion, expectedContentSec });
}

async function runPool(jobs, concurrency, worker) {
  const results = [];
  let idx = 0;
  async function next() {
    while (idx < jobs.length) {
      const myIdx = idx++;
      try { results[myIdx] = { ok: true, value: await worker(jobs[myIdx]) }; }
      catch (e) { results[myIdx] = { ok: false, error: e }; }
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, jobs.length) }, next);
  await Promise.all(workers);
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dir && !args.xml && !args['xml-dir']) {
    console.error('Uso: node scripts/render-rhythm-video.js --dir <carpeta-con-audios-y-config.json> [opciones]');
    console.error('  o (tempo progresivo): node scripts/render-rhythm-video.js --xml <archivo.xml> --audio <archivo.m4a> [opciones]');
    console.error('  o (tempo progresivo, varios temas): node scripts/render-rhythm-video.js --xml-dir <carpeta-con-pares-xml+audio> [opciones]');
    process.exit(1);
  }
  await waitFfmpeg();

  const repoRoot = path.resolve(__dirname, '..');
  const appPath = path.resolve(repoRoot, args.app || 'guitarvisualizer.html');
  const outDir = path.resolve(args.out || './video-out');
  const width = args.width ? parseInt(args.width, 10) : 1920;
  const height = args.height ? parseInt(args.height, 10) : 1080;

  if (!fs.existsSync(appPath)) { console.error('No existe: ' + appPath); process.exit(1); }

  // ---- Modo tempo progresivo POR LOTES (--xml-dir): una carpeta con varios pares XML+audio (el
  // mismo nombre base, p.ej. tema1.xml + tema1.m4a, tema2.xml + tema2.m4a…) — un vídeo por par,
  // generados DE UNO EN UNO. Nunca en paralelo: cada uno graba en tiempo real con Playwright,
  // solaparlos no ahorra tiempo real y sí arriesga interferencias entre grabaciones (mismo motivo
  // por el que --dir por defecto ya usa concurrency=1). config.json en la carpeta (opcional,
  // mismas claves que el modo --xml de un único tema) se aplica a TODOS los pares; los flags de
  // línea de comandos (--style/--substyle/…), si se pasan, pisan lo que traiga config.json.
  if (args['xml-dir']) {
    const dir = path.resolve(args['xml-dir']);
    if (!fs.existsSync(dir)) { console.error('No existe: ' + dir); process.exit(1); }

    const configPath = path.join(dir, 'config.json');
    const fileCfg = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
    const extraSec = args.extra !== undefined ? parseFloat(args.extra) : (fileCfg.extraSec != null ? fileCfg.extraSec : 2);
    const cfg = {
      style: args.style || fileCfg.style,
      substyle: args.substyle || fileCfg.substyle,
      beats: args.beats ? parseInt(args.beats, 10) : fileCfg.beats,
      colorPreset: args['color-preset'] || fileCfg.colorPreset,
      lang: args.lang || fileCfg.lang,
      introBars: args['intro-bars'] !== undefined ? parseInt(args['intro-bars'], 10) : undefined,
      offsetMs: args['offset-ms'] !== undefined ? parseFloat(args['offset-ms']) : undefined,
    };

    const files = fs.readdirSync(dir);
    const xmlFiles = files.filter((f) => XML_EXT_RE.test(f)).sort();
    if (!xmlFiles.length) { console.error('No hay ningún .xml en ' + dir); process.exit(1); }

    const jobs = [];
    for (const xf of xmlFiles) {
      const base = path.parse(xf).name;
      const af = findMatchingAudio(files, base);
      if (!af) { console.warn(`⚠ ${xf}: no se encontró un audio a juego (${base}.m4a/.mp3/… o ${base}_Render.m4a/…) — se omite.`); continue; }
      jobs.push({ xmlPath: path.join(dir, xf), audioPath: path.join(dir, af), tag: base });
    }
    if (!jobs.length) { console.error('Ningún XML tenía un audio emparejado en ' + dir); process.exit(1); }

    fs.mkdirSync(outDir, { recursive: true });
    const appUrl = 'file://' + appPath;

    console.log(`Generando ${jobs.length} vídeo(s) de tempo progresivo, de uno en uno…`);
    const t0 = Date.now();
    let ok = 0;
    const failed = [];
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      console.log(`\n[${i + 1}/${jobs.length}] ${job.tag}`);
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-rhythm-'));
      try {
        await runOneXml({ appUrl, xmlPath: job.xmlPath, audioPath: job.audioPath, cfg, extraSec, width, height, outDir, tmpDir, tag: job.tag, strict: !!args.strict });
        ok++;
      } catch (e) {
        console.error(`✗ ${job.tag}: ${e.message}`);
        failed.push(job.tag);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }
    console.log(`\nHecho en ${((Date.now() - t0) / 1000).toFixed(1)}s: ${ok}/${jobs.length} vídeos generados en ${outDir}`);
    if (failed.length) console.error(`  ✗ fallaron: ${failed.join(', ')}`);
    process.exitCode = failed.length ? 1 : 0;
    return;
  }

  // ---- Modo tempo progresivo (--xml): un XML + un audio = un único vídeo. No toca nada del
  // modo --dir de abajo (BPM fijo por nombre de archivo) — son caminos totalmente separados. ----
  if (args.xml) {
    if (!args.audio) { console.error('--xml requiere --audio.'); process.exit(1); }
    const xmlPath = path.resolve(args.xml);
    const audioPath = path.resolve(args.audio);
    for (const p of [xmlPath, audioPath]) {
      if (!fs.existsSync(p)) { console.error('No existe: ' + p); process.exit(1); }
    }
    const extraSec = args.extra !== undefined ? parseFloat(args.extra) : 2;
    const cfg = {
      style: args.style,
      substyle: args.substyle,
      beats: args.beats ? parseInt(args.beats, 10) : undefined,
      colorPreset: args['color-preset'],
      lang: args.lang,
      introBars: args['intro-bars'] !== undefined ? parseInt(args['intro-bars'], 10) : undefined,
      offsetMs: args['offset-ms'] !== undefined ? parseFloat(args['offset-ms']) : undefined,
    };
    const tag = args.name ? String(args.name) : path.parse(audioPath).name;

    fs.mkdirSync(outDir, { recursive: true });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-rhythm-'));
    const appUrl = 'file://' + appPath;

    console.log(`Generando vídeo de tempo progresivo (${tag})…`);
    const t0 = Date.now();
    try {
      const outPath = await runOneXml({ appUrl, xmlPath, audioPath, cfg, extraSec, width, height, outDir, tmpDir, tag, strict: !!args.strict });
      console.log(`\nHecho en ${((Date.now() - t0) / 1000).toFixed(1)}s: ${outPath}`);
    } catch (e) {
      console.error(`✗ ${tag}: ${e.message}`);
      process.exitCode = 1;
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    return;
  }

  // ---- Modo BPM fijo (--dir): sin tocar — carpeta de audios a distinto tempo fijo por nombre
  // de archivo, tal como se usaba antes de este cambio. ----
  const dir = path.resolve(args.dir);
  const concurrency = args.concurrency ? parseInt(args.concurrency, 10) : 1;
  if (!fs.existsSync(dir)) { console.error('No existe: ' + dir); process.exit(1); }

  const configPath = path.join(dir, 'config.json');
  if (!fs.existsSync(configPath)) { console.error('Falta ' + configPath); process.exit(1); }
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const extraSec = cfg.extraSec != null ? cfg.extraSec : 2;

  const audioFiles = fs.readdirSync(dir).filter((f) => AUDIO_EXT_RE.test(f)).sort();
  if (!audioFiles.length) { console.error('No hay audios (.m4a/.mp3/.wav/.aac) en ' + dir); process.exit(1); }

  const jobs = [];
  for (const f of audioFiles) {
    const bpm = bpmFromFilename(f);
    if (!bpm) { console.warn(`⚠ ${f}: no se pudo leer el BPM del nombre de archivo — se omite.`); continue; }
    jobs.push({ audioPath: path.join(dir, f), bpm });
  }
  if (!jobs.length) { console.error('Ningún archivo tenía un BPM reconocible en el nombre.'); process.exit(1); }

  fs.mkdirSync(outDir, { recursive: true });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-rhythm-'));
  const appUrl = 'file://' + appPath;

  console.log(`Generando ${jobs.length} vídeos (concurrencia=${concurrency})…`);
  const t0 = Date.now();
  const results = await runPool(jobs, concurrency, (job) =>
    runOne({ appUrl, audioPath: job.audioPath, bpm: job.bpm, cfg, extraSec, width, height, outDir, tmpDir })
  );

  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok);
  console.log(`\nHecho en ${((Date.now() - t0) / 1000).toFixed(1)}s: ${ok}/${jobs.length} vídeos generados en ${outDir}`);
  fail.forEach((f, i) => console.error(`  ✗ job ${i}: ${f.error && f.error.message}`));

  fs.rmSync(tmpDir, { recursive: true, force: true });
  process.exitCode = fail.length ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
