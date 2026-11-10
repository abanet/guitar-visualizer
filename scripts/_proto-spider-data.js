// PROTOTIPO: las 12 secuencias del reto anual del Spider (PDF de generate-spider-pdf.py, un mes cada una), escritas
// como "frases" para _proto-frases.js (--datos scripts/_proto-spider-data.js). Idea de Alberto (2026-10-25): un vídeo
// explicativo por secuencia, no por combinación, así que todas usan la combinación 1-2-3-4 de ejemplo; el dedo N
// pisa el traste pos + N - 1 (un dedo por traste). Sin escala de fondo ni tónica (rootPc -1): solo cuentan los dedos.
// Las vueltas que suben y bajan tienen 48 notas y van paginadas (pagina: 16 pulsos = 4 compases por página; 8 en
// tresillos y semicorcheas, que meten el doble de notas por pulso).
const n = (str, f, d, o = {}) => ({ s: 6 - str, f, d, ...o });
const T = 1 / 3;
const COMBO = [1, 2, 3, 4];

// Un grupo de cuatro notas en una cuerda; o(k) da las opciones de la nota k (0-3) del grupo.
const grupo = (str, pos, d, o = () => ({}), dedos = COMBO) => dedos.map((fg, k) => n(str, pos + fg - 1, d, { fg, ...o(k) }));
const sube = [6, 5, 4, 3, 2, 1], baja = [1, 2, 3, 4, 5, 6];
const ida = (pos, d, o, dedos = COMBO) => [...sube.flatMap(s => grupo(s, pos, d, o, dedos)), ...baja.flatMap(s => grupo(s, pos, d, o, [...dedos].reverse()))];
// Orden del calendario del PDF (generate-spider-pdf.py, COMBINACIONES): día N = combinación N.
const DIGITACIONES = ['1234', '4321', '1243', '2134', '3421', '4312', '1342', '1432', '2143', '2341', '2431', '3412', '1324',
  '3124', '3214', '4123', '4213', '4231', '1423', '2314', '3241', '4132', '2413', '3142'].map(x => [...x].map(Number));
const POS = 5;   // trastes 5 a 8: un dedo por traste sin estirar y con todos los números de una cifra en la tablatura

// Semicorcheas (Alberto, 11-09): con SPIDER_SEMI=1 las secuencias en corcheas pasan a semicorcheas (los tresillos se
// quedan en tresillos, que es de lo que va la 8) y se pagina cada 8 pulsos. Para tocarlas de 60 a 130 de 5 en 5: a 60
// son 4 notas/s, nivel bajo; los de nivel alto que suban el tempo con las bases de TodoRitmos. Sin la variable, todo
// queda en corcheas como en el primer lote (60-120).
const SEMI = process.env.SPIDER_SEMI === '1';
const C = SEMI ? 0.25 : 0.5;
// Rótulo durante la cuenta de entrada (11-09, Alberto): lo habitual es subir y bajar en una posición y correr un traste,
// hasta el 12, y volver. Todas menos la 7, que ya va de desplazarse (y el vídeo del recorrido, que lo enseña tocado).
const ROTULO = 'Cuando te salga limpio: corre un traste en cada vuelta, hasta el 12 y vuelta';
const base = (nombre, o) => ({ title: 'Spider · reto anual de calentamiento', name: nombre, rootPc: -1, pagina: SEMI ? 8 : 16, ...(SEMI ? { rotulo: ROTULO } : {}), ...o });

module.exports = {
  // 1. Cuerda a cuerda: sube de la 6ª a la 1ª con 1-2-3-4 y baja con 4-3-2-1.
  cuerda: base('Secuencia 1 · Cuerda a cuerda (1-2-3-4)', { items: ida(POS, C) }),
  // 2. Diagonal: cada cuerda empieza un traste más arriba; se baja deshaciendo la diagonal.
  diagonal: base('Secuencia 2 · Diagonal ascendente (1-2-3-4)', { items: [
    ...sube.flatMap((s, i) => grupo(s, 1 + i, C)),
    ...baja.flatMap((s, i) => grupo(s, 6 - i, C, undefined, [4, 3, 2, 1])) ] }),
  // 3. Salto de una cuerda: 6-4, 5-3, 4-2, 3-1 (subiendo).
  salto1: base('Secuencia 3 · Salto de una cuerda (1-2-3-4)', { items: [6, 4, 5, 3, 4, 2, 3, 1].flatMap(s => grupo(s, POS, C)) }),
  // 4. Araña en dos cuerdas: los dedos alternan entre dos cuerdas vecinas (1 y 3 en una, 2 y 4 en la otra) y luego
  // se cruzan; pares 6-5, 4-3 y 2-1.
  dosCuerdas: base('Secuencia 4 · Araña en dos cuerdas (1-2-3-4)', { items: [[6, 5], [4, 3], [2, 1]].flatMap(([a, b]) =>
    [[a, b, a, b], [b, a, b, a]].flatMap(cs => cs.map((s, k) => n(s, POS + k, C, { fg: k + 1 })))) }),
  // 5. Ligados ascendentes: se pulsa el dedo 1 y 2-3-4 entran de martillo (hammer-on).
  ligAsc: base('Secuencia 5 · Ligados ascendentes (1-2-3-4)', { items: sube.flatMap(s => grupo(s, POS, C, k => (k ? { lig: 'H' } : {}))) }),
  // 6. Ligados descendentes: se pulsa el 4 y 3-2-1 salen tirando (pull-off); de la 1ª a la 6ª.
  ligDesc: base('Secuencia 6 · Ligados descendentes (4-3-2-1)', { items: baja.flatMap(s => grupo(s, POS, C, k => (k ? { lig: 'P' } : {}), [4, 3, 2, 1])) }),
  // 7. Desplazamiento: sube en el traste 1, baja en el 2; la siguiente pasada seguiría en el 3, el 4...
  desplaza: base('Secuencia 7 · Desplazamiento por el mástil (1-2-3-4)', { rotulo: undefined, items: [
    ...sube.flatMap(s => grupo(s, 1, C)), ...baja.flatMap(s => grupo(s, 2, C, undefined, [4, 3, 2, 1])) ] }),
  // 8. Tresillos: tres notas por pulso, así que el acento del pulso cae cada vez en un dedo distinto.
  tresillos: base('Secuencia 8 · Tresillos (1-2-3-4)', { pagina: 8, items: ida(POS, T).map((it, i) => (i % 3 ? it : { ...it, acc: true })) }),
  // 9. Semicorcheas acentuadas: cuatro por pulso, acento en la primera de cada grupo.
  acentos: base('Secuencia 9 · Semicorcheas acentuadas (1-2-3-4)', { pagina: 8, items: ida(POS, 0.25, k => (k ? {} : { acc: true })) }),
  // 10. Salto de dos cuerdas: 6-3, 5-2, 4-1.
  salto2: base('Secuencia 10 · Salto de dos cuerdas (1-2-3-4)', { items: [6, 3, 5, 2, 4, 1].flatMap(s => grupo(s, POS, C)) }),
  // 11. Púa alterna (abajo-arriba) en la subida y, en la bajada, la misma púa con palm mute.
  pua: base('Secuencia 11 · Púa alterna y apagado (1-2-3-4)', { rowLabel: 'púa', items: ida(POS, C).map((it, i) => ({ ...it, strum: i % 2 ? 'u' : 'd', pm: i >= 24 })) }),
  // 12. Repaso combinado: ligado ascendente en la 6ª y 5ª, tresillos en 4ª y 3ª, acentos en semicorcheas en 2ª y 1ª.
  combinado: base('Secuencia 12 · Repaso combinado (1-2-3-4)', { pagina: SEMI ? 8 : 12, items: [
    ...[6, 5].flatMap(s => grupo(s, POS, C, k => (k ? { lig: 'H' } : {}))),
    ...[4, 3].flatMap(s => grupo(s, POS, T)), n(3, POS, T, { fg: 1 }),
    ...[2, 1].flatMap(s => grupo(s, POS, 0.25, k => (k ? {} : { acc: true }))), n(1, POS + 3, 1, { fg: 4 }) ] }),
  // Recorrido del Spider básico (11-09, Alberto): sube y baja en una posición y corre un traste. Se empieza en el 5 (en
  // frío, abajo la mano se abre demasiado), se sube al 12 y se baja hasta el 1. Un solo tempo y sin "escucha / tu
  // turno" (seguido): 19 posiciones.
  recorrido: base('Spider básico · del traste 5 al 12 y bajando hasta el 1 (1-2-3-4)', { seguido: true, porPosicion: true, rotulo: 'Sube y baja, corre un traste: del 5 al 12 y bajando hasta el 1',
    items: [5, 6, 7, 8, 9, 10, 11, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].flatMap(p => ida(p, C).map(it => ({ ...it, pos: p }))) }),
  // Las 24 digitaciones (11-09, Alberto): el básico en una posición, una vuelta (sube con la combinación y baja con
  // ella al revés) por combinación, en el MISMO orden que el calendario del PDF (COMBINACIONES de
  // generate-spider-pdf.py): el día N es la combinación N, y el aviso de arriba dice qué día es.
  digitaciones: base('Spider básico · las 24 digitaciones del reto', { seguido: true, rotulo: 'Una vuelta por digitación, en el orden de los días del reto',
    items: DIGITACIONES.flatMap((d, i) => ida(POS, C, () => ({ cap: `DÍA ${i + 1}` }), d)) }),
};
