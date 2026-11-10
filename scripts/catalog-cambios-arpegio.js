#!/usr/bin/env node
/*
 * Textos de catalogación de "Cambios entre arpegios de 7ª: I7 → IV7" (vídeos de make-arpeggio-change-sessions.js +
 * generate-videos-from-sessions.js: Cambio_I7-IV7-<K>_Forma<X>.mp4 en tres series — tempo fijo 80 bpm, progresivo
 * 65→100 y progresivo avanzado 100→140, de 5 en 5 cada 12 compases).
 * NO llama a la API: deja un JSON con título, descripción, etiquetas, listas, fecha y casilla del feed de cada vídeo,
 * para catalogarlos desde YouTube Studio (Chrome) como los patrones de pentatónica (ver catalog-patrones-penta.js).
 * Textos y listas aprobados por Alberto el 2026-10-28.
 *
 * Uso: node scripts/catalog-cambios-arpegio.js [--out plan.json] [--print <stem>]
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const a = {};
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith('--')) { const n = process.argv[i + 1]; if (n === undefined || n.startsWith('--')) a[k.slice(2)] = true; else { a[k.slice(2)] = n; i++; } } }

const HOME = os.homedir();
// Notas de cada dominante (deletreo de la base de BiaB: Db7-Gb7, F#7 con B7…).
const DOM = {
  C: 'C E G Bb', F: 'F A C Eb', G: 'G B D F', D: 'D F# A C', A: 'A C# E G', E: 'E G# B D', B: 'B D# F# A',
  'F#': 'F# A# C# E', Db: 'Db F Ab Cb', Gb: 'Gb Bb Db Fb', Ab: 'Ab C Eb Gb', Eb: 'Eb G Bb Db', Bb: 'Bb D F Ab',
};
const IV = { C: 'F', G: 'C', D: 'G', A: 'D', E: 'A', B: 'E', 'F#': 'B', Db: 'Gb', Ab: 'Db', Eb: 'Ab', Bb: 'Eb', F: 'Bb' };
const ORDEN = ['C', 'G', 'D', 'A', 'E', 'B', 'Fs', 'Db', 'Ab', 'Eb', 'Bb', 'F'];   // círculo de quintas, como las otras series
const FORMAS = ['C', 'A', 'G', 'E', 'D'];
const SERIES = {
  fijo: { dir: 'Cambio_I7-IV7_C', tempo: '80 bpm', nombre: 'a tempo fijo',
    introEn: 'An 80 bpm backing track from start to finish, to settle the change without rushing.',
    intro: 'Una base de 80 bpm de principio a fin, para asentar el cambio sin prisa.',
    caps: null },
  progresivo: { dir: 'Cambio_I7-IV7_C_progresivo', tempo: '65–100 bpm', nombre: 'progresivo',
    introEn: 'The backing track starts at 65 bpm and goes up 5 bpm every 12 bars until 100. On the right you have the tempo ladder and a countdown of the bars left before the next jump.',
    intro: 'La base empieza a 65 bpm y sube 5 bpm cada 12 compases hasta 100. A la derecha tienes la escalera de tempo y el aviso de cuántos compases faltan para el siguiente salto.',
    caps: ['0:00 65 bpm', '0:52 70 bpm', '1:33 75 bpm', '2:11 80 bpm', '2:47 85 bpm', '3:21 90 bpm', '3:53 95 bpm', '4:23 100 bpm'] },
  avanzado: { dir: 'Cambio_I7-IV7_C_progresivo_avanzado', tempo: '100–140 bpm', nombre: 'progresivo avanzado',
    introEn: 'The backing track starts at 100 bpm and goes up 5 bpm every 12 bars until 140: for when the change already comes naturally. On the right you have the tempo ladder and a countdown of the bars left before the next jump.',
    intro: 'La base empieza a 100 bpm y sube 5 bpm cada 12 compases hasta 140: para cuando el cambio ya sale solo. A la derecha tienes la escalera de tempo y el aviso de cuántos compases faltan para el siguiente salto.',
    caps: ['0:00 100 bpm', '0:34 105 bpm', '1:01 110 bpm', '1:27 115 bpm', '1:52 120 bpm', '2:16 125 bpm', '2:39 130 bpm', '3:01 135 bpm', '3:23 140 bpm'] },
};
// Listas (decisión de Alberto 10-28): una por combinación con TODOS los vídeos ("Conectando arpegios: I7 → IV7",
// luego ": I7 → V7", ": ii7 → V7 → I7"…), y "Conectando arpegios" como escaparate con solo el de tempo fijo Forma C de
// cada tonalidad (el mismo que va al feed), añadido ARRIBA: los antiguos (A7-E7, Dm7-A7…) se quedan al final para no
// perder sus visitas. La de tonalidad es la ya existente "Ejercicios en <K> mayor" (oculta).
const LISTA = 'Conectando arpegios: I7 → IV7';
const LISTA_URL = 'https://www.youtube.com/playlist?list=PLDkL0vUfWkRI';   // creada 10-28, privada hasta el 11-11
const ESCAPARATE = 'Conectando arpegios';
const DESDE = '2026-11-11';   // propuesta: después del último bloque de patrones de pentatónica (11-10)

function entrada(serie, k, f) {
  const S = SERIES[serie], K = k.replace(/s$/, '#'), IVk = IV[K];
  const i7 = DOM[K].split(' '), iv7 = DOM[IVk].split(' ');
  const title = `Cambio de arpegios ${K}7 → ${IVk}7 (I7–IV7) | Forma ${f} (CAGED) | ${S.tempo}`;
  const description = `Arpegios de ${K}7 y ${IVk}7 encadenados en la misma zona del mástil, con el ${K}7 en la Forma ${f} del sistema CAGED: dos compases de cada uno, sobre una base de ${S.tempo}. ${S.intro}

El cambio I7 → IV7 es el corazón del blues y de muchísimo funk y soul. Aquí lo practicas sin saltar de posición: el ${IVk}7 se toca en la forma más cercana a la del ${K}7.

👀 Qué ves en pantalla
• Las notas del arpegio que suena, con su intervalo en pequeño (3, 5, b7) y la tónica en rojo.
• En gris, las notas del arpegio que viene, para que veas el cambio antes de que llegue.
• Anillo blanco: la nota que no cambia entre los dos acordes.
• Arriba a la derecha, la forma completa del siguiente arpegio.

🎸 La clave del cambio
${K}7 = ${i7.join(' ')} · ${IVk}7 = ${iv7.join(' ')}
La 3ª del ${K}7 (${i7[1]}) baja medio tono a la b7 del ${IVk}7 (${iv7[3]}), y la b7 del ${K}7 (${i7[3]}) baja medio tono a la 3ª del ${IVk}7 (${iv7[1]}). Si llegas al cambio por esas notas, suena a blues de verdad.${S.caps ? `

⏱️ Tempos
${S.caps.join('\n')}` : ''}

🎯 Cómo practicarlo
1. Primero toca solo las tónicas de cada acorde; luego el arpegio entero.
2. Busca el cambio por la nota más cercana: la 3ª y la b7 te lo ponen fácil.
3. Cuando lo tengas en esta forma, pasa a la siguiente: las 5 formas juntas cubren todo el mástil.

📋 Todas las tonalidades y formas del cambio I7 → IV7: ${LISTA_URL}

#guitarra #arpegios #blues #CAGED #ejerciciosdeguitarra`;

  // Inglés (regla de Alberto 11-03: todo vídeo nuevo lleva título y descripción en inglés, Studio → Idiomas).
  const titleEn = `${K}7 → ${IVk}7 Arpeggio Change (I7–IV7) | ${f} Shape (CAGED) | ${S.tempo}`;
  const descriptionEn = `${K}7 and ${IVk}7 arpeggios linked in the same area of the neck, with ${K}7 in the ${f} Shape of the CAGED system: two bars of each, over a ${S.tempo} backing track. ${S.introEn}

The I7 → IV7 change is the heart of the blues and of lots of funk and soul. Here you practise it without jumping positions: ${IVk}7 is played in the shape closest to ${K}7.

👀 What you see on screen
• The notes of the arpeggio being played, with their interval in small print (3, 5, b7) and the root in red.
• In grey, the notes of the next arpeggio, so you see the change before it arrives.
• White ring: the note shared by both chords.
• Top right, the full shape of the next arpeggio.

🎸 The key to the change
${K}7 = ${i7.join(' ')} · ${IVk}7 = ${iv7.join(' ')}
The 3rd of ${K}7 (${i7[1]}) goes down a half step to the b7 of ${IVk}7 (${iv7[3]}), and the b7 of ${K}7 (${i7[3]}) goes down a half step to the 3rd of ${IVk}7 (${iv7[1]}). Land on the change through those notes and it sounds like real blues.${S.caps ? `

⏱️ Tempos
${S.caps.join('\n')}` : ''}

🎯 How to practise it
1. First play only the root of each chord; then the whole arpeggio.
2. Look for the change through the nearest note: the 3rd and the b7 make it easy.
3. Once you have it in this shape, move on to the next: the 5 shapes together cover the whole neck.

📋 Every key and shape of the I7 → IV7 change: ${LISTA_URL}

#guitar #arpeggios #blues #CAGED #guitarexercises`;
  const tags = ['guitarra', 'arpegios', 'arpegios de 7ª', 'arpegios dominantes', `arpegio de ${K}7`, `arpegio de ${IVk}7`, `${K}7 ${IVk}7`, 'I7 IV7',
    'cambio de acordes', 'blues', 'CAGED', 'sistema CAGED', `forma ${f}`, 'notas guía', 'improvisación', 'ejercicios de guitarra', 'backing track',
    S.tempo.replace('–', '-'), 'guitar arpeggios', 'dominant 7 arpeggios', 'blues guitar'];
  const dia = ORDEN.indexOf(k);
  const fecha = new Date(`${DESDE}T20:00:00Z`); fecha.setUTCDate(fecha.getUTCDate() + dia);
  const stem = `Cambio_I7-IV7-${k}_Forma${f}`;
  return { serie, stem, file: path.join(HOME, 'Downloads', S.dir, 'videos', stem + '.mp4'), title, description, titleEn, descriptionEn, tags,
    listas: [LISTA, `Ejercicios en ${K} mayor`, ...(serie === 'fijo' && f === 'C' ? [ESCAPARATE + ' (arriba)'] : [])],
    publishAtUTC: fecha.toISOString(), feed: serie === 'fijo' && f === 'C' };
}

const plan = [];
for (const k of ORDEN) for (const serie of Object.keys(SERIES)) for (const f of FORMAS) plan.push(entrada(serie, k, f));
for (const p of plan) { if (p.title.length > 100 || p.titleEn.length > 100) console.error('título largo', p.title, p.titleEn); if (p.descriptionEn.length > 5000) console.error('descripción inglesa larga', p.stem); if (p.description.length > 5000) console.error('descripción larga', p.stem); }
if (a.print) { const p = plan.find((x) => (x.serie + ':' + x.stem).includes(a.print)); console.log(p ? `${p.title} (${p.title.length})\n${p.publishAtUTC} feed:${p.feed} listas:${p.listas.join(' + ')}\n\n${p.description}\n\n${p.tags.join(', ')} (${p.tags.join(',').length})\n\n--- EN ---\n${p.titleEn} (${p.titleEn.length})\n\n${p.descriptionEn}` : 'no está'); process.exit(0); }
fs.writeFileSync(a.out || path.join(__dirname, '.catalog-cambios-arpegio-plan.json'), JSON.stringify(plan, null, 1));
console.log(`${plan.length} vídeos en el plan`);
