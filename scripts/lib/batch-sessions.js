/*
 * Lógica compartida para generar vídeos en lote a partir de sesiones .json exportadas desde la
 * app ("Guardar ejercicio"). La usan tanto el script de terminal
 * (scripts/generate-videos-from-sessions.js) como el servidor local (scripts/server.js), que es
 * lo que llama el botón "Generar vídeos" de la propia app web.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);

async function waitFfmpeg() {
  try { await execFileP('ffmpeg', ['-version']); }
  catch (e) { throw new Error('No se encuentra "ffmpeg" en el PATH. Instálalo antes de continuar.'); }
}

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

// Una sesión válida tiene 'cycles' y 'masterBars' como arrays — descarta cualquier otro .json
// suelto en la carpeta (p.ej. el vis-config.json exportado desde la app).
function listSessionFiles(dir, excludeAbsPaths, onSkip) {
  const excl = new Set((excludeAbsPaths || []).filter(Boolean).map((p) => path.resolve(p)));
  return fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.json')).sort()
    .map((f) => path.join(dir, f))
    .filter((p) => {
      if (excl.has(path.resolve(p))) return false;
      try {
        const d = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (Array.isArray(d.cycles) && Array.isArray(d.masterBars)) return true;
      } catch (e) {}
      if (onSkip) onSkip(p);
      return false;
    });
}

// Navegadores en marcha ahora mismo — permite un "Detener" real desde el servidor: cerrarlos
// aborta cualquier evaluate()/waitForTimeout() en curso, que runOne captura como error normal.
const activeBrowsers = new Set();
let cancelRequested = false;
function requestCancel() {
  cancelRequested = true;
  for (const b of activeBrowsers) { try { b.close(); } catch (e) {} }
}
function resetCancel() { cancelRequested = false; }

async function runOne({ appUrl, sessionPath, sessionObj, audioPath, audioDuration, extraSec, visConfig, width, height, outDir, tmpDir, onLog }) {
  const tag = path.basename(sessionPath, '.json');
  const log = (msg) => { if (onLog) onLog(msg); };

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  activeBrowsers.add(browser);
  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: { dir: tmpDir, size: { width, height } },
  });
  if (visConfig) {
    await context.addInitScript((cfg) => {
      try { if (cfg.vis) localStorage.setItem('gv_vis', JSON.stringify(cfg.vis)); } catch (e) {}
      try { if (cfg.colors) localStorage.setItem('gv_colors', JSON.stringify(cfg.colors)); } catch (e) {}
      try { if (cfg.maxFretsShown != null) localStorage.setItem('gv_maxFretsShown', String(cfg.maxFretsShown)); } catch (e) {}
      try { if (cfg.previewMaxFrets != null) localStorage.setItem('gv_previewMaxFrets', String(cfg.previewMaxFrets)); } catch (e) {}
    }, visConfig);
  }
  const page = await context.newPage();
  page.on('pageerror', (e) => log('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') log('console.error: ' + m.text()); });

  // Playwright graba desde que se crea la página, no desde que arranca la reproducción real —
  // todo el setup previo (cargar sesión, cargar audio, cambiar de pestaña) queda al principio
  // del vídeo silencioso mostrando el Editor. Medimos ese "arranque" para recortarlo luego con
  // ffmpeg y que el vídeo final empiece justo cuando suena el audio, no antes.
  const recordStartAt = Date.now();
  let playStartAt = null;
  let stepError = null;
  let appVersion = 'unknown';
  try {
    log('cargando app…');
    await page.goto(appUrl);
    appVersion = await page.evaluate(() => (typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'unknown'));

    log('cargando sesión…');
    const loadedSlots = await page.evaluate((s) => applySession(s), sessionObj);
    log(`sesión aplicada (${loadedSlots} slots con imagen)`);

    log('cargando audio…');
    await page.setInputFiles('#audioPicker', [audioPath]);
    await page.waitForFunction(() => {
      const el = document.getElementById('audioStatus');
      return el && el.classList.contains('ok');
    }, null, { timeout: 20000 });

    const total = audioDuration + extraSec;
    log(`duración objetivo: ${total.toFixed(1)}s (audio ${audioDuration.toFixed(1)}s + ${extraSec}s extra)`);

    // Selectores del Visualizador que no se guardan en localStorage ni en la sesión (modo de
    // acorde, modo de notas, voces seguidas) — se aplican aparte de gv_vis/gv_colors.
    if (visConfig) {
      await page.evaluate((cfg) => {
        if (cfg.chordDisplayMode) {
          document.getElementById('chordDisplayMode').value = cfg.chordDisplayMode;
          if (typeof setChordDisplayMode === 'function') setChordDisplayMode(cfg.chordDisplayMode);
        }
        if (cfg.noteMode) {
          document.getElementById('noteMode').value = cfg.noteMode;
          if (typeof refreshNotes === 'function') refreshNotes();
        }
        if (cfg.followVoice) document.getElementById('followVoice').value = cfg.followVoice;
        if (cfg.followVoice2) document.getElementById('followVoice2').value = cfg.followVoice2;
      }, visConfig);
    }

    await page.evaluate(() => {
      showTab('player');
      if (!document.body.classList.contains('presentation')) togglePresentation();
      stopAll();
    });
    await page.waitForTimeout(300); // deja asentar el layout de presentación

    // audioEl.play() es asíncrono — el audio tarda un poco en sonar de verdad (decodificación/
    // buffer). Si medimos el offset justo al volver de startIt(), ese hueco (~100-250ms, variable)
    // se cuela como vídeo adelantado al audio real. Esperamos al evento 'playing' (arranque
    // audible real) antes de tomar el timestamp de recorte.
    //
    // El timestamp NO se toma con Date.now() en Node tras el await — ese await cruza el
    // protocolo CDP (evaluate → esperar el evento dentro del navegador → resolver → volver a
    // Node), y ese viaje de vuelta tiene una latencia variable (de sobra pudimos medir ~500ms en
    // un caso real) que se colaba entera como desync constante en el vídeo final. En su lugar,
    // se toma el instante DENTRO del propio navegador con performance.timeOrigin+performance.now()
    // (reloj de época, mismo dominio que Date.now() en Node, en la misma máquina) en el momento
    // exacto del evento — antes de que empiece cualquier viaje de vuelta — y solo el NÚMERO ya
    // congelado cruza esa latencia, no la medición en sí.
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
  activeBrowsers.delete(browser);

  if (stepError) throw stepError;
  if (!videoObj) throw new Error('No se generó ningún vídeo (context sin recordVideo).');
  const silentPath = await videoObj.path();
  const trimOffsetSec = Math.max(0, ((playStartAt || recordStartAt) - recordStartAt) / 1000);

  const outPath = path.join(outDir, `${tag}.mp4`);
  log(`mezclando audio con ffmpeg (recortando ${trimOffsetSec.toFixed(2)}s de arranque)…`);
  // Recorte EXACTO por timestamp de fotograma (filtro trim+setpts), no por keyframe: el "-ss"
  // antes de "-i" busca al keyframe más cercano y puede desviarse del punto real hasta un GOP
  // entero, lo que se notaba como el audio ligeramente desfasado del metrónomo/cambio de acorde.
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
  let idx = 0;
  async function next() {
    while (idx < jobs.length && !cancelRequested) {
      const myIdx = idx++;
      await worker(jobs[myIdx]);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, jobs.length) }, next);
  await Promise.all(workers);
}

// Orquesta el lote completo y mantiene un objeto de estado mutable que el llamador puede seguir
// leyendo mientras corre (polling) — lo usa tanto el servidor (GET /api/status) como el CLI.
async function runBatch({ appPath, dir, audioPath, outDir, extraSec = 2, visConfig = null, visConfigPath = null, concurrency = 1, width = 1600, height = 900, onUpdate }) {
  resetCancel();
  const notify = () => { if (onUpdate) try { onUpdate(state); } catch (e) {} };
  const state = {
    startedAt: Date.now(), finishedAt: null, running: true,
    audioDuration: null, ok: 0, fail: 0, fatalError: null, cancelled: false,
    jobs: [],
  };

  try {
    await waitFfmpeg();
    const appUrl = 'file://' + path.resolve(appPath);
    const audioAbs = path.resolve(audioPath);
    const dirAbs = path.resolve(dir);

    state.audioDuration = await getAudioDurationSeconds(audioAbs);

    const skipped = [];
    const sessionFiles = listSessionFiles(dirAbs, [visConfigPath], (p) => skipped.push(path.basename(p)));
    state.skipped = skipped;
    if (!sessionFiles.length) throw new Error('No hay archivos de sesión válidos en ' + dirAbs);

    state.jobs = sessionFiles.map((f) => ({
      tag: path.basename(f, '.json'), sessionPath: f,
      status: 'pending', message: '', outPath: null, error: null,
      startedAt: null, finishedAt: null,
    }));
    notify();

    fs.mkdirSync(outDir, { recursive: true });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-video-'));

    await runPool(state.jobs, concurrency, async (job) => {
      job.status = 'running'; job.startedAt = Date.now(); notify();
      try {
        const sessionObj = JSON.parse(fs.readFileSync(job.sessionPath, 'utf8'));
        const outPath = await runOne({
          appUrl, sessionPath: job.sessionPath, sessionObj, audioPath: audioAbs, audioDuration: state.audioDuration,
          extraSec, visConfig, width, height, outDir, tmpDir,
          onLog: (msg) => { job.message = msg; notify(); },
        });
        job.status = 'done'; job.outPath = outPath; job.finishedAt = Date.now();
        state.ok++;
      } catch (e) {
        job.status = 'error'; job.error = e.message; job.finishedAt = Date.now();
        state.fail++;
      }
      notify();
    });

    if (cancelRequested) {
      state.cancelled = true;
      state.jobs.forEach((j) => { if (j.status === 'pending') j.status = 'cancelled'; });
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (e) {
    state.fatalError = e.message;
  }
  state.running = false;
  state.finishedAt = Date.now();
  notify();
  return state;
}

module.exports = { waitFfmpeg, getAudioDurationSeconds, listSessionFiles, runOne, runPool, runBatch, requestCancel };
