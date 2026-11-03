#!/usr/bin/env node
/*
 * Textos de catalogación de un RITMO de TodoRitmos (fijos + progresivos) a partir de las plantillas ya aprobadas
 * (Blues Shuffle 10-05, redacción de los Country 10-2x): título, descripción y etiquetas de cada vídeo, más el plan de
 * publicación. Por qué un script (11-02): Alberto tiene 5 ritmos subidos sin catalogar (172 vídeos) y quiere sacar
 * uno al mes; los textos son los mismos para todos los ritmos salvo el nombre, el párrafo del estilo y los números.
 *
 * Tipos de progresivo (por el nombre del fichero <Base>-<a>-<b>-incr<k>-<tipo>):
 *   incr1-progresivo → ESCALERA FINA · incr2-progresivo → ESCALERA · incr5-progresivo → CALENTAMIENTO
 *   piramide → PIRÁMIDE · zigzag → DOS ADELANTE, UNO ATRÁS · baja → DESCENDENTE
 * Capítulos de los progresivos: scripts/generate-youtube-chapters.js sobre el XML de BiaB de cada uno.
 *
 * Uso: node scripts/catalog-ritmo-textos.js --ritmo RumbaFlamencaPerc [--lista-estilo PLxxxx] --out <dir>
 * Deja <out>/plan.json ([{ stem, title, description, tags, lists: [ids], tipo }]) y TITULOS.txt.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const LISTAS = { velocidad: 'PLbeUrU7mRJ7s', precision: 'PLJR0TNESSEjo', calentar: 'PLGWCIjEG7XC8' };
const URL = id => `https://www.youtube.com/playlist?list=${id}`;
const BASE = path.join(os.homedir(), 'guitar-visualizer-assets', 'fuentes-descargas');

const ESTILOS = {
  RumbaFlamencaPerc: {
    nombre: 'Rumba Flamenca', min: 80, max: 170,
    parrafo: '🥁 Rumba Flamenca es una rumba en semicorcheas rectas con percusión flamenca (cajón y percusión de mano), con ese aire festivo y un pulso que no para nunca. Es ideal para practicar el rasgueo de rumba y el "ventilador", falsetas por arriba, acompañamiento a compás, palmas o líneas de bajo latinas.',
    tags: ['rumba', 'rumba flamenca', 'rumba flamenca {bpm} bpm', 'ritmo de rumba', 'flamenco', 'percusión flamenca', 'cajón flamenco', 'rumba backing track', 'flamenco rhythm'],
    tagsProg: ['rumba', 'rumba flamenca', 'ritmo de rumba', 'flamenco', 'flamenco rhythm'],
  },
  JazzFunkGroovin: {
    nombre: 'Funk Even 16ths', min: 60, max: 160,
    parrafo: '🥁 Funk Even 16ths es un funk en semicorcheas rectas, con el bombo sincopado, la caja firme en los tiempos 2 y 4 y un charles que no para: un groove apretado y muy de bolsillo. Es ideal para practicar rasgueos de funk con notas muertas, riffs de semicorcheas, slap y líneas de bajo funky o comping con acordes de novena.',
    tags: ['funk', 'funk 16ths', 'funk {bpm} bpm', 'ritmo funk', 'funk groove', 'funk drums', 'funk backing track', 'semicorcheas'],
    tagsProg: ['funk', 'ritmo funk', 'funk groove', 'funk drums'],
  },
  FunkyGroovin70s: {
    nombre: 'Funk Swing 16ths', min: 70, max: 150,
    parrafo: '🥁 Funk Swing 16ths es un funk de los 70 con las semicorcheas en swing: ese balanceo que hace que el groove "camine" en lugar de ir cuadrado. Es ideal para practicar rasgueos funky con swing, licks de soul y R&B, notas muertas y líneas de bajo con mucho bolsillo.',
    tags: ['funk', 'funk swing', 'funk {bpm} bpm', 'swing 16ths', 'funk 70s', 'ritmo funk', 'funk groove', 'funk backing track'],
    tagsProg: ['funk', 'funk swing', 'ritmo funk', 'funk groove'],
  },
  CountryEven8: {
    nombre: 'Country Classic 8ths', min: 70, max: 220,
    parrafo: '🥁 Country Classic 8ths es un country en corcheas rectas, con la caja en los tiempos 2 y 4 y un pulso constante que siempre empuja hacia delante, a medio camino entre el country clásico y el country-rock. Es ideal para practicar el bajo alterno (boom-chick), licks de country y chicken picking, rasgueos de acompañamiento o líneas de bajo tónica–quinta.',
    tags: ['country', 'country {bpm} bpm', 'country 8ths', 'classic country', 'country groove', 'country drums', 'country backing track', 'ritmo country'],
    tagsProg: ['country', 'classic country', 'ritmo country', 'country groove'],
  },
  PopWaltz: {
    nombre: 'Pop Waltz', min: 60, max: 180, beats: 3,
    parrafo: '🥁 Pop Waltz es un vals pop en 3/4: tres pulsos por compás con el acento en el primero y un balanceo suave y redondo. Es ideal para practicar acompañamientos en ternario (bajo–acorde–acorde), arpegios, baladas en 3/4 y para acostumbrarte a contar y frasear en compás de tres.',
    tags: ['vals', 'pop waltz', 'vals {bpm} bpm', 'ritmo de vals', '3/4', 'compás de 3/4', 'waltz', 'waltz backing track'],
    tagsProg: ['vals', 'pop waltz', 'ritmo de vals', '3/4', 'waltz'],
  },
};

function args(argv) { const a = {}; for (let i = 2; i < argv.length; i++) if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; return a; }

const tip = bpm => bpm <= 80
  ? `💡 A ${bpm} BPM tienes un tempo especialmente cómodo para concentrarte en la precisión y en la colocación rítmica. No tengas prisa por tocar muchas notas: intenta que cada una encaje perfectamente dentro del groove.\n\nCuando te sientas cómodo, puedes pasar progresivamente a tempos más rápidos y comprobar cómo evoluciona tu sensación de tiempo y tu control del ritmo.`
  : bpm <= 125
    ? `💡 A ${bpm} BPM tienes un tempo intermedio, ideal para trabajar el groove con más fluidez sin perder precisión. Es un buen punto para probar frases más largas y variar tu fraseo sin que el tempo se te escape.\n\nSi quieres más reto, sube a un tempo más rápido; si prefieres afinar la colocación de cada nota, baja a uno más lento.`
    : `💡 A ${bpm} BPM el reto cambia: mantener la precisión y el groove sin tensarte es lo importante, no la cantidad de notas. Si te cuesta, no pasa nada por bajar el tempo un rato y volver a subir cuando lo sientas más cómodo.\n\nTrabajar aquí también te ayuda a que los tempos más lentos te resulten después mucho más relajados.`;

function fijo(S, bpm, listaEstilo) {
  return { title: `${S.nombre} ${bpm}bpm | Practica con Ritmo | Metrónomo`,
    description: `🎵 Practica tu sentido del tiempo, el groove y el feeling con este ritmo ${S.nombre} a ${bpm} BPM.

Este ritmo está pensado como una herramienta de práctica sencilla y flexible para músicos de cualquier instrumento y nivel. Una forma más musical de trabajar el ritmo que utilizando únicamente un metrónomo.

${S.parrafo}

🎯 Úsalo para practicar:

• Pulso y sentido del tiempo
• Ritmo y subdivisión
• Groove y feeling
• Improvisación
• Fraseo
• Mantener un tempo estable
• Musicalidad y expresividad

🎸 🎹 🎷 🥁 🎺 🎻

Toca con tu instrumento, improvisa, practica escalas o arpegios, trabaja tu fraseo o simplemente utiliza el ritmo para mejorar tu sentido del pulso y del tiempo.

${tip(bpm)}

▶️ Todos los tempos de ${S.nombre} (${S.min} a ${S.max} BPM): ${URL(listaEstilo)}
📈 ¿Quieres que el tempo suba solo? Ritmos progresivos para ganar velocidad: ${URL(LISTAS.velocidad)}

🔥 Cualquier instrumento. Cualquier estilo. Cualquier tempo.

Encuentra tu groove. Practica tu sentido del ritmo. Haz música.

💬 ¿Qué tempo utilizas normalmente para practicar este tipo de groove? ¡Cuéntamelo en los comentarios!`,
    tags: ['BPM', ...S.tags.map(t => t.replace('{bpm}', bpm)), 'ejercicios de ritmo', 'groove practice', 'improvisation practice', 'metrónomo', 'music practice', 'phrasing practice', 'práctica de ritmo', 'pulso musical', 'rhythm practice', 'rhythm training', 'ritmo para músicos', 'sentido del ritmo', 'sentido del tiempo', 'tempo practice', 'timing practice'],
    lists: [listaEstilo], tipo: 'fijo' };
}

const TIPOS = {
  fina: { tit: 'Gana velocidad sin notar el salto', nombre: 'ESCALERA FINA', lista: 'velocidad',
    intro: (a, b, k, n) => `Comienza a ${a} BPM y aumenta gradualmente hasta ${b} BPM, subiendo ${k} BPM cada ${n} compases.`,
    texto: (a, b) => `Aquí el tempo sube de 1 en 1 BPM: un cambio tan pequeño que casi no se percibe. Es la forma más suave de empujar tu techo de velocidad: cuando te das cuenta, estás tocando ${b - a} BPM más rápido que al empezar sin haber notado ningún salto.`,
    tempo: (a, b, k, n) => `${a} → ${b} BPM\n+${k} BPM cada ${n} compases`,
    para: ['Empujar tu techo de velocidad', 'Superar un tempo en el que te atascas', 'Mantener la relajación mientras aceleras', 'Mejorar la regularidad', 'Trabajar un pasaje difícil subiéndolo poco a poco'],
    cierre: (a, b) => `🎸 Elige el rango en el que empiezas a tener dificultades y deja que el ritmo te lleve de ${a} a ${b} BPM casi sin darte cuenta.` },
  escalera: { tit: 'Sube el tempo poco a poco', nombre: 'ESCALERA', lista: 'velocidad',
    intro: (a, b, k, n) => `Comienza a ${a} BPM y aumenta gradualmente hasta ${b} BPM, subiendo ${k} BPM cada ${n} compases.`,
    texto: () => 'El objetivo es mantener un pulso sólido y conservar el mismo groove a medida que el tempo aumenta. Cada subida es pequeña, así que intenta que tu forma de tocar no cambie: misma relajación, misma precisión, un poco más rápido cada vez.',
    tempo: (a, b, k, n) => `${a} → ${b} BPM\n+${k} BPM cada ${n} compases`,
    para: ['Ganar velocidad de forma gradual', 'Mejorar la precisión rítmica', 'Desarrollar coordinación y control', 'Mantener el groove a velocidades altas', 'Encontrar tu tempo límite cómodo'],
    cierre: a => `🎸 Empieza a ${a} BPM y comprueba hasta dónde puedes llegar manteniendo el ritmo y la precisión.` },
  calentamiento: { tit: 'Calentamiento: recorre todo el rango', nombre: 'CALENTAMIENTO', lista: 'calentar',
    intro: (a, b, k, n) => `Comienza a ${a} BPM y aumenta gradualmente hasta ${b} BPM, subiendo ${k} BPM cada ${n} compases.`,
    texto: () => 'Un recorrido rápido por todo el rango de tempos, con saltos de 5 BPM, para calentar manos y oído antes de tocar. No busca exigirte al máximo: sirve para pasar por todas las velocidades y llegar a tu sesión de práctica con el pulso ya despierto.',
    tempo: (a, b, k, n) => `${a} → ${b} BPM\n+${k} BPM cada ${n} compases`,
    para: ['Calentar antes de practicar o de tocar', 'Recorrer todos los tempos en pocos minutos', 'Comprobar en qué tempos estás cómodo hoy', 'Despertar el sentido del pulso', 'Empezar la sesión sin tensión'],
    cierre: (a, b) => `🎸 Úsalo al empezar tu sesión: de ${a} a ${b} BPM en pocos minutos y con el pulso ya en su sitio.` },
  piramide: { tit: 'Pirámide: sube y baja con control', nombre: 'PIRÁMIDE', lista: 'precision',
    intro: (a, b, k, n) => `Comienza a ${a} BPM, sube hasta ${b} BPM y vuelve a ${a} BPM, cambiando ${k} BPM cada ${n} compases.`,
    texto: () => 'El tempo sube paso a paso hasta el punto más rápido y después vuelve a bajar hasta el tempo inicial. Subir exige velocidad; bajar exige control. Al volver a los tempos lentos después de haber tocado rápido, notarás que tienes mucho más espacio y precisión que al principio.',
    tempo: (a, b, k, n) => `${a} → ${b} → ${a} BPM\n±${k} BPM cada ${n} compases`,
    para: ['Trabajar la subida y la bajada de tempo', 'Ganar control al frenar', 'Comparar cómo tocas el mismo tempo antes y después', 'Mejorar la regularidad', 'Sesiones completas con calentamiento y vuelta a la calma'],
    cierre: (a, b) => `🎸 Sube hasta ${b} BPM y vuelve a ${a} BPM: fíjate en lo fácil que resulta el tempo inicial cuando regresas a él.` },
  zigzag: { tit: 'Dos pasos adelante, uno atrás', nombre: 'DOS ADELANTE, UNO ATRÁS', lista: 'velocidad',
    intro: (a, b, k, n) => `Comienza a ${a} BPM y llega hasta ${b} BPM subiendo ${2 * k} BPM y retrocediendo ${k}, con un cambio cada ${n} compases.`,
    texto: (a, b, k) => `El tempo sube ${2 * k} BPM y después retrocede ${k}, una y otra vez. Cada vez que avanzas te exiges un poco más, y cada vez que retrocedes consolidas lo que acabas de conseguir en un tempo que ahora te resulta más cómodo. Es una forma muy eficaz de ganar velocidad que se queda.`,
    tempo: (a, b, k, n) => `${a} → ${b} BPM\n+${2 * k} y −${k} BPM, alternando cada ${n} compases`,
    para: ['Consolidar la velocidad ganada', 'Avanzar sin acumular tensión', 'Recuperar el control tras cada subida', 'Mejorar la precisión rítmica', 'Trabajar con cambios de tempo en los dos sentidos'],
    cierre: (a, b) => `🎸 De ${a} a ${b} BPM avanzando dos pasos y retrocediendo uno: llega más lejos sin perder el control.` },
  baja: { tit: 'Mantén el pulso al frenar', nombre: 'DESCENDENTE', lista: 'precision', inverso: true,
    intro: (a, b, k, n) => `Comienza a ${b} BPM y baja gradualmente hasta ${a} BPM, restando ${k} BPM cada ${n} compases.`,
    texto: () => 'Al revés de lo habitual: empieza rápido y va bajando el tempo paso a paso. Frenar sin perder el pulso es más difícil de lo que parece, porque la tendencia natural es correr. Este ejercicio te obliga a llenar el espacio entre notas y a no adelantarte.',
    tempo: (a, b, k, n) => `${b} → ${a} BPM\n−${k} BPM cada ${n} compases`,
    para: ['Aprender a no correr', 'Mantener el pulso cuando el tempo baja', 'Trabajar la colocación de cada nota', 'Controlar el espacio entre notas', 'Ganar solidez en los tempos lentos'],
    cierre: (a, b) => `🎸 Empieza a ${b} BPM y baja hasta ${a} BPM sin adelantarte: cuanto más lento, más cuenta cada nota.` },
};
const LISTA_TXT = { velocidad: 'Más ritmos para ganar velocidad', precision: 'Más ritmos para ganar precisión', calentar: 'Más ritmos para calentar' };

function progresivo(S, stem, xml, listaEstilo) {
  const m = stem.match(/-(\d+)-(\d+)-incr(\d+)-(progresivo|piramide|zigzag|baja)$/);
  if (!m) throw new Error(`nombre de progresivo no reconocido: ${stem}`);
  const a = +m[1], b = +m[2], k = +m[3], tipo = m[4] === 'progresivo' ? (k === 1 ? 'fina' : k === 2 ? 'escalera' : 'calentamiento') : m[4];
  const T = TIPOS[tipo];
  const { parseTempoByMeasure } = require('./lib/tempo-progression');
  const temps = parseTempoByMeasure(fs.readFileSync(xml, 'utf8'));
  let n = 1; while (n < temps.length && temps[n] === temps[0]) n++;   // compases por escalón
  const caps = execFileSync('node', [path.join(__dirname, 'generate-youtube-chapters.js'), '--xml', xml, '--beats', String(S.beats || 4)], { encoding: 'utf8' }).trim();   // vals: 3 pulsos por compás (S.beats)
  const titleRange = T.inverso ? `${b} a ${a}` : `${a} a ${b}`;
  return { title: `${S.nombre} ${titleRange}bpm | ${T.tit} | Metrónomo`,
    description: `${caps}

Ejercicio de ritmo progresivo sobre un ritmo ${S.nombre}. ${T.intro(a, b, k, n)}

${T.texto(a, b, k)}

🥁 TEMPO
${T.tempo(a, b, k, n)}

🎯 TIPO: ${T.nombre}

Ideal para practicar con cualquier instrumento: guitarra, bajo, piano, batería, voz o cualquier otro instrumento.

Perfecto para:
${T.para.map(p => '• ' + p).join('\n')}

${S.parrafo}

${T.cierre(a, b)}

▶️ ${LISTA_TXT[T.lista]}: ${URL(LISTAS[T.lista])}
🎯 ¿Prefieres quedarte en un tempo? ${S.nombre} de ${S.min} a ${S.max} BPM: ${URL(listaEstilo)}`,
    tags: ['ritmo progresivo', 'ejercicios de ritmo', 'practicar ritmo', 'precisión rítmica', 'ejercicios musicales', 'tempo', 'tempos progresivos', 'metrónomo', 'practicar con metrónomo', ...S.tagsProg, 'rhythm practice', 'rhythm exercises', 'progressive rhythm', 'progressive tempo', 'metronome practice', 'timing', 'rhythm accuracy', 'tempo practice', 'groove practice', 'backing track'],
    lists: [listaEstilo, LISTAS[T.lista]], tipo, a, b };
}

const A = args(process.argv), S = ESTILOS[A.ritmo];
if (!S) { console.error(`--ritmo: ${Object.keys(ESTILOS).join(' | ')}`); process.exit(1); }
const lista = A['lista-estilo'] || '{{LISTA_ESTILO}}', dir = path.join(BASE, A.ritmo), out = path.resolve(A.out || path.join(dir, 'catalogo'));
fs.mkdirSync(out, { recursive: true });
const fijos = fs.readdirSync(path.join(dir, `${A.ritmo}_${S.min}_${S.max}_5`)).filter(f => /\.m4a$/.test(f)).map(f => +f.match(/-(\d+)\.m4a$/)[1]).sort((x, y) => x - y);
const progDir = path.join(dir, `${A.ritmo}_progresivo`);
const progs = fs.readdirSync(progDir).filter(f => /\.xml$/i.test(f)).map(f => f.replace(/\.xml$/i, ''));
const plan = [...fijos.map(bpm => ({ stem: `${A.ritmo}-${bpm}`, bpm, ...fijo(S, bpm, lista) })), ...progs.map(stem => ({ stem, ...progresivo(S, stem, path.join(progDir, stem + '.xml'), lista) }))];
fs.writeFileSync(path.join(out, 'plan.json'), JSON.stringify(plan, null, 1));
fs.writeFileSync(path.join(out, 'TITULOS.txt'), plan.map(p => `${p.stem}\n   ${p.title}`).join('\n'));
console.log(`${plan.length} vídeos (${fijos.length} fijos + ${progs.length} progresivos) → ${out}`);
