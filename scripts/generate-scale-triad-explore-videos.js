#!/usr/bin/env node
/*
 * Genera "Tríadas dentro de una posición de escala" (asSendToEditorTriadExplore en
 * guitarvisualizer.html) — sustituto de la vieja serie "Domina las tríadas | Escala de X | Forma
 * de Y" grabada a mano. Para una escala/tónica y CADA posición CAGED (por defecto las 5):
 *  - Una única posición fija durante todo el vídeo (nunca se mueve de zona), con la escala
 *    completa de fondo en gris y la tónica marcada con anillo dorado.
 *  - Unos compases de intro (clic + escala completa quieta, sin acorde) antes de empezar.
 *  - Tríadas SIEMPRE en el mismo sentido: cuerdas 3-2-1 primero, subiendo hacia 6-5-4.
 *
 * Dos modos, igual que generate-scale-arpeggio-videos.js:
 *  - MODO TEMA (--xml): usa un MusicXML real (con SUS acordes y tempo reales) + su audio a
 *    juego — el acorde de cada compás se lee tal cual del XML. Si un acorde vuelve a aparecer
 *    más adelante en el tema, se continúa por donde se dejaron sus tríadas la vez anterior (no
 *    se repite desde la primera) — con las repeticiones suficientes acaban saliendo TODAS las
 *    que quepan en la posición. --bpm se ignora (el tempo lo trae el XML); el vídeo dura lo que
 *    dure el audio completo (+ --extra), como cualquier otro ejercicio de tema real.
 *  - MODO DIAPOSITIVAS (sin --xml, por defecto): progresión sintética de los 7 grados
 *    diatónicos, un click/audio compartido — cada acorde ocupa tantos compases como tríadas
 *    suyas quepan enteras en la posición (normalmente 1-3), se muestran todas una tras otra. El
 *    vídeo se recorta a la duración real del ejercicio (intro + total de compases), no a la del
 *    audio completo (pensado para un backing largo y genérico, no sincronizado grado a grado).
 *
 * Uso:
 *   node scripts/generate-scale-triad-explore-videos.js --root C --scale major \
 *     --xml ~/Downloads/DominaTriadas-EscalaC-Mayor/EscalaCCambiosaTodosGrados.XML \
 *     --audio ~/Downloads/DominaTriadas-EscalaC-Mayor/EscalaCCambiosaTodosGrados_Render.m4a \
 *     --out ~/Downloads/DominaTriadasEscala-C90
 *   node scripts/generate-scale-triad-explore-videos.js --root C --scale major \
 *     --audio ~/guitar-visualizer-assets/triadas-por-tonalidad/C/C_AcordeParaTriadas_50Compases_90bpm_Render.m4a \
 *     --bpm 90 --out ~/Downloads/DominaTriadasEscala-C90
 *
 * Opciones:
 *   --app <path>            Ruta al HTML de la app (por defecto: guitarvisualizer.html)
 *   --root <nota>           Tónica, p.ej. C, F#, Bb
 *   --scale <clave>         Escala (clave interna, p.ej. major — ver SEQ_SCALE_FORMULAS)
 *   --xml <path>            MusicXML real → activa el MODO TEMA (ver arriba)
 *   --cyclelen <n>          "Compases por ciclo" (modo tema) si el valor por defecto de la app
 *                           no es el que quieres
 *   --whole-theme            "Compases por ciclo" = Tema completo (excluyente con --cyclelen)
 *   --audio <path>          Audio compartido para las 5 posiciones (obligatorio) — el real a
 *                           juego con --xml en modo tema, o un backing/click genérico en modo
 *                           diapositivas
 *   --bpm <n>               Tempo del audio — obligatorio en modo diapositivas (sin --xml); se
 *                           ignora en modo tema (lo trae el XML)
 *   --intro <n>             Compases de clic antes de empezar (por defecto 2)
 *   --positions <lista>     Formas a generar, coma-separadas (por defecto E,D,C,A,G)
 *   --positions-lib <path>  JSON de formas CAGED corregidas a mano (por defecto
 *                           scripts/lib/caged-scale-positions.json)
 *   --extra <seg>           Segundos extra al final de cada vídeo (por defecto 2)
 *   --out <dir>             Carpeta de salida (por defecto ./video-out)
 *   --concurrency <n>       Vídeos en paralelo (por defecto 1)
 *   --width/--height        Tamaño del viewport grabado (por defecto 1600x900)
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);
const { acquireRenderLock } = require('./lib/batch-sessions');

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
  catch (e) { throw new Error('No se encuentra "ffmpeg" en el PATH. Instálalo antes de continuar.'); }
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

// Portado tal cual de generate-scale-arpeggio-videos.js / generate-explore-triad-video.js: marca
// visual (negro→blanco a los 200ms) pintada en la esquina, detectada luego sobre el vídeo YA
// grabado para recortar el arranque (carga de página + entrada en modo presentación) con
// precisión — sin esto el vídeo empieza con un tramo de la UI normal antes de que el
// visualizador a pantalla completa se asiente.
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
    let sawDark = false;
    for (let i = 0; i < lines.length; i++) {
      const pm = lines[i].match(/pts_time:([0-9.]+)/);
      if (!pm) continue;
      const vm = (lines[i + 1] || '').match(/YAVG=([0-9.]+)/);
      if (!vm) continue;
      const y = parseFloat(vm[1]);
      if (!sawDark) { if (y < 60) sawDark = true; continue; }
      if (y > 180) return parseFloat(pm[1]);
    }
    return null;
  } finally {
    fs.unlink(statsPath, () => {});
  }
}

async function runOne({ appUrl, root, scale, posLabel, introBars, bpm, xmlPath, cycleLen, wholeTheme, audioPath, extraSec, positionsLib, width, height, outDir, tmpDir }) {
  const log = (msg) => console.log(`[forma${posLabel}] ${msg}`);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: { dir: tmpDir, size: { width, height } },
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => log('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') log('console.error: ' + m.text()); });

  let flipTimestamp = null, playStartAt = null, stepError = null, genResult = null;
  try {
    log('cargando app…');
    await page.goto(appUrl);
    if (positionsLib) await page.evaluate((lib) => localStorage.setItem('gv_arpscale_positions', JSON.stringify(lib)), positionsLib);

    if (xmlPath) {
      log('cargando XML…');
      await page.setInputFiles('#xmlPicker', [xmlPath]);
      await page.waitForFunction(() => typeof cycles !== 'undefined' && cycles.length > 0, null, { timeout: 20000 });
      if (wholeTheme) { log('ajustando "Compases por ciclo" a Tema completo…'); await page.evaluate(() => setCycleToWholeTheme()); }
      else if (cycleLen) { log(`ajustando "Compases por ciclo" a ${cycleLen}…`); await page.evaluate((n) => applyCycleLen(n), cycleLen); }
    }

    log('cargando audio…');
    await page.setInputFiles('#audioPicker', [audioPath]);
    await page.waitForFunction(() => { const el = document.getElementById('audioStatus'); return el && el.classList.contains('ok'); }, null, { timeout: 20000 });

    log('generando posición y tríadas por acorde…');
    genResult = await page.evaluate(async ({ root, scale, posLabel, bpm, introBars, hasXml }) => {
      showTab('arpscale'); // asegura que #asScale tiene sus <option> (asInit) antes de fijar el valor
      const posIdx = ['E', 'D', 'C', 'A', 'G'].indexOf(posLabel);
      document.getElementById('asRoot').value = root;
      document.getElementById('asScale').value = scale;
      document.getElementById('asPos').value = String(posIdx);
      document.getElementById('asQuality').value = 'triads';
      asGenerate();
      const r = await asSendToEditorTriadExplore();
      if (!hasXml && bpm) document.getElementById('bpmInput').value = String(bpm); // modo tema: el tempo ya lo trae el XML, no lo pisamos
      document.getElementById('introCount').value = String(introBars);
      if (typeof updateIntroLbl === 'function') updateIntroLbl();
      return { ...r, totalBars: (r ? r.applied + r.skipped : 0) };
    }, { root, scale, posLabel, bpm, introBars, hasXml: !!xmlPath });
    if (!genResult || !genResult.applied) throw new Error('No se generó ningún compás (revisa la posición/escala).');
    log(`ok: ${genResult.applied} compás(es) generados${genResult.skipped ? `, ${genResult.skipped} sin voicing limpio` : ''}`);

    await page.evaluate(() => {
      showTab('player');
      if (!document.body.classList.contains('presentation')) togglePresentation();
      stopAll();
    });
    await page.waitForTimeout(300);

    flipTimestamp = await page.evaluate(() => new Promise((resolve) => {
      const marker = document.createElement('div');
      marker.id = '__syncMarker';
      marker.style.cssText = 'position:fixed;top:0;left:0;width:48px;height:48px;background:#000;z-index:2147483647;pointer-events:none;';
      document.body.appendChild(marker);
      setTimeout(() => { marker.style.background = '#fff'; resolve(performance.timeOrigin + performance.now()); }, 200);
    }));
    await page.evaluate(() => { const m = document.getElementById('__syncMarker'); if (m) m.remove(); });

    const stampInfo = await page.evaluate(() => new Promise((resolve) => {
      const sample = () => ({ t: performance.timeOrigin + performance.now(), c: audioEl.currentTime });
      const afterPlaying = () => {
        const samples = []; let n = 0;
        const tick = () => { samples.push(sample()); n++; if (n < 6) setTimeout(tick, 100); else resolve(samples); };
        setTimeout(tick, 1500);
      };
      startIt();
      if (!audioEl.paused && audioEl.currentTime > 0) { afterPlaying(); return; }
      audioEl.addEventListener('playing', () => afterPlaying(), { once: true });
      setTimeout(afterPlaying, 2000);
    }));
    const t0Candidates = stampInfo.map((s) => s.t - s.c * 1000).sort((a, b) => a - b);
    const nS = t0Candidates.length;
    playStartAt = nS % 2 ? t0Candidates[(nS - 1) / 2] : (t0Candidates[nS / 2 - 1] + t0Candidates[nS / 2]) / 2;

    let contentSec;
    if (xmlPath) {
      // MODO TEMA: el audio ya está sincronizado al XML real — se usa completo, como
      // cualquier otro ejercicio de tema real (no un recorte sintético).
      contentSec = await getAudioDurationSeconds(audioPath) + extraSec;
      log(`grabando ~${contentSec.toFixed(1)}s (audio completo + ${extraSec}s extra)…`);
    } else {
      // MODO DIAPOSITIVAS: duración real del contenido (no la del audio completo, que es un
      // backing track largo y genérico) — intro + todos los compases generados, con margen; el
      // resto del audio se recorta. Asume 4/4 (todo el proyecto lo es).
      const barSec = (60 / bpm) * 4;
      contentSec = introBars * barSec + genResult.totalBars * barSec + extraSec;
      log(`grabando ~${contentSec.toFixed(1)}s (intro ${(introBars * barSec).toFixed(1)}s + ${genResult.totalBars} compases + ${extraSec}s extra)…`);
    }
    await page.waitForTimeout(contentSec * 1000);
    await page.evaluate(() => { if (typeof pauseIt === 'function') pauseIt(); });

    genResult.contentSec = contentSec;
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

  let videoStartRef = flipTimestamp;
  const markerPtsTime = await detectMarkerFrameTime(silentPath, tmpDir);
  if (markerPtsTime != null) {
    videoStartRef = flipTimestamp - markerPtsTime * 1000;
    log(`marca de calibración detectada en t=${markerPtsTime.toFixed(3)}s`);
  } else {
    log('aviso: no se detectó la marca de calibración — uso flipTimestamp (menos preciso)');
  }
  const trimOffsetSec = Math.max(0, (playStartAt - videoStartRef) / 1000);

  const audioDuration = await getAudioDurationSeconds(audioPath);
  const mixDuration = Math.min(genResult.contentSec, audioDuration);

  const outPath = path.join(outDir, `${root}_${scale}_Forma${posLabel}_TriadasEnPosicion.mp4`);
  log(`mezclando audio con ffmpeg (recortando ${trimOffsetSec.toFixed(2)}s de arranque, ${mixDuration.toFixed(1)}s de duración)…`);
  await execFileP('ffmpeg', [
    '-y',
    '-i', silentPath,
    '-i', audioPath,
    '-filter_complex', `[0:v]trim=start=${trimOffsetSec.toFixed(3)},setpts=PTS-STARTPTS[v]`,
    '-map', '[v]', '-map', '1:a:0',
    '-t', mixDuration.toFixed(3),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20',
    '-c:a', 'aac', '-b:a', '192k',
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
  if (!args.root || !args.scale || !args.audio || (!args.xml && !args.bpm)) {
    console.error('Uso: node scripts/generate-scale-triad-explore-videos.js --root <nota> --scale <clave> --audio <archivo> (--bpm <n> | --xml <archivo.xml>) [opciones]');
    process.exit(1);
  }
  if (args.cyclelen && args['whole-theme']) { console.error('--cyclelen y --whole-theme son excluyentes.'); process.exit(1); }
  await waitFfmpeg();
  // Ver el comentario grande de acquireRenderLock() en scripts/lib/batch-sessions.js: esto
  // graba en tiempo real, así que dos grabaciones a la vez en la misma máquina se estropean
  // entre sí (pasó de verdad: lote de Ritmo Soul, sep 2026).
  await acquireRenderLock();

  const repoRoot = path.resolve(__dirname, '..');
  const appPath = path.resolve(repoRoot, args.app || 'guitarvisualizer.html');
  const audioPath = path.resolve(args.audio);
  const xmlPath = args.xml ? path.resolve(args.xml) : null;
  const cycleLen = args.cyclelen ? parseInt(args.cyclelen, 10) : null;
  const wholeTheme = !!args['whole-theme'];
  const outDir = path.resolve(args.out || './video-out');
  const extraSec = args.extra !== undefined ? parseFloat(args.extra) : 2;
  const introBars = args.intro !== undefined ? parseInt(args.intro, 10) : 2;
  const bpm = args.bpm ? parseFloat(args.bpm) : null;
  const positions = (args.positions ? String(args.positions) : AS_POS_LABELS.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
  const concurrency = args.concurrency ? parseInt(args.concurrency, 10) : 1;
  const width = args.width ? parseInt(args.width, 10) : 1600;
  const height = args.height ? parseInt(args.height, 10) : 900;

  const positionsLibPath = path.resolve(args['positions-lib'] || path.join(repoRoot, 'scripts/lib/caged-scale-positions.json'));
  let positionsLib = null;
  if (fs.existsSync(positionsLibPath)) {
    positionsLib = JSON.parse(fs.readFileSync(positionsLibPath, 'utf8'));
    console.log(`(usando librería de formas corregidas: ${positionsLibPath})`);
  }

  for (const p of [appPath, audioPath, ...(xmlPath ? [xmlPath] : [])]) {
    if (!fs.existsSync(p)) { console.error('No existe: ' + p); process.exit(1); }
  }
  fs.mkdirSync(outDir, { recursive: true });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-video-'));

  const appUrl = 'file://' + appPath;
  console.log(`Escala: ${args.root} ${args.scale} · posiciones: ${positions.join(', ')} · ${xmlPath ? `modo tema (${path.basename(xmlPath)})` : `modo diapositivas (${bpm} bpm)`} · audio: ${path.basename(audioPath)}`);

  const jobs = positions.map((posLabel) => ({ posLabel }));
  const t0 = Date.now();
  const results = await runPool(jobs, concurrency, (job) =>
    runOne({ appUrl, root: args.root, scale: args.scale, posLabel: job.posLabel, introBars, bpm, xmlPath, cycleLen, wholeTheme, audioPath, extraSec, positionsLib, width, height, outDir, tmpDir })
  );

  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok);
  console.log(`\nHecho en ${((Date.now() - t0) / 1000).toFixed(1)}s: ${ok}/${jobs.length} vídeos generados en ${outDir}`);
  fail.forEach((f, i) => console.error(`  ✗ ${jobs[i].posLabel}: ${f.error && f.error.message}`));

  fs.rmSync(tmpDir, { recursive: true, force: true });
  process.exitCode = fail.length ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
