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

// Detección (solo informativa, ver el comentario grande más abajo sobre por qué NO se corrige
// automáticamente en este pipeline) del instante real en que empieza a sonar el audio, para
// comparar contra el recorte inicial del navegador (evento 'playing', ±0.3-0.5s de ruido
// documentado de una toma a otra).
const SYNC_LONG_GAP_SEC = 0.22; // hueco típico del click de conteo; un silencio musical breve no llega a esto

// Busca, cerca de `nearSec` (el instante teórico en que debería acabar la intro, según
// getIntroSec()+getOffSec()), el hueco de silencio "largo" (>= SYNC_LONG_GAP_SEC) cuyo final está
// MÁS CERCA de nearSec — el patrón del click de conteo (blips cortos separados por huecos largos y
// regulares). Idéntica a la de render-rhythm-video.js: el click de conteo es genérico, no depende
// del tipo de ejercicio (tríadas, arpegios, ritmo…), así que la detección tampoco.
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

// Equivalente en vídeo a detectAudioOnsetNear, pero genérico para cualquier tipo de ejercicio (no
// solo Ritmo, que tiene una etiqueta fija "GET READY" que medir): al salir de la intro, el panel
// "AHORA" cambia de un número de cuenta atrás a un nombre de acorde/posición — un cambio de
// contenido real, no un simple fundido, así que en vez de medir luminancia (como
// detectOverlayFadeNear en render-rhythm-video.js) se mide la DIFERENCIA entre cada fotograma y el
// anterior dentro de esa zona (tblend=difference + signalstats) y se busca el pico más cercano a
// nearSec — un cambio de contenido genera un pico claro sobre el ruido de fondo (partículas,
// pulso de las notas), que decae de inmediato al quedarse estable el nuevo acorde.
// `crop` son fracciones [0,1] del fotograma completo (no píxeles) para no depender de la
// resolución exacta con la que se grabó — ver el rectángulo del panel "AHORA" en
// guitarvisualizer.html (.chord-center / #vChord).
const AHORA_PANEL_CROP = { x: 0.18, y: 0.09, w: 0.38, h: 0.14 };
async function detectContentChangeNear(mp4Path, nearSec, windowAfterSec, width, height) {
  const searchSec = nearSec + windowAfterSec;
  const even = (n) => Math.max(2, Math.floor(n / 2) * 2);
  const cw = even(AHORA_PANEL_CROP.w * width);
  const ch = even(AHORA_PANEL_CROP.h * height);
  const cx = even(AHORA_PANEL_CROP.x * width);
  const cy = even(AHORA_PANEL_CROP.y * height);
  let stdout = '';
  try {
    const r = await execFileP('ffmpeg', [
      '-i', mp4Path, '-t', String(searchSec),
      '-vf', `crop=${cw}:${ch}:${cx}:${cy},tblend=all_mode=difference,signalstats,metadata=print:file=-`,
      '-f', 'null', '-',
    ], { maxBuffer: 1024 * 1024 * 64 });
    stdout = r.stdout || '';
  } catch (e) { stdout = e.stdout || ''; }
  const samples = [];
  let pts = null;
  for (const line of stdout.split('\n')) {
    const pm = line.match(/pts_time:([0-9.]+)/);
    if (pm) { pts = parseFloat(pm[1]); continue; }
    const ym = line.match(/YAVG=([0-9.]+)/);
    if (ym && pts != null) samples.push({ t: pts, y: parseFloat(ym[1]) });
  }
  if (samples.length < 5) return null;
  const ys = samples.map((s) => s.y).sort((a, b) => a - b);
  const baseline = ys[Math.floor(ys.length / 2)]; // mediana: ruido de fondo típico (partículas, glow)
  const peak = ys[ys.length - 1];
  if (peak - baseline < 4) return null; // sin pico claro por encima del ruido de fondo
  const threshold = baseline + (peak - baseline) * 0.5;
  let best = null;
  let bestDist = Infinity;
  for (let i = 1; i < samples.length - 1; i++) {
    const s = samples[i];
    if (s.y < threshold || s.y < samples[i - 1].y || s.y < samples[i + 1].y) continue; // solo máximos locales
    const dist = Math.abs(s.t - nearSec);
    if (dist < bestDist) { best = s.t; bestDist = dist; }
  }
  return best;
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
  let expectedContentSec = 0;
  try {
    log('cargando app…');
    await page.goto(appUrl);
    appVersion = await page.evaluate(() => (typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'unknown'));

    log('cargando sesión…');
    const loadedSlots = await page.evaluate((s) => applySession(s), sessionObj);
    log(`sesión aplicada (${loadedSlots} slots con imagen)`);

    // Instante teórico en que debería acabar la intro (mismo cálculo que usa tick() en
    // guitarvisualizer.html: getIntroSec()+getOffSec()) — se usa después para verificar/corregir
    // la sincronización. 0 si no hay intro (nada que verificar, ver más abajo).
    expectedContentSec = await page.evaluate(() => {
      let s = 0;
      try { if (typeof getIntroSec === 'function') s += getIntroSec(); } catch (e) {}
      try { if (typeof getOffSec === 'function') s += getOffSec(); } catch (e) {}
      return s;
    });

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
  // Recorte EXACTO por timestamp de fotograma (filtro trim+setpts), no por keyframe: el "-ss"
  // antes de "-i" busca al keyframe más cercano y puede desviarse del punto real hasta un GOP
  // entero, lo que se notaba como el audio ligeramente desfasado del metrónomo/cambio de acorde.
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

  // Auto-corrección de sincronización DESACTIVADA para este pipeline (sesiones de Tríadas/
  // Arpegios) — investigación real, ago 2026 (TriadasMenoresPorQuintas): detectContentChangeNear
  // mide la diferencia entre fotogramas dentro del panel "AHORA", pero esa misma zona tiene un
  // indicador de pulso/tiempo que se anima de forma CONTINUA (no solo al cambiar de acorde), con
  // una amplitud de diferencia MAYOR que el propio cambio de texto real («Cm» apareciendo) que se
  // quería detectar — comprobado volcando la señal cruda: el pico de la transición real medía
  // 2.5, mientras que el pulso decorativo alcanzaba 9.1 en varios puntos ajenos a la transición.
  // El detector, tal como está, engancha ese pulso en vez de la transición real, con errores de
  // hasta varios segundos (confirmado comparando fotograma a fotograma contra el audio real). En
  // TriadasMenoresPorQuintas-123-F, dejar que el bucle "corrigiera" sobre esa lectura ruidosa
  // acabó CORTANDO visualmente los 2 primeros tiempos de la claqueta (el primer fotograma ya
  // mostraba el tercer tiempo del metrónomo en vez del primero) aunque la comprobación diera el
  // resultado por bueno. El recorte inicial (trimOffsetSec, medido en el navegador con el evento
  // 'playing', ±0.3-0.5s de margen documentado) ya deja la transición real dentro de ese margen en
  // todas las sesiones verificadas a mano — así que aquí no se intenta "mejorar" con una señal que
  // resulta ser más ruido que señal. Se deja solo el audio (si acaso, para depurar a mano) sin
  // aplicar ninguna corrección sobre él. Si se rehace detectContentChangeNear con una zona de
  // recorte que aísle solo el texto del acorde (sin el indicador de pulso), esto se puede
  // reactivar con el mismo patrón best-of-N + límite de deriva que usa render-rhythm-video.js.
  if (expectedContentSec > 0) {
    const audioOnset = await detectAudioOnsetNear(outPath, expectedContentSec, 3);
    if (audioOnset != null) log(`referencia: audio real a partir de ${audioOnset.toFixed(2)}s (teórico ${expectedContentSec.toFixed(2)}s) — sin corrección automática, ver comentario`);
  }

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
