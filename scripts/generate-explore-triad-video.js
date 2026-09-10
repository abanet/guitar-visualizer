#!/usr/bin/env node
/*
 * Genera el vídeo del ejercicio "Explora una tríada en el mástil" (secuencia A u B, ver
 * EXPLORE_TRIAD_SEQ_A/B y applyExploreTriadSequence en guitarvisualizer.html) a partir de un
 * MusicXML + un audio de un solo acorde tipo vamp — SIN necesidad de ver nada en pantalla.
 *
 * Mismo arnés que generate-triad-videos.js (Chrome headless + Playwright grabando + ffmpeg
 * mezclando el audio real), pero en vez de "Generar tríadas automáticas" (voice leading o figura
 * fija) llama a generateExploreTriadA()/generateExploreTriadB() — 1 compás por posición, 2
 * pasadas completas de las 12 posiciones jugables de la tríada (nombres de nota → intervalos).
 *
 * Uso:
 *   node scripts/generate-explore-triad-video.js --xml tema.musicxml --audio tema.m4a --seq A
 *
 * Opciones:
 *   --app <path>         Ruta al HTML de la app (por defecto: guitarvisualizer.html)
 *   --xml <path>          MusicXML de un solo acorde tipo vamp (obligatorio)
 *   --audio <path>        Audio m4a/mp3/wav a ese mismo acorde (obligatorio)
 *   --seq A|B|C           A: horizontal por grupo de cuerdas, ida y vuelta.
 *                         B: diagonal, conecta las 12 posiciones cuerda a cuerda.
 *                         C: las 12 posiciones en orden aleatorio. (por defecto: A)
 *   --out <dir>            Carpeta de salida (por defecto: ./video-out)
 *   --extra <seg>         Segundos extra al final del vídeo (por defecto: 2)
 *   --vis-config <path>   JSON con la configuración de "Elementos" a aplicar (opcional, por
 *                         defecto scripts/lib/default-triad-vis-config.json — ver
 *                         project_triads_color_regression en memoria).
 *   --width/--height      Tamaño del viewport grabado (por defecto: 1600x900)
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);

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

// Busca, en el vídeo silencioso YA grabado, el primer fotograma en el que la marca de
// calibración (cuadro pintado en la esquina superior izquierda, ver marcador más abajo) aparece —
// devuelve su pts_time (segundos, en la propia línea de tiempo del vídeo crudo) o null si no se
// detecta. Portado tal cual de generate-scale-arpeggio-videos.js (ver ese fichero para el porqué
// de "visto oscuro antes de contar el blanco": los primerísimos fotogramas de cualquier página ya
// salen blancos por defecto, antes de que cargue el CSS de la app).
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.xml || !args.audio) {
    console.error('Uso: node scripts/generate-explore-triad-video.js --xml <archivo.musicxml> --audio <archivo.m4a> [--seq A|B] [opciones]');
    process.exit(1);
  }
  await waitFfmpeg();

  const repoRoot = path.resolve(__dirname, '..');
  const appPath = path.resolve(repoRoot, args.app || 'guitarvisualizer.html');
  const xmlPath = path.resolve(args.xml);
  const audioPath = path.resolve(args.audio);
  const outDir = path.resolve(args.out || './video-out');
  const extraSec = args.extra !== undefined ? parseFloat(args.extra) : 2;
  const seq = String(args.seq || 'A').toUpperCase();
  if (seq !== 'A' && seq !== 'B' && seq !== 'C') { console.error('--seq debe ser A, B o C'); process.exit(1); }
  const width = args.width ? parseInt(args.width, 10) : 1600;
  const height = args.height ? parseInt(args.height, 10) : 900;
  const defaultVisConfigPath = path.resolve(repoRoot, 'scripts/lib/explore-triad-vis-config.json');
  let visConfig;
  if (args['vis-config']) {
    visConfig = JSON.parse(fs.readFileSync(path.resolve(args['vis-config']), 'utf8'));
  } else {
    visConfig = JSON.parse(fs.readFileSync(defaultVisConfigPath, 'utf8'));
    console.log(`(usando configuración de vis por defecto: ${defaultVisConfigPath} — pasa --vis-config <archivo> para otra distinta)`);
  }

  for (const p of [appPath, xmlPath, audioPath]) {
    if (!fs.existsSync(p)) { console.error('No existe: ' + p); process.exit(1); }
  }
  fs.mkdirSync(outDir, { recursive: true });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-video-'));

  const appUrl = 'file://' + appPath;
  const audioDuration = await getAudioDurationSeconds(audioPath);
  console.log(`Audio: ${audioDuration.toFixed(1)}s (${path.basename(audioPath)}) — secuencia ${seq}`);

  const log = (msg) => console.log(`[explore-${seq}] ${msg}`);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
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
  page.on('dialog', (d) => { log('dialog: ' + d.message()); d.accept(); });

  const recordStartAt = Date.now();
  let playStartAt = null;
  let flipTimestamp = null;
  let stepError = null;
  let appVersion = 'unknown';
  try {
    log('cargando app…');
    await page.goto(appUrl);
    appVersion = await page.evaluate(() => (typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'unknown'));

    // CALIBRACIÓN POR MARCA VISUAL (portado de generate-scale-arpeggio-videos.js — sync
    // reportado como poco fiable, "en algunos vídeos va bien, en el último iba mal": el arranque
    // real del grabador de Playwright/Chromium tiene un retraso variable frente a recordStartAt
    // = Date.now() tras el await de newPage(), y ningún ajuste del lado del audio puede corregir
    // eso. Se pinta un cuadro en la esquina en un instante conocido con precisión
    // (performance.now() dentro del navegador) y, sobre el vídeo YA grabado, se busca el
    // fotograma exacto en que aparece (ver detectMarkerFrameTime, tras cerrar la página).
    // El doble rAF original (portado del otro script) deja la marca en negro solo 1-2
    // fotogramas de PINTADO del navegador — bastante menos que un fotograma de GRABACIÓN si el
    // vídeo se captura a ~25fps (40ms), así que el grabador podía no llegar a capturar NINGÚN
    // fotograma negro (comprobado grabando aparte: la traza nunca bajaba de Y≈230, jamás oscuro
    // → "no se detectó la marca" repetido). Se mantiene el negro 200ms explícitos (varios
    // fotogramas de sobra a cualquier fps de grabación) antes de pasar a blanco.
    flipTimestamp = await page.evaluate(() => new Promise((resolve) => {
      const marker = document.createElement('div');
      marker.id = '__syncMarker';
      marker.style.cssText = 'position:fixed;top:0;left:0;width:48px;height:48px;background:#000;z-index:2147483647;pointer-events:none;';
      document.body.appendChild(marker);
      setTimeout(() => {
        marker.style.background = '#fff';
        resolve(performance.timeOrigin + performance.now());
      }, 200);
    }));
    await page.evaluate(() => { const m = document.getElementById('__syncMarker'); if (m) m.remove(); });

    log('cargando XML…');
    await page.setInputFiles('#xmlPicker', [xmlPath]);
    await page.waitForFunction(() => {
      const t3 = document.getElementById('t3');
      const err = document.getElementById('xmlStatus');
      if (err && err.classList.contains('err')) throw new Error('Error al leer el MusicXML');
      return t3 && t3.textContent && t3.textContent.length > 0;
    }, null, { timeout: 20000 });

    log('cargando audio…');
    await page.setInputFiles('#audioPicker', [audioPath]);
    await page.waitForFunction(() => {
      const el = document.getElementById('audioStatus');
      return el && el.classList.contains('ok');
    }, null, { timeout: 20000 });

    log(`generando secuencia ${seq}…`);
    const genResult = await page.evaluate((s) => (
      s === 'A' ? generateExploreTriadA() : s === 'B' ? generateExploreTriadB() : generateExploreTriadC()
    ), seq);

    // Con 1 compás por posición, los 2 compases de anticipación fantasma por defecto (pensados
    // para figuras que aguantan varios compases) se comían la mitad del compás en transición
    // permanente — nunca llegaba a verse "asentada" la posición activa. Se reduce a una fracción
    // de compás salvo que --vis-config indique otra cosa explícitamente.
    if (visConfig && visConfig.triadGhostBeats != null) {
      await page.evaluate((v) => {
        const el = document.getElementById('triadGhostBeats');
        if (el) { el.value = String(v); if (typeof setTriadGhostBeats === 'function') setTriadGhostBeats(v); }
      }, visConfig.triadGhostBeats);
    }

    // Selectores del Visualizador que no se guardan en localStorage ni en la sesión (modo de
    // acorde, modo de notas, voces seguidas) — se aplican aparte de gv_vis/gv_colors (mismo
    // motivo que en generate-triad-videos.js).
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

    const total = audioDuration + extraSec;
    log(`duración objetivo: ${total.toFixed(1)}s (audio ${audioDuration.toFixed(1)}s + ${extraSec}s extra)`);

    // "Fondo automático" (bgAuto) es estado de SESIÓN, no localStorage — ver comentario largo en
    // generate-triad-videos.js (project_triads_color_regression). Por defecto 'figure' salvo que
    // --vis-config indique otra cosa.
    await page.evaluate((cfg) => {
      const bg = (cfg && cfg.bgAuto) || { mode: 'figure' };
      const m = document.getElementById('bgAutoMode');
      if (m) m.value = bg.mode || 'figure';
      if (typeof bgAutoChanged === 'function') bgAutoChanged();
      if (bg.root) {
        const r = document.getElementById('bgAutoRoot');
        if (r) { r.value = bg.root; if (typeof bgAutoChanged === 'function') bgAutoChanged(); }
      }
      if (bg.scale) {
        const s = document.getElementById('bgAutoScale');
        if (s) { s.value = bg.scale; if (typeof bgAutoChanged === 'function') bgAutoChanged(); }
      }
    }, visConfig);

    await page.evaluate(() => {
      showTab('player');
      if (!document.body.classList.contains('presentation')) togglePresentation();
      stopAll();
    });
    await page.waitForTimeout(300);

    // Muestreo estabilizado (portado de generate-scale-arpeggio-videos.js — mismo bug ya resuelto
    // ahí: una sola muestra en el evento 'playing' cae dentro de la ventana en la que el
    // decodificador de un audio real puede tener un micro-parón de calentamiento, y extrapolar
    // desde ahí sesga el resultado unos cientos de ms — justo la "unas veces bien, otras mal" que
    // se ha visto aquí). Se espera LARGO (4s tras 'playing') y solo entonces se toman 6 muestras
    // seguidas (100ms aparte); con reproducción ya estable, t0 = mediana de (muestra.t -
    // muestra.c*1000) — el instante real en que currentTime habría sido 0.
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
    const t0Candidates = stampInfo.map((s) => s.t - s.c * 1000).sort((a, b) => a - b);
    const nS = t0Candidates.length;
    const t0 = nS % 2 ? t0Candidates[(nS - 1) / 2] : (t0Candidates[nS / 2 - 1] + t0Candidates[nS / 2]) / 2;
    playStartAt = t0;
    const spread = t0Candidates[nS - 1] - t0Candidates[0];
    log(`arranque real (t0) de ${nS} muestras estables · dispersión=${spread.toFixed(1)}ms (¿pequeña? si no, algo va mal)`);

    // 2ª pasada en intervalos: applyExploreTriadSequence ya hornea el intervalo en el mástil vía
    // generateNeckSVG, pero renderSVGStatic IGNORA esa etiqueta horneada y la recalcula en vivo a
    // partir de "Mástil:" (getNoteDisplay/globalNoteDisplay) — por eso el mástil se quedaba
    // siempre en nombres de nota, aunque la fila de "Notas del acorde" (que no depende de ese
    // selector) sí alternaba bien. Aquí se cambia ESE selector a mitad de la grabación, en el
    // instante exacto en que empieza la 2ª pasada (bug reportado: "las tríadas no cambian nunca a
    // formato intervalos"). Se descuenta lo que el muestreo de arriba ya ha consumido de reloj
    // real (~4.5s) para no disparar el cambio tarde.
    const lapLen = seq === 'C' ? 12 : 23; // nº de posiciones de una vuelta completa de la secuencia (A y B: ida+vuelta=23; C: 12, sin ida/vuelta)
    const { introSec, barSec } = await page.evaluate(() => ({ introSec: getIntroSec() + getOffSec(), barSec: getBarSec() }));
    const pass2AtSec = introSec + lapLen * barSec; // 1 compás/posición
    const elapsedSoFarSec = (Date.now() - t0) / 1000;
    const waitToPass2 = pass2AtSec - elapsedSoFarSec;
    if (pass2AtSec > 0 && pass2AtSec < total && waitToPass2 > 0) {
      await page.waitForTimeout(waitToPass2 * 1000);
      await page.evaluate(() => {
        const gnd = document.getElementById('globalNoteDisplay');
        if (gnd) { gnd.value = 'intervals'; onGlobalNoteDisplayChange(); }
      });
      log(`cambiado a intervalos en t=${pass2AtSec.toFixed(1)}s (2ª pasada)`);
      await page.waitForTimeout((total - pass2AtSec) * 1000);
    } else {
      await page.waitForTimeout(Math.max(0, total - elapsedSoFarSec) * 1000);
    }
    await page.evaluate(() => { if (typeof pauseIt === 'function') pauseIt(); });
  } catch (e) {
    stepError = e;
  }

  const videoObj = page.video();
  await page.close().catch(() => {});
  await context.close().catch(() => {});
  await browser.close().catch(() => {});

  if (stepError) { fs.rmSync(tmpDir, { recursive: true, force: true }); throw stepError; }
  if (!videoObj) throw new Error('No se generó ningún vídeo (context sin recordVideo).');
  const silentPath = await videoObj.path();
  // T_v = instante real (wall clock) del fotograma 0 del vídeo crudo, calibrado con la marca
  // visual en vez de asumido igual a recordStartAt (que no tiene por qué coincidir con cuándo el
  // grabador empezó a capturar de verdad — la causa del "unas veces bien, otras mal"). Fallback a
  // recordStartAt si la marca no se detecta, para no romper el vídeo por completo.
  let videoStartRef = recordStartAt;
  if (flipTimestamp != null) {
    try {
      const markerPtsTime = await detectMarkerFrameTime(silentPath, tmpDir);
      if (markerPtsTime != null) {
        videoStartRef = flipTimestamp - markerPtsTime * 1000;
        log(`marca de calibración detectada en t=${markerPtsTime.toFixed(3)}s del vídeo crudo`);
      } else {
        log('aviso: no se detectó la marca de calibración — uso recordStartAt (menos preciso)');
      }
    } catch (e) {
      log('aviso: fallo detectando la marca de calibración (' + e.message + ') — uso recordStartAt (menos preciso)');
    }
  }
  const trimOffsetSec = Math.max(0, ((playStartAt || videoStartRef) - videoStartRef) / 1000);

  const outPath = path.join(outDir, `explore-triad_${seq}.mp4`);
  log(`mezclando audio con ffmpeg (recortando ${trimOffsetSec.toFixed(2)}s de arranque)…`);
  // "-ss" ANTES de "-i" busca por keyframe (rápido pero puede desviarse hasta un GOP entero —
  // con un cambio de posición cada 1 compás/2.67s ese desvío se notaba muchísimo, "está
  // desincronizado"). Se recorta con el filtro "trim" sobre el vídeo YA DECODIFICADO — más
  // lento pero exacto al fotograma — y se resincroniza el PTS a 0 con setpts.
  await execFileP('ffmpeg', [
    '-y',
    '-i', silentPath,
    '-i', audioPath,
    '-filter_complex',
    `[0:v]trim=start=${trimOffsetSec.toFixed(3)},setpts=PTS-STARTPTS[v];[1:a]apad=pad_dur=${extraSec}[a]`,
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20',
    '-c:a', 'aac', '-b:a', '192k',
    '-metadata', `comment=Generado con Guitar Visualizer v${appVersion}`,
    '-shortest',
    outPath,
  ]);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  log(`✓ ${outPath}`);
  console.log(`\nHecho: ${outPath}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
