#!/usr/bin/env node
/*
 * Textos de catalogación de los "Patrones melódicos de la pentatónica" (vídeos de generate-scale-sequences.js con
 * --scale penta-menor|penta-mayor: Pentatonica<Menor|Mayor>_<GruposDe3|GruposDe4|SaltandoUnaNota>_<K>_Forma<X>[_Cerrada]_40-120bpm.mp4).
 * NO llama a la API: deja un JSON con título, descripción, etiquetas, listas, miniatura, fecha y casilla del feed de cada
 * vídeo, para catalogarlos desde YouTube Studio (Alberto, 2026-10-26: "para catalogar ¿no puedes hacerlo desde Chrome
 * para no necesitar APIs?" — la cuota de la API la consume el catalogador de los patrones de la escala mayor).
 * Mismo formato que catalog-patrones.js (escala mayor), con capítulos por tempo calculados con la vuelta de cada
 * ejercicio sobre la caja de pentatónica (12 notas): 24 pulsos en grupos de 3 y saltando una nota, 20 en grupos de 4
 * (medido con la duración real de los vídeos; es igual en las 5 formas).
 * Calendario aprobado el 10-26: una tonalidad al día con sus 3 ejercicios, a las 20:00 UTC (las 18:00 y 19:00 son de la
 * pentatónica sola), la menor desde el 10-28 y la mayor a continuación; en el feed solo grupos de 3, Forma C abierta.
 *
 * Uso: node scripts/catalog-patrones-penta.js [--out plan.json] [--print <stem>]
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const a = {};
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith('--')) { const n = process.argv[i + 1]; if (n === undefined || n.startsWith('--')) a[k.slice(2)] = true; else { a[k.slice(2)] = n; i++; } } }

const HOME = os.homedir();
const THUMBS = path.join(HOME, 'guitar-visualizer-assets', 'miniaturas-patrones-pentatonica');
const ESCALAS = {
  Menor: { dir: path.join(HOME, 'Downloads', 'PentatonicaMenorPatrones'), nombre: 'menor', tag: 'pentatónica menor',
    orden: ['A', 'E', 'B', 'Fs', 'C', 'G', 'D'], desde: '2026-10-28',
    notas: { A: 'A C D E G', B: 'B D E F# A', C: 'C Eb F G Bb', D: 'D F G A C', E: 'E G A B D', Fs: 'F# A B C# E', G: 'G Bb C D F' },
    listas: { GruposDe3: 'PLKHSEeAetJHs', GruposDe4: 'PLQQvlZpfVRlw', SaltandoUnaNota: 'PLVdmlSTJQZhQ' } },
  Mayor: { dir: path.join(HOME, 'Downloads', 'PentatonicaMayorPatrones'), nombre: 'mayor', tag: 'pentatónica mayor',
    orden: ['C', 'G', 'D', 'A', 'Eb', 'Bb', 'F'], desde: '2026-11-04',
    notas: { C: 'C D E G A', G: 'G A B D E', D: 'D E F# A B', A: 'A B C# E F#', Eb: 'Eb F G Bb C', Bb: 'Bb C D F G', F: 'F G A C D' },
    listas: { GruposDe3: 'PLXuq-uY_6mMk', GruposDe4: 'PLOk7j2Mar2TI', SaltandoUnaNota: 'PLDMVRm-aqoWE' } },
};
const EJ = {
  GruposDe3: { como: 'en grupos de 3 notas', lap: 24,
    que: (n) => `La pentatónica en grupos de tres notas seguidas: ${n[0]}-${n[1]}-${n[2]}, ${n[1]}-${n[2]}-${n[3]}, ${n[2]}-${n[3]}-${n[4]}… Un grupo por pulso, en tresillos. Es la secuencia más usada para ganar soltura y velocidad dentro de la caja.` },
  GruposDe4: { como: 'en grupos de 4 notas', lap: 20,
    que: (n) => `La pentatónica en grupos de cuatro notas seguidas: ${n[0]}-${n[1]}-${n[2]}-${n[3]}, ${n[1]}-${n[2]}-${n[3]}-${n[4]}… Un grupo por pulso, en semicorcheas. La secuencia clásica para trabajar la velocidad y la púa alterna.` },
  SaltandoUnaNota: { como: 'saltando una nota', lap: 24,
    que: (n) => `La pentatónica saltando una nota: cada nota seguida de la que está dos notas por encima (${n[0]}-${n[2]}, ${n[1]}-${n[3]}, ${n[2]}-${n[4]}…). Casi todo son cuartas y alguna tercera: rompe el recorrido lineal y suena mucho más melódico. Dos notas por pulso, en corcheas.` },
};
const ORDEN_EJ = ['GruposDe3', 'GruposDe4', 'SaltandoUnaNota'];
const FORMAS = ['C', 'A', 'G', 'E', 'D'];
const TEMPOS = []; for (let t = 40; t <= 120; t += 5) TEMPOS.push(t);
const T0 = TEMPOS[0], T1 = TEMPOS[TEMPOS.length - 1];
const RE = /^Pentatonica(Menor|Mayor)_(GruposDe3|GruposDe4|SaltandoUnaNota)_([A-G][sb]?)_Forma([CAGED])(_Cerrada)?_40-120bpm\.mp4$/;

const mmss = (t) => { const s = Math.floor(t); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function capitulos(lap) {
  let t = 8 * 60 / T0; // 2 compases de cuenta al primer tempo
  return TEMPOS.map((bpm, i) => { const l = `${i === 0 ? '0:00' : mmss(t)} ${bpm} bpm`; t += lap * 60 / bpm; return l; }).join('\n');
}
const plUrl = (id) => `https://www.youtube.com/playlist?list=${id}`;

function entrada(esc, ej, k, f, c) {
  const E = ESCALAS[esc], J = EJ[ej], K = k.replace(/s$/, '#'), notas = E.notas[k].split(' ');
  const forma = `Forma ${f}${c ? ' cerrada' : ''}`;
  const title = `Pentatónica de ${K} ${E.nombre} ${J.como} | ${forma} (CAGED) | ${T0}–${T1} bpm`;
  const serie = E.listas[ej];
  const description = `La pentatónica de ${K} ${E.nombre} (${notas.join(' ')}) ${J.como} en la ${forma} del sistema CAGED, con una base rítmica que empieza a ${T0} bpm y sube 5 bpm en cada vuelta hasta ${T1}.

${J.que(notas)}

Cada vuelta recorre la caja entera: sale de la tónica más grave, sube hasta arriba, baja hasta la nota más grave y vuelve a la tónica. Arriba tienes las cinco notas con su intervalo, a la derecha el metrónomo y abajo la escalera de tempos, para saber siempre por dónde vas.${c ? `

🔒 Versión cerrada: la misma Forma ${f}, 12 trastes más arriba y sin cuerdas al aire.` : ''}

⏱️ Elige tu tempo
${capitulos(J.lap)}

🎯 Cómo practicarlo
1. Empieza desde el principio y toca encima. Las primeras vueltas son lentas a propósito: úsalas para memorizar el recorrido.
2. Cuando una vuelta se te resista, vuelve a su capítulo y repítela antes de seguir.
3. La próxima vez empieza un par de tempos más arriba.
4. Cuando lo tengas en esta forma, pasa a la siguiente: las 5 formas juntas cubren todo el mástil.${serie ? `

📚 Toda la serie ${J.como}: ${plUrl(serie)}` : ''}

#guitarra #pentatonica #CAGED #técnica #velocidad #ejerciciosdeguitarra`;
  const tags = ['guitarra', E.tag, `pentatónica de ${K} ${E.nombre}`, `${K} ${E.nombre}`, 'patrones melódicos', 'secuencias de pentatónica',
    `pentatónica ${J.como}`, 'CAGED', 'sistema CAGED', `forma ${f}`, 'posiciones de la pentatónica', 'cajas de pentatónica', 'técnica de guitarra',
    'velocidad', 'púa alterna', 'metrónomo', 'ejercicios de guitarra', 'backing track', `${T0}-${T1} bpm`, 'guitar', 'pentatonic scale', 'pentatonic sequences', 'guitar licks'];
  const dia = E.orden.indexOf(k);
  const fecha = new Date(`${E.desde}T20:00:00Z`); fecha.setUTCDate(fecha.getUTCDate() + dia);
  const stem = `Pentatonica${esc}_${ej}_${k}_Forma${f}${c ? '_Cerrada' : ''}_40-120bpm`;
  return { stem, file: path.join(E.dir, ej, stem + '.mp4'), thumb: path.join(THUMBS, stem + '.jpg'), title, description, tags,
    listas: [serie ? `Recorre la pentatónica ${E.nombre} ${J.como}` : null, `Ejercicios en ${K} ${E.nombre}`].filter(Boolean),
    publishAtUTC: fecha.toISOString(), feed: ej === 'GruposDe3' && f === 'C' && !c };
}

const plan = [];
for (const esc of ['Menor', 'Mayor']) for (const ej of ORDEN_EJ) {
  const d = path.join(ESCALAS[esc].dir, ej);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d).sort()) { const m = f.match(RE); if (m) plan.push(entrada(m[1], m[2], m[3], m[4], !!m[5])); }
}
plan.sort((x, y) => x.publishAtUTC.localeCompare(y.publishAtUTC) || ORDEN_EJ.indexOf(x.stem.split('_')[1]) - ORDEN_EJ.indexOf(y.stem.split('_')[1])
  || FORMAS.indexOf(x.stem.match(/Forma(.)/)[1]) - FORMAS.indexOf(y.stem.match(/Forma(.)/)[1]) || x.stem.length - y.stem.length);
for (const p of plan) { if (!fs.existsSync(p.thumb)) console.error('falta miniatura', p.thumb); if (p.title.length > 100) console.error('título largo', p.title); }
if (a.print) { const p = plan.find((x) => x.stem.startsWith(a.print)); console.log(p ? `${p.title} (${p.title.length})\n${p.publishAtUTC} feed:${p.feed} listas:${p.listas.join(' + ')}\n\n${p.description}\n\n${p.tags.join(', ')} (${p.tags.join(',').length})` : 'no está'); process.exit(0); }
fs.writeFileSync(a.out || path.join(__dirname, '.catalog-patrones-penta-plan.json'), JSON.stringify(plan, null, 1));
console.log(`${plan.length} vídeos en el plan`);
