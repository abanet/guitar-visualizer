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
const ida = (pos, d, o) => [...sube.flatMap(s => grupo(s, pos, d, o)), ...baja.flatMap(s => grupo(s, pos, d, o, [...COMBO].reverse()))];
const POS = 5;   // trastes 5 a 8: un dedo por traste sin estirar y con todos los números de una cifra en la tablatura

const base = (nombre, o) => ({ title: 'Spider · reto anual de calentamiento', name: nombre, rootPc: -1, pagina: 16, ...o });

module.exports = {
  // 1. Cuerda a cuerda: sube de la 6ª a la 1ª con 1-2-3-4 y baja con 4-3-2-1.
  cuerda: base('Secuencia 1 · Cuerda a cuerda (1-2-3-4)', { items: ida(POS, 0.5) }),
  // 2. Diagonal: cada cuerda empieza un traste más arriba; se baja deshaciendo la diagonal.
  diagonal: base('Secuencia 2 · Diagonal ascendente (1-2-3-4)', { items: [
    ...sube.flatMap((s, i) => grupo(s, 1 + i, 0.5)),
    ...baja.flatMap((s, i) => grupo(s, 6 - i, 0.5, undefined, [4, 3, 2, 1])) ] }),
  // 3. Salto de una cuerda: 6-4, 5-3, 4-2, 3-1 (subiendo).
  salto1: base('Secuencia 3 · Salto de una cuerda (1-2-3-4)', { items: [6, 4, 5, 3, 4, 2, 3, 1].flatMap(s => grupo(s, POS, 0.5)) }),
  // 4. Araña en dos cuerdas: los dedos alternan entre dos cuerdas vecinas (1 y 3 en una, 2 y 4 en la otra) y luego
  // se cruzan; pares 6-5, 4-3 y 2-1.
  dosCuerdas: base('Secuencia 4 · Araña en dos cuerdas (1-2-3-4)', { items: [[6, 5], [4, 3], [2, 1]].flatMap(([a, b]) =>
    [[a, b, a, b], [b, a, b, a]].flatMap(cs => cs.map((s, k) => n(s, POS + k, 0.5, { fg: k + 1 })))) }),
  // 5. Ligados ascendentes: se pulsa el dedo 1 y 2-3-4 entran de martillo (hammer-on).
  ligAsc: base('Secuencia 5 · Ligados ascendentes (1-2-3-4)', { items: sube.flatMap(s => grupo(s, POS, 0.5, k => (k ? { lig: 'H' } : {}))) }),
  // 6. Ligados descendentes: se pulsa el 4 y 3-2-1 salen tirando (pull-off); de la 1ª a la 6ª.
  ligDesc: base('Secuencia 6 · Ligados descendentes (4-3-2-1)', { items: baja.flatMap(s => grupo(s, POS, 0.5, k => (k ? { lig: 'P' } : {}), [4, 3, 2, 1])) }),
  // 7. Desplazamiento: sube en el traste 1, baja en el 2; la siguiente pasada seguiría en el 3, el 4...
  desplaza: base('Secuencia 7 · Desplazamiento por el mástil (1-2-3-4)', { items: [
    ...sube.flatMap(s => grupo(s, 1, 0.5)), ...baja.flatMap(s => grupo(s, 2, 0.5, undefined, [4, 3, 2, 1])) ] }),
  // 8. Tresillos: tres notas por pulso, así que el acento del pulso cae cada vez en un dedo distinto.
  tresillos: base('Secuencia 8 · Tresillos (1-2-3-4)', { pagina: 8, items: ida(POS, T).map((it, i) => (i % 3 ? it : { ...it, acc: true })) }),
  // 9. Semicorcheas acentuadas: cuatro por pulso, acento en la primera de cada grupo.
  acentos: base('Secuencia 9 · Semicorcheas acentuadas (1-2-3-4)', { pagina: 8, items: ida(POS, 0.25, k => (k ? {} : { acc: true })) }),
  // 10. Salto de dos cuerdas: 6-3, 5-2, 4-1.
  salto2: base('Secuencia 10 · Salto de dos cuerdas (1-2-3-4)', { items: [6, 3, 5, 2, 4, 1].flatMap(s => grupo(s, POS, 0.5)) }),
  // 11. Púa alterna (abajo-arriba) en la subida y, en la bajada, la misma púa con palm mute.
  pua: base('Secuencia 11 · Púa alterna y apagado (1-2-3-4)', { rowLabel: 'púa', items: ida(POS, 0.5).map((it, i) => ({ ...it, strum: i % 2 ? 'u' : 'd', pm: i >= 24 })) }),
  // 12. Repaso combinado: ligado ascendente en la 6ª y 5ª, tresillos en 4ª y 3ª, acentos en semicorcheas en 2ª y 1ª.
  combinado: base('Secuencia 12 · Repaso combinado (1-2-3-4)', { pagina: 12, items: [
    ...[6, 5].flatMap(s => grupo(s, POS, 0.5, k => (k ? { lig: 'H' } : {}))),
    ...[4, 3].flatMap(s => grupo(s, POS, T)), n(3, POS, T, { fg: 1 }),
    ...[2, 1].flatMap(s => grupo(s, POS, 0.25, k => (k ? {} : { acc: true }))), n(1, POS + 3, 1, { fg: 4 }) ] }),
};
