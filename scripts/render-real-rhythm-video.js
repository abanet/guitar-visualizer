#!/usr/bin/env node
/*
 * Genera el vídeo de "Ritmos Reales" (título/autor/BPM/tonalidad + fondo animado aleatorio)
 * SIN necesidad de tener la pestaña visible ni de conceder permiso de compartir pantalla —
 * mismo enfoque que scripts/generate-triad-videos.js y scripts/render-rhythm-video.js: Chrome
 * headless + Playwright graba la pestaña por debajo, ffmpeg mezcla el audio real encima.
 *
 * A diferencia de generateVideo() (botón "Generar vídeo" de la app, que usa getDisplayMedia()
 * y por tanto exige una pestaña real visible + gesto del usuario), este script rellena los
 * campos de la sección "Ritmos Reales" por DOM y arranca la reproducción directamente — no hay
 * captura de pantalla real de por medio, solo el propio contexto de Playwright grabándose a
 * sí mismo (recordVideo), que no requiere pantalla ni permisos.
 *
 * Uso normal (recomendado): exporta "config.json" desde la propia app (pestaña Ritmos →
 * Ritmos Reales → botón "Exportar config.json") y déjalo junto al audio del tema, en su propia
 * carpeta — así no hay que teclear título/autor/BPM/tonalidad/estilo cada vez:
 *   node scripts/render-real-rhythm-video.js --dir ./mis-ritmos/ojos-asi
 *
 * <dir>/config.json:
 *   { "title": "Nombre del tema", "author": "Autor", "bpm": "96", "key": "Bbm",
 *     "genre": "Jazz", "subgenre": "Jazz Fusion", "style": "particles" }
 *
 * También se puede usar sin carpeta, pasando cada dato por CLI (o para pisar algún campo del
 * config.json de la carpeta):
 *   node scripts/render-real-rhythm-video.js --audio tema.mp3 --title "Nombre del tema" \
 *     --author "Autor" --bpm 96 --key Bbm --genre Jazz --subgenre "Jazz Fusion" \
 *     --style particles --out ./video-out
 *
 * Opciones:
 *   --app <path>       Ruta al HTML de la app (por defecto: guitarvisualizer.html)
 *   --dir <path>         Carpeta con UN audio + config.json (alternativa a --audio; si se pasan
 *                        ambos, --dir solo aporta el config.json y --audio manda para el audio)
 *   --audio <path>      Audio m4a/mp3/wav (obligatorio si no se pasa --dir)
 *   --title <texto>      Título mostrado en el vídeo (si no se pasa, se lee de config.json)
 *   --author <texto>     Autor mostrado en el vídeo (si no se pasa, se lee de config.json)
 *   --bpm <n>            BPM mostrado en el vídeo, solo informativo (si no se pasa, de config.json)
 *   --key <tonalidad>    Tonalidad mostrada en el vídeo, p.ej. "Bbm" (si no se pasa, de config.json)
 *   --genre <texto>      Estilo musical, p.ej. "Jazz" (si no se pasa, de config.json)
 *   --subgenre <texto>   Subestilo musical, p.ej. "Jazz Fusion" (si no se pasa, de config.json)
 *   --style <estilo>     particles | waves | shapes (si no se pasa, de config.json; por defecto particles)
 *   --out <dir>          Carpeta de salida (por defecto: ./video-out)
 *   --name <texto>       Nombre base del archivo de salida (por defecto: se deriva del título o del audio)
 *   --extra <seg>        Segundos extra al final del vídeo, para el fundido a negro + logo (por defecto: 2)
 *   --width/--height     Tamaño del viewport grabado (por defecto: 1600x900)
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);
const { waitFfmpeg, getAudioDurationSeconds } = require('./lib/batch-sessions');

const AUDIO_EXT_RE = /\.(m4a|mp3|wav|aac|aiff?|caf)$/i;

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
function sanitizeName(name) {
  return String(name || 'ritmo-real').replace(/[^\w\-]+/g, '_').slice(0, 60) || 'ritmo-real';
}
function findAudioInDir(dir) {
  const f = fs.readdirSync(dir).find((n) => AUDIO_EXT_RE.test(n));
  return f ? path.join(dir, f) : null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dir && !args.audio) {
    console.error('Uso: node scripts/render-real-rhythm-video.js --dir <carpeta-con-audio-y-config.json>');
    console.error('  o: node scripts/render-real-rhythm-video.js --audio <archivo> [--title ...] [--author ...] [--bpm ...] [--key ...] [--style particles|waves|shapes] [opciones]');
    process.exit(1);
  }
  await waitFfmpeg();

  const repoRoot = path.resolve(__dirname, '..');
  const appPath = path.resolve(repoRoot, args.app || 'guitarvisualizer.html');
  const dirAbs = args.dir ? path.resolve(args.dir) : null;

  let fileCfg = {};
  if (dirAbs) {
    const configPath = path.join(dirAbs, 'config.json');
    if (fs.existsSync(configPath)) fileCfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    else console.warn('Aviso: no hay config.json en ' + dirAbs + ' — se usan solo los flags de línea de comandos.');
  }
  const audioPath = path.resolve(args.audio || (dirAbs && findAudioInDir(dirAbs)) || '');
  if (!args.audio && dirAbs && !findAudioInDir(dirAbs)) { console.error('No se encontró ningún audio en ' + dirAbs); process.exit(1); }

  const outDir = path.resolve(args.out || './video-out');
  const title = args.title ? String(args.title) : String(fileCfg.title || '');
  const author = args.author ? String(args.author) : String(fileCfg.author || '');
  const bpm = args.bpm ? String(args.bpm) : String(fileCfg.bpm || '');
  const key = args.key ? String(args.key) : String(fileCfg.key || '');
  const genre = args.genre ? String(args.genre) : String(fileCfg.genre || '');
  const subgenre = args.subgenre ? String(args.subgenre) : String(fileCfg.subgenre || '');
  const styleRaw = args.style || fileCfg.style;
  const style = ['particles', 'waves', 'shapes'].includes(styleRaw) ? styleRaw : 'particles';
  const extraSec = args.extra !== undefined ? parseFloat(args.extra) : 2;
  const width = args.width ? parseInt(args.width, 10) : 1600;
  const height = args.height ? parseInt(args.height, 10) : 900;
  const baseName = sanitizeName(args.name || title || path.basename(audioPath, path.extname(audioPath)));

  for (const p of [appPath, audioPath]) {
    if (!fs.existsSync(p)) { console.error('No existe: ' + p); process.exit(1); }
  }
  fs.mkdirSync(outDir, { recursive: true });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-video-'));

  const appUrl = 'file://' + appPath;
  const audioDuration = await getAudioDurationSeconds(audioPath);
  console.log(`Audio: ${audioDuration.toFixed(1)}s (${path.basename(audioPath)}) — estilo: ${style}`);

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: { dir: tmpDir, size: { width, height } },
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('console.error: ' + m.text()); });

  const recordStartAt = Date.now();
  let playStartAt = null;
  let stepError = null;
  let appVersion = 'unknown';
  try {
    console.log('cargando app…');
    await page.goto(appUrl);
    appVersion = await page.evaluate(() => (typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'unknown'));

    console.log('rellenando título/autor/BPM/tonalidad/estilo…');
    await page.evaluate(({ title, author, bpm, key, genre, subgenre, style }) => {
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      set('rrTitle', title); set('rrAuthor', author); set('rrBpm', bpm); set('rrKey', key);
      set('rrGenre', genre); set('rrSubgenre', subgenre);
      set('rrAnimStyle', style);
      if (typeof setRRAnimStyle === 'function') setRRAnimStyle(style);
    }, { title, author, bpm, key, genre, subgenre, style });

    console.log('cargando audio…');
    await page.setInputFiles('#rrAudioPicker', [audioPath]);
    await page.waitForFunction(() => {
      const el = document.getElementById('rrAudioStatus');
      return el && el.classList.contains('ok');
    }, null, { timeout: 20000 });

    console.log('activando Ritmos Reales…');
    await page.evaluate(() => {
      document.getElementById('exerciseType').value = 'realrhythm';
      setExerciseType('realrhythm');
    });

    const total = audioDuration + extraSec;
    console.log(`duración objetivo: ${total.toFixed(1)}s (audio ${audioDuration.toFixed(1)}s + ${extraSec}s extra)`);

    await page.evaluate(() => {
      showTab('player');
      if (!document.body.classList.contains('presentation')) togglePresentation();
      stopAll();
    });
    await page.waitForTimeout(300); // deja asentar el layout de presentación

    // Mismo criterio de timestamp que generate-triad-videos.js: se toma DENTRO del navegador,
    // en el evento 'playing' real, para que la vuelta por CDP no se cuele como desync constante.
    playStartAt = await page.evaluate(() => new Promise((resolve) => {
      const stamp = () => resolve(performance.timeOrigin + performance.now());
      startIt();
      if (!audioEl.paused && audioEl.currentTime > 0) { stamp(); return; }
      const onPlaying = () => { audioEl.removeEventListener('playing', onPlaying); stamp(); };
      audioEl.addEventListener('playing', onPlaying);
      setTimeout(stamp, 2000); // failsafe: no colgarse si el evento no llega
    }));
    console.log(`grabando… (arranque: ${((playStartAt - recordStartAt) / 1000).toFixed(2)}s de setup a recortar)`);
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

  const outPath = path.join(outDir, `${baseName}.mp4`);
  console.log(`mezclando audio con ffmpeg (recortando ${trimOffsetSec.toFixed(2)}s de arranque)…`);
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
  console.log(`✓ ${outPath}`);
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
