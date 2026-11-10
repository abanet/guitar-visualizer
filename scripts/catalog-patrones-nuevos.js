#!/usr/bin/env node
/*
 * Textos de catalogación de los patrones nuevos del manual (lote de 11-03/05, ~/Downloads/PatronesNuevos-lote):
 *   - pentatónica menor y mayor: grupos de 5 y grupos de 3 en semicorcheas, repetición de nota (40-130) y bordadura (50-160);
 *   - escala de blues menor y mayor: la blue note de paso (60-200).
 * Mismo formato que catalog-patrones-penta.js (capítulos por tempo, cómo practicarlo, enlace a la lista de la serie).
 * Novedades: la escalera de tempos es la del lote (de 5 en 5 hasta 100 y de 10 en 10 después) y la vuelta de cada
 * vídeo (en compases) depende del ejercicio Y de la forma, así que se lee de lote.log en vez de fijarla a mano.
 * Los capítulos se comprueban contra la duración real del vídeo (lo apunta lote.log) con --check.
 * Pendiente: listas nuevas (enlaces), y los otros idiomas (en/pt/fr/it/de).
 *
 * Uso: node scripts/catalog-patrones-nuevos.js [--print <stem>] [--check] [--out plan.json]
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { IDIOMAS, traducir } = require('./lib/textos-patrones-idiomas');

const a = {};
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith('--')) { const n = process.argv[i + 1]; if (n === undefined || n.startsWith('--')) a[k.slice(2)] = true; else { a[k.slice(2)] = n; i++; } } }

const HOME = os.homedir();
const DL = path.join(HOME, 'Downloads');
const ASSETS = path.join(HOME, 'guitar-visualizer-assets');
const ESCALAS = {
  PentatonicaMenor: { dir: 'PentatonicaMenorPatrones', titulo: (K) => `Pentatónica de ${K} menor`, lote: 'penta-menor', thumbs: 'miniaturas-patrones-pentatonica',
    nombre: 'pentatónica menor', tags: ['pentatónica menor', 'cajas de pentatónica', 'pentatonic scale'], hashtag: '#pentatonica',
    notas: { A: 'A C D E G', B: 'B D E F# A', C: 'C Eb F G Bb', D: 'D F G A C', E: 'E G A B D', Fs: 'F# A B C# E', G: 'G Bb C D F' } },
  PentatonicaMayor: { dir: 'PentatonicaMayorPatrones', titulo: (K) => `Pentatónica de ${K} mayor`, lote: 'penta-mayor', thumbs: 'miniaturas-patrones-pentatonica',
    nombre: 'pentatónica mayor', tags: ['pentatónica mayor', 'cajas de pentatónica', 'pentatonic scale'], hashtag: '#pentatonica',
    notas: { C: 'C D E G A', G: 'G A B D E', D: 'D E F# A B', A: 'A B C# E F#', Eb: 'Eb F G Bb C', Bb: 'Bb C D F G', F: 'F G A C D' } },
  EscalaBlues: { dir: 'EscalaBluesPatrones', titulo: (K) => `Escala de blues de ${K} menor`, lote: 'blues', thumbs: 'miniaturas-patrones-blues',
    nombre: 'escala de blues', tags: ['escala de blues', 'blues menor', 'blue note', 'blues scale'], hashtag: '#blues',
    notas: { A: 'A C D Eb E G', B: 'B D E F F# A', C: 'C Eb F Gb G Bb', D: 'D F G Ab A C', E: 'E G A Bb B D', Fs: 'F# A B C C# E', G: 'G Bb C Db D F' } },
  EscalaBluesMayor: { dir: 'EscalaBluesMayorPatrones', titulo: (K) => `Escala de blues mayor de ${K}`, lote: 'blues-mayor', thumbs: 'miniaturas-patrones-blues',
    nombre: 'escala de blues mayor', tags: ['escala de blues mayor', 'blues mayor', 'blue note', 'major blues scale'], hashtag: '#blues',
    notas: { C: 'C D Eb E G A', G: 'G A Bb B D E', D: 'D E F F# A B', A: 'A B C C# E F#', Eb: 'Eb F Gb G Bb C', Bb: 'Bb C Db D F G', F: 'F G Ab A C D' } },
};
const EJ = {
  GruposDe5: { como: 'en grupos de 5 notas', lote: 'grupos5',
    que: (n) => `Grupos de cinco notas seguidas (${n[0]}-${n[1]}-${n[2]}-${n[3]}-${n[4]}, ${n[1]}-${n[2]}-${n[3]}-${n[4]}-${n[0]}…) tocados en semicorcheas, es decir, cuatro notas por pulso. Como el grupo tiene cinco notas, cada uno empieza en un sitio distinto del pulso y el acento va rotando: suena a cascada y rompe la cuadratura de los grupos de 4. Es un recurso muy de rock y fusión para tocar rápido sin sonar a escala.` },
  GruposDe3Semicorcheas: { como: 'en grupos de 3 en semicorcheas', lote: 'grupos3x4',
    que: (n) => `Los grupos de tres notas de siempre (${n[0]}-${n[1]}-${n[2]}, ${n[1]}-${n[2]}-${n[3]}…), pero en semicorcheas en lugar de tresillos: cuatro notas por pulso. El grupo de 3 se va desplazando respecto al pulso (tres contra cuatro) y el acento cae cada vez en una nota distinta. Más difícil de lo que parece: te obliga a contar y no a dejarte llevar por el patrón.` },
  RepeticionDeNota: { como: 'repitiendo nota', lote: 'repeticion',
    que: (n) => `Cada grupo empieza repitiendo su primera nota: ${n[0]}-${n[0]}-${n[1]}-${n[2]}, ${n[1]}-${n[1]}-${n[2]}-${n[3]}… En semicorcheas, cuatro notas por pulso. La nota repetida trabaja la púa sobre la misma cuerda y el control del tiempo, y es un gesto muy típico en solos rápidos.` },
  Bordadura: { como: 'con bordadura', lote: 'bordadura',
    que: (n) => `Bordadura: de cada nota vas a la siguiente y vuelves (${n[0]}-${n[1]}-${n[0]}, ${n[1]}-${n[2]}-${n[1]}…), un grupo por pulso en tresillos. Es el adorno más clásico que hay: rodea la nota principal y le da movimiento sin alejarte de ella. Muy útil para trabajar el ligado y la limpieza entre dos cuerdas.` },
  BlueNoteDePaso: { como: 'con la blue note de paso', lote: 'linea',
    que: (n, esc) => esc === 'EscalaBlues'
      ? `La escala de blues seguida, en corcheas, con la blue note (${n[3]}, la b5) siempre de paso entre la 4ª (${n[2]}) y la 5ª (${n[4]}). Está colocada para caer a contratiempo: así es como suena en el blues, como una nota que pasa y tensa, no como una nota en la que pararse. En pantalla la verás en violeta.`
      : `La escala de blues mayor seguida, en corcheas, con la blue note (${n[2]}, la b3) siempre de paso entre la 2ª (${n[1]}) y la 3ª (${n[3]}). Está colocada para caer a contratiempo, resolviendo en la 3ª mayor: es el sonido del blues mayor, el country y el southern rock. En pantalla la verás en violeta.` },
};
// Alberto 11-05: aquí se aprende el patrón; la velocidad y la precisión, después, con los ritmos progresivos de su otro canal.
const TODORITMOS = 'https://www.youtube.com/@TodoRitmos';
// La lista de rock ("Ritmo Rock Classic 8ths"): Alberto 11-05, "será la más utilizada".
const TODORITMOS_ROCK = 'https://www.youtube.com/playlist?list=PLZGvgaVgkRGA';
// Calendario aprobado por Alberto el 11-05: una tonalidad al día con todos sus ejercicios. Pentatónica a las 17:00 UTC
// (18:00 en España; menor 11-12→18, mayor 11-19→25), blues a las 19:00 UTC (menor 11-14→20, mayor 11-21→27).
// En el feed, un vídeo por bloque y día: la Forma C abierta del primer ejercicio.
const CALENDARIO = {
  PentatonicaMenor: { desde: '2026-11-12', hora: '17:00', orden: ['A', 'E', 'D', 'B', 'Fs', 'G', 'C'] },
  PentatonicaMayor: { desde: '2026-11-19', hora: '17:00', orden: ['C', 'G', 'D', 'A', 'Eb', 'Bb', 'F'] },
  EscalaBlues: { desde: '2026-11-14', hora: '19:00', orden: ['A', 'E', 'D', 'B', 'Fs', 'G', 'C'] },
  EscalaBluesMayor: { desde: '2026-11-21', hora: '19:00', orden: ['C', 'G', 'D', 'A', 'Eb', 'Bb', 'F'] },
};
const ORDEN_EJ = ['GruposDe5', 'GruposDe3Semicorcheas', 'RepeticionDeNota', 'Bordadura', 'BlueNoteDePaso'];
const FORMAS = ['C', 'A', 'G', 'E', 'D'];
const RE = /^(PentatonicaMenor|PentatonicaMayor|EscalaBlues|EscalaBluesMayor)_(GruposDe5|GruposDe3Semicorcheas|RepeticionDeNota|Bordadura|BlueNoteDePaso)_([A-G][sb]?)_Forma([CAGED])(_Cerrada)?_(\d+)-(\d+)bpm\.mp4$/;

// Vuelta en compases por ejercicio y forma, sacada del log del lote ("Vuelta: 21 pulsos de secuencia + 3 de respiro = 6 compases").
const vueltas = {}, duraciones = {};
{ let n = null;
  for (const l of fs.readFileSync(path.join(DL, 'PatronesNuevos-lote', 'lote.log'), 'utf8').split('\n')) {
    const m = l.match(/^=== (\S+)/); if (m) n = m[1];
    const v = l.match(/^Vuelta: .*= (\d+) compases/); if (v && n) vueltas[n] = Number(v[1]);
    const d = l.match(/^✓ (\S+\.mp4) \(([\d.]+) s/); if (d) duraciones[path.basename(d[1])] = Number(d[2]);
  } }
const escalera = (t0, t1) => { const r = []; for (let t = t0; t <= Math.min(100, t1); t += 5) r.push(t); for (let t = 110; t <= t1; t += 10) r.push(t); return r; };
const mmss = (t) => { const s = Math.floor(t); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function capitulos(tempos, compases) {
  let t = 8 * 60 / tempos[0]; // 2 compases de cuenta al primer tempo
  const caps = tempos.map((bpm, i) => { const l = `${i === 0 ? '0:00' : mmss(t)} ${bpm} bpm`; t += compases * 4 * 60 / bpm; return l; });
  return { texto: caps.join('\n'), fin: t };
}

function entrada(esc, ej, k, f, c, t0, t1) {
  const E = ESCALAS[esc], J = EJ[ej], K = k.replace(/s$/, '#'), notas = E.notas[k].split(' ');
  const compases = vueltas[`${E.lote}-${J.lote}-${k}-${f}`];
  const tempos = escalera(t0, t1), caps = capitulos(tempos, compases);
  const forma = `Forma ${f}${c ? ' cerrada' : ''}`;
  const title = `${E.titulo(K)} ${J.como} | ${forma} (CAGED) | ${t0}–${t1} bpm`;
  const description = `${E.titulo(K)} (${notas.join(' ')}) ${J.como} en la ${forma} del sistema CAGED, con una base rítmica que empieza a ${t0} bpm y sube en cada vuelta hasta ${t1}: de 5 en 5 hasta 100 y de 10 en 10 a partir de ahí.

${J.que(notas, esc)}

Cada vuelta recorre la caja entera: sale de la tónica más grave, sube hasta arriba, baja hasta la nota más grave y vuelve a la tónica. Arriba tienes las notas con su intervalo, a la derecha el metrónomo y abajo la escalera de tempos, para saber siempre por dónde vas.${c ? `

🔒 Versión cerrada: la misma Forma ${f}, 12 trastes más arriba y sin cuerdas al aire.` : ''}

⏱️ Elige tu tempo
${caps.texto}

🎯 Cómo practicarlo
1. Empieza desde el principio y toca encima. Las primeras vueltas son lentas a propósito: úsalas para memorizar el recorrido.
2. Cuando una vuelta se te resista, vuelve a su capítulo y repítela antes de seguir.
3. La próxima vez empieza un par de tempos más arriba.
4. Cuando lo tengas en esta forma, pasa a la siguiente: las 5 formas juntas cubren todo el mástil.

💡 Lo importante aquí es aprender el patrón: que te salga solo, sin pensar, en las 5 formas. Cuando llegues a tu velocidad máxima y quieras seguir subiendo poco a poco, pásate a TodoRitmos: sus ritmos progresivos (rock, funk, shuffle, reggae…) van aumentando el tempo poco a poco para que ganes velocidad y precisión con bases de verdad.
🎸 Ritmos de rock (fijos y progresivos): ${TODORITMOS_ROCK}
🥁 Canal TodoRitmos: ${TODORITMOS}

📚 Toda la serie ${J.como}: (enlace de la lista)

#guitarra ${E.hashtag} #CAGED #técnica #velocidad #ejerciciosdeguitarra`;
  const tags = ['guitarra', ...E.tags.slice(0, 2), `${E.titulo(K).toLowerCase()}`, 'patrones melódicos', `${E.nombre} ${J.como}`, 'CAGED', 'sistema CAGED',
    `forma ${f}`, 'técnica de guitarra', 'velocidad', 'púa alterna', 'metrónomo', 'ejercicios de guitarra', 'backing track', `${t0}-${t1} bpm`,
    'guitar', ...E.tags.slice(2), 'guitar exercises'];
  const stem = `${esc}_${ej}_${k}_Forma${f}${c ? '_Cerrada' : ''}_${t0}-${t1}bpm`;
  // Los 5 idiomas (desde el 11-04); el enlace de la lista se rellena igual que en español.
  const localizations = {};
  for (const l of IDIOMAS) localizations[l] = traducir(l, { esc, ej, K, notas, f, c, t0, t1, caps: caps.texto, rock: TODORITMOS_ROCK, canal: TODORITMOS, serieUrl: '(enlace de la lista)' });
  const C = CALENDARIO[esc], fecha = new Date(`${C.desde}T${C.hora}:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + C.orden.indexOf(k));
  const feed = f === 'C' && !c && ej === (esc.startsWith('Pentatonica') ? 'GruposDe5' : 'BlueNoteDePaso');
  return { publishAtUTC: fecha.toISOString(), feed, localizations, stem, file: path.join(DL, E.dir, ej, stem + '.mp4'), thumb: path.join(ASSETS, E.thumbs, stem + '.jpg'), title, description, tags,
    listas: [`Recorre la ${E.nombre} ${J.como}`, `Ejercicios en ${K} ${esc.endsWith('Mayor') ? 'mayor' : 'menor'}`], finCaps: caps.fin, compases };
}

const plan = [];
for (const esc of Object.keys(ESCALAS)) for (const ej of Object.keys(EJ)) {
  const d = path.join(DL, ESCALAS[esc].dir, ej);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d).sort()) { const m = f.match(RE); if (m) plan.push(entrada(m[1], m[2], m[3], m[4], !!m[5], Number(m[6]), Number(m[7]))); }
}
plan.sort((x, y) => x.publishAtUTC.localeCompare(y.publishAtUTC) || ORDEN_EJ.indexOf(x.stem.split('_')[1]) - ORDEN_EJ.indexOf(y.stem.split('_')[1])
  || FORMAS.indexOf(x.stem.match(/Forma(.)/)[1]) - FORMAS.indexOf(y.stem.match(/Forma(.)/)[1]) || x.stem.length - y.stem.length);
for (const p of plan) {
  if (!p.compases) console.error('sin vuelta en el log', p.stem);
  if (!fs.existsSync(p.thumb)) console.error('falta miniatura', p.thumb);
  for (const t of [p.title, ...Object.values(p.localizations).map((x) => x.title)]) if (t.length > 100) console.error('título largo', t.length, t);
  for (const [l, x] of Object.entries(p.localizations)) if (x.description.length > 5000) console.error('descripción larga', l, p.stem);
}
if (a.check) {
  // El último capítulo + su vuelta debe acabar cerca del final del vídeo (queda la coda).
  for (const p of plan.filter((_, i) => i % 9 === 0)) {
    const dur = duraciones[path.basename(p.file)];
    console.log(`${p.stem}: capítulos acaban ${p.finCaps.toFixed(1)} s, vídeo ${dur.toFixed(1)} s`);
  }
}
if (a.print) { const p = plan.find((x) => x.stem.startsWith(a.print)); if (a.lang && p) { const x = p.localizations[a.lang]; console.log(`${x.title} (${x.title.length})\n\n${x.description}`); process.exit(0); }
  console.log(p ? `${p.title} (${p.title.length})\nlistas: ${p.listas.join(' + ')}\n\n${p.description}\n\n${p.tags.join(', ')} (${p.tags.join(',').length})` : 'no está'); process.exit(0); }
if (a.out) fs.writeFileSync(a.out, JSON.stringify(plan, null, 1));
console.log(`${plan.length} vídeos en el plan`);
