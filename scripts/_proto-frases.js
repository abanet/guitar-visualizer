#!/usr/bin/env node
/*
 * PROTOTIPO "vocabulario": vídeo para practicar UNA frase sobre una base, de lento a rápido, con una vuelta
 * de "escucha" y otra de "tu turno" por tempo. Mástil con la zona de la pentatónica de fondo, tablatura con
 * figuras y dedos, y técnicas que se ven y se oyen: bending (con el círculo naranja que viaja hasta la nota
 * que suena), ligados, deslizamientos, vibrato y dobles cuerdas.
 * Frases en scripts/_proto-frases-data.js (La menor). Fotograma a fotograma, como generate-scale-sequences.js.
 *
 * Uso: node scripts/_proto-frases.js --frase clasico --tempos 80,90 --backing ~/guitar-visualizer-assets/FrasesAm/biblioteca
 *        [--backing-vol 1.3] [--notes-vol 0.65] [--out <dir>] [--num 1]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);
const { renderToneTrackInPage } = require('./lib/_proto-pluck-audio');
const PHRASES = require('./_proto-frases-data');

const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const ROOT_PC = 9, PENTA = [9, 0, 2, 4, 7];

// Base: trozos de los renders a tempo fijo (2 compases de cuenta + música), uno por tempo.
async function buildBacking(dir, tempos, lapBeats, tailBeats, out) {
  const files = fs.readdirSync(dir), sr = 44100, segs = [];
  const fileFor = bpm => { const f = files.find(x => new RegExp(`_Render_${bpm}\\.(aiff?|wav|m4a)$`, 'i').test(x)); if (!f) throw new Error(`Falta la base de ${bpm} bpm en ${dir}`); return path.join(dir, f); };
  let T = 0;
  const add = (bpm, fromBeat, beats, fade) => { const b = 60 / bpm, n = Math.round((T + beats * b) * sr) - Math.round(T * sr); segs.push({ file: fileFor(bpm), s0: Math.round(fromBeat * b * sr), n, fade }); T += beats * b; };
  add(tempos[0], 0, 8, 0.008);
  tempos.forEach((bpm, i) => { const last = i === tempos.length - 1; add(bpm, 8, lapBeats + (last ? tailBeats : 0), last ? tailBeats * 60 / bpm : 0.008); });
  const fc = segs.map((g, k) => `[${k}:a]aresample=${sr},atrim=start_sample=${g.s0}:end_sample=${g.s0 + g.n},asetpts=PTS-STARTPTS,afade=t=out:st=${(g.n / sr - g.fade).toFixed(4)}:d=${g.fade.toFixed(4)}[a${k}]`).join(';')
    + ';' + segs.map((_, k) => `[a${k}]`).join('') + `concat=n=${segs.length}:v=0:a=1[a]`;
  await execFileP('ffmpeg', ['-loglevel', 'error', '-y', ...segs.flatMap(g => ['-i', g.file]), '-filter_complex', fc, '-map', '[a]', '-ar', String(sr), '-ac', '2', out]);
}

function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  return a;
}

(async () => {
  const args = parseArgs(process.argv), P = PHRASES[args.frase];
  if (!P) { console.error(`--frase: ${Object.keys(PHRASES).join(' | ')}`); process.exit(1); }
  const tempos = String(args.tempos || '80,90').split(',').map(Number).filter(x => x > 0);
  const backingDir = path.resolve(String(args.backing || '~/guitar-visualizer-assets/FrasesAm/biblioteca').replace(/^~/, os.homedir()));
  const outDir = path.resolve(String(args.out || '~/Downloads/Bendings-prueba/demos').replace(/^~/, os.homedir()));
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-frase-'));
  const EPS = 1e-6, key = n => n.s + ':' + n.f, fq = midi => 82.4069 * Math.pow(2, (midi - 40) / 12);

  // Frase: instante de cada nota, nota anterior (para ligados y deslizamientos) y silencios hasta completar el compás.
  const items = P.items.map(it => ({ ...it }));
  let at = 0, lastNote;
  items.forEach((it, i) => { it.at = at; at += it.d; if (!it.r) { it.prev = lastNote; lastNote = i; if ((it.lig || it.slide) && (it.prev === undefined || items[it.prev].s !== it.s)) throw new Error(`nota ${i}: ligado o deslizamiento sin nota anterior en la misma cuerda`); } });
  const seqBeats = Math.round(at * 1e6) / 1e6, lapBeats = Math.ceil((seqBeats + 2 - EPS) / 4) * 4;
  const bendTxt = s => (s === 2 ? '1' : s === 1 ? '½' : s === 0.5 ? '¼' : String(s / 2));
  const TAB = items.map(it => it.r ? { r: true, at: it.at, d: it.d } : { at: it.at, d: it.d, notes: [{ s: it.s, f: it.f }, ...(it.also || []).map(o => ({ s: o.s, f: o.f }))], fg: it.fg, prev: it.prev,
    bend: it.bend ? (it.rel ? 'updown' : 'up') : undefined, txt: it.bend ? bendTxt(it.bend) : '', vib: it.vib, lig: it.lig, slide: it.slide });
  for (let a = seqBeats; a < lapBeats - EPS;) { const whole = Math.abs(a - Math.round(a)) < EPS, len = whole && Math.round(a) % 2 === 0 && lapBeats - a >= 2 - EPS ? 2 : whole && lapBeats - a >= 1 - EPS ? 1 : Math.min(0.5, Math.ceil(a - EPS) - a || 0.5); TAB.push({ r: true, at: a, d: len }); a += len; }

  // Notas del mástil: la pentatónica dentro de la ventana de trastes (fondo) más las de la frase.
  const notes = new Map();
  const addNote = (s, f) => { const midi = OPEN_MIDI[s] + f, k = s + ':' + f; if (!notes.has(k)) notes.set(k, { s, f, midi, label: NAMES[midi % 12], isRoot: midi % 12 === ROOT_PC }); };
  for (let s = 0; s < 6; s++) for (let f = P.win[0]; f <= P.win[1]; f++) if (PENTA.includes((OPEN_MIDI[s] + f) % 12)) addNote(s, f);
  const fingerOf = {};
  items.filter(it => !it.r).forEach(it => [it, ...(it.also || [])].forEach(o => { addNote(o.s, o.f); if (fingerOf[key(o)] === undefined) fingerOf[key(o)] = o.fg; }));
  const N = [...notes.values()];
  const frets = [...N.map(n => n.f), ...items.filter(it => it.bend >= 1).map(it => it.f + it.bend)];
  const fretMin = Math.max(1, Math.min(...frets) - 1), fretMax = Math.max(...frets) + 1;

  // Bending: sube rápido (0,2 s como mucho, a cualquier tempo) y, si vuelve, baja al final de la nota.
  const ease = x => x * x * (3 - 2 * x), ramp = (x, [a, b2]) => x <= a ? 0 : x >= b2 ? 1 : ease((x - a) / (b2 - a));
  const bendOf = (it, b) => { const up1 = Math.min(0.42, it.d * 0.45, 0.04 + 0.2 / b), d1 = Math.min(it.d, 1) * 0.92; return { up: [0.04, up1], down: it.rel ? [Math.max(up1 + 0.04, d1 - 0.2 / b), d1] : undefined }; };
  const prog = (bd, x) => ramp(x, bd.up) * (bd.down ? 1 - ramp(x, bd.down) : 1);
  const bendMark = (it, p) => ({ p, toFret: it.f + it.bend, txt: it.bend === 2 ? '1 tono' : it.bend === 1 ? '½ tono' : '¼ de tono', to: it.bend >= 1 ? NAMES[(OPEN_MIDI[it.s] + it.f + it.bend) % 12] : '', full: it.bend >= 1 });

  const steps = [];
  const pendState = () => { const st = new Map(N.map(n => [key(n), 'ghost'])); items.filter(it => !it.r).forEach(it => [it, ...(it.also || [])].forEach(o => st.set(key(o), 'pend'))); return st; };
  const first = items.find(it => !it.r);
  // Silencios pulso a pulso (el metrónomo visual sigue marcando); lead = avisa de la primera nota de la vuelta.
  const rest = (beats, b, from, bpm, lap, next, cur) => { const n = Math.max(1, Math.round(beats / 0.5)); for (let k = 0; k < n; k++) steps.push({ state: pendState(), dur: b * beats / n, caption: '', metro: { bpm, beat: Math.floor(from + k * beats / n + EPS) % 4, next }, lap, cur, bend: first.bend ? { [key(first)]: bendMark(first, 0) } : {} }); };
  const pushLap = (b, bpm, lap, mute) => {
    const st = pendState();
    items.forEach((it, i) => {
      const metroAt = x => ({ bpm, beat: Math.floor(it.at + x + EPS) % 4 }), caption = mute ? 'TU TURNO' : 'ESCUCHA';
      if (it.r) { const n = Math.max(1, Math.round(it.d / 0.5)); for (let k = 0; k < n; k++) steps.push({ state: new Map(st), dur: b * it.d / n, caption, metro: metroAt(k * it.d / n), lap, cur: i, bend: {} }); return; }
      const keys = [it, ...(it.also || [])].map(key), n = Math.max(1, Math.round(it.bend ? it.d * 24 : it.d / 0.5)), slice = it.d / n, bd = it.bend ? bendOf(it, b) : null;
      const f = fq(OPEN_MIDI[it.s] + it.f), fT = f * Math.pow(2, (it.bend || 0) / 12);
      for (let k = 0; k < n; k++) {
        const snap = new Map(st); keys.forEach(k2 => snap.set(k2, 'flash'));
        const sounds = k || mute ? undefined : [{ main: true, freq: f, soft: !!it.lig, slide: !!it.slide,
          bend: bd ? [[bd.up[0] * b, f], [bd.up[1] * b, fT], ...(bd.down ? [[bd.down[0] * b, fT], [bd.down[1] * b, f]] : [])] : undefined,
          vib: it.vib ? { from: bd ? bd.up[1] * b + 0.08 : Math.min(0.35, 0.4 * b), rate: 5.5, cents: 22 } : undefined },
          ...(it.also || []).map(o => ({ freq: fq(OPEN_MIDI[o.s] + o.f) }))];
        steps.push({ state: snap, dur: b * slice, caption, metro: metroAt(k * slice), lap, cur: i, sounds, bend: bd ? { [key(it)]: bendMark(it, prog(bd, (k + 1) * slice)) } : {},
          vibKey: it.vib ? key(it) : undefined, lig: it.lig ? { key: key(it), t: it.lig, from: items[it.prev].f } : undefined, slide: it.slide ? { key: key(it), from: items[it.prev].f } : undefined });
      }
      keys.forEach(k2 => st.set(k2, 'active'));
    });
  };
  const b0 = 60 / tempos[0];
  rest(8, b0, 0, tempos[0], 0, undefined, -1);                                    // la base trae 2 compases de cuenta
  tempos.forEach((bpm, li) => {
    const b = 60 / bpm, gap = lapBeats - seqBeats;
    pushLap(b, bpm, li, false); rest(gap, b, seqBeats, bpm, li, undefined, items.length);
    pushLap(b, bpm, li, true); rest(gap, b, seqBeats, bpm, li, tempos[li + 1], items.length);
  });
  steps.push({ state: pendState(), dur: 4 * 60 / tempos[tempos.length - 1], caption: '', cur: -1, bend: {} });   // un compás más, en fundido
  console.log(`${P.name}: ${seqBeats} pulsos de frase + ${lapBeats - seqBeats} de respiro = ${lapBeats / 4} compases por vuelta`);

  // Fotogramas: una sola página; los estados repetidos se renderizan una vez.
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto('file://' + path.join(__dirname, 'lib', '_proto-frases-frame.html'));
  const cache = new Map(); let nPng = 0;
  for (const s of steps) {
    const data = { title: 'Vocabulario pentatónico · La menor', subtitle: (args.num ? `Frase ${args.num} · ` : '') + P.name, caption: s.caption, metro: s.metro,
      ladder: s.lap === undefined ? undefined : { tempos, cur: s.lap }, fretMin, fretMax, badges: true, tab: { beats: lapBeats, items: TAB, cur: s.cur },
      notes: N.map(n => ({ string: n.s, fret: n.f, label: n.label, isRoot: n.isRoot, iv: fingerOf[key(n)], state: s.state.get(key(n)), bend: s.bend[key(n)], vib: s.vibKey === key(n),
        lig: s.lig && s.lig.key === key(n) ? s.lig : undefined, slide: s.slide && s.slide.key === key(n) ? s.slide : undefined })) };
    const sig = JSON.stringify(data);
    if (!cache.has(sig)) {
      await page.evaluate(d => render(d), data);
      const png = path.join(tmp, `f${String(nPng++).padStart(4, '0')}.png`);
      await page.screenshot({ path: png });
      cache.set(sig, png);
    }
    s.png = cache.get(sig);
  }

  // Audio: los ligados y deslizamientos no son notas nuevas, se cuelgan de la anterior de su voz.
  let t = 0; const events = [];
  steps.forEach(s => { (s.sounds || []).forEach(e => events.push({ ...e, t })); t += s.dur; });
  const total = t, main = events.filter(e => e.main);
  for (let i = main.length - 1; i > 0; i--) {
    const e = main[i], pv = main[i - 1];
    if (!e.soft && !e.slide) continue;
    const gap = e.t - pv.t;
    pv.ligs = [{ at: gap, freq: e.freq, dur: e.slide ? Math.min(0.12, 0.45 * gap) : undefined }, ...(e.ligs || []).map(l => ({ ...l, at: l.at + gap }))];
    if (e.vib) pv.vib = { ...e.vib, from: e.vib.from + gap };
    e.gone = true;
  }
  const evs = events.filter(e => !e.gone);
  const wav = path.join(tmp, 'notas.wav'), CHUNK = 40, parts = [];
  for (let a = 0; a < total; a += CHUNK) {
    const ev = evs.filter(e => e.t >= a && e.t < a + CHUNK).map(e => ({ t: e.t - a, freq: e.freq, bend: e.bend, vib: e.vib, ligs: e.ligs }));
    if (!ev.length) continue;
    const w = path.join(tmp, `notas-${parts.length}.wav`);
    fs.writeFileSync(w, Buffer.from(await page.evaluate(renderToneTrackInPage, { events: ev, total: Math.min(CHUNK, total - a) + 4 }), 'base64'));
    parts.push({ w, a });
  }
  await execFileP('ffmpeg', ['-loglevel', 'error', '-y', ...parts.flatMap(p => ['-i', p.w]), '-filter_complex',
    parts.map((p, k) => `[${k}:a]adelay=${Math.round(p.a * 44100)}S|${Math.round(p.a * 44100)}S[p${k}]`).join(';') + ';' + parts.map((_, k) => `[p${k}]`).join('') + `amix=inputs=${parts.length}:normalize=0[a]`,
    '-map', '[a]', '-ar', '44100', '-ac', '2', wav]);
  await browser.close();

  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, steps.map(s => `file '${s.png}'\nduration ${s.dur.toFixed(4)}`).join('\n') + `\nfile '${steps[steps.length - 1].png}'\n`);
  const bw = path.join(tmp, 'base.wav'); await buildBacking(backingDir, tempos, lapBeats * 2, 4, bw);
  const out = path.join(outDir, `${args.num ? 'Frase' + String(args.num).padStart(2, '0') + '_' : 'Frase_'}${args.frase}_Am_${tempos[0]}-${tempos[tempos.length - 1]}bpm.mp4`);
  await execFileP('nice', ['-n', '19', 'ffmpeg', '-loglevel', 'error', '-y', '-threads', '2', '-f', 'concat', '-safe', '0', '-i', list, '-i', wav, '-i', bw,
    '-filter_complex', `[1:a]volume=${parseFloat(args['notes-vol'] || 0.65)}[n];[2:a]volume=${parseFloat(args['backing-vol'] || 1.3)}[b];[n][b]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]`, '-map', '0:v', '-map', '[a]',
    '-vf', 'fps=25,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { maxBuffer: 1 << 24 });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`✓ ${out} (${total.toFixed(1)} s, ${steps.length} pasos, ${nPng} fotogramas distintos)`);
})().catch(e => { console.error(e.stderr || e); process.exitCode = 1; });
