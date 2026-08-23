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
 * Opciones:
 *   --app <path>         Ruta al HTML de la app (por defecto: guitarvisualizer.html)
 *   --dir <path>          Carpeta con los audios + config.json (obligatorio)
 *   --out <dir>            Carpeta de salida (por defecto: ./video-out)
 *   --concurrency <n>      Vídeos en paralelo (por defecto: 1 — cada uno graba en tiempo real,
 *                          así que el lote entero tarda aprox. la suma de todas las duraciones
 *                          dividida entre la concurrencia)
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

const AUDIO_EXT_RE = /\.(m4a|mp3|wav|aac)$/i;

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
      setVal('tvCfgColorPreset', c.colorPreset);
      if (typeof updateIntroLbl === 'function') updateIntroLbl();
      if (typeof tvSync === 'function') tvSync();
    }, { style: cfg.style, substyle: cfg.substyle, beats: cfg.beats || 4, bpm, introBars: cfg.introBars || 0, offsetMs: cfg.offsetMs || 0, colorPreset: cfg.colorPreset });

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
  const silentPath = await videoObj.path();
  const trimOffsetSec = Math.max(0, ((playStartAt || recordStartAt) - recordStartAt) / 1000);

  const outPath = path.join(outDir, `${tag}.mp4`);
  log(`mezclando audio con ffmpeg (recortando ${trimOffsetSec.toFixed(2)}s de arranque)…`);
  await execFileP('ffmpeg', [
    '-y',
    '-i', silentPath,
    '-i', audioPath,
    '-filter_complex', `[0:v]trim=start=${trimOffsetSec.toFixed(3)},setpts=PTS-STARTPTS[v];[1:a]apad=pad_dur=${extraSec}[a]`,
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20',
    '-c:a', 'aac', '-b:a', '192k',
    '-metadata', `comment=Generado con Guitar Visualizer v${appVersion}`,
    '-shortest',
    outPath,
  ]);
  log(`✓ ${outPath}`);
  return outPath;
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
  if (!args.dir) {
    console.error('Uso: node scripts/render-rhythm-video.js --dir <carpeta-con-audios-y-config.json> [opciones]');
    process.exit(1);
  }
  await waitFfmpeg();

  const repoRoot = path.resolve(__dirname, '..');
  const appPath = path.resolve(repoRoot, args.app || 'guitarvisualizer.html');
  const dir = path.resolve(args.dir);
  const outDir = path.resolve(args.out || './video-out');
  const width = args.width ? parseInt(args.width, 10) : 1920;
  const height = args.height ? parseInt(args.height, 10) : 1080;
  const concurrency = args.concurrency ? parseInt(args.concurrency, 10) : 1;

  if (!fs.existsSync(appPath)) { console.error('No existe: ' + appPath); process.exit(1); }
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
