#!/usr/bin/env node
/*
 * Genera en lote los vídeos de tríadas (grupo de cuerdas fijo × inversión fija) a partir de
 * un MusicXML + un audio, SIN necesidad de ver nada en pantalla ni de generar cada ejercicio
 * a mano en la app.
 *
 * Cómo funciona (no toca el motor de reproducción en vivo — solo lo pilota desde fuera):
 *  1. Para cada combinación (grupo de cuerdas × inversión), abre la app en un Chrome headless
 *     (no aparece en tu pantalla), carga el XML + audio, y llama a autoGenerateTriads() con
 *     "misma figura" fijada a esa combinación — la misma función que usa el botón "Generar
 *     tríadas automáticas" de la pestaña Tríadas.
 *  2. Activa modo presentación, arranca la reproducción real (audio + visualizador) y Playwright
 *     graba ese vídeo por debajo (sin audio, WebM). Tarda lo mismo que dura el audio + la cola
 *     extra — pero en segundo plano, sin bloquear tu pantalla.
 *  3. Varias combinaciones corren EN PARALELO (--concurrency), así el lote completo no tarda
 *     12× la duración del audio.
 *  4. ffmpeg mezcla el vídeo silencioso con el audio real y lo re-codifica a .mp4.
 *
 * Uso:
 *   node scripts/generate-triad-videos.js --xml tema.musicxml --audio tema.m4a --out ./videos
 *
 * Opciones:
 *   --app <path>         Ruta al HTML de la app (por defecto: guitarvisualizer.html)
 *   --xml <path>          MusicXML con la progresión de acordes (obligatorio)
 *   --audio <path>        Audio m4a/mp3/wav (obligatorio)
 *   --out <dir>            Carpeta de salida (por defecto: ./video-out)
 *   --extra <seg>         Segundos extra al final de cada vídeo (por defecto: 2)
 *   --cycle-len <n>       Compases por ciclo (por defecto: el que traiga el campo, 12)
 *   --vis-config <path>   JSON con la configuración de "Elementos" a aplicar (opcional). Si no se
 *                         indica, se usa scripts/lib/default-triad-vis-config.json (fondo
 *                         automático activo, estilo propio de notas y mástil realista — vale
 *                         para el 98% de los casos, ver project_triads_color_regression en
 *                         memoria). Puede incluir "bgAuto":{"mode":"figure"|"scale"|"off",
 *                         "root":"C","scale":"major"} para el fondo automático.
 *   --groups <lista>      Índices de grupo de cuerdas a generar, coma-separados (por defecto: 0,1,2,3)
 *   --invs <lista>        Índices de inversión a generar, coma-separados (por defecto: 0,1,2)
 *   --concurrency <n>     Vídeos en paralelo (por defecto: 1 — más sube el riesgo de saltos en la animación en máquinas de pocos núcleos)
 *   --width/--height      Tamaño del viewport grabado (por defecto: 1600x900)
 */
const { chromium } = require('/Users/alberto/guitar-visualizer/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);
const { acquireRenderLock } = require('/Users/alberto/guitar-visualizer/scripts/lib/batch-sessions');

const GROUP_LABELS = { 0: 'cuerdas432', 1: 'cuerdas543', 2: 'cuerdas654', 3: 'cuerdas321' };
const INV_LABELS = { 0: 'fundamental', 1: 'inv1', 2: 'inv2' };

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

// Duración del audio calculada con ffmpeg directamente sobre el archivo, sin depender de
// leer `audioEl.duration` dentro de la página (esa variable es un `let` de módulo, no cuelga
// de `window`, así que no es accesible desde fuera vía page.evaluate).
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

async function runOne({ appUrl, xmlPath, audioPath, audioDuration, extraSec, cycleLen, visConfig, gi, inv, width, height, outDir, tmpDir }) {
  const groupLabel = GROUP_LABELS[gi] || `grupo${gi}`;
  const invLabel = INV_LABELS[inv] || `inv${inv}`;
  const tag = `${groupLabel}_${invLabel}`;
  const log = (msg) => console.log(`[${tag}] ${msg}`);

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width, height },
  });
  if (visConfig) {
    await context.addInitScript((cfg) => {
      try { if (cfg.vis) localStorage.setItem('gv_vis', JSON.stringify(cfg.vis)); } catch (e) {}
      try { if (cfg.colors) localStorage.setItem('gv_colors', JSON.stringify(cfg.colors)); } catch (e) {}
      try { if (cfg.maxFretsShown != null) localStorage.setItem('gv_maxFretsShown', String(cfg.maxFretsShown)); } catch (e) {}
      try { if (cfg.previewMaxFrets != null) localStorage.setItem('gv_previewMaxFrets', String(cfg.previewMaxFrets)); } catch (e) {}
    }, visConfig);
  }
  await context.addInitScript(() => {
    const real = { now: performance.now.bind(performance), raf: window.requestAnimationFrame.bind(window), caf: window.cancelAnimationFrame.bind(window),
      st: window.setTimeout.bind(window), ct: window.clearTimeout.bind(window), si: window.setInterval.bind(window), ci: window.clearInterval.bind(window) };
    const V = { on: false, t: 0, base: 0, rafs: new Map(), timers: new Map(), id: 1e6 };
    performance.now = () => (V.on ? V.base + V.t * 1000 : real.now());
    window.requestAnimationFrame = (cb) => { if (!V.on) return real.raf(cb); const id = ++V.id; V.rafs.set(id, cb); return id; };
    window.cancelAnimationFrame = (id) => { if (V.rafs.delete(id)) return; real.caf(id); };
    window.setTimeout = (cb, ms, ...a) => { if (!V.on || typeof cb !== 'function') return real.st(cb, ms, ...a); const id = ++V.id; V.timers.set(id, { at: V.t + (ms || 0) / 1000, cb: () => cb(...a) }); return id; };
    window.clearTimeout = (id) => { if (V.timers.delete(id)) return; real.ct(id); };
    window.setInterval = (cb, ms, ...a) => { if (!V.on || typeof cb !== 'function') return real.si(cb, ms, ...a); const id = ++V.id; const every = Math.max(0.001, (ms || 0) / 1000); V.timers.set(id, { at: V.t + every, every, cb: () => cb(...a) }); return id; };
    window.clearInterval = (id) => { if (V.timers.delete(id)) return; real.ci(id); };
    window.__virt = {
      enable(audio) {
        V.base = real.now(); V.on = true; V.t = 0;
        const dur = audio.duration;
        Object.defineProperty(audio, 'currentTime', { configurable: true, get: () => Math.min(V.t, dur - 0.02), set: () => {} });
        Object.defineProperty(audio, 'paused', { configurable: true, get: () => false });
        audio.play = () => Promise.resolve(); audio.pause = () => {};
      },
      step(t, dt) {
        V.t = t;
        for (let guard = 0; guard < 50; guard++) {  // temporizadores vencidos, en orden
          let nid = null, nt = null; for (const [id, x] of V.timers) if (x.at <= t && (nt === null || x.at < nt.at)) { nid = id; nt = x; }
          if (!nt) break;
          if (nt.every) nt.at += nt.every; else V.timers.delete(nid);
          try { nt.cb(); } catch (e) { console.error(e); }
        }
        const cbs = [...V.rafs.values()]; V.rafs.clear();
        const ts = V.base + t * 1000;
        for (const cb of cbs) { try { cb(ts); } catch (e) { console.error(e); } }
        for (const a of document.getAnimations()) {   // transiciones/animaciones CSS: avanzan con el reloj virtual
          a._gvT = (a._gvT === undefined) ? 0 : a._gvT + dt * 1000;
          const end = a.effect ? a.effect.getComputedTiming().endTime : Infinity;
          if (a._gvT >= end) { a.finish(); continue; }
          a.pause(); a.currentTime = a._gvT;
        }
      },
    };
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => log('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') log('console.error: ' + m.text()); });

  // Playwright graba desde que se crea la página, no desde que arranca la reproducción real —
  // todo el setup previo queda al principio del vídeo silencioso mostrando el Editor. Medimos
  // ese "arranque" para recortarlo luego con ffmpeg y que el vídeo empiece justo con el audio.
  const recordStartAt = Date.now();
  let playStartAt = null;
  let stepError = null;
  let appVersion = 'unknown';
  try {
    log('cargando app…');
    await page.goto(appUrl);
    appVersion = await page.evaluate(() => (typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'unknown'));

    if (cycleLen) {
      // Los campos viven en pestañas ocultas (display:none) mientras no se seleccionan — se
      // manipulan directamente por DOM en vez de page.fill()/click(), que exigen visibilidad.
      await page.evaluate((v) => {
        const el = document.getElementById('cycleLenAudio');
        el.value = String(v);
        if (typeof applyCycleLen === 'function') applyCycleLen(String(v));
      }, cycleLen);
    }

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

    log(`generando tríadas (${groupLabel}, ${invLabel})…`);
    const info = await page.evaluate(({ gi }) => {
      // PROTOTIPO: una forma fija por acorde, elegida para que el tema ENTERO mueva los dedos lo mínimo.
      // NIVEL INTERMEDIO: una zona de 4 trastes (la mano no se mueve), cualquier grupo de cuerdas,
      // una forma fija por acorde, mínimo movimiento de dedos en el tema entero. Se excluye la zona del nivel fácil.
      const mov = (a, b) => b.notes.reduce((t, n) => { const m = a.notes.find((x) => x.string === n.string); return t + (m ? Math.abs(m.fret - n.fret) : 2); }, 0);
      const resolver = (chords, filtro, grupos) => {
        const uniq = [...new Set(chords)];
        // Solo los grupos de cuerdas permitidos (1-2-3 y 2-3-4: los graves suenan embarullados).
        const cands = uniq.map((ch) => triadCandidates(ch, filtro).filter((c) => !grupos || grupos.includes(c.group.join(''))));
        if (cands.some((c) => !c.length)) return null;
        const idx = chords.map((ch) => uniq.indexOf(ch));
        let best = null, bestCost = Infinity; const pick = new Array(uniq.length).fill(0);
        const total = () => { let t = 0; for (let k = 1; k < idx.length; k++) if (idx[k] !== idx[k - 1]) t += mov(cands[idx[k - 1]][pick[idx[k - 1]]], cands[idx[k]][pick[idx[k]]]);
          return t + 0.001 * pick.reduce((x, p, u) => x + cands[u][p].centerFret, 0); };  // a igualdad, lo más grave (mismo criterio que el nivel fácil)
        const rec = (u) => { if (u === uniq.length) { const c = total(); if (c < bestCost) { bestCost = c; best = pick.slice(); } return; }
          for (let p = 0; p < cands[u].length; p++) { pick[u] = p; rec(u + 1); } };
        rec(0);
        return { uniq, cands, best, bestCost };
      };
      const zonas = [];
      const elegir = (chords) => {
        // Zona del nivel fácil (grupo de cuerdas gi, sin límite de trastes): el intermedio no puede
        // compartir con ella más de un traste.
        const facil = resolver(chords, { groupIdx: gi });
        let fMin = 99, fMax = -1;
        if (facil) facil.best.forEach((p, u) => { fMin = Math.min(fMin, facil.cands[u][p].minF); fMax = Math.max(fMax, facil.cands[u][p].maxF); });
        zonas.push({ zonaFacil: fMin + '-' + fMax });
        let mejor = null;
        for (const ancho of [3, 4, 5]) {            // 4 trastes; si no hay ninguna zona válida, 5
          for (let z = 1; z <= 12; z++) {
            const solape = Math.max(0, Math.min(z + ancho, fMax) - Math.max(z, fMin) + 1);
            if (solape > 1) continue;
            const r = resolver(chords, { fretMin: z, fretMax: z + ancho }, ['234', '345']);
            zonas.push({ zona: z + '-' + (z + ancho), mov: r ? Math.round(r.bestCost) : 'no caben' });
            if (r && (!mejor || r.bestCost < mejor.bestCost)) { mejor = r; mejor.zona = z + '-' + (z + ancho); }
          }
          if (mejor) break;
        }
        return mejor;
      };
      const libre = generateTriadVoiceLeading;
      let dump = null;
      window.generateTriadVoiceLeading = function (chords) {
        const r = elegir(chords);
        const antes = libre(chords, {}); let costAntes = 0, cambiosGrupo = 0;
        for (let k = 1; k < antes.length; k++) if (antes[k] && antes[k - 1] && chords[k] !== chords[k - 1]) {
          if (antes[k].group.join() !== antes[k - 1].group.join()) cambiosGrupo++; else costAntes += mov(antes[k - 1], antes[k]); }
        const formasAntes = {}; chords.forEach((ch, k) => { if (antes[k]) (formasAntes[ch] = formasAntes[ch] || new Set()).add(antes[k].group.join('') + ':' + antes[k].voicing.frets.join('-')); });
        dump = { zona: r.zona, zonas, formas: r.uniq.map((ch, u) => ({ acorde: ch, cuerdas: r.cands[u][r.best[u]].group.map((x) => 6 - x).join(''), inv: r.cands[u][r.best[u]].inv, trastes: r.cands[u][r.best[u]].voicing.frets })), movTotal: Math.round(r.bestCost), cambios: chords.filter((c, k) => k && c !== chords[k - 1]).length,
          antes: { movMismoGrupo: costAntes, cambiosDeGrupo: cambiosGrupo, formasPorAcorde: Object.fromEntries(Object.entries(formasAntes).map(([k, v]) => [k, v.size])) } };
        return chords.map((ch) => r.cands[r.uniq.indexOf(ch)][r.best[r.uniq.indexOf(ch)]]);
      };
      window.__dump = () => dump;
      return 'parche aplicado';
    }, { gi, inv });
    log(info);
    await page.evaluate(() => autoGenerateTriads());
    // En este ejercicio el mástil muestra SIEMPRE nombres de nota: en 'auto' las vueltas pares pasan a intervalos.
    await page.evaluate(() => { const g = document.getElementById('globalNoteDisplay'); if (g) { g.value = 'notes'; if (typeof onGlobalNoteDisplayChange === 'function') onGlobalNoteDisplayChange(); } });
    log(JSON.stringify(await page.evaluate(() => window.__dump())));

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

    // "Fondo automático" (bgAuto: notas fantasma en todo el mástil) — es estado de SESIÓN, no
    // localStorage, así que no lo cubre el bloque de gv_vis/gv_colors de arriba (bug real, ago
    // 2026: generado así siempre salía con bgAuto.mode='off', sin fondo — ver
    // project_triads_color_regression). Por defecto activo ('figure': muestra el resto de notas
    // de la tríada/acorde que suena), salvo que --vis-config indique otra cosa explícitamente.
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
    await page.waitForTimeout(300); // deja asentar el layout de presentación

    const fps = 25, frames = Math.ceil(total * fps);
    const outPath0 = path.join(outDir, `triads_${tag}.mp4`);
    const ff = require('child_process').spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', 'pipe:0', '-i', audioPath,
      '-filter_complex', `[0:v]scale=in_range=pc:out_range=tv,format=yuv420p[v];[1:a]apad=pad_dur=${extraSec}[a]`, '-map', '[v]', '-map', '[a]',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-b:a', '192k', '-shortest', outPath0], { stdio: ['pipe', 'ignore', 'pipe'] });
    let ffErr = ''; ff.stderr.on('data', (d) => { ffErr = (ffErr + d).slice(-3000); });
    const ffDone = new Promise((res, rej) => { ff.on('error', rej); ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c + ': ' + ffErr.slice(-500))))); });
    ff.stdin.on('error', () => {});
    await page.evaluate(() => { window.__virt.enable(audioEl); startIt(); });
    const cdp = await context.newCDPSession(page);
    log(`pintando ${frames} fotogramas a ${fps}fps…`);
    const t0 = Date.now();
    for (let n = 0; n < frames; n++) {
      const painted = cdp.send('Runtime.evaluate', { expression: `__virt.step(${((n + 0.5) / fps).toFixed(6)},${n ? (1 / fps).toFixed(6) : 0})` });
      const shot = cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 95, optimizeForSpeed: true });
      const r = await painted; if (r.exceptionDetails) throw new Error('step falló: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
      const buf = Buffer.from((await shot).data, 'base64');
      if (!ff.stdin.write(buf)) await new Promise((res) => ff.stdin.once('drain', res));
    }
    ff.stdin.end(); await ffDone;
    log(`render: ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  } catch (e) {
    stepError = e;
  }
  await page.close().catch(() => {});
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
  if (stepError) throw stepError;
  const outPath = path.join(outDir, `triads_${tag}.mp4`);
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
  if (!args.xml || !args.audio) {
    console.error('Uso: node scripts/generate-triad-videos.js --xml <archivo.musicxml> --audio <archivo.m4a> [opciones]');
    process.exit(1);
  }
  await waitFfmpeg();
  // Ver el comentario grande de acquireRenderLock() en scripts/lib/batch-sessions.js: esto
  // graba en tiempo real, así que dos grabaciones a la vez en la misma máquina se estropean
  // entre sí (pasó de verdad: lote de Ritmo Soul, sep 2026).
  await acquireRenderLock();

  const repoRoot = '/Users/alberto/guitar-visualizer';
  const appPath = path.resolve(repoRoot, args.app || 'guitarvisualizer.html');
  const xmlPath = path.resolve(args.xml);
  const audioPath = path.resolve(args.audio);
  const outDir = path.resolve(args.out || './video-out');
  const extraSec = args.extra !== undefined ? parseFloat(args.extra) : 2;
  const cycleLen = args['cycle-len'] ? parseInt(args['cycle-len'], 10) : null;
  const groups = (args.groups ? String(args.groups) : '0,1,2,3').split(',').map((s) => parseInt(s.trim(), 10));
  const invs = (args.invs ? String(args.invs) : '0,1,2').split(',').map((s) => parseInt(s.trim(), 10));
  const concurrency = args.concurrency ? parseInt(args.concurrency, 10) : 1;
  const width = args.width ? parseInt(args.width, 10) : 1600;
  const height = args.height ? parseInt(args.height, 10) : 900;
  // Sin --vis-config explícito, se usa la config por defecto del repo (scripts/lib/
  // default-triad-vis-config.json — fondo activo, estilo propio de notas y mástil realista,
  // el resultado validado con Alberto en ago 2026). Vale para el 98% de los casos; --vis-config
  // sigue disponible para el resto.
  const defaultVisConfigPath = path.resolve(repoRoot, 'scripts/lib/default-triad-vis-config.json');
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
  console.log(`Audio: ${audioDuration.toFixed(1)}s (${path.basename(audioPath)})`);

  const jobs = [];
  for (const gi of groups) for (const inv of invs) jobs.push({ gi, inv });

  console.log(`Generando ${jobs.length} vídeos (concurrencia=${concurrency})…`);
  const t0 = Date.now();
  const results = await runPool(jobs, concurrency, (job) =>
    runOne({ appUrl, xmlPath, audioPath, audioDuration, extraSec, cycleLen, visConfig, gi: job.gi, inv: job.inv, width, height, outDir, tmpDir })
  );

  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok);
  console.log(`\nHecho en ${((Date.now() - t0) / 1000).toFixed(1)}s: ${ok}/${jobs.length} vídeos generados en ${outDir}`);
  fail.forEach((f, i) => console.error(`  ✗ job ${i}: ${f.error && f.error.message}`));

  fs.rmSync(tmpDir, { recursive: true, force: true });
  process.exitCode = fail.length ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
