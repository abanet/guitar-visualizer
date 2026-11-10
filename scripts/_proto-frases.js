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
 *        [--datos scripts/_proto-spider-data.js] [--nombre Spider01_cuerda]
 * --datos cambia el fichero de frases (por defecto las de La menor) y --nombre el del vídeo; sin ellos todo
 * sale igual que antes. Lo usan los vídeos del Spider (2026-10-25), que no son pentatónica ni van en La.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);
const { renderToneTrackInPage } = require('./lib/_proto-pluck-audio');

const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const NAMES_STD = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'], NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const PENTA = [9, 0, 2, 4, 7];

// Base: trozos de los renders a tempo fijo (2 compases de cuenta + música), uno por tempo.
async function buildBacking(dir, tempos, lapBeats, tailBeats, out, entrada = 8, entreVueltas = 0) {
  const files = fs.readdirSync(dir), sr = 44100, segs = [];
  const fileFor = bpm => { const f = files.find(x => new RegExp(`_Render_${bpm}\\.(aiff?|wav|m4a)$`, 'i').test(x)); if (!f) throw new Error(`Falta la base de ${bpm} bpm en ${dir}`); return path.join(dir, f); };
  let T = 0;
  const add = (bpm, fromBeat, beats, fade) => { const b = 60 / bpm, n = Math.round((T + beats * b) * sr) - Math.round(T * sr); segs.push({ file: fileFor(bpm), s0: Math.round(fromBeat * b * sr), n, fade }); T += beats * b; };
  add(tempos[0], 8 - entrada, entrada, 0.008);   // entrada = pulsos de cuenta (8 de la base, o solo el último compás)
  tempos.forEach((bpm, i) => { const last = i === tempos.length - 1, pre = i ? entreVueltas : 0; add(bpm, 8, pre + lapBeats + (last ? tailBeats : 0), last ? tailBeats * 60 / bpm : 0.008); });
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
  const args = parseArgs(process.argv), PHRASES = require(args.datos ? path.resolve(String(args.datos)) : './_proto-frases-data'), P = PHRASES[args.frase];
  if (!P) { console.error(`--frase: ${Object.keys(PHRASES).join(' | ')}`); process.exit(1); }
  // P.sostenidos: todo con sostenidos (cromática a octavas, 11-05: la partitura de Alberto va con C# D# F# G# A#).
  const NAMES = P.flats ? NAMES_FLAT : P.sostenidos ? ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] : NAMES_STD, ROOT_PC = P.rootPc === undefined ? 9 : P.rootPc;
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
  const seqBeats = Math.round(at * 1e6) / 1e6, lapBeats = P.noRest ? seqBeats : Math.ceil((seqBeats + 2 - EPS) / 4) * 4;   // noRest: patrón en bucle, sin compás de respiro
  const bendTxt = s => (s === 2 ? '1' : s === 1 ? '½' : s === 0.5 ? '¼' : String(s / 2));
  const TAB = items.map(it => it.r ? { r: true, at: it.at, d: it.d } : { at: it.at, d: it.d, notes: [{ s: it.s, f: it.f }, ...(it.also || []).map(o => ({ s: o.s, f: o.f }))], fg: it.fg, prev: it.prev,
    x: it.x, pick: it.strum, acc: it.acc, pm: it.pm, bend: it.bend ? (it.rel ? 'updown' : 'up') : undefined, txt: it.bend ? bendTxt(it.bend) : '', vib: it.vib, lig: it.lig, slide: it.slide });
  for (let a = seqBeats; a < lapBeats - EPS;) { const whole = Math.abs(a - Math.round(a)) < EPS, len = whole && Math.round(a) % 2 === 0 && lapBeats - a >= 2 - EPS ? 2 : whole && lapBeats - a >= 1 - EPS ? 1 : Math.min(0.5, Math.ceil(a - EPS) - a || 0.5); TAB.push({ r: true, at: a, d: len }); a += len; }

  // Notas del mástil: la pentatónica dentro de la ventana de trastes (fondo) más las de la frase.
  const notes = new Map();
  const addNote = (s, f) => { const midi = OPEN_MIDI[s] + f, k = s + ':' + f; if (!notes.has(k)) notes.set(k, { s, f, midi, label: NAMES[midi % 12], isRoot: midi % 12 === ROOT_PC }); };
  if (P.win) for (let s = 0; s < 6; s++) for (let f = P.win[0]; f <= P.win[1]; f++) if (PENTA.includes((OPEN_MIDI[s] + f) % 12)) addNote(s, f);
  const fingerOf = {};
  items.filter(it => !it.r).forEach(it => [it, ...(it.also || [])].forEach(o => { addNote(o.s, o.f); if (fingerOf[key(o)] === undefined) fingerOf[key(o)] = o.fg; }));
  const N = [...notes.values()];
  const frets = [...N.map(n => n.f), ...items.filter(it => it.bend >= 1).map(it => it.f + it.bend)];
  const fretMin = P.fretMin || Math.max(1, Math.min(...frets) - 1), fretMax = P.fretMax || Math.max(...frets) + 1;

  // Bending: sube rápido (0,2 s como mucho, a cualquier tempo) y, si vuelve, baja al final de la nota.
  const ease = x => x * x * (3 - 2 * x), ramp = (x, [a, b2]) => x <= a ? 0 : x >= b2 ? 1 : ease((x - a) / (b2 - a));
  const bendOf = (it, b) => { const up1 = Math.min(0.42, it.d * 0.45, 0.04 + 0.2 / b), d1 = Math.min(it.d, 1) * 0.92; return { up: [0.04, up1], down: it.rel ? [Math.max(up1 + 0.04, d1 - 0.2 / b), d1] : undefined }; };
  const prog = (bd, x) => ramp(x, bd.up) * (bd.down ? 1 - ramp(x, bd.down) : 1);
  const bendMark = (it, p) => ({ p, toFret: it.f + it.bend, txt: it.bend === 2 ? '1 tono' : it.bend === 1 ? '½ tono' : '¼ de tono', to: it.bend >= 1 ? NAMES[(OPEN_MIDI[it.s] + it.f + it.bend) % 12] : '', full: it.bend >= 1 });

  const steps = [];
  const pendState = () => { const st = new Map(N.map(n => [key(n), 'ghost'])); if (P.proximas) return st; items.filter(it => !it.r).forEach(it => [it, ...(it.also || [])].forEach(o => st.set(key(o), 'pend'))); return st; };
  const first = items.find(it => !it.r);
  // Silencios pulso a pulso (el metrónomo visual sigue marcando); lead = avisa de la primera nota de la vuelta.
  const rest = (beats, b, from, bpm, lap, next, cur) => { if (beats < EPS) return; const n = Math.max(1, Math.round(beats / 0.5)); for (let k = 0; k < n; k++) steps.push({ beat: cur >= 0 ? from + k * beats / n : undefined, state: pendState(), dur: b * beats / n, caption: '', metro: { bpm, beat: Math.floor(from + k * beats / n + EPS) % 4, next }, lap, cur, bend: first.bend ? { [key(first)]: bendMark(first, 0) } : {} }); };
  // P.proximas = K (Alberto 11-05, cromática a octavas): solo se destacan las K notas que vienen; las ya tocadas vuelven
  // a fantasma. Si no, en un ejercicio que recorre todo el mástil acaban todas marcadas y "es un poco lioso".
  const keysOf = it => [it, ...(it.also || [])].map(key);
  // P.anticipaPar (11-05, cromática a octavas: "las notas van a pares, solo hay que anticipar la segunda del par de forma
  // sutil… el brillo solo cuando suena"): mientras suena la 1ª del par, la 2ª deja de ser fantasma (sólida, sin brillo
  // ni anillo); todo lo demás, fantasma.
  const notaIdx = []; items.forEach((it, i) => { if (!it.r) notaIdx.push(i); });
  const parState = i => { const st = new Map(N.map(n => [key(n), 'ghost'])), q = notaIdx.indexOf(i);
    if (q >= 0 && q % 2 === 0 && notaIdx[q + 1] !== undefined) keysOf(items[notaIdx[q + 1]]).forEach(x => st.set(x, 'active'));
    return st; };
  const proxState = i => { if (P.anticipaPar) return parState(i); const st = new Map(N.map(n => [key(n), 'ghost'])); let k = 0;
    // la siguiente con anillo dorado fuerte ('next') y la de después más tenue ('soon'): se ve ANTES qué toca.
    for (let j = i + 1; j < items.length && k < P.proximas; j++) if (!items[j].r) { keysOf(items[j]).forEach(x => st.set(x, k === 0 ? 'next' : 'soon')); k++; }
    return st; };
  const pushLap = (b, bpm, lap, mute) => {
    const st = pendState();
    items.forEach((it, i) => {
      if (P.proximas) { const p0 = proxState(i); st.clear(); p0.forEach((v, k2) => st.set(k2, v)); }
      const metroAt = x => ({ bpm, beat: Math.floor(it.at + x + EPS) % 4 }), caption = it.cap || (P.seguido ? '' : mute ? 'TU TURNO' : 'ESCUCHA');   // it.cap (11-09): aviso propio de la nota ("DÍA 7" en las 24 digitaciones del Spider)
      if (it.r) { const n = Math.max(1, Math.round(it.d / 0.5)); for (let k = 0; k < n; k++) steps.push({ beat: it.at + k * it.d / n, state: new Map(st), dur: b * it.d / n, caption, metro: metroAt(k * it.d / n), lap, cur: i, bend: {} }); return; }
      const keys = [it, ...(it.also || [])].map(key), n = Math.max(1, Math.round(it.bend ? it.d * 24 : it.d / 0.5)), slice = it.d / n, bd = it.bend ? bendOf(it, b) : null;
      const f = fq(OPEN_MIDI[it.s] + it.f), fT = f * Math.pow(2, (it.bend || 0) / 12);
      for (let k = 0; k < n; k++) {
        const snap = new Map(st); keys.forEach(k2 => snap.set(k2, it.x ? 'active' : 'flash'));
        // Rasgueo: las cuerdas entran escalonadas (abajo = de graves a agudas) y el acorde se corta en el golpe siguiente.
        const strumSounds = () => { const ns = [it, ...(it.also || [])].sort((p, q) => (it.strum === 'u' ? q.s - p.s : p.s - q.s));
          return it.x ? [{ mute: true }] : ns.map((o, oi) => ({ freq: fq(OPEN_MIDI[o.s] + o.f), off: oi * 0.008, cut: it.pm ? 0.09 : it.d * b * 0.9 })); };
        const sounds = k || mute ? undefined : it.strum ? strumSounds() : [{ main: true, freq: f, soft: !!it.lig, slide: !!it.slide,
          bend: bd ? [[bd.up[0] * b, f], [bd.up[1] * b, fT], ...(bd.down ? [[bd.down[0] * b, fT], [bd.down[1] * b, f]] : [])] : undefined,
          vib: it.vib ? { from: bd ? bd.up[1] * b + 0.08 : Math.min(0.35, 0.4 * b), rate: 5.5, cents: 22 } : undefined },
          ...(it.also || []).map(o => ({ freq: fq(OPEN_MIDI[o.s] + o.f) }))];
        // Marcas de la cromática a octavas (11-05): it.crom = nota grave anterior (flecha de medio tono) e it.octDe =
        // nota grave del par (línea de octava). Solo las llevan los datos que las definen.
        const marks = it.crom || it.octDe ? { crom: it.crom ? { a: it.crom, b: { s: it.s, f: it.f } } : undefined, oct: it.octDe ? { a: it.octDe, b: { s: it.s, f: it.f } } : undefined } : undefined;
        steps.push({ beat: it.at + k * slice, pc: it.x ? undefined : (OPEN_MIDI[it.s] + it.f) % 12, marks, state: snap, dur: b * slice, caption, metro: metroAt(k * slice), lap, cur: i, sounds, mx: it.x ? keys : undefined, bend: bd ? { [key(it)]: bendMark(it, prog(bd, (k + 1) * slice)) } : {},
          vibKey: it.vib ? key(it) : undefined, lig: it.lig ? { key: key(it), t: it.lig, from: items[it.prev].f } : undefined, slide: it.slide ? { key: key(it), from: items[it.prev].f } : undefined });
      }
      if (!P.proximas) keys.forEach(k2 => st.set(k2, 'active'));
    });
  };
  const b0 = 60 / tempos[0];
  // Entrada (11-05): si el primer tempo es 60 o menos, UN compás de cuenta (a 40 bpm dos compases eran 12 s de espera)
  // y se avisa con una cuenta atrás discreta bajo el metrónomo ("entra en 4… 1"). Si no, los dos compases de siempre.
  const ENTRADA = tempos[0] <= 60 && P.entradaCorta ? 4 : 8;
  if (ENTRADA === 4) { for (let k = 0; k < 4; k++) steps.push({ state: pendState(), dur: b0, caption: '', metro: { bpm: tempos[0], beat: k, cuenta: 4 - k }, lap: 0, cur: -1, bend: {} }); }
  else rest(8, b0, 0, tempos[0], 0, undefined, -1);                                    // la base trae 2 compases de cuenta
  // P.rotulo (11-09, Spider): una indicación que se lee durante la cuenta de entrada ("corre un traste y repite…").
  // Sin él, la entrada queda sin rótulo como siempre.
  if (P.rotulo) steps.forEach(s => { s.rotulo = P.rotulo; });
  tempos.forEach((bpm, li) => {
    const b = 60 / bpm, gap = lapBeats - seqBeats;
    // P.seguido: una sola vuelta por tempo y sonando (ejercicio técnico, sin "escucha / tu turno").
    // P.compasEntreVueltas (11-05): antes de cada subida, un compás sin notas ya al tempo nuevo, con la cuenta atrás.
    if (li && P.compasEntreVueltas) for (let k = 0; k < 4; k++) steps.push({ state: pendState(), dur: b, caption: '', metro: { bpm, beat: k, cuenta: 4 - k }, lap: li, cur: -1, bend: {} });
    pushLap(b, bpm, li, false); rest(gap, b, seqBeats, bpm, li, P.seguido ? tempos[li + 1] : undefined, items.length);
    if (!P.seguido) { pushLap(b, bpm, li, true); rest(gap, b, seqBeats, bpm, li, tempos[li + 1], items.length); }
  });
  steps.push({ state: pendState(), dur: 4 * 60 / tempos[tempos.length - 1], caption: '', cur: -1, bend: {} });   // un compás más, en fundido
  console.log(`${P.name}: ${seqBeats} pulsos de frase + ${lapBeats - seqBeats} de respiro = ${lapBeats / 4} compases por vuelta`);

  // Fotogramas: una sola página; los estados repetidos se renderizan una vez.
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto('file://' + path.join(__dirname, 'lib', '_proto-frases-frame.html'));
  // P.pagina (pulsos): la tablatura va por páginas y pasa a la de la nota en curso; los silencios del final se
  // quedan en la última página y la cuenta inicial en la primera.
  // pos (11-05, Alberto: "en la notación se tiene que ver cómo corre el tiempo siempre", también en los silencios): pulso
  // en curso, para la línea de tiempo de la tablatura. Solo con P.cabezal, para no cambiar los vídeos ya hechos.
  const tabOf = (cur, beat) => { const tab = { beats: lapBeats, items: TAB, cur, rowLabel: P.rowLabel, pos: P.cabezal ? beat : undefined }; if (!P.pagina) return tab;
    const at = beat !== undefined ? Math.min(beat, lapBeats - EPS) : cur < 0 ? 0 : cur < items.length ? items[cur].at : seqBeats - EPS;
    const from = Math.floor(at / P.pagina + EPS) * P.pagina;
    return { ...tab, beats: P.pagina, from, pos: tab.pos === undefined ? undefined : tab.pos - from }; };
  const cache = new Map(); let nPng = 0;
  for (const s of steps) {
    // sinSubtitulo (11-05): sin subtítulo, para dar aire arriba.
    // Tira cromática: el enarmónico de cada sostenido debajo (solo en la tira, no en el mástil; Alberto 11-05).
    // La tira empieza en la primera nota del ejercicio (E en la abierta, A en la cerrada).
    const pc0 = (OPEN_MIDI[first.s] + first.f) % 12, CROM_PC = [...Array(12)].map((_, k) => (pc0 + k) % 12), CROM = CROM_PC.map(pc => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][pc]);
    const tira = P.tiraCromatica ? { top: 132, chico: true, items: CROM.map(l => ({ label: l, sub: { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' }[l] || '', nat: !l.includes('#') })), on: s.pc === undefined ? [] : [CROM_PC.indexOf(s.pc)] } : undefined;
    // Los silencios añadidos (el respiro del final de vuelta) no llevan pos: se mantiene la de la última nota anterior
    // (11-10: sin esto, items[cur].pos era undefined y el render del recorrido petaba).
    let posAct;
    if (P.porPosicion) { for (let i = Math.min(s.cur >= 0 ? s.cur : 0, items.length - 1); i >= 0 && posAct === undefined; i--) posAct = items[i] && items[i].pos; if (posAct === undefined) posAct = (items.find(it => it.pos !== undefined) || {}).pos; }
    const data = { strip: tira, neckTop: P.tiraCromatica ? 258 : undefined, tabY: P.tiraCromatica ? 648 : undefined, crece: !!P.crece, maxFretW: P.maxFretW, marks: s.marks, title: P.title || 'Vocabulario pentatónico · La menor', subtitle: P.sinSubtitulo ? '' : (args.num ? `Frase ${args.num} · ` : '') + P.name, caption: s.caption, rotulo: s.rotulo, metro: s.metro,
      ladder: s.lap === undefined ? undefined : { tempos, cur: s.lap }, fretMin, fretMax, badges: true, tab: tabOf(s.cur, s.beat),
      // P.porPosicion (11-09, recorrido del Spider): solo se ven las notas de la posición que se toca (it.pos … it.pos+3)
      // y el dedo sale de esa posición; sin ello, todas las notas con su primer dedo, como siempre.
      notes: (posAct === undefined ? N : N.filter(n => n.f >= posAct && n.f <= posAct + 3)).map(n => ({ string: n.s, fret: n.f, label: n.label, isRoot: n.isRoot, nat: !!P.naturales && [0, 2, 4, 5, 7, 9, 11].includes(n.midi % 12), iv: posAct === undefined ? fingerOf[key(n)] : n.f - posAct + 1, state: s.state.get(key(n)), bend: s.bend[key(n)], mx: !!(s.mx && s.mx.includes(key(n))), vib: s.vibKey === key(n),
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
  steps.forEach(s => { (s.sounds || []).forEach(e => events.push({ ...e, t: t + (e.off || 0) })); t += s.dur; });
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
    const ev = evs.filter(e => e.t >= a && e.t < a + CHUNK).map(e => ({ t: e.t - a, freq: e.freq, bend: e.bend, vib: e.vib, ligs: e.ligs, mute: e.mute, cut: e.cut }));
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
  const bw = path.join(tmp, 'base.wav'); await buildBacking(backingDir, tempos, P.seguido ? lapBeats : lapBeats * 2, 4, bw, ENTRADA, P.compasEntreVueltas ? 4 : 0);   // seguido: una vuelta por tempo
  const out = path.join(outDir, args.nombre ? `${args.nombre}_${tempos[0]}-${tempos[tempos.length - 1]}bpm.mp4` : `${args.num ? 'Frase' + String(args.num).padStart(2, '0') + '_' : 'Frase_'}${args.frase}_Am_${tempos[0]}-${tempos[tempos.length - 1]}bpm.mp4`);
  await execFileP('nice', ['-n', '19', 'ffmpeg', '-loglevel', 'error', '-y', '-threads', '2', '-f', 'concat', '-safe', '0', '-i', list, '-i', wav, '-i', bw,
    '-filter_complex', `[1:a]volume=${parseFloat(args['notes-vol'] || P.notesVol || 0.65)}[n];[2:a]volume=${parseFloat(args['backing-vol'] || P.backingVol || 1.3)}[b];[n][b]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]`, '-map', '0:v', '-map', '[a]',
    '-vf', 'fps=25,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { maxBuffer: 1 << 24 });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`✓ ${out} (${total.toFixed(1)} s, ${steps.length} pasos, ${nPng} fotogramas distintos)`);
})().catch(e => { console.error(e.stderr || e); process.exitCode = 1; });
