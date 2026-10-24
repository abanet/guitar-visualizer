#!/usr/bin/env node
/*
 * Pentatónicas y escalas de blues sobre un blues (formato nuevo, pedido por Alberto 2026-10-12 para sustituir a
 * las listas antiguas "Combina pentatónicas" y "Escala de blues"): la rueda entera a la vista (rejilla de
 * compases, el que suena encendido) y debajo el mástil en una forma CAGED fija. Cuatro ejercicios (--mode):
 *   mezcla        pentatónica MAYOR + MENOR de la tónica, cambiando con el acorde (por defecto)
 *   mezcla-blues  lo mismo con las escalas de blues (mayor de blues + menor de blues)
 *   blues-menor   la escala menor de blues (pentatónica menor + b5) toda la rueda
 *   blues-mayor   la escala mayor de blues (pentatónica mayor + 3m) toda la rueda
 *   penta-menor / penta-mayor   la pentatónica sola, pensada para una base de UN acorde (--cyclelen 8: la rejilla
 *                 solo cuenta compases): dos compases con las tónicas y luego la escala hasta el final (sin partes ni "te toca"). Sin rejilla de acordes
 *                 (Alberto: basta decir en qué acorde está la base): en su sitio, la FÓRMULA sobre la escala de
 *                 siete notas de la que sale, y en el mástil esa escala apagada detrás de la pentatónica.
 *                 Antes de la base, una entrada corta (pluck, en corcheas): con la escala de siete en gris, la
 *                 pentatónica se enciende nota a nota desde la tónica más grave (--no-intro la quita).
 *                 --intro presentacion: la presentación larga (suena la escala de siete, cada nota que sobra
 *                 choca con su vecina de semitono y se apaga); Alberto la reserva para un vídeo aparte.
 * Las mezclas proponen un MAPA PARA EMPEZAR, no una regla (no hay una única entre los profesionales; Alberto:
 * "lo que indiquemos tiene que ser lo que recomendaría un profesional del blues"): mayor en el I7 ("en casa") y
 * menor en el IV7 y el V7 ("fuera de casa"; la 3ª mayor de la tónica choca con la 7ª menor del IV7, y el tramo
 * V7-IV7 en menor es el patrón más citado). --v7 may pone la mayor en el V7.
 *
 * Fases, una por vuelta de la rueda (plan para 10 vueltas; con otro número se reparte en proporción):
 *   mezclas:  1 solo mayor · 2 solo menor · 3 lo que tienen en común y las dos juntas · 4-7 el mapa para empezar ·
 *             8-10 te toca a ti (las dos tenues; la rejilla marca el compás, sin decir qué escala)
 *   blues-*:  1 la pentatónica de partida · 2 la blue note (primero sola, luego con el resto) ·
 *             3-7 la escala completa · 8-10 te toca a ti
 * Sin demo tocada ni notas objetivo marcadas (descartado por Alberto: demasiado estímulo, y decidir en qué nota
 * terminar es complejo): el vídeo va directo al ejercicio.
 *
 * Entrada: el MusicXML de la base (acordes por compás, tempo fijo) y su audio, que empieza en el primer
 * pulso de la cuenta de entrada. No graba en tiempo real: un fotograma por pulso (scripts/lib/penta-mix-frame.html)
 * montado con ffmpeg sobre el audio.
 *
 * Uso: node scripts/generate-pentatonic-mix.js --xml base.xml --audio base.aiff [--mode mezcla] [--position C]
 *        [--closed | --with-closed] [--v7 may|men] [--cyclelen 12] [--out <dir>] [--from-bar 39 --bars 13 --tag prueba]   (clip: compases absolutos, 1 = primero del XML)
 *        [--no-fade]   (sin el fundido de 0,32 s en los cambios de escala)
 *        [--stills 3:1,40:3 [--stills-only]]   (además, PNG sueltos de compás:pulso)
 * Salida: <out>/<Ejercicio>_<Tono>_Forma<X>[_<tag>].mp4 (por defecto, la carpeta del XML)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { renderToneTrackInPage } = require('./lib/pluck-audio');
const execFileP = promisify(execFile);

const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const POS_LABELS = ['E', 'D', 'C', 'A', 'G'];
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const MAJ = [0, 2, 4, 7, 9], MEN = [0, 3, 5, 7, 10];
const IV_LABEL = { 0: '1', 2: '2M', 3: '3m', 4: '3M', 5: '4', 6: 'b5', 7: '5', 8: '6m', 9: '6M', 10: '7m', 11: '7M' };
// Nombre de la nota según su intervalo (la letra la da el grado: la 3m de G es Bb, no A#).
const LETTERS = 'CDEFGAB', IV_DEG = { 0: 0, 2: 1, 3: 2, 4: 2, 5: 3, 6: 4, 7: 4, 8: 5, 9: 5, 10: 6, 11: 6 };
const noteName = (tonicName, tonicPc, iv) => { const L = LETTERS[(LETTERS.indexOf(tonicName[0]) + IV_DEG[iv]) % 7], d = (((tonicPc + iv) - PC[L]) % 12 + 18) % 12 - 6; return L + (d > 0 ? '#'.repeat(d) : 'b'.repeat(-d)); };
const KIND_SUP = { dominant: '7', major: '', minor: 'm', 'major-seventh': 'maj7', 'minor-seventh': 'm7', 'major-sixth': '6', 'minor-sixth': 'm6' }; // 6: base de la pentatónica mayor (C6…)
const PLAN_MIX = ['may', 'men', 'com', 'sw', 'sw', 'sw', 'sw', 'free', 'free', 'free'];
const PLAN_ONE = ['pen', 'blue', 'full', 'full', 'full', 'full', 'full', 'free', 'free', 'free'];
const PLAN_PLAIN = ['ton', 'full', 'full', 'full', 'full', 'full', 'full', 'free', 'free', 'free'];
// blue: semitono de la blue note de cada escala (b5 en la menor, 3m en la mayor); one: ejercicio de UNA escala;
// plain: la pentatónica sola, sin blue note; scale = la escala de siete notas de la que sale, out = las dos que
// sobran, pairs = cada una con la vecina con la que forma semitono (12 = la tónica de arriba).
const MODES = {
  mezcla:         { file: 'MezclaPentatonicas', title: 'Mezcla de pentatónicas', may: 'pentatónica mayor', men: 'pentatónica menor', sub: t => `${t} mayor + ${t} menor` },
  'mezcla-blues': { file: 'MezclaEscalasDeBlues', title: 'Mezcla de escalas de blues', may: 'mayor de blues', men: 'menor de blues', blue: true, sub: t => `${t} mayor de blues + ${t} menor de blues` },
  'blues-menor':  { file: 'EscalaMenorDeBlues', title: 'Escala menor de blues', one: 'men', blue: true, penta: 'pentatónica menor', full: 'menor de blues', bn: 'b5', sub: t => `${t} menor de blues` },
  'blues-mayor':  { file: 'EscalaMayorDeBlues', title: 'Escala mayor de blues', one: 'may', blue: true, penta: 'pentatónica mayor', full: 'mayor de blues', bn: '3m', sub: t => `${t} mayor de blues` },
  'penta-menor':  { file: 'PentatonicaMenor', title: 'Pentatónica menor', one: 'men', plain: true, penta: 'pentatónica menor', ivs: '1 · 3m · 4 · 5 · 7m', parent: 'escala menor natural', scale: [0, 2, 3, 5, 7, 8, 10], out: [2, 8], pairs: [[2, 3], [8, 7]], sub: t => `${t} pentatónica menor` },
  'penta-mayor':  { file: 'PentatonicaMayor', title: 'Pentatónica mayor', one: 'may', plain: true, penta: 'pentatónica mayor', ivs: '1 · 2M · 3M · 5 · 6M', parent: 'escala mayor', scale: [0, 2, 4, 5, 7, 9, 11], out: [5, 11], pairs: [[5, 4], [11, 12]], sub: t => `${t} pentatónica mayor` },
};

function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  return a;
}

// Acordes por compás (el primero de cada compás) y tempo, de la primera parte del MusicXML.
function readXml(file) {
  const s = fs.readFileSync(file, 'utf8');
  const part = (s.match(/<part id="[^"]*">([\s\S]*?)<\/part>/) || [])[1];
  if (!part) throw new Error('No encuentro ninguna <part> en ' + file);
  const tempo = parseFloat((s.match(/<sound[^>]*tempo="([\d.]+)"/) || [])[1]);
  if (!tempo) throw new Error('El XML no trae tempo');
  const bars = [...part.matchAll(/<measure [^>]*>([\s\S]*?)<\/measure>/g)].map(m => {
    const h = (m[1].match(/<harmony[\s\S]*?<\/harmony>/) || [])[0];
    if (!h) return null;
    const step = (h.match(/<root-step>([A-G])/) || [])[1], alter = parseInt((h.match(/<root-alter>(-?\d)/) || [])[1] || '0', 10);
    const kind = ((h.match(/<kind[^>]*>([^<]*)</) || [])[1] || 'major').trim();
    return { pc: ((PC[step] + alter) % 12 + 12) % 12, name: step + (alter === 1 ? '#' : alter === -1 ? 'b' : ''), kind };
  });
  // Un compás sin cifrado sigue con el acorde anterior (las bases de un acorde solo lo escriben cada 4 compases).
  for (let i = 1; i < bars.length; i++) if (!bars[i] && bars[i - 1]) bars[i] = bars[i - 1];
  return { tempo, bars };
}

// Caja de pentatónica de 2 notas por cuerda: desde el grado `start` sobre la 6ª cuerda, subiendo.
function pentaBox(rootPc, formula, start) {
  const pcs = formula.map(i => (rootPc + i) % 12);
  let midi = 40; while (midi % 12 !== pcs[start]) midi++;
  const out = [];
  for (let string = 0, d = start; string < 6; string++) for (let k = 0; k < 2; k++, d++) {
    out.push({ string, fret: midi - OPEN_MIDI[string], pc: midi % 12 });
    const cur = formula[d % 5] + 12 * Math.floor(d / 5), nxt = formula[(d + 1) % 5] + 12 * Math.floor((d + 1) / 5);
    midi += nxt - cur;
  }
  return out;
}

// Blue notes de una caja: en cada cuerda, la blue note que cae ENTRE las dos notas de la pentatónica o un
// traste por encima de la aguda (las digitaciones habituales; nunca por debajo de la grave).
function blueNotes(box, bluePc) {
  const out = [];
  for (let string = 0; string < 6; string++) {
    const fr = box.filter(n => n.string === string).map(n => n.fret), lo = Math.min(...fr), hi = Math.max(...fr);
    for (let f = lo + 1; f <= hi + 1; f++) if ((OPEN_MIDI[string] + f) % 12 === bluePc && !fr.includes(f)) out.push({ string, fret: f, pc: bluePc });
  }
  return out;
}

// Notas de la escala de siete que NO están en la pentatónica, en la digitación habitual de la posición: en
// cada cuerda, entre las dos de la caja o a un traste de ellas.
function outNotes(box, pcs) {
  const out = [];
  for (let string = 0; string < 6; string++) {
    const fr = box.filter(n => n.string === string).map(n => n.fret), lo = Math.min(...fr), hi = Math.max(...fr);
    for (let f = Math.max(0, lo - 1); f <= hi + 1; f++) { const pc = (OPEN_MIDI[string] + f) % 12; if (pcs.includes(pc) && !fr.includes(f)) out.push({ string, fret: f, pc, ghost: true }); }
  }
  return out;
}

(async () => {
  const args = parseArgs(process.argv);
  const M = MODES[args.mode || 'mezcla'];
  if (!args.xml || !args.audio || !M) { console.error(`Uso: --xml <base.xml> --audio <base.aiff> [--mode ${Object.keys(MODES).join('|')}] [--position C] [--v7 may|men] [--from-bar N --bars M --tag t]`); process.exit(1); }
  const xmlPath = path.resolve(String(args.xml).replace(/^~/, os.homedir())), audioPath = path.resolve(String(args.audio).replace(/^~/, os.homedir()));
  const { tempo, bars } = readXml(xmlPath), beat = 60 / tempo;
  const posLabel = String(args.position || 'C').toUpperCase(), posIdx = POS_LABELS.indexOf(posLabel);
  if (posIdx < 0) throw new Error('Forma desconocida: ' + posLabel);
  const v7 = args.v7 === 'may' ? 'may' : 'men', cyc = parseInt(args.cyclelen || 12, 10);
  const countIn = bars.findIndex(b => b), tonic = bars[countIn];
  const laps = Math.floor((bars.filter(b => b).length) / cyc), PLAN10 = M.plain ? PLAN_PLAIN : M.one ? PLAN_ONE : PLAN_MIX;
  const plan = Array.from({ length: laps }, (_, i) => PLAN10[Math.min(9, Math.floor(i * 10 / laps))]);
  const outDir = path.resolve(args.out ? String(args.out).replace(/^~/, os.homedir()) : path.dirname(xmlPath));
  fs.mkdirSync(outDir, { recursive: true });

  // Notas. Cada una sabe a qué escalas pertenece (in.may / in.men) y su color (kind):
  //   mezclas: 'com' = tónica, 'fif' = la 5ª (color de la escala que suena; partida si valen las dos); las dos son las comunes a las dos PENTATÓNICAS y van rodeadas de un aro
  //            blanco (Alberto: solo la tónica en rojo, y lo común "como siempre", con círculo blanco), 'may' / 'men' = solo en una, 'blue' = la b5.
  //            (la 3m es la blue note de la mayor de blues, pero se queda con el color de la menor: es SU nota)
  //   una escala: 'com' = tónica, 'blue' = la blue note, el resto con el color de la escala.
  const notes = new Map(), iv = n => ((n.pc - tonic.pc) % 12 + 12) % 12;
  const add = (n, scale, kind) => { const k = n.string + ':' + n.fret, o = notes.get(k) || { ...n, iv: iv(n), label: noteName(tonic.name, tonic.pc, iv(n)), ivLabel: IV_LABEL[iv(n)], in: {}, kind }; o.in[scale] = true; notes.set(k, o); };
  for (const [scale, f, blueIv] of [['may', MAJ, 3], ['men', MEN, 6]]) {
    if (M.one && M.one !== scale) continue;
    const box = pentaBox(tonic.pc, f, posIdx);
    if (args.closed) box.forEach(n => { n.fret += 12; });      // --closed: la misma forma 12 trastes más arriba, sin cuerdas al aire
    box.forEach(n => add({ ...n, penta: true }, scale, scale));
    if (M.blue) blueNotes(box, (tonic.pc + blueIv) % 12).forEach(n => add(n, scale, 'blue'));
    if (M.plain) outNotes(box, M.out.map(i => (tonic.pc + i) % 12)).forEach(n => add(n, 'out', 'out'));
  }
  const NOTES = [...notes.values()];
  const hasOpen = !args.closed && NOTES.some(n => n.fret === 0);
  NOTES.forEach(n => { n.kind = M.one ? (n.ghost ? 'out' : n.iv === 0 ? 'com' : n.penta ? M.one : 'blue') : n.iv === 0 ? 'com' : n.iv === 7 ? 'fif' : n.iv === 6 ? 'blue' : n.iv === 3 || n.iv === 5 || n.iv === 10 ? 'men' : 'may'; });
  const frets = NOTES.map(n => n.fret), fretMin = Math.max(1, Math.min(...frets) - 1), fretMax = Math.max(...frets) + 1;

  // Qué escala pide cada acorde, y qué indica cada compás según la fase de su vuelta.
  const chordScale = c => { const i = ((c.pc - tonic.pc) % 12 + 12) % 12; return i === 5 ? 'men' : i === 7 ? v7 : 'may'; };
  const where = bar => {                                   // bar: índice absoluto (0 = primer compás del XML)
    if (bar < countIn || !bars[bar]) return { zone: bar < countIn ? 'in' : 'out' };
    const k = bar - countIn, lap = Math.floor(k / cyc);
    return lap >= laps ? { zone: 'out', chord: bars[bar] } : { zone: 'lap', lap, pos: k % cyc, phase: M.plain ? (k < 2 ? 'ton' : 'full') : plan[lap], chord: bars[bar] };   // pentatónica sola: dos compases con las tónicas y la escala hasta el final, sin partes
  };
  const scaleAt = bar => {
    const w = where(bar);
    if (w.zone !== 'lap') return null;
    if (M.one) return M.one;
    // free: sin indicación de escala (Alberto: en las últimas vueltas improvisa mezclando, sin decirle mayor o menor).
    return w.phase === 'may' || w.phase === 'men' ? w.phase : w.phase === 'com' ? (w.pos < 4 ? null : 'both') : w.phase === 'free' ? 'both' : chordScale(w.chord);
  };
  const chordName = c => c.name + (KIND_SUP[c.kind] === undefined ? '' : KIND_SUP[c.kind]);
  const cycleCells = lap => Array.from({ length: cyc }, (_, i) => { const b = countIn + lap * cyc + i, c = bars[b]; return { chord: c.name, sup: KIND_SUP[c.kind] || '', scale: scaleAt(b), tag: !M.one && plan[lap] !== 'free' }; });
  const b2 = (cls, t) => `<b class="${cls}">${t}</b>`, arr = '<span class="arr">→</span>';
  // El mapa: los acordes agrupados por la escala que se propone ("G7 → mayor · C7 y D7 → menor").
  const rule = sc => { const cs = uniqChords.filter(c => chordScale(c) === sc).map(chordName); return cs.length ? `${cs.join(' y ')}${arr}${b2(sc, sc === 'may' ? 'mayor' : 'menor')}` : ''; };
  const uniqChords = [...new Map(bars.filter(b => b).map(c => [chordName(c), c])).values()];
  const comTxt = M.blue ? `la ${b2('com', 'tónica')}, la ${b2('men', '3m')} y la ${b2('fif', '5ª')}` : `la ${b2('com', 'tónica')} y la ${b2('fif', '5ª')}`;
  const PHASE_NAME = M.plain
    ? { ton: 'Localiza las tónicas', full: M.title, free: 'Te toca a ti' }
    : M.one
    ? { pen: `Empieza por la ${M.penta}`, blue: `Añade la blue note (${M.bn})`, full: `Escala ${M.full}`, free: 'Te toca a ti' }
    : { may: `Solo ${M.may}`, men: `Solo ${M.men}`, com: 'Lo que tienen en común', sw: 'Un mapa para empezar', free: 'Te toca a ti' };
  const LINES = M.plain ? {
    ton: [`Primero las ${b2('com', 'tónicas')}: son tu punto de apoyo`, 'Empieza y termina tus frases en ellas'],
    full: [`Toda la ${b2(M.one, M.penta)}`, 'Súbela, bájala y repite notas: sin prisa'],
    free: [`Improvisa con la ${M.penta}`, 'Frases cortas, y deja silencios'],
  } : M.one ? {
    pen: [`Toda la vuelta con la ${b2(M.one, M.penta)}`, 'Es la base: la escala de blues solo le añade una nota'],
    blue: [`La ${b2('blue', 'blue note')} es la ${M.bn}: localízala en cada cuerda`, M.one === 'men' ? 'Es una nota de paso: no te quedes en ella' : 'Úsala de paso hacia la 3M'],
    full: [`${b2(M.one, M.penta[0].toUpperCase() + M.penta.slice(1))} + ${b2('blue', 'blue note')}`, M.one === 'men' ? 'Pasa por la b5 entre la 4 y la 5' : 'Pasa por la 3m entre la 2M y la 3M'],
    free: [`Improvisa con la escala ${M.full}`, 'Sigue la rueda en la rejilla'],
  } : {
    may: [`Toda la vuelta con la ${b2('may', M.may)}`, 'Suena dulce, a country y a rock clásico'],
    men: [`Toda la vuelta con la ${b2('men', M.men)}`, 'Suena a blues: es la de siempre'],
    com: [`Comparten ${comTxt}`, 'Misma zona del mástil, dos colores'],
    sw: ['Para empezar: ' + ['may', 'men'].map(rule).filter(Boolean).join(' &nbsp;·&nbsp; '), 'En casa suena mayor; al salir de casa, menor'],
    free: ['Improvisa mezclando las dos', 'Tú decides cuándo suena mayor y cuándo menor'],
  };
  const NOW = M.plain ? { ton: 'TÓNICAS', full: 'PENTATÓNICA', free: 'PENTATÓNICA' } : M.one ? { pen: 'PENTATÓNICA', blue: 'BLUE NOTE', full: 'ESCALA DE BLUES', free: 'ESCALA DE BLUES' } : null;
  const legend = M.plain
    ? [['com', 'Tónica'], [M.one, M.penta[0].toUpperCase() + M.penta.slice(1)], ['out', `Resto de la ${M.parent}`]]
    : M.one
    ? [['com', 'Tónica'], [M.one, M.penta[0].toUpperCase() + M.penta.slice(1)], ['blue', `Blue note (${M.bn})`]]
    : [['com', 'Tónica'], ['common', 'Comunes a las dos (1 y 5): aro blanco'], ['may', `Solo mayor (2M · 3M · 6M)`], ['men', 'Solo menor (3m · 4 · 7m)'], ...(M.blue ? [['blue', 'Blue note (b5 · 3m)']] : [])];
  const isCommon = n => n.in.may && n.in.men;
  // Pentatónica sola: la fórmula sobre los siete grados de la escala de la que sale (st: estado de cada grado)
  // y, en vez de vueltas, las partes del vídeo.
  const useIntro = !!(M.plain && !args['no-intro'] && (!args['from-bar'] || parseInt(args['from-bar'], 10) === 1)), longIntro = useIntro && args.intro === 'presentacion';
  const STEP = longIntro ? 1 : 0.5;   // STEP: pulsos por fotograma de la entrada
  const cap = t => t[0].toUpperCase() + t.slice(1);
  const formulaOf = (st, head, beat) => ({ head, base: chordName(tonic), beat,
    // hasta la tónica de arriba, con la distancia entre cada dos grados (T / ST)
    degs: [...M.scale, 12].map((i, j, a) => ({ iv: IV_LABEL[i % 12], note: noteName(tonic.name, tonic.pc, i % 12), kind: i % 12 === 0 ? 'com' : M.out.includes(i) ? 'out' : M.one, state: st(j, i % 12), step: j ? (i - a[j - 1] === 1 ? 'ST' : 'T') : '' })) });
  // Pentatónica sola: consejos de improvisación que van saliendo de uno en uno (Alberto: "de uno en uno, a ratos"),
  // los habituales de los profesores (silencios, pocas notas, repetir, ritmo, notas de paso…) y, intercalados,
  // en qué nota TERMINAR la frase y qué sensación deja cada una. Se reparten por igual en lo que dura la base.
  const nn = i => noteName(tonic.name, tonic.pc, i);
  const END = M.one === 'men'
    ? [[0, 'Escucha cómo encaja: reposo total,', 'es el punto final'], [7, 'Suena firme, pero abierta:', 'como una coma, la frase puede seguir'], [3, 'Es la nota que suena a menor:', 'estable y melancólica'],
       [10, 'Se queda en el aire:', 'suena a blues y pide continuar'], [5, 'Tensión: una pregunta sin respuesta', 'Resuélvela luego en la 3m o en la 5']]
    : [[0, 'Escucha cómo encaja: reposo total,', 'es el punto final'], [7, 'Suena firme, pero abierta:', 'como una coma, la frase puede seguir'], [4, 'Es la nota que suena a mayor:', 'dulce y estable'],
       [2, 'Flota, sin tensión ni reposo:', 'deja la frase abierta'], [9, 'Dulce y algo nostálgica:', 'recuerda al relativo menor']];
  const end = k => { const [i, a, b] = END[k]; return [`Termina en la ${i ? IV_LABEL[i] : 'tónica'} (${nn(i)})`, [a, b]]; };
  const TIPS = !M.plain ? [] : [
    ['Deja silencios', ['Toca una frase y respira,', 'como si la cantaras']],
    end(0),
    ['Pocas notas', ['Prueba un rato con solo dos o tres notas', 'Menos notas, más música']],
    end(1),
    ['Repite una idea', ['Toca la misma frase dos veces;', 'a la tercera, cámbiale el final']],
    end(2),
    ['Cambia el ritmo, no las notas', ['Las mismas notas con otro ritmo', 'suenan a frase nueva']],
    end(3),
    ['Pregunta y respuesta', ['Una frase pregunta en las cuerdas agudas;', 'otra le responde en las graves']],
    end(4),
    ['No empieces siempre en la tónica', ['Entra por otra nota,', 'o en otro pulso del compás']],
    ['Notas de paso', [`Añade color con las grises: ${M.out.map(i => b2('out', nn(i))).join(' y ')}`, 'Pasa por ellas sin quedarte']],
    ['Salta notas', ['No siempre en orden:', 'salta de cuerda y deja huecos']],
    ['No todas las notas pesan igual', ['Unas fuertes y otras suaves:', 'acentúa las que importan']],
    ['Da vida a las notas largas', ['Vibrato, ligados y deslizamientos', 'para llegar a ellas']],
    ['Canta lo que tocas', ['Si puedes tararear la frase,', 'es una buena frase']],
    ['Júntalo todo', ['Frases cortas, silencios, ritmo', 'y alguna nota de paso']],
  ];
  // Escalas de blues: consejos de una línea, uno cada media vuelta, en las vueltas de escala completa y libres (Alberto,
  // 10-15: "algún consejo profesional"). Son los habituales de los profesores de blues (la b5 y la 3m como notas de
  // paso, fraseo, pregunta-respuesta, silencios…), sin atribuirlos a nadie con nombre: no hay citas verificadas.
  const BT_COMMON = ['Pocas notas, bien dichas: el blues es fraseo', 'Pregunta y respuesta: una frase pide, otra contesta',
    'Deja silencios: respirar también es tocar', 'Repite una frase y cambia solo el final', 'Tócala como si la cantaras',
    'Vibrato en las notas largas', 'Llega a las notas importantes con un slide', 'Empieza a veces a contratiempo, no en el 1',
    'Unas frases suaves y otras con ataque', 'En los compases 11-12, cierra la frase'];
  const BTIPS = !M.blue ? [] : M.one === 'men' ? ['La b5 es de paso: 4 → b5 → 5, sin pararte', 'Llega a la b5 con un bend desde la 4',
      'Si te paras en la b5, resuélvela en la 4 o la 5', 'No la pongas en cada frase: que siga sonando especial', ...BT_COMMON, 'Termina en la tónica: reposo total', 'Júntalo todo: pocas notas, silencios y la b5 de paso']
    : M.one === 'may' ? ['La 3m es de paso: 2M → 3m → 3M', 'Sube la 3m con un bend corto hasta la 3M', 'No te quedes en la 3m: resuélvela en la 3M',
      'Sobre el IV7, la 3M choca: pásala rápido', ...BT_COMMON, 'Termina en la tónica: reposo total', 'Júntalo todo: pocas notas, silencios y la 3m de paso']
    : ['En casa (I7) mayor; fuera (IV7 y V7) menor', 'El gesto clave: de la 3m a la 3M, con slide o bend', 'Empieza en mayor y termina en menor, o al revés',
      'La 3M suena dulce; la 3m, a blues: elige qué decir', 'La 1 y la 5 son de las dos: úsalas de puente', 'Sobre el IV7, no te apoyes en la 3M',
      'Un bend corto en la 3m: ni mayor ni menor', 'La b5, de paso entre la 4 y la 5', 'Pregunta en mayor, contesta en menor',
      ...BT_COMMON.slice(0, 4), 'Termina en la tónica: reposo total', 'Júntalo todo: el mapa, los puentes y silencios'];
  const tipLaps = plan.map((p, i) => [i, p]).filter(([, p]) => ['full', 'sw', 'free'].includes(p)).map(([i]) => i);
  const btipAt = w => { if (!BTIPS.length || w.zone !== 'lap') return null; const k = tipLaps.indexOf(w.lap); if (k < 0) return null;
    const slot = k * 2 + (w.pos >= cyc / 2 ? 1 : 0), nSlots = tipLaps.length * 2; const i = Math.min(Math.floor(slot * BTIPS.length / nSlots), BTIPS.length - 1);
    return { n: i + 1, total: BTIPS.length, text: BTIPS[i], hi: !!M.one }; };
  // Los 8 primeros compases son de la escala; después, cada consejo dura TIP_SPAN compases (par, mínimo 4).
  const TIP_SPAN = M.plain ? Math.max(4, 2 * Math.floor((laps * cyc - 8) / TIPS.length / 2)) : 0;
  const titles = M.plain ? { title: `${M.title} · Base en ${chordName(tonic)}`, subtitle: `${M.sub(tonic.name)} · Forma ${posLabel}${args.closed ? ' cerrada' : ''} (CAGED)` } : null;

  const frameAt = (bar, bt) => {
    const w = where(bar), cur = scaleAt(bar);
    const lap = w.zone === 'lap' ? w.lap : w.zone === 'in' ? 0 : laps - 1, phase = w.zone === 'lap' ? w.phase : plan[lap];
    // Aviso del cambio: la escala del compás siguiente, si es otra (también al cambiar de fase).
    const nw = where(bar + 1), nxt = scaleAt(bar + 1), sameLap = nw.zone === 'lap' && w.zone === 'lap' && nw.lap === w.lap;
    const change = !M.one && w.zone === 'lap' && nw.zone === 'lap' && nxt && cur && nxt !== cur && nxt !== 'both' ? nxt : null;
    const state = n => {
      if (M.one) {
        if (n.ghost) return 'dim';
        if (w.zone === 'in') return n.penta ? 'soft' : 'off';
        if (w.zone === 'out' || phase === 'free') return 'soft';
        if (phase === 'ton') return n.iv === 0 ? 'on' : 'dim';
        if (phase === 'pen') return n.penta ? 'on' : 'off';
        if (phase === 'blue') return !n.penta ? 'on' : w.pos < 4 ? 'dim' : 'on';
        return 'on';
      }
      if (w.zone === 'in') return n.in[plan[0]] ? 'soft' : 'off';
      if (w.zone === 'out') return 'soft';
      if (phase === 'may' || phase === 'men') return n.in[phase] ? 'on' : 'off';
      if (phase === 'com') return isCommon(n) ? 'on' : w.pos < 4 ? 'dim' : 'on';
      if (phase === 'free') return 'soft';
      if (n.in[cur]) return 'on';
      return change && n.in[change] && bt >= 2 ? 'pre' : 'dim';
    };
    const hint = w.zone === 'in' ? 'Cuenta de entrada'
      // Una sola escala de blues: sin "Siguiente vuelta" (Alberto, 10-15: no hace falta; salía un compás antes de los consejos).
      : w.zone === 'lap' && w.pos === cyc - 1 && nw.zone === 'lap' && nw.phase !== phase && !(M.one && M.blue) ? `Siguiente vuelta: ${PHASE_NAME[nw.phase].toLowerCase()}`
      : change ? `Siguiente compás: ${chordName(nw.chord)}${arr}${b2(change, change === 'may' ? 'mayor' : 'menor')}` : '';
    // Una sola escala de blues: sin "AHORA" (Alberto, 10-15: ocupa mucho y no aporta; su sitio es para los consejos).
    const nowText = w.zone !== 'lap' || (M.one && M.blue) ? '' : M.one ? (phase === 'blue' && w.pos >= 4 ? NOW.full : NOW[phase]) : cur ? { may: 'MAYOR', men: 'MENOR', both: 'LAS DOS' }[cur] : M.blue ? 'TÓNICA, 3m Y 5ª' : 'TÓNICA Y 5ª';
    const kb = bar - countIn, tip = M.plain && w.zone === 'lap' && kb >= 8 ? TIPS[Math.min(Math.floor((kb - 8) / TIP_SPAN), TIPS.length - 1)] : null;
    if (M.plain) return {
      ...titles, fretMin, fretMax, grid: null, metro: { bpm: tempo, beat: w.zone === 'out' ? -1 : bt },
      formula: formulaOf((j, i) => M.out.includes(i) ? 'out' : 'on', `${cap(M.penta)}: la ${M.parent} sin la ${M.out.map(i => IV_LABEL[i]).join(' ni la ')}`, w.zone === 'out' ? -1 : bt),
      lap: null,
      phase: { tag: w.zone === 'in' ? 'Cuenta de entrada' : tip ? `Consejo ${TIPS.indexOf(tip) + 1} de ${TIPS.length}` : w.zone === 'lap' ? 'Para empezar' : '', name: w.zone === 'out' ? 'Final' : tip ? tip[0] : PHASE_NAME[phase], lines: w.zone === 'out' ? [] : tip ? tip[1] : LINES[phase], now: null, nowText: '', hint },   // sin "AHORA": es siempre la misma escala, y deja sitio a los consejos
      notes: NOTES.map(n => ({ string: n.string, fret: n.fret, label: n.label, iv: n.ivLabel, kind: n.kind, state: state(n) })),
      legend,
    };
    return {
      title: `${M.title} · Blues en ${tonic.name}`, subtitle: `${M.sub(tonic.name)} · Forma ${posLabel}${args.closed ? ' cerrada' : ''} (CAGED) · ${tempo} bpm`,
      fretMin, fretMax,
      grid: { cols: 4, cells: cycleCells(lap), cur: w.zone === 'lap' ? w.pos : -1, beat: bt, next: change && sameLap ? nw.pos : -1, nextScale: change },
      lap: { cur: lap, total: laps },
      tip: btipAt(w), phase: { name: w.zone === 'out' ? 'Final' : PHASE_NAME[phase], lines: w.zone === 'out' ? [] : LINES[phase], now: M.one ? (phase === 'blue' && w.pos < 4 ? 'blue' : phase === 'ton' ? 'com' : M.one) : cur, nowText, hint },
      // la 5ª es de las dos escalas: toma el color de la que suena en ese compás y, si valen las dos, va partida
      // Mezcla de blues: la 3m es la blue note de la mayor de blues → violeta mientras suena la mayor, como la b5 en la
      // menor (Alberto, 10-15: le despistaba que la blue note fuese naranja en la mayor y violeta en la menor).
      notes: NOTES.map(n => ({ string: n.string, fret: n.fret, label: n.label, iv: n.ivLabel, kind: n.kind === 'fif' ? (w.zone === 'in' ? plan[0] : cur === 'may' || cur === 'men' ? cur : 'split') : M.blue && !M.one && n.iv === 3 && (w.zone === 'in' ? plan[0] : cur) === 'may' ? 'blue' : n.kind, state: state(n), common: !M.one && (n.iv === 0 || n.iv === 7),
        ...(M.one && w.zone === 'lap' && phase === 'blue' && n.kind === 'blue' && state(n) === 'on' ? { pulse: 1 } : {}) })),
      legend,
    };
  };

  const from = args['from-bar'] ? parseInt(args['from-bar'], 10) - 1 : 0, nBars = args.bars ? parseInt(args.bars, 10) : bars.length - from;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-pmix-'));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto('file://' + path.join(__dirname, 'lib', 'penta-mix-frame.html'));
  const base = `${M.file}_${tonic.name.replace('#', 's')}_Forma${posLabel}${args.closed ? '_Cerrada' : ''}${args.tag ? '_' + args.tag : ''}`;

  // Entrada de la pentatónica sola: un fotograma y, si suena algo, sus notas, cada STEP pulsos.
  const intro = [];                                            // { d: fotograma, play: [midi] }
  if (useIntro && !longIntro) {
    // Corta: la escala de siete en gris y la pentatónica encendiéndose al sonar, de la tónica más grave hacia
    // arriba; si la caja tiene notas por debajo de esa tónica, después bajan y se vuelve a la tónica.
    const midi = n => OPEN_MIDI[n.string] + n.fret, pen = NOTES.filter(n => !n.ghost).sort((a, b) => midi(a) - midi(b)), t0 = pen.findIndex(n => n.iv === 0);
    const seq = [...pen.slice(t0), ...pen.slice(0, t0).reverse(), ...(t0 > 0 ? [pen[t0]] : [])];
    const fr = (k, cur) => { const lit = seq.slice(0, k); intro.push({ play: cur ? [midi(cur)] : [], d: {
      ...titles, fretMin, fretMax, grid: null, metro: { bpm: tempo, beat: -1 },
      formula: formulaOf((j, i) => M.out.includes(i) ? 'out' : !lit.some(n => n.iv === i) ? 'off' : cur && cur.iv === i ? 'ring' : 'on', `${cap(M.penta)}: la ${M.parent} sin la ${M.out.map(i => IV_LABEL[i]).join(' ni la ')}`, -1),
      lap: null, phase: { name: M.title, lines: [`Cinco notas de la ${b2('out', M.parent)}`, 'La misma escala, sin los semitonos'], now: null, nowText: '', hint: '' },
      notes: NOTES.map(n => { const on = lit.includes(n); return { string: n.string, fret: n.fret, label: n.label, iv: n.ivLabel, kind: on ? n.kind : 'out', state: on ? 'on' : 'dim', ring: n === cur }; }),
      legend } }); };
    fr(0); fr(0); seq.forEach((n, k) => fr(k + 1, n)); for (let i = 0; i < 4; i++) fr(seq.length);
  }
  if (longIntro) {
    const midi = n => OPEN_MIDI[n.string] + n.fret, tonics = NOTES.filter(n => n.iv === 0).map(midi).sort((a, b) => a - b);
    const m0 = tonics.find(t => [...M.scale, 12].every(i => NOTES.some(n => midi(n) === t + i)));
    if (m0 === undefined) throw new Error('--intro: la forma no tiene una octava entera de la escala');
    const ivs = [...M.scale, 12], pth = ivs.map(i => NOTES.find(n => midi(n) === m0 + i));
    const ivName = i => i % 12 === 0 ? 'tónica' : IV_LABEL[i], nn = i => noteName(tonic.name, tonic.pc, i % 12);
    const push = (name, lines, st, ring = [], play = [], all = false) => intro.push({ play: play.map(j => m0 + ivs[j]), d: {
      ...titles, fretMin, fretMax, grid: null, metro: { bpm: tempo, beat: -1 },
      formula: formulaOf(j => { const a = [st(j), ...(j === 0 ? [st(7)] : [])]; return a.includes('on') || a.includes('soft') ? (ring.includes(j) || (j === 0 && ring.includes(7)) ? 'ring' : 'on') : a.includes('dim') ? 'out' : 'off'; }, cap(M.parent), -1),
      lap: null, phase: { name, lines, now: null, nowText: '', hint: '' },
      notes: NOTES.map(n => { const j = pth.indexOf(n); return { string: n.string, fret: n.fret, label: n.label, iv: n.ivLabel, kind: n.kind, state: all ? (n.ghost ? 'dim' : 'on') : j < 0 ? 'off' : st(j), ring: !all && ring.includes(j) }; }),
      legend } });
    const rep = (k, f) => { for (let i = 0; i < k; i++) f(i); };
    const q = [`¿De dónde sale la ${M.penta}?`, [`De la ${b2('out', M.parent)}: siete notas`, ivs.slice(0, 7).map(nn).join(' · ')]];
    rep(2, () => push(...q, () => 'off'));
    rep(8, i => push(...q, j => j <= i ? 'on' : 'off', [i], [i]));
    rep(2, () => push(...q, () => 'on'));
    const gone = [];
    for (const [rm, pa] of M.pairs) {
      const r = ivs.indexOf(rm), p = ivs.indexOf(pa), st = j => gone.includes(j) ? 'dim' : j === r || j === p ? 'on' : 'soft';
      const t = ['A un semitono: tensión', [`La ${b2('out', ivName(rm))} (${nn(rm)}) está a un semitono de la ${b2(pa % 12 === 0 ? 'com' : M.one, ivName(pa))} (${nn(pa)})`, 'Es la nota difícil de colocar']];
      [r, p, r, p].forEach(j => push(...t, st, [j], [j]));
      rep(2, i => push(...t, st, [r, p], i ? [] : [r, p]));
      gone.push(r);
      rep(2, i => push('La quitamos', [`Fuera la ${b2('out', ivName(rm))} (${nn(rm)})`, ''], st, i ? [] : [p], i ? [] : [p]));
    }
    const keep = ivs.map((_, j) => j).filter(j => !gone.includes(j)), fin = ['Quedan cinco notas', [`La ${b2(M.one, M.penta)}: ${M.ivs}`, 'La misma escala, sin los semitonos']];
    keep.forEach((j, k) => push(...fin, x => gone.includes(x) ? 'dim' : keep.indexOf(x) <= k ? 'on' : 'soft', [j], [j]));
    rep(3, () => push(...fin, () => 'on', [], [], true));
  }

  if (args.stills) for (const st of String(args.stills).split(',')) {
    const [b, bt] = st.split(':').map(Number), iN = st[0] === 'i' ? parseInt(st.slice(1), 10) : 0;   // iN: pulso N de la presentación
    await page.evaluate(d => render(d), iN ? intro[iN - 1].d : frameAt(b - 1, (bt || 1) - 1));
    const p = path.join(outDir, iN ? `${base}_intro${iN}.png` : `${base}_compas${b}-${bt || 1}.png`); await page.screenshot({ path: p }); console.log('✓ ' + p);
  }
  if (args['stills-only']) { await browser.close(); fs.rmSync(tmp, { recursive: true, force: true }); return; }

  const introDur = intro.length * STEP * beat, introWav = path.join(tmp, 'intro.wav');
  if (useIntro) {
    const events = intro.flatMap((f, i) => f.play.map(m => ({ t: i * STEP * beat, freq: 440 * Math.pow(2, (m - 69) / 12) })));
    fs.writeFileSync(introWav, Buffer.from(await page.evaluate(renderToneTrackInPage, { events, total: introDur }), 'base64'));
  }

  const cache = new Map(), list = [], datas = intro.map(f => f.d), fracs = intro.map(() => STEP);
  // La blue note PALPITA despacio en su vuelta (Alberto, 10-15: "la imagen queda muy estática"; luego: más suave,
  // de lo más claro a lo más oscuro en 2 tiempos): onda coseno de 4 pulsos, 4 fotogramas por pulso. Solo
  // cambia el brillo (ver penta-mix-frame.html). El fundido entre escalas no ve estos fotogramas (nsig).
  const SUB = 4, PERIOD = 4;
  for (let b = from; b < from + nBars; b++) for (let bt = 0; bt < 4; bt++) {
    const d = frameAt(b, bt);
    if (!d.notes.some(n => n.pulse)) { datas.push(d); fracs.push(1); continue; }
    for (let j = 0; j < SUB; j++) {
      const g = Math.round((0.5 + 0.5 * Math.cos(2 * Math.PI * ((b * 4 + bt + j / SUB) % PERIOD) / PERIOD)) * 20) / 20;
      datas.push({ ...d, notes: d.notes.map(n => n.pulse ? { ...n, pulse: g } : n) }); fracs.push(1 / SUB);
    }
  }
  for (const d of datas) {
    const sig = JSON.stringify(d);
    if (!cache.has(sig)) { await page.evaluate(x => render(x), d); const png = path.join(tmp, `f${String(cache.size).padStart(4, '0')}.png`); await page.screenshot({ path: png }); cache.set(sig, png); }
    list.push(cache.get(sig));
  }
  await browser.close();

  const clip = !!args['from-bar'] || !!args.bars, listFile = path.join(tmp, 'list.txt');
  // Vídeo entero: el último fotograma aguanta hasta que se apaga el acorde final de la base.
  const audioDur = await execFileP('ffmpeg', ['-i', audioPath]).catch(e => { const m = (e.stderr || '').match(/Duration:\s*(\d+):(\d+):([\d.]+)/); return m ? m[1] * 3600 + m[2] * 60 + parseFloat(m[3]) : 0; });
  const tail = clip ? 0 : Math.max(0, audioDur - nBars * 4 * beat), total = introDur + nBars * 4 * beat + tail;
  // Cambio de escala suave (Alberto): cuando entre dos pulsos seguidos cambian las notas, fundido de FADE s
  // repartido a los dos lados del pulso (8 fotogramas intermedios con xfade). La entrada tocada va a cortes secos.
  const FADE = args['no-fade'] ? 0 : 0.32, nsig = datas.map(d => JSON.stringify(d.notes.map(n => n.pulse ? { ...n, pulse: 1 } : n)));
  const segs = list.map((p, i) => ({ p, dur: fracs[i] * beat + (i === list.length - 1 ? tail : 0) })), seq = [], xf = new Map();
  for (let i = 0; i < segs.length; i++) {
    seq.push(segs[i]);
    if (!FADE || i + 1 >= segs.length || i < intro.length || nsig[i] === nsig[i + 1]) continue;
    const k = segs[i].p + '>' + segs[i + 1].p;
    if (!xf.has(k)) {
      const pre = path.join(tmp, `x${String(xf.size).padStart(3, '0')}_`);
      await execFileP('ffmpeg', ['-loglevel', 'error', '-y', '-loop', '1', '-t', String(FADE), '-i', segs[i].p, '-loop', '1', '-t', String(FADE), '-i', segs[i + 1].p,
        '-filter_complex', `[0:v]fps=25[a];[1:v]fps=25[b];[a][b]xfade=transition=fade:duration=${FADE}:offset=0`, '-frames:v', String(Math.round(FADE * 25)), pre + '%02d.png']);
      xf.set(k, fs.readdirSync(tmp).filter(f => f.startsWith(path.basename(pre))).sort().map(f => path.join(tmp, f)));
    }
    segs[i].dur -= FADE / 2; segs[i + 1].dur -= FADE / 2;
    xf.get(k).forEach(p => seq.push({ p, dur: 0.04 }));
  }
  fs.writeFileSync(listFile, seq.map(g => `file '${g.p}'\nduration ${g.dur.toFixed(6)}`).join('\n') + `\nfile '${seq[seq.length - 1].p}'\n`);
  const out = path.join(outDir, base + '.mp4');
  const af = clip ? `afade=t=in:d=0.05,afade=t=out:st=${(total - 0.6).toFixed(3)}:d=0.6` : `afade=t=out:st=${(total - 1).toFixed(3)}:d=1`;
  await execFileP('nice', ['-n', '19', 'ffmpeg', '-loglevel', 'error', '-y', '-threads', '2', '-f', 'concat', '-safe', '0', '-i', listFile,
    ...(useIntro
      ? ['-i', introWav, '-t', (total - introDur).toFixed(4), '-i', audioPath, '-filter_complex', `[1:a]volume=0.4,aresample=44100,aformat=channel_layouts=stereo[a0];[2:a]aresample=44100,aformat=channel_layouts=stereo[a1];[a0][a1]concat=n=2:v=0:a=1,${af}[a]`, '-map', '0:v', '-map', '[a]']
      : ['-ss', (from * 4 * beat).toFixed(4), '-t', total.toFixed(4), '-i', audioPath, '-map', '0:v', '-map', '1:a', '-af', af]),
    '-vf', 'fps=25,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-b:a', '192k', '-t', total.toFixed(4), '-movflags', '+faststart', out], { maxBuffer: 1 << 24 });
  fs.rmSync(tmp, { recursive: true, force: true });
  // --with-closed: si la forma cae en cuerdas al aire, genera también la cerrada (Alberto: siempre las dos).
  if (args['with-closed'] && hasOpen) { const r = await execFileP(process.execPath, [...process.argv.slice(1), '--closed'], { maxBuffer: 1 << 24 }); process.stdout.write(r.stdout); }
  console.log(`✓ ${out} (${total.toFixed(1)} s, compases ${from + 1}-${from + nBars}, ${cache.size} fotogramas distintos; tónica ${tonic.name}, ${laps} vueltas de ${cyc}, plan ${plan.join(' ')})`);
})().catch(e => { console.error(e.stderr || e); process.exitCode = 1; });
