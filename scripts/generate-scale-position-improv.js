#!/usr/bin/env node
/*
 * Cierre "Ahora tú: improvisa" del vídeo largo de una posición (propuesta aceptada por Alberto,
 * 2026-09-27): una vuelta de la progresión (backing EscalaCTriadasEscala) con TODA la posición en
 * fantasma (con su intervalo en placa pequeña, --badges) y el acorde que suena en grande encima,
 * cambiando con el compás. Sin nada que seguir: es para improvisar con lo visto en el vídeo.
 *
 * Uso: node scripts/generate-scale-position-improv.js --root C --position E [--laps 1]
 *        [--backing ~/Downloads/SUBIREscalaCTriadasEscala] [--out <dir>]
 * Salida: <out>/<Root>_Forma<X>_Improvisa.mp4 (por defecto ~/Downloads/PosicionEscala/piezas)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);

const POS_LABELS = ['E', 'D', 'C', 'A', 'G'];
const a = {};
for (let i = 2; i < process.argv.length; i++) if (process.argv[i].startsWith('--')) a[process.argv[i].slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true;

(async () => {
  const root = a.root || 'C', pos = (a.position || 'E').toUpperCase(), laps = parseInt(a.laps || 1, 10);
  const k = root.replace('#', 's');
  const B = path.resolve((a.backing || '~/Downloads/SUBIREscalaCTriadasEscala').replace(/^~/, os.homedir()));
  const xml = path.join(B, `EscalaCTriadasEscala-${k}.XML`), audio = path.join(B, `EscalaCTriadasEscala-${k}.m4a`);
  const outDir = path.resolve((a.out || '~/Downloads/PosicionEscala/piezas').replace(/^~/, os.homedir()));
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-improv-'));

  // Compases del XML: cuenta (sin <harmony>) + acorde de cada compás de la 1ª vuelta.
  const x = fs.readFileSync(xml, 'utf8');
  const part = x.match(/<part\b[\s\S]*?<\/part>/)[0];
  const meas = part.match(/<measure\b[\s\S]*?<\/measure>/g);
  const bpm = parseFloat((x.match(/tempo="([\d.]+)"/) || [0, 85])[1]), bar = 4 * 60 / bpm;
  const intro = meas.findIndex(m => m.includes('<harmony'));
  let last = '';
  const chords = meas.slice(intro).map(m => {
    const h = m.match(/<harmony[\s\S]*?<\/harmony>/);
    if (h) {
      const st = h[0].match(/<root-step>(\w)/)[1], alt = (h[0].match(/<root-alter>(-?\d)/) || [])[1];
      const kt = (h[0].match(/<kind[^>]*text="([^"]*)"/) || [])[1], kv = (h[0].match(/<kind[^>]*>([^<]*)/) || [])[1] || '';
      last = st + (alt === '1' ? '#' : alt === '-1' ? 'b' : '') + (kt != null ? kt : kv.startsWith('minor') ? 'm' : kv.startsWith('dim') ? 'dim' : '');
    }
    return last;
  });
  const cycle = parseInt(a.cyclelen || 14, 10), nBars = laps * cycle + 1;

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const app = await browser.newPage(); app.on('dialog', d => d.accept());
  await app.goto('file://' + path.resolve(__dirname, '..', 'guitarvisualizer.html'));
  const notes = await app.evaluate(({ root, posIdx }) => {
    showTab('arpscale');
    document.getElementById('asRoot').value = root; document.getElementById('asScale').value = 'major';
    document.getElementById('asPos').value = String(posIdx); document.getElementById('asQuality').value = 'triads'; asGenerate();
    const rp = noteToSt(root), IV = { 0: 'R', 2: '2', 4: '3', 5: '4', 7: '5', 9: '6', 11: '7' };
    return asActiveNotes().map(n => ({ string: n.string, fret: n.fret, label: n.note, isRoot: !!n.isRoot, iv: IV[((n.st - rp) % 12 + 12) % 12] || '', state: 'ghost' }));
  }, { root, posIdx: POS_LABELS.indexOf(pos) });
  const frets = notes.map(n => n.fret);
  const fretMin = Math.max(1, Math.min(...frets) - 1), fretMax = Math.max(...frets) + 1;
  const frameUrl = 'file://' + path.join(__dirname, 'lib', 'scale-intro-frame.html');
  const frames = new Map();
  const shot = async (big) => {
    if (frames.has(big)) return frames.get(big);
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    await page.addInitScript(d => { window.__DATA__ = d; }, { title: `Ahora tú: improvisa`, subtitle: `Escala de ${root} mayor · Forma ${pos} — usa todo lo que has visto`, caption: '', big, fretMin, fretMax, badges: true, notes });
    await page.goto(frameUrl);
    const f = path.join(tmp, `f${frames.size}.png`); await page.screenshot({ path: f }); await page.close();
    frames.set(big, f); return f;
  };
  // Cuenta (acorde vacío) y luego un fotograma por compás con el acorde que suena.
  const steps = [{ png: await shot(''), dur: intro * bar }];
  for (let i = 0; i < nBars; i++) steps.push({ png: await shot(chords[i] || ''), dur: bar });
  await browser.close();

  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, steps.map(s => `file '${s.png}'\nduration ${s.dur.toFixed(4)}`).join('\n') + `\nfile '${steps[steps.length - 1].png}'\n`);
  const total = steps.reduce((s, x) => s + x.dur, 0);
  const out = path.join(outDir, `${k}_Forma${pos}_Improvisa.mp4`);
  await execFileP('nice', ['-n', '19', 'ffmpeg', '-loglevel', 'error', '-y', '-threads', '2', '-f', 'concat', '-safe', '0', '-i', list, '-i', audio,
    '-vf', 'fps=25,format=yuv420p', '-af', `atrim=0:${total.toFixed(3)},afade=out:st=${(total - 1.5).toFixed(3)}:d=1.5`, '-t', total.toFixed(3),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out], { maxBuffer: 1 << 24 });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`✓ ${out} (${total.toFixed(1)} s; ${chords.slice(0, cycle).join(' ')})`);
})().catch(e => { console.error(e.stderr || e); process.exitCode = 1; });
