#!/usr/bin/env node
/*
 * Secuencias de la escala DENTRO de una posición CAGED (prueba pedida por Alberto 2026-09-27, capítulo
 * candidato del vídeo largo de una posición). Mismo aspecto que el capítulo 1 (scale-intro-frame.html):
 * la posición entera en fantasma de fondo y las notas de cada grupo se iluminan a la vez que suenan
 * (pluck del Mástil interactivo); el grupo se queda encendido hasta que empieza el siguiente, para ver
 * su forma. Cada secuencia sube por toda la posición y vuelve a bajar.
 *
 * Cada GRUPO ocupa un pulso: terceras = corcheas, tríadas = tresillos, cuatriadas = semicorcheas.
 *   terceras    C-E, D-F, E-G…            (grados i, i+2)
 *   triadas     C-E-G, D-F-A…  + acorde   (i, i+2, i+4)
 *   cuatriadas  C-E-G-B, D-F-A-C… + acorde (i, i+2, i+4, i+6)
 * "i" recorre las notas de la POSICIÓN ordenadas por altura (son notas de la escala, así que dos
 * posiciones seguidas = una 2ª), de modo que todo cae siempre dentro de la caja; empieza en la tónica
 * más grave y vuelve a ella.
 *
 * Uso: node scripts/generate-scale-sequences.js --root C --position E [--bpm 60]
 *        [--seqs terceras,triadas,cuatriadas] [--out <dir>]
 * Salida: <out>/<Root>_Forma<X>_Secuencias.mp4 (por defecto ~/Downloads/PosicionEscala)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);
const { renderToneTrackInPage } = require('./lib/pluck-audio');

const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const POS_LABELS = ['E', 'D', 'C', 'A', 'G'];
const SEQS = {
  terceras:   { name: 'Terceras',              span: [0, 2] },
  triadas:    { name: 'Tríadas por terceras',  span: [0, 2, 4],    suffix: ['', 'm', 'm', '', '', 'm', 'dim'] },
  cuatriadas: { name: 'Cuatriadas por terceras', span: [0, 2, 4, 6], suffix: ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5'] },
};

function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  return a;
}

(async () => {
  const args = parseArgs(process.argv);
  const root = args.root || 'C', posLabel = (args.position || 'E').toUpperCase(), bpm = parseFloat(args.bpm || 60);
  const posIdx = POS_LABELS.indexOf(posLabel);
  const seqKeys = (args.seqs || 'terceras,triadas,cuatriadas').split(',').map(s => s.trim()).filter(s => SEQS[s]);
  const beat = 60 / bpm;
  const outDir = path.resolve(args.out || path.join(os.homedir(), 'Downloads', 'PosicionEscala'));
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-seq-'));

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const app = await browser.newPage();
  app.on('dialog', d => d.accept());
  await app.goto('file://' + path.resolve(__dirname, '..', 'guitarvisualizer.html'));
  const box = await app.evaluate(({ root, posIdx }) => {
    showTab('arpscale');
    document.getElementById('asRoot').value = root; document.getElementById('asScale').value = 'major';
    document.getElementById('asPos').value = String(posIdx); document.getElementById('asQuality').value = 'triads';
    asGenerate();
    const rootPc = noteToSt(root), SCALE = [0, 2, 4, 5, 7, 9, 11];
    return asActiveNotes().map(n => ({ string: n.string, fret: n.fret, label: n.note, isRoot: !!n.isRoot,
      degree: SCALE.indexOf(((n.st - rootPc) % 12 + 12) % 12) }));
  }, { root, posIdx });
  const notes = box.map(n => ({ ...n, midi: OPEN_MIDI[n.string] + n.fret })).sort((a, b) => a.midi - b.midi);
  const key = n => n.string + ':' + n.fret;

  // Pasos: un fotograma por nota; el grupo en curso encendido, el resto de la posición en fantasma.
  const steps = [];
  const baseState = () => new Map(notes.map(n => [key(n), 'ghost']));
  steps.push({ state: baseState(), dur: 2 * beat, caption: '' });
  for (const sk of seqKeys) {
    const sq = SEQS[sk], top = sq.span[sq.span.length - 1];
    // Desde la TÓNICA más grave (no desde la nota más grave de la caja: la 1ª tríada sería el vii°),
    // subiendo hasta donde quepa el grupo, y de vuelta hasta la tónica.
    const first = notes.findIndex(n => n.isRoot);
    const starts = []; for (let i = first; i + top < notes.length; i++) starts.push(i);
    const groups = [...starts.map(i => ({ idx: sq.span.map(o => i + o), down: false })),
                    ...starts.slice(0, -1).reverse().map(i => ({ idx: sq.span.map(o => i + o).reverse(), down: true }))];
    const noteDur = beat / sq.span.length;
    steps.push({ state: baseState(), dur: 2 * beat, caption: sq.name });            // 2 pulsos de respiro + título
    for (const g of groups) {
      const chordRoot = notes[Math.min(...g.idx)];
      const chord = sq.suffix ? `${chordRoot.label}${sq.suffix[chordRoot.degree]}` : '';
      const st = baseState();
      g.idx.forEach(ix => {
        st.set(key(notes[ix]), 'active');
        steps.push({ state: new Map(st), dur: noteDur, caption: chord ? `${sq.name} · ${chord}` : sq.name, sound: notes[ix] });
      });
    }
  }
  steps.push({ state: baseState(), dur: 3 * beat, caption: '' });

  // Fotogramas: se reutiliza el dibujo del capítulo 1; los estados repetidos se renderizan una vez.
  const frameUrl = 'file://' + path.join(__dirname, 'lib', 'scale-intro-frame.html');
  const frets = notes.map(n => n.fret);
  const fretMin = Math.max(1, Math.min(...frets) - 1), fretMax = Math.max(...frets) + 1;
  const cache = new Map(); let nPng = 0;
  for (const s of steps) {
    const sig = s.caption + '|' + notes.map(n => s.state.get(key(n))[0]).join('');
    if (!cache.has(sig)) {
      const data = { title: `Escala de ${root} mayor · Forma ${posLabel}`, subtitle: 'Secuencias dentro de la posición', caption: s.caption, fretMin, fretMax,
        notes: notes.map(n => ({ string: n.string, fret: n.fret, label: n.label, isRoot: n.isRoot, state: s.state.get(key(n)) })) };
      const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
      await page.addInitScript(d => { window.__DATA__ = d; }, data);
      await page.goto(frameUrl);
      const png = path.join(tmp, `f${String(nPng++).padStart(4, '0')}.png`);
      await page.screenshot({ path: png });
      await page.close();
      cache.set(sig, png);
    }
    s.png = cache.get(sig);
  }

  let t = 0; const events = [];
  steps.forEach(s => { if (s.sound) events.push({ t, freq: 82.4069 * Math.pow(2, (s.sound.midi - 40) / 12) }); t += s.dur; });
  const total = t;
  const wav = path.join(tmp, 'notas.wav');
  fs.writeFileSync(wav, Buffer.from(await app.evaluate(renderToneTrackInPage, { events, total }), 'base64'));
  await browser.close();

  // Cortes secos (concat con duraciones): en secuencias rápidas un fundido por nota emborrona.
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, steps.map(s => `file '${s.png}'\nduration ${s.dur.toFixed(4)}`).join('\n') + `\nfile '${steps[steps.length - 1].png}'\n`);
  const out = path.join(outDir, `${root.replace('#', 's')}_Forma${posLabel}_Secuencias.mp4`);
  await execFileP('nice', ['-n', '19', 'ffmpeg', '-loglevel', 'error', '-y', '-threads', '2', '-f', 'concat', '-safe', '0', '-i', list, '-i', wav,
    '-vf', 'fps=25,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { maxBuffer: 1 << 24 });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`✓ ${out} (${total.toFixed(1)} s, ${steps.length} pasos, ${nPng} fotogramas distintos)`);
})().catch(e => { console.error(e.stderr || e); process.exitCode = 1; });
