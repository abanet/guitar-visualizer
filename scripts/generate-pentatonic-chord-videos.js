#!/usr/bin/env node
/*
 * Genera en lote los 5 vídeos (uno por posición CAGED de partida: E, D, C, A, G) de "Pentatónica
 * del acorde, por proximidad" a partir de un MusicXML + un audio reales: para CADA acorde real
 * del tema (cualquiera que sea la progresión — no hace falta que sean diatónicos entre sí ni que
 * sigan ningún patrón concreto, p.ej. un círculo de quintas completo con los 12 acordes menores)
 * calcula las 5 formas CAGED de SU PROPIA pentatónica (mayor si el acorde es mayor, menor en
 * cualquier otro caso) y encadena, acorde a acorde, la forma más cercana en trastes a la anterior
 * — para minimizar el desplazamiento de la mano izquierda en cada cambio, igual que ya hace
 * "Tríadas" con voice leading. Cada uno de los 5 vídeos arranca el primer acorde en una forma
 * distinta ("Forma de partida"), así el resto del tema encadena desde una zona distinta del
 * mástil y las 5 zonas quedan cubiertas.
 *
 * No reimplementa nada de esto en Node: pilota la pestaña "Arpegios" (id 'generate') de la app
 * real por el mismo camino que el botón "Generar automáticamente para el tema" (checkbox
 * "Pentatónica del acorde" marcada) + "Enviar al editor" — así el script no se desincroniza cada
 * vez que cambia esa lógica. La reproducción usa el motor REAL de arpegios (zoom a zona, fantasma
 * de la siguiente posición con fundido, notas comunes ancladas — exerciseType='arpeggios'), el
 * mismo que ya usa scripts/generate-scale-arpeggio-videos.js.
 *
 * Uso:
 *   node scripts/generate-pentatonic-chord-videos.js --xml tema.xml --audio tema.m4a --out ./video-out
 *
 * Opciones:
 *   --app <path>          Ruta al HTML de la app (por defecto: guitarvisualizer.html)
 *   --xml <path>           MusicXML con la progresión de acordes real (obligatorio)
 *   --audio <path>         Audio m4a/mp3/wav (obligatorio)
 *   --out <dir>            Carpeta de salida (por defecto: ./video-out — normalmente conviene
 *                          apuntarlo a la MISMA carpeta donde están el XML/audio de origen)
 *   --arpeggio             En vez de la pentatónica del acorde, usa sus chord tones (el modo
 *                          "arpegio" de siempre) — para comparar o si en realidad quieres eso.
 *   --positions <lista>     Formas de partida a generar, coma-separadas (por defecto: las 5,
 *                          E,D,C,A,G) — una única "Forma de partida" por vídeo, el resto del tema
 *                          encadena por cercanía a partir de ahí (ver "Forma de partida" en la
 *                          pestaña Arpegios).
 *   --cyclelen <n>          "Compases por ciclo" — el mismo valor que pusiste en Audio & XML. Sin
 *                          esto se queda en el valor por defecto de la app (12).
 *   --whole-theme            "Compases por ciclo" = Tema completo (excluyente con --cyclelen)
 *   --visconfig <path>      JSON con el "Configuración" (gv_vis) tal cual lo ves en tu propio
 *                          navegador — Playwright arranca con un perfil limpio, sin ese
 *                          localStorage. Consíguelo con `localStorage.getItem('gv_vis')` en la
 *                          consola del navegador. nextPreview se fuerza a true siempre.
 *   --extra <seg>           Segundos extra al final de cada vídeo (por defecto: 2)
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

const CAGED_POS_LABELS = ['E', 'D', 'C', 'A', 'G'];

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

// Ver comentario equivalente en generate-scale-arpeggio-videos.js: busca, en el vídeo silencioso
// YA grabado, el primer fotograma en el que la marca de calibración aparece.
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

async function runOne({ appUrl, xmlPath, audioPath, audioDuration, usePenta, startPos, cycleLen, wholeTheme, extraSec, width, height, outDir, tmpDir, visConfig }) {
  const tag = `forma${startPos}`;
  const log = (msg) => console.log(`[${tag}] ${msg}`);

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
    await page.waitForFunction(() => typeof ashAutoGenerateForTheme === 'function', null, { timeout: 20000 });

    flipTimestamp = await page.evaluate(() => new Promise((resolve) => {
      const marker = document.createElement('div');
      marker.id = '__syncMarker';
      marker.style.cssText = 'position:fixed;top:0;left:0;width:48px;height:48px;background:#000;z-index:2147483647;pointer-events:none;';
      document.body.appendChild(marker);
      // Antes solo 2 rAF (~33ms) de negro antes de pasar a blanco — si la grabación tarda lo más
      // mínimo en empezar a capturar de verdad, se perdía ese negro entero y
      // detectMarkerFrameTime nunca confirmaba "ya vi el fondo oscuro" antes del blanco, así que
      // ignoraba el salto real (bug reportado: sincronización imprecisa, caía siempre al método
      // de respaldo). Mantenerlo negro más tiempo (~400ms) da mucho más margen.
      requestAnimationFrame(() => {
        setTimeout(() => {
          marker.style.background = '#fff';
          resolve(performance.timeOrigin + performance.now());
        }, 400);
      });
    }));
    // Antes se quitaba la marca casi al instante (1-2 fotogramas en blanco) — si la grabación
    // tarda lo más mínimo en empezar a capturar de verdad (variable, depende de la máquina/carga),
    // se perdía esos 1-2 fotogramas por completo y detectMarkerFrameTime nunca encontraba el
    // salto oscuro→blanco, cayendo siempre al método de respaldo (recordStartAt, "menos preciso"
    // — bug reportado: "la sincronización no está del todo bien"). Dejarla en blanco más tiempo
    // (aquí, ~15 fotogramas a 25fps) da mucho más margen sin coste real (se quita mucho antes de
    // que aparezca nada del ejercicio).
    await page.waitForTimeout(600);
    await page.evaluate(() => { const m = document.getElementById('__syncMarker'); if (m) m.remove(); });
    await page.evaluate((vc) => { const cfg = { ...getVisConfig(), ...(vc || {}), nextPreview: true }; localStorage.setItem('gv_vis', JSON.stringify(cfg)); applyVisConfig(cfg); }, visConfig || null);

    log('cargando XML…');
    await page.setInputFiles('#xmlPicker', [xmlPath]);
    await page.waitForFunction(() => typeof cycles !== 'undefined' && cycles.length > 0, null, { timeout: 20000 });
    if (wholeTheme) {
      log('ajustando "Compases por ciclo" a Tema completo…');
      await page.evaluate(() => setCycleToWholeTheme());
    } else if (cycleLen) {
      log(`ajustando "Compases por ciclo" a ${cycleLen}…`);
      await page.evaluate((n) => applyCycleLen(n), cycleLen);
    }

    log('generando posiciones y encadenando por cercanía desde Forma ' + startPos + '…');
    const result = await page.evaluate(({ usePenta, startPos }) => {
      showTab('generate');
      const cb = document.getElementById('ashUsePenta');
      if (cb) cb.checked = usePenta;
      const sp = document.getElementById('ashStartPos');
      if (sp) sp.value = startPos || '';
      ashAutoGenerateForTheme();
      return {
        autoStatus: document.getElementById('ashAutoStatus')?.textContent || '',
        sendStatus: document.getElementById('ashSendStatus')?.textContent || '',
        exerciseType: typeof getExerciseType === 'function' ? getExerciseType() : null,
      };
    }, { usePenta, startPos });
    log('estado: ' + result.autoStatus);
    if (!/todos los acordes cubiertos/.test(result.sendStatus)) {
      log('AVISO — algún acorde del tema se quedó sin fotograma: ' + result.sendStatus);
    }
    if (result.exerciseType !== 'arpeggios') throw new Error('exerciseType no cambió a "arpeggios" — revisa ashAutoGenerateForTheme.');

    log('cargando audio…');
    await page.setInputFiles('#audioPicker', [audioPath]);
    await page.waitForFunction(() => { const el = document.getElementById('audioStatus'); return el && el.classList.contains('ok'); }, null, { timeout: 20000 });

    await page.evaluate(() => { if (!document.body.classList.contains('presentation')) togglePresentation(); if (typeof stopAll === 'function') stopAll(); });
    await page.waitForTimeout(300);

    const total = audioDuration + extraSec;
    log(`grabando… (~${total.toFixed(1)}s)`);
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
    playStartCurrentTime = 0;
    const spread = t0Candidates[nS - 1] - t0Candidates[0];
    log(`arranque real (t0) de ${nS} muestras estables (audio en ${stampInfo[0].c.toFixed(3)}s-${stampInfo[nS - 1].c.toFixed(3)}s) · dispersión=${spread.toFixed(1)}ms`);
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
  const trimOffsetSec = Math.max(0, ((playStartAt || videoStartRef) - videoStartRef) / 1000 - playStartCurrentTime);

  const baseName = path.basename(xmlPath, path.extname(xmlPath));
  const kindTag = usePenta ? 'Pentatonica' : 'Arpegio';
  const outPath = path.join(outDir, `${baseName}_${kindTag}_${tag}.mp4`);
  log(`mezclando audio con ffmpeg (recortando ${trimOffsetSec.toFixed(2)}s de arranque)…`);
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
    + '  node scripts/generate-pentatonic-chord-videos.js --xml <tema.xml> --audio <tema.m4a> [--out <dir>]\n'
    + '(--arpeggio para chord tones en vez de la pentatónica del acorde.)';
  if (!args.xml || !args.audio) { console.error(usage); process.exit(1); }
  if (args.cyclelen && args['whole-theme']) { console.error('--cyclelen y --whole-theme son excluyentes.'); process.exit(1); }
  await waitFfmpeg();

  const appPath = path.resolve(args.app || path.join(__dirname, '..', 'guitarvisualizer.html'));
  const appUrl = 'file://' + appPath;
  const xmlPath = path.resolve(args.xml);
  const audioPath = path.resolve(args.audio);
  const outDir = path.resolve(args.out || './video-out');
  fs.mkdirSync(outDir, { recursive: true });
  const usePenta = !args.arpeggio;
  const positions = (args.positions ? String(args.positions).split(',') : CAGED_POS_LABELS).map((s) => s.trim().toUpperCase());
  for (const p of positions) {
    if (!CAGED_POS_LABELS.includes(p)) { console.error(`Forma desconocida: ${p} (debe ser una de ${CAGED_POS_LABELS.join(', ')})`); process.exit(1); }
  }
  const cycleLen = args.cyclelen ? parseInt(args.cyclelen, 10) : null;
  const wholeTheme = !!args['whole-theme'];
  const extraSec = args.extra ? parseFloat(args.extra) : 2;
  const width = args.width ? parseInt(args.width, 10) : 1600;
  const height = args.height ? parseInt(args.height, 10) : 900;
  const concurrency = args.concurrency ? Math.max(1, parseInt(args.concurrency, 10)) : 1;
  const visConfig = args.visconfig ? JSON.parse(fs.readFileSync(path.resolve(args.visconfig), 'utf8')) : null;

  const audioDuration = await getAudioDurationSeconds(audioPath);
  console.log(`Modo: ${usePenta ? 'Pentatónica del acorde' : 'Arpegio (chord tones)'} · Audio: ${audioPath} (${audioDuration.toFixed(1)}s) · posiciones: ${positions.join(', ')}`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-pentachord-'));
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < positions.length) {
      const startPos = positions[idx++];
      const out = await runOne({ appUrl, xmlPath, audioPath, audioDuration, usePenta, startPos, cycleLen, wholeTheme, extraSec, width, height, outDir, tmpDir, visConfig });
      results.push(out);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, positions.length) }, worker));
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log(`\n${results.length}/${positions.length} vídeos generados en ${outDir}`);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
