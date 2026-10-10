#!/usr/bin/env node
/*
 * Secuencias de la escala DENTRO de una posición CAGED (prueba pedida por Alberto 2026-09-27, capítulo
 * candidato del vídeo largo de una posición). Mismo aspecto que el capítulo 1 (scale-intro-frame.html):
 * la posición entera en fantasma de fondo y las notas de cada grupo se iluminan a la vez que suenan
 * (pluck del Mástil interactivo); el grupo se queda encendido hasta que empieza el siguiente, para ver
 * su forma. Cada secuencia sube por toda la posición y vuelve a bajar.
 *
 * Cada GRUPO ocupa un pulso: terceras = corcheas, triadas = tresillos, cuatriadas = semicorcheas
 * (en el modo progresivo las cuatriadas van en corcheas, 2 pulsos por acorde, como en el ejemplo 6 de
 * "Everything You Need To Learn For Jazz Guitar").
 *   grupos3     C-D-E, D-E-F…  (tresillos)      grupos4   C-D-E-F, D-E-F-G…  (semicorcheas)
 *   terceras    C-E, D-F, E-G…            (grados i, i+2)
 *   triadas     C-E-G, D-F-A…  + acorde   (i, i+2, i+4)
 *   cuatriadas  C-E-G-B, D-F-A-C… + acorde (i, i+2, i+4, i+6)
 * "i" recorre las notas de la POSICIÓN ordenadas por altura (son notas de la escala, así que dos
 * posiciones seguidas = una 2ª), de modo que todo cae siempre dentro de la caja; empieza en la tónica
 * más grave y vuelve a ella.
 *
 * Uso: node scripts/generate-scale-sequences.js --root C --position E [--bpm 60]
 *        [--seqs terceras,triadas,cuatriadas] [--out <dir>] [--closed]
 * Salida: <out>/<Root>_Forma<X>_Secuencias.mp4 (por defecto ~/Downloads/PosicionEscala)
 *
 * Modo PROGRESIVO (serie de secuencias): --tempos 50,60,70 [--ruta caja|tonica] (por defecto caja) con UNA secuencia en --seqs.
 * Una vuelta entera (subida y bajada) por tempo; el tempo cambia al volver a empezar en graves. Suena una
 * claqueta, o la base rítmica con --backing <carpeta de renders BiaB a tempo fijo, *_Render_<bpm>.aiff>
 * [--backing-vol 2.6] [--notes-vol 0.65] (balance ajustado de oído por Alberto; los
 * renders de BiaB pican a −14 dB). Salida: <Secuencia>_<Root>_Forma<X>_<t0>-<tn>bpm.mp4 (terceras = EscalasPorTerceras)
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
  grupos3:    { name: 'Grupos de 3 notas',     span: [0, 1, 2], file: 'EscalasPorGruposDe3' },       // 1-2-3, 2-3-4… en tresillos (un grupo por pulso)
  grupos4:    { name: 'Grupos de 4 notas',     span: [0, 1, 2, 3], file: 'EscalasPorGruposDe4' },    // 1-2-3-4, 2-3-4-5… en semicorcheas (un grupo por pulso)
  alternas:   { name: 'Terceras alternas',     span: [0, 2], alt: true, file: 'EscalasPorTercerasAlternas' },   // una sube y la siguiente baja: C-E, F-D, E-G, A-F…
  sextas:     { name: 'Sextas',                span: [0, 5], file: 'EscalasPorSextas' },                       // C-A, D-B, E-C…
  zigzag:     { name: 'Triadas en zigzag',     span: [0, 2, 4], alt: true, roman: 'triadas', file: 'EscalasPorTriadasZigzag', suffix: ['', 'm', 'm', '', '', 'm', 'dim'] },   // C-E-G, A-F-D, E-G-B…
  terceras:   { name: 'Terceras',              span: [0, 2], file: 'EscalasPorTerceras' },
  triadas:    { name: 'Triadas diatónicas',    span: [0, 2, 4], file: 'EscalasPorTriadas',   suffix: ['', 'm', 'm', '', '', 'm', 'dim'] },
  cuatriadas: { name: 'Arpegios de 7ª diatónicos', span: [0, 2, 4, 6], file: 'EscalasPorSeptimas', progBeats: 2, suffix: ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5'] },
};

// Claqueta (WAV PCM 16 bits estéreo): un tic por pulso, más agudo y fuerte en el primero del compás.
function clickWav(clicks, total) {
  const rate = 44100, n = Math.ceil(rate * total), pcm = new Float32Array(n), buf = Buffer.alloc(44 + n * 4);
  clicks.forEach(({ t, accent }) => {
    const i0 = Math.round(t * rate), f = accent ? 1600 : 1100, len = Math.floor(rate * 0.04);
    for (let i = 0; i < len && i0 + i < n; i++) pcm[i0 + i] += Math.sin(2 * Math.PI * f * i / rate) * Math.exp(-i / (rate * 0.008)) * (accent ? 0.5 : 0.32);
  });
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { const v = Math.round(Math.max(-1, Math.min(1, pcm[i])) * 32767); buf.writeInt16LE(v, 44 + i * 4); buf.writeInt16LE(v, 46 + i * 4); }
  return buf;
}

// Base rítmica del modo progresivo, montada a partir de la BIBLIOTECA de renders de BiaB a tempo fijo
// (<dir>/*_Render_<bpm>.aiff: el audio empieza justo en el 1er pulso de los 2 compases de cuenta y el
// ritmo arranca en el pulso 8). Cuenta de entrada del primer tempo + los pulsos de cada vuelta tomados
// del render de su tempo; los cortes van a la muestra sobre la rejilla global para no acumular deriva.
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
  const args = parseArgs(process.argv);
  const root = args.root || 'C', posLabel = (args.position || 'E').toUpperCase(), bpm = parseFloat(args.bpm || 60);
  const posIdx = POS_LABELS.indexOf(posLabel);
  const seqKeys = (args.seqs || 'terceras,triadas,cuatriadas').split(',').map(s => s.trim()).filter(s => SEQS[s]);
  if (args['seq-name'] && seqKeys.length) SEQS[seqKeys[0]] = { ...SEQS[seqKeys[0]], name: String(args['seq-name']) };   // rótulo en pantalla alternativo (p.ej. "Tríadas diatónicas" con tilde)
  const beat = 60 / bpm;
  const tempos = args.tempos ? String(args.tempos).split(',').map(Number).filter(n => n > 0) : null;
  const ruta = args.ruta === 'caja' || args.ruta === 'tonica' ? args.ruta : (tempos ? 'caja' : 'tonica');   // progresivo: posición entera por defecto
  const antic = ['grupo', 'todo'].includes(args.anticipa) ? args.anticipa : 'no';
  const ladderTempos = args.ladder ? String(args.ladder).split(',').map(Number).filter(n => n > 0) : tempos;   // --ladder: escalera que se DIBUJA (para clips de prueba de unas pocas vueltas)
  const backingDir = args.backing ? path.resolve(String(args.backing).replace(/^~/, os.homedir())) : null;
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
  // --closed: la misma posición 12 trastes más arriba, sin cuerdas al aire (vídeo "Forma X cerrada").
  if (args.closed) box.forEach(n => { n.fret += 12; });
  const notes = box.map(n => ({ ...n, midi: OPEN_MIDI[n.string] + n.fret })).sort((a, b) => a.midi - b.midi);
  const key = n => n.string + ':' + n.fret;

  // Pasos: un fotograma por nota; el grupo en curso encendido, el resto de la posición en fantasma.
  const steps = [];
  const baseState = () => new Map(notes.map(n => [key(n), 'ghost']));
  const first = notes.findIndex(n => n.isRoot);
  // Grupos de una vuelta (cada grupo = un pulso). Ruta 'tonica': desde la TÓNICA más grave (no desde la
  // nota más grave de la caja: la 1ª triada sería el vii°), subiendo hasta donde quepa el grupo, y de
  // vuelta hasta la tónica. Ruta 'caja': tónica grave → arriba → nota más grave de la caja → tónica
  // (recorre la posición entera y dura lo mismo en todas las formas).
  const buildGroups = (sq) => {
    const top = sq.span[sq.span.length - 1], up = i => ({ idx: sq.span.map(o => i + o) }), down = i => ({ idx: sq.span.map(o => i + o).reverse() });
    const starts = []; for (let i = first; i + top < notes.length; i++) starts.push(i);
    if (ruta !== 'caja' || first === 0) return [...starts.map(up), ...starts.slice(0, -1).reverse().map(down)];
    const bajada = []; for (let i = starts[starts.length - 1] - 1; i >= 0; i--) bajada.push(down(i));
    const remonte = []; for (let i = 1; i < first; i++) remonte.push(up(i));
    return [...starts.map(up), ...bajada, ...remonte, { idx: [first] }];
  };
  // alt: cada segundo grupo va en sentido contrario (terceras alternas, triadas en zigzag).
  const buildSeq = (sq) => { const gs = buildGroups(sq); return sq.alt ? gs.map((g, i) => (i % 2 && g.idx.length > 1 ? { idx: [...g.idx].reverse() } : g)) : gs; };
  // gb = pulsos por grupo (1; en progresivo las cuatriadas van en corcheas = 2 pulsos por acorde).
  // Fila de la escala (modo progresivo): los 7 acordes diatónicos con su grado, o las 7 notas en las
  // terceras (con la calidad de cada tercera, mayor/menor, para ir asociando el sonido).
  const ROMAN = { triadas: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'], cuatriadas: ['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø'] };
  const degLabel = d => notes.find(n => n.degree === d).label;
  const stripItems = sk => [0, 1, 2, 3, 4, 5, 6].map(d => SEQS[sk].suffix ? { label: degLabel(d) + SEQS[sk].suffix[d], sub: ROMAN[SEQS[sk].roman || sk][d] } : { label: degLabel(d), sub: String(d + 1) });
  const pushGroups = (sq, groups, b, base, bpm, gb = 1, lap) => {
    groups.forEach((g, gi) => {
      const chordRoot = notes[Math.min(...g.idx)];
      const chord = sq.suffix && g.idx.length > 1 ? `${chordRoot.label}${sq.suffix[chordRoot.degree]}` : '';
      const st = baseState();
      // Progresivo, --anticipa: 'grupo' = el grupo en curso entero desde su primer pulso (lo que falta, tenue)
      // con la nota que suena AHORA destacada (brillo + halo) y, solo con --pista, el borde blanco en la 1ª nota del grupo siguiente un pulso antes;
      // 'todo' = además aros en lo que falta y en el grupo siguiente (a Alberto le resultó confuso); 'no' = nada.
      if (bpm && antic === 'todo') { (groups[gi + 1] ? groups[gi + 1].idx : []).forEach(ix => st.set(key(notes[ix]), 'soon')); g.idx.forEach(ix => st.set(key(notes[ix]), 'next')); }
      else if (bpm && antic === 'grupo') g.idx.forEach(ix => st.set(key(notes[ix]), 'pend'));
      g.idx.forEach((ix, j) => {
        st.set(key(notes[ix]), 'active');
        const caption = bpm ? '' : chord ? `${base} · ${chord}` : base, nb = gb / g.idx.length, at = gi * gb + j * nb;   // pulsos que dura la nota / pulso en que cae
        const metro = k => bpm ? { bpm, beat: Math.floor(at + k + 1e-9) % 4 } : undefined;
        const nextIx = groups[gi + 1] ? groups[gi + 1].idx[0] : undefined;                // 1ª nota del grupo SIGUIENTE, durante todo el grupo
        const ring = bpm && antic === 'grupo' && args.pista && nextIx !== undefined && j * (gb / g.idx.length) >= gb - 1 - 1e-9 ? key(notes[nextIx]) : undefined;   // solo en el último pulso del grupo
        const strip = !bpm ? undefined : sq.suffix ? { on: [g.idx.length > 1 ? chordRoot.degree : notes[ix].degree] }
          : { on: g.idx.slice(0, j + 1).map(i => notes[i].degree), q: g.idx.length === 2 ? ([4, 9].includes(Math.abs(notes[g.idx[0]].midi - notes[g.idx[1]].midi)) ? 'may' : 'men') : undefined };   // 3ª/6ª mayor (4/9 semitonos) o menor (3/8)
        const snap = new Map(st); if (bpm && antic === 'grupo') snap.set(key(notes[ix]), 'flash');   // tres niveles: AHORA (brillo + halo) / ya tocada / pendiente (tenue)
        if (nb <= 1) steps.push({ state: snap, dur: b * nb, caption, sound: notes[ix], metro: metro(0), strip, lap, ring });
        else for (let k = 0; k < nb; k++) steps.push({ state: new Map(snap), dur: b, caption, sound: k ? undefined : notes[ix], metro: metro(k), strip, lap, ring });   // nota larga: un paso por pulso (metrónomo)
      });
    });
  };
  const clicks = []; let lapBeats = 0;
  if (tempos) {
    // Progresivo: UNA secuencia, una vuelta entera por tempo; el tempo sube al volver a empezar en graves.
    // La vuelta se redondea a compases de 4/4 con al menos 2 pulsos de respiro (aviso del tempo siguiente).
    const sq = SEQS[seqKeys[0]], groups = buildSeq(sq), gb = sq.progBeats || 1, seqBeats = groups.length * gb;
    lapBeats = Math.ceil((seqBeats + 2) / 4) * 4;
    let tt = 0;
    const tick = (n, b, from) => { if (!backingDir) for (let k = 0; k < n; k++) clicks.push({ t: tt + k * b, accent: (from + k) % 4 === 0 }); tt += n * b; };
    const countBeats = backingDir ? 8 : 4;                                          // la base trae 2 compases de cuenta
    // Silencios pulso a pulso, para que el metrónomo visual (tempo + 4 puntos) siga marcando.
    // lead = se anuncia el primer grupo de la vuelta que empieza (aro) durante el silencio.
    const rest = (n, b, from, next, bpm, lap, lead) => { for (let k = 0; k < n; k++) { const st = baseState(); if (lead && antic !== 'no') groups[0].idx.forEach(ix => st.set(key(notes[ix]), antic === 'todo' ? 'next' : 'pend')); steps.push({ state: st, dur: b, caption: '', metro: { bpm, beat: (from + k) % 4, next }, strip: { on: [] }, lap, ring: lead && antic === 'grupo' && args.pista && k === n - 1 ? key(notes[groups[0].idx[0]]) : undefined }); } };
    rest(countBeats - 4, 60 / tempos[0], 0, undefined, tempos[0], 0, false); rest(4, 60 / tempos[0], countBeats - 4, undefined, tempos[0], 0, true); tick(countBeats, 60 / tempos[0], 0);
    tempos.forEach((bpmL, li) => {
      const b = 60 / bpmL, next = tempos[li + 1];
      pushGroups(sq, groups, b, sq.name, bpmL, gb, li); tick(seqBeats, b, 0);
      rest(lapBeats - seqBeats, b, seqBeats, next, bpmL, li, !!next); tick(lapBeats - seqBeats, b, seqBeats);
    });
    steps.push({ state: baseState(), dur: backingDir ? 4 * 60 / tempos[tempos.length - 1] : 1, caption: '' });   // con base: un compás más, en fundido
    console.log(`Vuelta: ${seqBeats} pulsos de secuencia + ${lapBeats - seqBeats} de respiro = ${lapBeats / 4} compases`);
  } else {
    steps.push({ state: baseState(), dur: 2 * beat, caption: '' });
    for (const sk of seqKeys) {
      const sq = SEQS[sk];
      steps.push({ state: baseState(), dur: 2 * beat, caption: sq.name });          // 2 pulsos de respiro + título
      pushGroups(sq, buildSeq(sq), beat, sq.name);
    }
    steps.push({ state: baseState(), dur: 3 * beat, caption: '' });
  }

  // Fotogramas: se reutiliza el dibujo del capítulo 1; los estados repetidos se renderizan una vez.
  const frameUrl = 'file://' + path.join(__dirname, 'lib', 'scale-intro-frame.html');
  const frets = notes.map(n => n.fret);
  const fretMin = Math.max(1, Math.min(...frets) - 1), fretMax = Math.max(...frets) + 1;
  const cache = new Map(); let nPng = 0, framePage = null;
  const t0 = Date.now(), lap = []; const mark = n => lap.push(`${n} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  for (const s of steps) {
    const sig = s.caption + '|' + (s.metro ? `${s.metro.bpm}:${s.metro.beat}:${s.metro.next || ''}` : '') + '|' + (s.strip ? s.strip.on.join(',') + (s.strip.q || '') : '') + '|' + (s.lap === undefined ? '' : s.lap) + '|' + (s.ring || '') + '|' + notes.map(n => s.state.get(key(n))[0]).join('');
    if (!cache.has(sig)) {
      const data = { title: `Escala de ${root} mayor · Forma ${posLabel}${args.closed ? ' cerrada' : ''}`, subtitle: tempos ? `Patrones melódicos · ${SEQS[seqKeys[0]].name}` : 'Secuencias dentro de la posición', caption: s.caption, metro: s.metro,
        ladder: tempos && s.lap !== undefined ? { tempos: ladderTempos, cur: ladderTempos.indexOf(tempos[s.lap]) } : undefined,
        strip: s.strip && tempos ? { items: stripItems(seqKeys[0]), on: s.strip.on, q: s.strip.q, pill: SEQS[seqKeys[0]].span.length === 2, iv: SEQS[seqKeys[0]].span[1] === 5 ? '6ª' : '3ª' } : undefined, fretMin, fretMax,
        notes: notes.map(n => ({ string: n.string, fret: n.fret, label: n.label, isRoot: n.isRoot, state: s.state.get(key(n)), ring: s.ring === key(n) })) };
      if (!framePage) { framePage = await browser.newPage({ viewport: { width: 1600, height: 900 } }); await framePage.goto(frameUrl); }
      await framePage.evaluate(d => render(d), data);                               // una sola página para todos los fotogramas
      const png = path.join(tmp, `f${String(nPng++).padStart(4, '0')}.png`);
      await framePage.screenshot({ path: png });
      cache.set(sig, png);
    }
    s.png = cache.get(sig);
  }

  mark('fotogramas');
  let t = 0; const events = [];
  steps.forEach(s => { if (s.sound) events.push({ t, freq: 82.4069 * Math.pow(2, (s.sound.midi - 40) / 12) }); t += s.dur; });
  const total = t;
  // Las notas se sintetizan POR TRAMOS (un vídeo de 6 min de una sola vez tumba la pestaña: cientos de
  // notas con su reverb en un único OfflineAudioContext) y se suman con su desfase; cada tramo lleva
  // 3 s de cola para que la última nota termine de sonar.
  const wav = path.join(tmp, 'notas.wav'), CHUNK = 40, parts = [];
  for (let a = 0; a < total; a += CHUNK) {
    const ev = events.filter(e => e.t >= a && e.t < a + CHUNK).map(e => ({ t: e.t - a, freq: e.freq }));
    if (!ev.length) continue;
    const w = path.join(tmp, `notas-${parts.length}.wav`);
    fs.writeFileSync(w, Buffer.from(await app.evaluate(renderToneTrackInPage, { events: ev, total: Math.min(CHUNK, total - a) + 3 }), 'base64'));
    parts.push({ w, a });
  }
  if (parts.length === 1 && parts[0].a === 0) fs.renameSync(parts[0].w, wav);
  else await execFileP('ffmpeg', ['-loglevel', 'error', '-y', ...parts.flatMap(p => ['-i', p.w]), '-filter_complex',
    parts.map((p, k) => `[${k}:a]adelay=${Math.round(p.a * 44100)}S|${Math.round(p.a * 44100)}S[p${k}]`).join(';') + ';' + parts.map((_, k) => `[p${k}]`).join('') + `amix=inputs=${parts.length}:normalize=0[a]`,
    '-map', '[a]', '-ar', '44100', '-ac', '2', wav]);
  await browser.close();
  mark('audio');

  // Cortes secos (concat con duraciones): en secuencias rápidas un fundido por nota emborrona.
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, steps.map(s => `file '${s.png}'\nduration ${s.dur.toFixed(4)}`).join('\n') + `\nfile '${steps[steps.length - 1].png}'\n`);
  const rootF = root.replace('#', 's'), sq0 = SEQS[seqKeys[0]];
  const out = path.join(outDir, tempos
    ? `${sq0.file || sq0.name.replace(/\s+/g, '')}_${rootF}_Forma${posLabel}${args.closed ? '_Cerrada' : ''}_${tempos[0]}-${tempos[tempos.length - 1]}bpm${ruta === 'tonica' ? '_tonica' : ''}.mp4`
    : `${rootF}_Forma${posLabel}${args.closed ? '_Cerrada' : ''}_Secuencias.mp4`);
  // Modo progresivo: base rítmica (--backing <biblioteca>) o, sin ella, claqueta.
  const clickArgs = [];
  if (tempos && backingDir) {
    const bw = path.join(tmp, 'base.wav'); await buildBacking(backingDir, tempos, lapBeats, 4, bw);
    clickArgs.push('-i', bw, '-filter_complex', `[1:a]volume=${parseFloat(args['notes-vol'] || 0.65)}[n];[2:a]volume=${parseFloat(args['backing-vol'] || 2.6)}[b];[n][b]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]`, '-map', '0:v', '-map', '[a]');
  } else if (clicks.length) {
    const cw = path.join(tmp, 'click.wav'); fs.writeFileSync(cw, clickWav(clicks, total));
    clickArgs.push('-i', cw, '-filter_complex', '[1:a][2:a]amix=inputs=2:normalize=0[a]', '-map', '0:v', '-map', '[a]');
  }
  await execFileP('nice', ['-n', '19', 'ffmpeg', '-loglevel', 'error', '-y', '-threads', '2', '-f', 'concat', '-safe', '0', '-i', list, '-i', wav, ...clickArgs,
    '-vf', 'fps=25,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { maxBuffer: 1 << 24 });
  fs.rmSync(tmp, { recursive: true, force: true });
  mark('vídeo');
  console.log(`✓ ${out} (${total.toFixed(1)} s, ${steps.length} pasos, ${nPng} fotogramas distintos; ${lap.join(', ')})`);
})().catch(e => { console.error(e.stderr || e); process.exitCode = 1; });
