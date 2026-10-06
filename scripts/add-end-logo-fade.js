#!/usr/bin/env node
/*
 * Añade a un vídeo YA montado (editado fuera de la app) el mismo remate que llevan los vídeos generados:
 * fundido a negro con el logo del canal (ver #endFadeOverlay / armEndFade() en guitarvisualizer.html).
 *   - los últimos --fade s (1.4, END_FADE_SEC) del vídeo se funden a negro + logo (y el audio se apaga),
 *   - después el logo se queda --hold s (2, VIDEO_GEN_EXTRA_SEC) en silencio.
 * El logo se pinta con Playwright con el mismo CSS (38 % de la pantalla, halo drop-shadow) al tamaño del vídeo.
 *
 * Uso: node scripts/add-end-logo-fade.js <video> [--out <fichero>] [--fade 1.4] [--hold 2] [--crf 18]
 * Salida por defecto: junto al original, <nombre>_conLogo.mp4 (el original no se toca).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);

const a = { _: [] };
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith('--')) a[k.slice(2)] = process.argv[++i]; else a._.push(k); }
const IN = a._[0];
if (!IN) { console.error('Uso: node scripts/add-end-logo-fade.js <video> [--out <fichero>] [--fade 1.4] [--hold 2] [--crf 18]'); process.exit(1); }
const FADE = parseFloat(a.fade || 1.4), HOLD = parseFloat(a.hold || 2), CRF = String(a.crf || 18);
const OUT = a.out || path.join(path.dirname(IN), path.basename(IN, path.extname(IN)) + '_conLogo.mp4');
const LOGO = path.resolve(__dirname, '..', 'img', 'logotransparente.png');

async function probe(f) {
  let err = '';
  try { await execFileP('ffmpeg', ['-hide_banner', '-i', f]); } catch (e) { err = e.stderr || ''; }
  const d = err.match(/Duration:\s*(\d+):(\d+):([\d.]+)/), v = err.match(/Stream.*Video:.*?(\d{3,5})x(\d{3,5})/), fps = err.match(/([\d.]+) fps/);
  if (!d || !v) throw new Error('No puedo leer el vídeo: ' + (err.trim().split('\n').pop() || f));
  return { dur: +d[1] * 3600 + +d[2] * 60 + +d[3], w: +v[1], h: +v[2], fps: fps ? fps[1] : '30', audio: /Stream.*Audio:/.test(err) };
}

(async () => {
  const { dur, w, h, fps, audio } = await probe(IN);
  console.log(`${path.basename(IN)}: ${w}x${h} ${fps} fps, ${dur.toFixed(2)} s${audio ? '' : ', sin audio'}`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-logo-'));
  const card = path.join(tmp, 'logo.png');

  // Mismo aspecto que #endFadeOverlay: negro, logo centrado al 38 % y halo azulado alrededor de la púa.
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const k = h / 900; // el halo está pensado para la ventana de grabación (900 px de alto)
  await page.setContent(`<body style="margin:0;background:#000;width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center">
    <img src="data:image/png;base64,${fs.readFileSync(LOGO).toString('base64')}" style="max-width:38%;max-height:38%;object-fit:contain;
      filter:drop-shadow(0 0 ${2 * k}px rgba(255,255,255,.85)) drop-shadow(0 0 ${10 * k}px rgba(180,210,255,.55)) drop-shadow(0 0 ${22 * k}px rgba(140,180,255,.3))"></body>`);
  await page.screenshot({ path: card });
  await browser.close();

  const st = Math.max(0, dur - FADE), total = dur + HOLD;
  const vf = `[0:v]tpad=stop_mode=clone:stop_duration=${HOLD + 1},setsar=1[b];[1:v]format=rgba,fade=in:st=${st}:d=${FADE}:alpha=1[c];[b][c]overlay=format=auto,format=yuv420p[v]`;
  const args = ['-hide_banner', '-loglevel', 'error', '-stats', '-y', '-i', IN, '-loop', '1', '-framerate', fps, '-i', card];
  if (audio) args.push('-filter_complex', `${vf};[0:a]afade=out:st=${st}:d=${FADE},apad=pad_dur=${HOLD + 1}[a]`, '-map', '[v]', '-map', '[a]', '-c:a', 'aac', '-b:a', '192k');
  else args.push('-filter_complex', vf, '-map', '[v]');
  args.push('-t', total.toFixed(3), '-c:v', 'libx264', '-preset', 'medium', '-crf', CRF, '-movflags', '+faststart', OUT);
  await new Promise((res, rej) => { const p = require('child_process').spawn('ffmpeg', args, { stdio: 'inherit' }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg salió con ' + c)))); });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n✓ ${OUT} (${total.toFixed(1)} s)`);
})().catch((e) => { console.error('✗ ' + e.message); process.exit(1); });
