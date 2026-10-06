#!/usr/bin/env node
/*
 * "Tríadas en 4 mástiles": UN acorde, todas sus posiciones de tríada cerrada en los 4 grupos de
 * 3 cuerdas (3-2-1, 4-3-2, 5-4-3, 6-5-4), en una imagen FIJA — sin animación, pensado para mirar y
 * tocar encima del backing de un solo acorde (pedido de Alberto 2026-09-27, sustituto en nuestro
 * estilo de un formato de otro canal con 4 mástiles estáticos).
 *
 * Las posiciones salen del mismo motor que el resto de vídeos de tríadas (getChordVoicing +
 * TRIAD_STRING_GROUPS de guitarvisualizer.html, cargado en Chrome headless solo para calcular);
 * el dibujo es scripts/lib/static-triads-frame.html. Como la imagen no se mueve, NO se graba en
 * tiempo real: se hacen 2 fotogramas (nombres de nota / intervalos) y ffmpeg monta el vídeo con el
 * audio — segundos por vídeo en vez de minutos.
 *
 * El vídeo se reparte en 4 vueltas iguales, cuadradas al compás (tras los compases de cuenta del
 * XML): nombres → intervalos → nombres → intervalos, con un fundido corto en cada cambio.
 *
 * Uso:
 *   node scripts/generate-static-triad-videos.js                 (las 48: 12 tónicas × mayor, menor, dim, aug)
 *   node scripts/generate-static-triad-videos.js --chords C,Am,F#dim
 *   Opciones: --out <dir> (por defecto ~/Downloads/TriadasEn4Mastiles) · --force (rehace aunque exista)
 *             --frames-only <dir>: solo los PNG (nombres/intervalos) en <dir>, sin vídeo ni esperar
 *             al bloqueo — para revisar el dibujo de todas las tonalidades de un vistazo
 *
 * Backings (XML + audio de un solo acorde, los mismos que "Todas las tríadas"):
 *   mayor/menor: ~/guitar-visualizer-assets/triadas-por-tonalidad/<Acorde>/<Acorde>_AcordeParaTriadas_50Compases_90bpm{.XML,_Render.m4a}
 *   dim / aug:   ~/Downloads/AcordeParaTriadas{Dim,Aug}_50Compases_90bpm/AcordeParaTriadas{Dim,Aug}_50Compases_90bpm-<Tónica>{.XML,.m4a}
 *                (tónica con "Fs" en vez de "F#")
 * Salida: <out>/<Acorde>_TriadasEn4Mastiles_<bpm>bpm.mp4
 *
 * Espera a que no haya otra grabación en marcha (bloqueo de scripts/lib/batch-sessions.js): no
 * graba en tiempo real, pero el ffmpeg sí carga la CPU y estropearía una grabación en curso.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);
const { acquireRenderLock, getAudioDurationSeconds } = require('./lib/batch-sessions');

const HOME = os.homedir();
const ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
// Grafía de las menores = la de las carpetas de backings que ya existen (Dbm, Ebm, F#m, Abm, Bbm).
const QUALITIES = ['', 'm', 'dim', 'aug'];
const XFADE = 0.5; // s de fundido entre vueltas

function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--force') a.force = true;
    else if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[++i];
  }
  return a;
}

// Backing de un acorde → {xml, audio}, o null si no existe.
function backingFor(chord) {
  const m = chord.match(/^([A-G][b#]?)(m|dim|aug)?$/);
  if (!m) return null;
  const [, root, q = ''] = m;
  let xml, audio;
  if (q === 'dim' || q === 'aug') {
    const Q = q === 'dim' ? 'Dim' : 'Aug', key = root.replace('#', 's');
    const dir = path.join(HOME, 'Downloads', `AcordeParaTriadas${Q}_50Compases_90bpm`);
    xml = path.join(dir, `AcordeParaTriadas${Q}_50Compases_90bpm-${key}.XML`);
    audio = path.join(dir, `AcordeParaTriadas${Q}_50Compases_90bpm-${key}.m4a`);
  } else {
    const dir = path.join(HOME, 'guitar-visualizer-assets', 'triadas-por-tonalidad', chord);
    xml = path.join(dir, `${chord}_AcordeParaTriadas_50Compases_90bpm.XML`);
    audio = path.join(dir, `${chord}_AcordeParaTriadas_50Compases_90bpm_Render.m4a`);
  }
  return fs.existsSync(xml) && fs.existsSync(audio) ? { xml, audio } : null;
}

// Del XML (1ª parte): tempo, compases de cuenta (los del principio sin <harmony>) y compases de música.
function readTiming(xmlPath) {
  const x = fs.readFileSync(xmlPath, 'utf8');
  const part = (x.match(/<part\b[\s\S]*?<\/part>/) || [x])[0];
  const measures = part.match(/<measure\b[\s\S]*?<\/measure>/g) || [];
  const intro = Math.max(0, measures.findIndex(m => m.includes('<harmony')));
  const bpm = parseFloat((x.match(/tempo="([\d.]+)"/) || x.match(/<per-minute>([\d.]+)/) || [0, 90])[1]);
  const beats = parseInt((x.match(/<beats>(\d+)<\/beats>/) || [0, 4])[1], 10);
  return { bpm, barSec: beats * 60 / bpm, intro, musicBars: measures.length - intro };
}

// Datos del fotograma, calculados con el motor de la app (página ya cargada).
function frameDataInApp(chord) {
  const INV = ['Fund.', '1ª inv.', '2ª inv.'];
  const order = [3, 0, 1, 2]; // 3-2-1, 4-3-2, 5-4-3, 6-5-4 (índices de TRIAD_STRING_GROUPS)
  const rows = order.map(gi => {
    const g = TRIAD_STRING_GROUPS[gi];
    const shapes = [];
    for (let inv = 0; inv < 3; inv++) {
      const v = getChordVoicing(chord, g, inv);
      if (v) shapes.push({ label: INV[inv], notes: v.strings.map((s, i) => ({ string: s, fret: v.frets[i], iv: v.intervals[i], name: v.notes[i] })) });
    }
    return { label: g.map(s => 6 - s).join('-'), strings: g.slice().sort((a, b) => a - b), shapes };
  });
  const parsed = parseChord(chord);
  const st = parsed.map(n => noteToSt(n.note));
  const gapName = d => ({ 1: '½T', 2: '1T', 3: '1½T', 4: '2T', 5: '2½T', 6: '3T' }[d] || d + 'st');
  // Nombre del intervalo por GRADOS del acorde (R, 3/b3, 5/b5/#5 → nº de intervalo) + semitonos
  // (→ calidad): R→3 y 3→5 siempre son 3ª y 5→R siempre 4ª, sea cual sea la grafía. Por la grafía
  // de la app no vale: escribe la b5 de Ebdim como "A" (no Bbb) para no usar dobles bemoles, y
  // Gb→A saldría "2ª aum" en vez de la 3ª m que se enseña.
  const degOf = iv => iv === 'R' ? 1 : parseInt(iv.replace(/[^0-9]/g, ''), 10);
  const ivName = (ivA, ivB, semis) => {
    const n = ((degOf(ivB) - degOf(ivA) + 7) % 7) + 1;
    const d = semis - { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11 }[n];
    const q = [1, 4, 5].includes(n) ? { '-1': 'dis', 0: 'J', 1: 'aum' }[d] : { '-2': 'dis', '-1': 'm', 0: 'M', 1: 'aum' }[d];
    return `${n}ª ${q || '?'}`;
  };
  const invs = [0, 1, 2].map(k => {
    const idx = [0, 1, 2].map(j => (j + k) % 3);
    return {
      label: ['Fundamental', '1ª inversión', '2ª inversión'][k],
      notes: idx.map(j => ({ name: parsed[j].note, iv: parsed[j].interval })),
      gaps: idx.slice(1).map((j, i) => gapName((st[j] - st[idx[i]] + 12) % 12)),
      ivNames: idx.slice(1).map((j, i) => ivName(parsed[idx[i]].interval, parsed[j].interval, (st[j] - st[idx[i]] + 12) % 12)),
    };
  });
  return { chord, rows, invs };
}

async function waitForRenderLock() {
  let warned = false;
  for (;;) {
    try { return await acquireRenderLock(); }
    catch (e) {
      if (!/otra generación/.test(e.message)) throw e;
      if (!warned) { console.log('Hay otra grabación en marcha — espero a que termine…'); warned = true; }
      await new Promise(r => setTimeout(r, 60000));
    }
  }
}

(async () => {
  const args = parseArgs(process.argv);
  const outDir = path.resolve(args.out || path.join(HOME, 'Downloads', 'TriadasEn4Mastiles'));
  const chords = args.chords ? args.chords.split(',').map(s => s.trim()).filter(Boolean)
    : QUALITIES.flatMap(q => ROOTS.map(r => r + q));
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-triadas4m-'));

  const jobs = [];
  for (const chord of chords) {
    const b = backingFor(chord);
    if (!b) { console.log(`⚠ ${chord}: no encuentro su backing (XML + audio), me lo salto`); continue; }
    const t = readTiming(b.xml);
    const out = path.join(outDir, `${chord}_TriadasEn4Mastiles_${Math.round(t.bpm)}bpm.mp4`);
    if (!args.force && !args['frames-only'] && fs.existsSync(out)) { console.log(`= ${path.basename(out)} ya existe`); continue; }
    jobs.push({ chord, ...b, ...t, out });
  }
  if (!jobs.length) { console.log('Nada que hacer.'); return; }

  const framesOnly = args['frames-only'] ? path.resolve(args['frames-only']) : null;
  if (framesOnly) fs.mkdirSync(framesOnly, { recursive: true });
  else await waitForRenderLock();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const app = await browser.newPage();
  app.on('dialog', d => d.accept());
  await app.goto('file://' + path.resolve(__dirname, '..', 'guitarvisualizer.html'));
  const frameUrl = 'file://' + path.join(__dirname, 'lib', 'static-triads-frame.html');

  let ok = 0;
  for (const j of jobs) {
    const t0 = Date.now();
    const data = await app.evaluate(frameDataInApp, j.chord);
    const missing = data.rows.reduce((a, r) => a + 3 - r.shapes.length, 0);
    if (missing) console.log(`⚠ ${j.chord}: ${missing} posición(es) sin voicing`);
    const pngs = {};
    for (const labels of ['names', 'intervals']) {
      const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
      await page.addInitScript(d => { window.__DATA__ = d; }, { ...data, labels });
      await page.goto(frameUrl);
      pngs[labels] = path.join(framesOnly || tmp, `${j.chord}_${labels}.png`);
      await page.screenshot({ path: pngs[labels] });
      await page.close();
    }
    if (framesOnly) { ok++; console.log(`✓ ${j.chord} (fotogramas)`); continue; }
    // 4 vueltas cuadradas al compás: cambios en intro + round(k·compases/4). La 1ª incluye la cuenta.
    const total = await getAudioDurationSeconds(j.audio);
    const cuts = [1, 2, 3].map(k => (j.intro + Math.round(k * j.musicBars / 4)) * j.barSec);
    const bounds = [0, ...cuts, total];
    const frames = [pngs.names, pngs.intervals, pngs.names, pngs.intervals];
    const ff = ['-loglevel', 'error', '-y'];
    frames.forEach((f, i) => {
      const len = bounds[i + 1] - bounds[i] + (i > 0 ? XFADE / 2 : 0) + (i < 3 ? XFADE / 2 : 0);
      ff.push('-loop', '1', '-framerate', '25', '-t', len.toFixed(3), '-i', f);
    });
    ff.push('-i', j.audio);
    let fc = '', prev = '[0]';
    cuts.forEach((c, i) => {
      const last = i === cuts.length - 1;
      fc += `${prev}[${i + 1}]xfade=transition=fade:duration=${XFADE}:offset=${(c - XFADE / 2).toFixed(3)}${last ? ',format=yuv420p[v]' : `[x${i}];`}`;
      prev = `[x${i}]`;
    });
    ff.push('-filter_complex', fc, '-map', '[v]', '-map', '4:a', '-c:v', 'libx264', '-preset', 'medium', '-tune', 'stillimage',
      '-crf', '20', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', j.out);
    await execFileP('nice', ['-n', '10', 'ffmpeg', ...ff], { maxBuffer: 1 << 24 });
    ok++;
    console.log(`✓ ${path.basename(j.out)}  (${Math.round((Date.now() - t0) / 1000)} s; cambios en ${cuts.map(c => c.toFixed(1)).join(' / ')} s)`);
  }
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(framesOnly ? `Hecho: ${ok}/${jobs.length} pares de fotogramas en ${framesOnly}` : `Hecho: ${ok}/${jobs.length} vídeos en ${outDir}`);
})().catch(e => { console.error(e); process.exitCode = 1; });
