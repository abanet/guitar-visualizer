// PROTOTIPO "vocabulario": frases de ejemplo en La menor, escritas a partir de clichés de dominio común
// (no transcritas de ningún método). Cada nota: n(cuerda 6..1, traste, pulsos, opciones).
//   bend: semitonos (2 = un tono, 1 = medio, 0.5 = cuarto) · rel: el bending vuelve a bajar
//   lig: 'P' pull-off / 'H' hammer-on desde la nota anterior (misma cuerda) · slide: se llega deslizando
//   vib: vibrato · also: notas que suenan a la vez · fg: dedo · r(pulsos) = silencio
const n = (str, f, d, o = {}) => ({ s: 6 - str, f, d, ...o });
const r = d => ({ r: true, d });
const T = 1 / 3, X = 1 / 6;

// Riff de "Sex Machine" (James Brown, guitarra de Catfish Collins), según la transcripción colaborativa de Songsterr:
// Mib9 en las tres cuerdas agudas (cejilla en el traste 6) en los tiempos 1 y 2, con la tónica apagada con la palma
// (5ª cuerda, traste 6) en los contratiempos; en el 3, Mib13 (meñique en el traste 8 de la 1ª) y vuelta a Mib9 en
// la última semicorchea; el 4 es silencio.
const TOP9 = [[3, 6, 3], [2, 6, 3], [1, 6, 3]], TOP13 = [[3, 6, 3], [2, 6, 3], [1, 8, 4]];
const ch = (shape, d, strum, o = {}) => { const sh = shape.map(([str, f, fg]) => ({ s: 6 - str, f, fg })); return { ...sh[0], also: sh.slice(1), d, strum, ...o }; };
const SEX_BAR = () => [ch(TOP9, 0.5, 'd'), n(5, 6, 0.5, { strum: 'd', pm: true, fg: 2 }), ch(TOP9, 0.5, 'd'), n(5, 6, 0.5, { strum: 'd', pm: true, fg: 2 }),
  ch(TOP13, 0.75, 'd'), ch(TOP9, 0.25, 'u'), r(1)];
// Puente (Lab): Lab13 y Lab9 en las tres primeras cuerdas, subida cromática 9-10-11 y Lab7 en las cuerdas 5ª a 3ª.
const BAR3 = (f) => [[3, f, 1], [2, f, 1], [1, f, 1]], AB13 = [[3, 11, 1], [2, 11, 1], [1, 13, 3]], AB7 = [[5, 11, 1], [4, 13, 3], [3, 11, 1]];
const SEX_PUENTE = () => [ch(AB13, 0.25, 'd'), ch(AB13, 0.25, 'u'), r(0.5),
  ch(BAR3(11), 0.25, 'd'), ch(BAR3(11), 0.25, 'u'), r(0.25), ch(BAR3(9), 0.25, 'u'),
  r(0.25), ch(BAR3(10), 0.25, 'u'), r(0.25), ch(BAR3(11), 0.25, 'u'),
  r(0.25), ch(AB7, 0.25, 'u'), ch(AB7, 0.5, 'd')];

module.exports = {
  funk: { title: 'Guitarra rítmica funk · Mib9', name: 'El riff de "Sex Machine" (James Brown): Mib9 y Mib13', rootPc: 3, flats: true, noRest: true, rowLabel: 'púa',
    items: [...SEX_BAR(), ...SEX_BAR()] },
  funkPuente: { title: 'Guitarra rítmica funk · Lab9', name: 'El puente de "Sex Machine" (James Brown): Lab13, Lab9 y Lab7', rootPc: 8, flats: true, noRest: true, rowLabel: 'púa',
    items: [...SEX_PUENTE(), ...SEX_PUENTE()] },
  // Un lick por cada una de las cinco formas CAGED de la pentatónica menor de La (E = tónica en 6ª cuerda).
  formaE: { name: 'Forma E (CAGED) · trastes 5 a 8', win: [5, 8], items: [
    n(3, 7, 1, { bend: 2, fg: 3 }), n(2, 5, 0.5, { fg: 1 }), n(1, 5, 0.5, { fg: 1 }), n(2, 8, 0.5, { fg: 4 }), n(2, 5, 0.5, { lig: 'P', fg: 1 }),
    n(3, 7, 1, { bend: 2, rel: true, fg: 3 }), n(3, 5, 0.5, { lig: 'P', fg: 1 }), n(4, 7, 1.5, { vib: true, fg: 3 })] },
  formaD: { name: 'Forma D (CAGED) · trastes 7 a 10', win: [7, 10], items: [
    n(1, 10, 1, { bend: 2, fg: 3 }), n(1, 8, 0.5, { fg: 1 }), n(2, 10, 0.5, { fg: 3 }), n(2, 8, 0.5, { fg: 1 }), n(3, 9, 0.5, { fg: 2 }), n(3, 7, 0.5, { lig: 'P', fg: 1 }),
    n(4, 7, 0.5, { fg: 1 }), n(2, 8, 0.5, { fg: 1 }), n(2, 10, 1.5, { lig: 'H', vib: true, fg: 3 })] },
  formaC: { name: 'Forma C (CAGED) · trastes 9 a 13', win: [9, 13], items: [
    n(2, 13, 1, { bend: 2, fg: 3 }), n(2, 10, 0.5, { fg: 1 }), n(1, 10, 0.5, { fg: 1 }), n(1, 12, 0.5, { fg: 3 }), n(1, 10, 0.5, { lig: 'P', fg: 1 }),
    n(2, 13, 0.5, { fg: 4 }), n(2, 10, 0.5, { lig: 'P', fg: 1 }), n(3, 12, 0.5, { fg: 3 }), n(2, 10, 1.5, { vib: true, fg: 1 })] },
  formaA: { name: 'Forma A (CAGED) · trastes 12 a 15', win: [12, 15], items: [
    n(1, 15, 1, { bend: 2, fg: 3 }), n(1, 12, 0.5, { fg: 1 }), n(2, 15, 0.5, { fg: 4 }), n(2, 13, 0.5, { lig: 'P', fg: 2 }), n(3, 14, 0.5, { fg: 3 }), n(3, 12, 0.5, { lig: 'P', fg: 1 }),
    n(4, 14, 0.5, { fg: 3 }), n(3, 12, 0.5, { fg: 1 }), n(3, 14, 1.5, { lig: 'H', vib: true, fg: 3 })] },
  formaG: { name: 'Forma G (CAGED) · trastes 14 a 17', win: [14, 17], items: [
    n(3, 17, 1, { bend: 2, fg: 4 }), n(3, 14, 0.5, { fg: 1 }), n(2, 15, 0.5, { fg: 2 }), n(2, 17, 0.5, { fg: 4 }), n(1, 15, 0.5, { fg: 2 }), n(1, 17, 1, { vib: true, fg: 4 }),
    n(1, 15, 0.5, { fg: 2 }), n(2, 17, 0.5, { fg: 4 }), n(3, 14, 1, { vib: true, fg: 1 })] },
  clasico: { name: 'El bending clásico', win: [5, 8], items: [
    n(3, 7, 1, { bend: 2, fg: 3 }), n(2, 5, 0.5, { fg: 1 }), n(1, 5, 0.5, { fg: 1 }), n(2, 8, 0.5, { fg: 4 }), n(2, 5, 0.5, { lig: 'P', fg: 1 }),
    n(3, 7, 1, { bend: 2, rel: true, fg: 3 }), n(3, 5, 0.5, { lig: 'P', fg: 1 }), n(4, 7, 1.5, { vib: true, fg: 3 })] },
  ligados: { name: 'Ligados en cascada', win: [5, 8], items: [
    n(1, 8, 0.5, { fg: 4 }), n(1, 5, 0.5, { lig: 'P', fg: 1 }), n(2, 8, 0.5, { fg: 4 }), n(2, 5, 0.5, { lig: 'P', fg: 1 }), n(3, 7, 0.5, { fg: 3 }), n(3, 5, 0.5, { lig: 'P', fg: 1 }),
    n(4, 7, 1, { fg: 3 }), n(4, 5, 0.5, { fg: 1 }), n(4, 7, 1.5, { lig: 'H', vib: true, fg: 3 })] },
  slide: { name: 'Deslizamiento a la Forma D', win: [5, 10], items: [
    n(3, 5, 0.5, { fg: 1 }), n(3, 7, 0.5, { fg: 3 }), n(3, 9, 1, { slide: true, fg: 3 }), n(2, 8, 0.5, { fg: 1 }), n(2, 10, 0.5, { fg: 3 }), n(1, 8, 1, { fg: 1 }),
    n(2, 10, 2, { vib: true, fg: 3 })] },
  unisono: { name: 'Bending al unísono', win: [5, 8], items: [
    n(3, 7, 1, { bend: 2, fg: 3, also: [{ s: 4, f: 5, fg: 1 }] }), n(3, 7, 1, { bend: 2, fg: 3, also: [{ s: 4, f: 5, fg: 1 }] }),
    n(2, 8, 0.5, { fg: 4 }), n(2, 5, 0.5, { lig: 'P', fg: 1 }), n(3, 7, 0.5, { fg: 3 }), n(3, 5, 0.5, { lig: 'P', fg: 1 }), n(4, 7, 2, { vib: true, fg: 3 })] },
  blue: { name: 'La blue note y el cuarto de tono', win: [5, 8], items: [
    n(3, 5, 0.5, { fg: 1 }), n(3, 7, 0.5, { lig: 'H', fg: 3 }), n(3, 8, 0.5, { lig: 'H', fg: 4 }), n(3, 7, 0.5, { lig: 'P', fg: 3 }), n(3, 5, 0.5, { lig: 'P', fg: 1 }), n(4, 7, 0.5, { fg: 3 }),
    n(3, 5, 1, { bend: 0.5, fg: 1 }), n(4, 7, 2, { vib: true, fg: 3 })] },
  bbking: { name: 'La caja de B.B. King', win: [9, 13], items: [
    r(0.5), n(2, 10, 0.5, { fg: 1 }), n(2, 12, 1, { bend: 1, fg: 3 }), n(2, 10, 0.5, { fg: 1 }), n(1, 10, 0.5, { fg: 1 }), n(2, 10, 1, { vib: true, fg: 1 }),
    n(1, 12, 0.5, { fg: 3 }), n(1, 10, 0.5, { lig: 'P', fg: 1 }), n(2, 10, 1, { vib: true, fg: 1 })] },
  tresillos: { name: 'Tresillos descendentes', win: [5, 8], items: [
    n(1, 8, T, { fg: 4 }), n(1, 5, T, { fg: 1 }), n(2, 8, T, { fg: 4 }), n(1, 5, T, { fg: 1 }), n(2, 8, T, { fg: 4 }), n(2, 5, T, { fg: 1 }),
    n(2, 8, T, { fg: 4 }), n(2, 5, T, { fg: 1 }), n(3, 7, T, { fg: 3 }), n(2, 5, T, { fg: 1 }), n(3, 7, T, { fg: 3 }), n(3, 5, T, { fg: 1 }),
    n(4, 7, 2, { vib: true, fg: 3 })] },
  pregunta: { name: 'Pregunta y respuesta (4 compases)', win: [5, 8], items: [
    n(3, 7, 1, { bend: 2, fg: 3 }), n(2, 5, 0.5, { fg: 1 }), n(2, 8, 0.5, { fg: 4 }), n(1, 5, 1, { fg: 1 }), r(1),
    n(2, 8, 0.5, { fg: 4 }), n(2, 5, 0.5, { lig: 'P', fg: 1 }), n(3, 7, 1, { bend: 2, rel: true, fg: 3 }), n(3, 5, 1, { bend: 0.5, fg: 1 }), r(1),
    n(3, 5, 0.5, { fg: 1 }), n(3, 7, 0.5, { lig: 'H', fg: 3 }), n(2, 5, 0.5, { fg: 1 }), n(2, 8, 0.5, { fg: 4 }), n(1, 5, 1, { fg: 1 }), n(2, 8, 0.5, { fg: 4 }), n(2, 5, 0.5, { lig: 'P', fg: 1 }),
    n(3, 7, 0.5, { fg: 3 }), n(3, 5, 0.5, { lig: 'P', fg: 1 }), n(4, 7, 1, { vib: true, fg: 3 })] },
  semicorcheas: { name: 'Cascada en semicorcheas', win: [5, 8], items: [
    n(1, 8, 0.25, { fg: 4 }), n(1, 5, 0.25, { lig: 'P', fg: 1 }), n(2, 8, 0.25, { fg: 4 }), n(2, 5, 0.25, { lig: 'P', fg: 1 }),
    n(2, 8, 0.25, { fg: 4 }), n(2, 5, 0.25, { lig: 'P', fg: 1 }), n(3, 7, 0.25, { fg: 3 }), n(3, 5, 0.25, { lig: 'P', fg: 1 }),
    n(3, 7, 0.25, { fg: 3 }), n(3, 5, 0.25, { lig: 'P', fg: 1 }), n(4, 7, 0.25, { fg: 3 }), n(4, 5, 0.25, { lig: 'P', fg: 1 }),
    n(4, 7, 0.25, { fg: 3 }), n(4, 5, 0.25, { lig: 'P', fg: 1 }), n(5, 7, 0.25, { fg: 3 }), n(5, 5, 0.25, { lig: 'P', fg: 1 }),
    n(6, 5, 2, { vib: true, fg: 1 })] },
  repetitiva: { name: 'Frase repetitiva en seisillos', win: [5, 8], items: [
    n(2, 8, X, { fg: 4 }), n(2, 5, X, { lig: 'P', fg: 1 }), n(3, 7, X, { fg: 3 }), n(2, 8, X, { fg: 4 }), n(2, 5, X, { lig: 'P', fg: 1 }), n(3, 7, X, { fg: 3 }),
    n(2, 8, X, { fg: 4 }), n(2, 5, X, { lig: 'P', fg: 1 }), n(3, 7, X, { fg: 3 }), n(2, 8, X, { fg: 4 }), n(2, 5, X, { lig: 'P', fg: 1 }), n(3, 7, X, { fg: 3 }),
    n(3, 7, 1, { bend: 2, fg: 3 }), n(2, 5, 0.5, { fg: 1 }), n(1, 5, 0.5, { fg: 1 }), n(1, 8, 2, { bend: 2, vib: true, fg: 4 })] },
  diagonal: { name: 'Por todo el mástil: la diagonal', win: [5, 17], items: [
    n(6, 5, 0.5, { fg: 1 }), n(6, 8, 0.5, { fg: 3 }), n(6, 10, 0.5, { slide: true, fg: 3 }), n(5, 7, 0.5, { fg: 1 }), n(5, 10, 0.5, { fg: 3 }),
    n(4, 7, 0.5, { fg: 1 }), n(4, 10, 0.5, { fg: 3 }), n(4, 12, 0.5, { slide: true, fg: 3 }), n(3, 9, 0.5, { fg: 1 }), n(3, 12, 0.5, { fg: 3 }),
    n(2, 10, 0.5, { fg: 1 }), n(2, 13, 0.5, { fg: 3 }), n(2, 15, 0.5, { slide: true, fg: 3 }), n(1, 12, 0.5, { fg: 1 }), n(1, 15, 1, { bend: 2, fg: 3 }),
    n(1, 15, 1, { bend: 2, rel: true, fg: 3 }), n(1, 12, 0.5, { fg: 1 }), n(2, 15, 0.5, { fg: 4 }), n(2, 13, 0.5, { lig: 'P', fg: 2 }), n(3, 12, 0.5, { fg: 1 }),
    n(3, 14, 3, { lig: 'H', vib: true, fg: 3 })] },
  // ── FRASES COMPLEJAS (11-01, Alberto: "buscar los límites del formato"). Escritas a partir de recursos de
  // dominio común (bending oblicuo, dobles cuerdas, cascadas, enclosures, cromatismos), no transcritas de nadie.
  bluesTecnica: { name: 'Blues avanzado: oblicuo, cascada y dobles cuerdas', win: [5, 10], items: [
    n(3, 7, 1, { bend: 2, fg: 3, also: [{ s: 4, f: 5, fg: 1 }] }),
    n(2, 8, 0.25, { fg: 4 }), n(2, 5, 0.25, { lig: 'P', fg: 1 }), n(3, 7, 0.25, { fg: 3 }), n(3, 5, 0.25, { lig: 'P', fg: 1 }),
    n(4, 7, 0.25, { fg: 3 }), n(4, 5, 0.25, { lig: 'P', fg: 1 }), n(5, 7, 0.5, { fg: 3 }),
    n(5, 5, 0.5, { fg: 1 }), n(5, 7, 0.5, { lig: 'H', vib: true, fg: 3 }),
    n(2, 5, 0.5, { fg: 1, also: [{ s: 5, f: 5, fg: 1 }] }), n(2, 8, 0.5, { slide: true, fg: 3, also: [{ s: 5, f: 8, fg: 3 }] }),
    n(1, 8, T, { fg: 3 }), n(1, 5, T, { lig: 'P', fg: 1 }), n(2, 8, T, { fg: 4 }),
    n(3, 7, 1, { bend: 2, rel: true, fg: 3 }), n(3, 5, 0.5, { lig: 'P', fg: 1 }), n(4, 7, 1.5, { vib: true, fg: 3 })] },
  bluesRafaga: { name: 'Ráfaga en semicorcheas por tres formas', win: [5, 17], items: [
    n(4, 5, 0.25, { fg: 1 }), n(4, 7, 0.25, { lig: 'H', fg: 3 }), n(3, 5, 0.25, { fg: 1 }), n(3, 7, 0.25, { lig: 'H', fg: 3 }),
    n(3, 9, 0.25, { slide: true, fg: 3 }), n(2, 8, 0.25, { fg: 1 }), n(2, 10, 0.25, { lig: 'H', fg: 3 }), n(1, 8, 0.25, { fg: 1 }),
    n(1, 10, 0.25, { lig: 'H', fg: 3 }), n(1, 12, 0.25, { slide: true, fg: 3 }), n(2, 13, 0.25, { fg: 2 }), n(2, 15, 0.25, { lig: 'H', fg: 4 }),
    n(1, 12, 0.25, { fg: 1 }), n(1, 15, 0.25, { fg: 3 }), n(1, 17, 0.5, { lig: 'H', fg: 4 }),
    n(2, 15, 1, { bend: 2, fg: 3 }), n(1, 12, 0.5, { fg: 1 }), n(2, 15, 0.5, { bend: 2, rel: true, fg: 3 }),
    n(2, 13, 0.5, { lig: 'P', fg: 2 }), n(3, 14, 1.5, { vib: true, fg: 3 })] },
  // Jazz modal sobre Am7 (La dórica): enclosure de la 5ª, arpegios, cromatismo bebop, tresillos, salida "fuera"
  // por medio tono (Bb) y resolución en la 6ª mayor (F#), la nota que hace dórico al modo.
  jazzModal: { name: 'Jazz modal sobre Am7: enclosures, cromatismos y salida', win: [3, 8], scale: [9, 11, 0, 2, 4, 6, 7], items: [
    n(2, 6, T, { fg: 3 }), n(2, 4, T, { fg: 1 }), n(2, 5, T, { fg: 2 }),
    n(1, 5, 0.5, { fg: 2 }), n(1, 8, 0.5, { fg: 4 }),
    n(1, 7, 0.5, { fg: 4 }), n(2, 8, 0.5, { fg: 4 }),
    n(2, 7, 0.5, { fg: 4 }), n(2, 5, 0.5, { fg: 2 }),
    n(3, 7, 0.5, { fg: 4 }), n(3, 6, 0.5, { fg: 3 }),
    n(3, 5, 0.5, { fg: 2 }), n(4, 7, 0.5, { fg: 4 }),
    n(5, 7, T, { fg: 4 }), n(4, 5, T, { fg: 2 }), n(3, 4, T, { fg: 1 }),
    n(2, 3, T, { fg: 1 }), n(2, 5, T, { lig: 'H', fg: 2 }), n(2, 6, T, { lig: 'H', fg: 3 }),
    n(1, 6, 0.5, { fg: 3 }), n(1, 4, 0.5, { fg: 1 }),
    n(1, 5, 1, { fg: 2 }),
    n(2, 5, 0.5, { fg: 2 }), n(2, 7, 2, { vib: true, fg: 4 })] },
  // ══ LISTA DE 60 (vocabulario-blues-rock-lista.md, 11-01). Claves = número de la lista. Forma E = trastes 5-8. ══
  // Dobles cuerdas: also usa s = 6 - cuerda (1ª → s:5, 2ª → s:4, 3ª → s:3, 4ª → s:2, 5ª → s:1, 6ª → s:0).
  v04: { name: 'Vibrato en la tónica', win: [5, 8], items: [
    n(2, 8, 0.5, { fg: 4 }), n(2, 5, 0.5, { fg: 1 }), n(3, 7, 0.5, { fg: 3 }), n(3, 5, 0.5, { fg: 1 }), n(4, 7, 3, { vib: true, fg: 3 })] },
  v05: { name: 'Bending y bajada', win: [5, 8], items: [
    n(2, 8, 0.5, { fg: 4 }), n(2, 5, 0.5, { fg: 1 }), n(3, 7, 2, { bend: 2, rel: true, fg: 3 }), n(3, 5, 0.5, { lig: 'P', fg: 1 }), n(4, 7, 1.5, { vib: true, fg: 3 })] },
  v06: { name: 'El rastrillado', win: [5, 8], items: [
    n(4, 7, X, { x: true, strum: 'd' }), n(3, 7, X, { x: true, strum: 'd' }), n(2, 8, 2 / 3, { bend: 2, fg: 3 }),
    n(1, 5, 0.5, { fg: 1 }), n(2, 8, 0.5, { fg: 4 }), n(2, 5, 1, { fg: 1 }), n(3, 7, 0.5, { fg: 3 }), n(4, 7, 1.5, { vib: true, fg: 3 })] },
  v09: { name: 'Hammer-on desde la cuerda al aire', win: [0, 5], items: [
    n(5, 0, 0.5), n(5, 3, 0.5, { lig: 'H', fg: 3 }), n(4, 0, 0.5), n(4, 2, 0.5, { lig: 'H', fg: 2 }),
    n(5, 0, 0.5), n(5, 3, 0.5, { lig: 'H', fg: 3 }), n(6, 3, 0.5, { fg: 2 }), n(5, 0, 1.5)] },
  v10: { name: 'Notas largas, pocas notas', win: [5, 8], items: [
    n(2, 8, 1.5, { bend: 2, fg: 3 }), r(0.5), n(2, 5, 1, { fg: 1 }), r(1), n(4, 7, 2.5, { vib: true, fg: 3 })] },
  v11: { name: 'El pre-bend', win: [5, 8], items: [
    n(3, 7, 1, { bend: 2, pre: true, fg: 3 }), n(3, 5, 0.5, { lig: 'P', fg: 1 }), n(4, 7, 0.5, { fg: 3 }),
    n(3, 7, 1, { bend: 2, pre: true, fg: 3 }), n(3, 5, 0.5, { lig: 'P', fg: 1 }), n(4, 7, 1.5, { vib: true, fg: 3 })] },
  v12: { name: 'Doble cuerda en la 1ª y la 2ª', win: [5, 8], items: [
    n(2, 5, 0.5, { fg: 1, also: [{ s: 5, f: 5, fg: 1 }] }), n(2, 5, 0.5, { fg: 1, also: [{ s: 5, f: 5, fg: 1 }] }), n(2, 8, 0.5, { fg: 3, also: [{ s: 5, f: 8, fg: 4 }] }),
    n(2, 5, 0.5, { fg: 1, also: [{ s: 5, f: 5, fg: 1 }] }), n(2, 5, 0.5, { fg: 1, also: [{ s: 5, f: 5, fg: 1 }] }), n(2, 8, 0.5, { fg: 3, also: [{ s: 5, f: 8, fg: 4 }] }),
    n(3, 7, 0.5, { fg: 3 }), n(3, 5, 0.5, { lig: 'P', fg: 1 }), n(4, 7, 2, { vib: true, fg: 3 })] },
  v19: { name: 'Bending, pull-off y slide', win: [5, 10], items: [
    n(3, 7, 1, { bend: 2, rel: true, fg: 3 }), n(3, 5, 0.5, { lig: 'P', fg: 1 }), n(4, 7, 0.5, { fg: 3 }), n(4, 5, 0.5, { lig: 'P', fg: 1 }), n(4, 7, 0.5, { lig: 'H', fg: 3 }),
    n(4, 10, 1, { slide: true, fg: 3 }), n(3, 9, 0.5, { fg: 2 }), n(2, 10, 2, { vib: true, fg: 3 })] },
  v21: { name: 'La frase en la octava alta', win: [17, 20], items: [
    n(3, 19, 1, { bend: 2, fg: 3 }), n(2, 17, 0.5, { fg: 1 }), n(1, 17, 0.5, { fg: 1 }), n(2, 20, 0.5, { fg: 4 }), n(2, 17, 0.5, { lig: 'P', fg: 1 }),
    n(3, 19, 1, { bend: 2, rel: true, fg: 3 }), n(3, 17, 0.5, { lig: 'P', fg: 1 }), n(4, 19, 1.5, { vib: true, fg: 3 })] },
  v22: { name: 'Repetición con variación', win: [5, 8], items: [
    n(2, 8, 0.5, { fg: 4 }), n(2, 5, 0.5, { fg: 1 }), n(3, 7, 1, { bend: 2, fg: 3 }), n(3, 5, 0.5, { fg: 1 }), n(4, 7, 1.5, { fg: 3 }),
    n(2, 8, 0.5, { fg: 4 }), n(2, 5, 0.5, { fg: 1 }), n(3, 7, 1, { bend: 2, rel: true, fg: 3 }), n(3, 5, 0.5, { lig: 'P', fg: 1 }), n(4, 7, 0.5, { fg: 3 }), n(4, 5, 0.5, { fg: 1 }), n(5, 7, 1.5, { vib: true, fg: 3 })] },
  v23: { name: 'Síncopas: entrar a contratiempo', win: [5, 8], items: [
    r(0.5), n(1, 5, 0.5, { fg: 1 }), n(1, 8, 1, { fg: 4 }), n(1, 5, 0.5, { fg: 1 }), n(2, 8, 1, { fg: 4 }), n(2, 5, 0.5, { fg: 1 }), n(3, 7, 2, { bend: 2, vib: true, fg: 3 })] },
  v24: { name: 'Bending doble: medio tono y tono', win: [5, 8], items: [
    n(3, 7, 1, { bend: 1, fg: 3 }), n(3, 7, 1, { bend: 2, fg: 3 }), n(2, 8, 0.5, { fg: 4 }), n(2, 5, 0.5, { lig: 'P', fg: 1 }), n(3, 5, 0.5, { fg: 1 }), n(4, 7, 1.5, { vib: true, fg: 3 })] },
  v26: { name: 'Blue note de paso', win: [5, 8], items: [
    n(2, 5, 0.5, { fg: 1 }), n(3, 8, 0.5, { fg: 4 }), n(3, 7, 0.5, { fg: 3 }), n(3, 5, 0.5, { fg: 1 }), n(4, 7, 1, { fg: 3 }), r(0.5),
    n(2, 5, 0.5, { fg: 1 }), n(3, 8, 0.5, { fg: 4 }), n(3, 7, 0.5, { fg: 3 }), n(3, 5, 1, { bend: 0.5, fg: 1 }), n(4, 7, 1.5, { vib: true, fg: 3 })] },
  v27: { name: 'Bending oblicuo', win: [5, 8], items: [
    n(3, 7, 1.5, { bend: 2, fg: 3, also: [{ s: 4, f: 8, fg: 4 }] }), n(2, 5, 0.5, { fg: 1 }), n(3, 7, 1, { bend: 2, fg: 3, also: [{ s: 4, f: 8, fg: 4 }] }),
    n(3, 5, 0.5, { fg: 1 }), n(4, 7, 1.5, { vib: true, fg: 3 })] },
  v28: { name: 'Dobles cuerdas en la 2ª y la 3ª', win: [5, 10], items: [
    n(3, 5, 0.5, { fg: 1, also: [{ s: 4, f: 5, fg: 1 }] }), n(3, 7, 0.5, { fg: 2, also: [{ s: 4, f: 8, fg: 3 }] }), n(3, 9, 0.5, { fg: 2, also: [{ s: 4, f: 10, fg: 3 }] }),
    n(3, 7, 0.5, { fg: 2, also: [{ s: 4, f: 8, fg: 3 }] }), n(3, 5, 0.5, { fg: 1, also: [{ s: 4, f: 5, fg: 1 }] }), n(3, 7, 0.5, { fg: 2, also: [{ s: 4, f: 8, fg: 3 }] }),
    n(3, 5, 0.5, { fg: 1, also: [{ s: 4, f: 5, fg: 1 }] }), n(4, 7, 2.5, { vib: true, fg: 3 })] },
  v29: { name: 'Dobles cuerdas deslizadas', win: [3, 8], items: [
    n(2, 3, 0.5, { fg: 1, also: [{ s: 5, f: 3, fg: 1 }] }), n(2, 5, 1, { slide: true, fg: 1, also: [{ s: 5, f: 5, fg: 1 }] }), n(2, 8, 0.5, { fg: 3, also: [{ s: 5, f: 8, fg: 4 }] }),
    n(2, 5, 0.5, { fg: 1, also: [{ s: 5, f: 5, fg: 1 }] }), n(3, 7, 0.5, { fg: 3 }), n(3, 5, 0.5, { lig: 'P', fg: 1 }), n(4, 7, 2, { vib: true, fg: 3 })] },
  v30: { name: 'Frase repetitiva en tresillos', win: [5, 8], items: [
    n(2, 8, T, { fg: 4 }), n(2, 5, T, { lig: 'P', fg: 1 }), n(3, 7, T, { fg: 3 }), n(2, 8, T, { fg: 4 }), n(2, 5, T, { lig: 'P', fg: 1 }), n(3, 7, T, { fg: 3 }),
    n(2, 8, T, { fg: 4 }), n(2, 5, T, { lig: 'P', fg: 1 }), n(3, 7, T, { fg: 3 }), n(2, 8, T, { fg: 4 }), n(2, 5, T, { lig: 'P', fg: 1 }), n(3, 7, T, { fg: 3 }),
    n(3, 7, 1, { bend: 2, fg: 3 }), n(2, 5, 0.5, { fg: 1 }), n(1, 5, 0.5, { fg: 1 }), n(1, 8, 2, { bend: 2, vib: true, fg: 3 })] },
  v31: { name: 'Bending de tono y medio', win: [7, 10], items: [
    n(3, 9, 1.5, { bend: 3, fg: 3 }), n(2, 8, 0.5, { fg: 1 }), n(2, 10, 0.5, { fg: 3 }), n(2, 8, 0.5, { lig: 'P', fg: 1 }),
    n(3, 9, 1, { bend: 3, rel: true, fg: 3 }), n(3, 7, 0.5, { lig: 'P', fg: 1 }), n(4, 7, 1.5, { vib: true, fg: 1 })] },
  v32: { name: 'Bending en la 1ª cuerda', win: [5, 8], items: [
    n(1, 8, 1, { bend: 2, fg: 3 }), n(1, 5, 0.5, { fg: 1 }), n(2, 8, 0.5, { fg: 4 }), n(1, 8, 1, { bend: 2, rel: true, fg: 3 }), n(1, 5, 0.5, { lig: 'P', fg: 1 }),
    n(2, 8, 0.5, { fg: 4 }), n(2, 5, 2, { vib: true, fg: 1 })] },
  v33: { name: 'El ritmo de los silencios', win: [5, 8], items: [
    n(1, 5, 0.5, { fg: 1 }), r(0.5), n(1, 5, 0.5, { fg: 1 }), r(0.5), n(1, 8, 0.5, { fg: 4 }), n(1, 5, 0.5, { fg: 1 }), r(0.5), n(2, 8, 0.5, { fg: 4 }),
    n(2, 5, 1, { fg: 1 }), r(1), n(4, 7, 2, { vib: true, fg: 3 })] },
  v34: { name: 'De menor a mayor: la 3ª que cambia', win: [5, 8], items: [
    n(3, 5, 0.5, { fg: 1 }), n(3, 6, 0.5, { lig: 'H', fg: 2 }), n(4, 7, 0.5, { fg: 3 }), n(3, 5, 0.5, { fg: 1 }), n(3, 6, 0.5, { lig: 'H', fg: 2 }), n(2, 5, 0.5, { fg: 1 }), n(1, 5, 2, { vib: true, fg: 1 })] },
  v35: { name: 'Respuesta en las cuerdas graves', win: [5, 8], items: [
    n(6, 5, 0.5, { fg: 1 }), n(6, 8, 0.5, { fg: 4 }), n(5, 5, 0.5, { fg: 1 }), n(5, 6, 0.5, { fg: 2 }), n(5, 7, 0.5, { fg: 3 }), n(5, 5, 0.5, { fg: 1 }), n(6, 8, 0.5, { fg: 4 }), n(6, 5, 2, { fg: 1 })] },
  v36: { name: 'Bending con vibrato', win: [5, 8], items: [
    n(2, 8, 2, { bend: 2, vib: true, fg: 3 }), n(2, 5, 0.5, { fg: 1 }), n(3, 7, 0.5, { fg: 3 }), n(3, 5, 0.5, { fg: 1 }), n(4, 7, 2.5, { vib: true, fg: 3 })] },
  v40: { name: 'Grupos de seis en semicorcheas', win: [5, 8], items: [
    n(1, 8, 0.25, { fg: 4 }), n(1, 5, 0.25, { lig: 'P', fg: 1 }), n(2, 8, 0.25, { fg: 4 }), n(2, 5, 0.25, { lig: 'P', fg: 1 }), n(3, 7, 0.25, { fg: 3 }), n(3, 5, 0.25, { lig: 'P', fg: 1 }),
    n(1, 8, 0.25, { fg: 4 }), n(1, 5, 0.25, { lig: 'P', fg: 1 }), n(2, 8, 0.25, { fg: 4 }), n(2, 5, 0.25, { lig: 'P', fg: 1 }), n(3, 7, 0.25, { fg: 3 }), n(3, 5, 0.25, { lig: 'P', fg: 1 }),
    n(3, 7, 1, { bend: 2, fg: 3 }), n(2, 5, 0.5, { fg: 1 }), n(1, 5, 0.5, { fg: 1 }), n(1, 8, 2, { bend: 2, vib: true, fg: 3 })] },
  v41: { name: 'Secuencia de cuatro notas subiendo', win: [5, 8], items: [
    n(6, 5, 0.25, { fg: 1 }), n(6, 8, 0.25, { fg: 4 }), n(5, 5, 0.25, { fg: 1 }), n(5, 7, 0.25, { fg: 3 }),
    n(6, 8, 0.25, { fg: 4 }), n(5, 5, 0.25, { fg: 1 }), n(5, 7, 0.25, { fg: 3 }), n(4, 5, 0.25, { fg: 1 }),
    n(5, 5, 0.25, { fg: 1 }), n(5, 7, 0.25, { fg: 3 }), n(4, 5, 0.25, { fg: 1 }), n(4, 7, 0.25, { fg: 3 }),
    n(5, 7, 0.25, { fg: 3 }), n(4, 5, 0.25, { fg: 1 }), n(4, 7, 0.25, { fg: 3 }), n(3, 5, 0.25, { fg: 1 }),
    n(3, 7, 1, { bend: 2, fg: 3 }), n(2, 5, 0.5, { fg: 1 }), n(1, 5, 2.5, { vib: true, fg: 1 })] },
  v42: { name: 'Bajada por cuatro formas', win: [5, 17], items: [
    n(1, 17, 0.25, { fg: 4 }), n(1, 15, 0.25, { lig: 'P', fg: 2 }), n(2, 17, 0.25, { fg: 4 }), n(2, 15, 0.25, { lig: 'P', fg: 2 }),
    n(2, 13, 0.25, { slide: true, fg: 1 }), n(3, 14, 0.25, { fg: 3 }), n(3, 12, 0.25, { lig: 'P', fg: 1 }), n(4, 14, 0.25, { fg: 3 }),
    n(4, 12, 0.25, { lig: 'P', fg: 1 }), n(4, 10, 0.25, { slide: true, fg: 1 }), n(5, 12, 0.25, { fg: 3 }), n(5, 10, 0.25, { lig: 'P', fg: 1 }),
    n(6, 12, 0.25, { fg: 3 }), n(6, 10, 0.25, { lig: 'P', fg: 1 }), n(6, 8, 0.25, { slide: true, fg: 1 }), n(6, 5, 2.25, { slide: true, vib: true, fg: 1 })] },
  v43: { name: 'Trino de blues', win: [5, 8], items: [
    n(3, 5, 0.25, { fg: 1 }), n(3, 7, 0.25, { lig: 'H', fg: 3 }), n(3, 5, 0.25, { lig: 'P', fg: 1 }), n(3, 7, 0.25, { lig: 'H', fg: 3 }),
    n(3, 5, 0.25, { lig: 'P', fg: 1 }), n(3, 7, 0.25, { lig: 'H', fg: 3 }), n(3, 5, 0.25, { lig: 'P', fg: 1 }), n(3, 7, 0.25, { lig: 'H', fg: 3 }),
    n(3, 7, 1, { bend: 2, fg: 3 }), n(3, 5, 0.5, { fg: 1 }), n(4, 7, 1.5, { vib: true, fg: 3 })] },
  v44: { name: 'Frase de cuatro compases', win: [5, 8], items: [
    n(3, 7, 1, { bend: 2, fg: 3 }), n(2, 5, 0.5, { fg: 1 }), n(2, 8, 0.5, { fg: 4 }), n(1, 5, 1, { fg: 1 }), r(1),
    n(2, 8, 0.5, { fg: 4 }), n(2, 5, 0.5, { lig: 'P', fg: 1 }), n(3, 7, 1, { bend: 2, rel: true, fg: 3 }), n(3, 5, 0.5, { lig: 'P', fg: 1 }), n(4, 7, 1.5, { vib: true, fg: 3 }),
    n(1, 8, T, { fg: 4 }), n(1, 5, T, { lig: 'P', fg: 1 }), n(2, 8, T, { fg: 4 }), n(2, 5, T, { lig: 'P', fg: 1 }), n(3, 7, T, { fg: 3 }), n(3, 5, T, { lig: 'P', fg: 1 }),
    n(3, 7, 1, { bend: 2, rel: true, fg: 3 }), n(3, 5, 1, { bend: 0.5, fg: 1 }), n(4, 7, 3, { vib: true, fg: 3 })] },
  v45: { name: 'Cambio de forma con bending', win: [5, 10], items: [
    n(3, 7, 1, { bend: 2, fg: 3 }), n(2, 5, 0.5, { fg: 1 }), n(2, 8, 0.5, { fg: 3 }), n(2, 10, 1, { slide: true, fg: 3 }), n(1, 8, 0.5, { fg: 1 }),
    n(1, 10, 1, { bend: 2, fg: 3 }), n(1, 8, 0.5, { fg: 1 }), n(2, 10, 1.5, { vib: true, fg: 3 })] },
  v46: { name: 'Semicorcheas y bending final', win: [5, 8], items: [
    n(4, 5, 0.25, { fg: 1 }), n(4, 7, 0.25, { lig: 'H', fg: 3 }), n(3, 5, 0.25, { fg: 1 }), n(3, 7, 0.25, { lig: 'H', fg: 3 }),
    n(2, 5, 0.25, { fg: 1 }), n(2, 8, 0.25, { fg: 4 }), n(1, 5, 0.25, { fg: 1 }), n(1, 8, 0.25, { fg: 4 }),
    n(2, 8, 2, { bend: 2, vib: true, fg: 3 })] },
  v47: { name: 'Rock de los 70 en la octava alta', win: [17, 20], items: [
    n(1, 17, 0.25, { fg: 1 }), n(2, 20, 0.25, { fg: 4 }), n(2, 17, 0.25, { lig: 'P', fg: 1 }), n(3, 19, 0.25, { fg: 3 }),
    n(1, 17, 0.25, { fg: 1 }), n(2, 20, 0.25, { fg: 4 }), n(2, 17, 0.25, { lig: 'P', fg: 1 }), n(3, 19, 0.25, { fg: 3 }),
    n(1, 17, 0.25, { fg: 1 }), n(2, 20, 0.25, { fg: 4 }), n(2, 17, 0.25, { lig: 'P', fg: 1 }), n(3, 19, 0.25, { fg: 3 }),
    n(3, 19, 1, { bend: 2, vib: true, fg: 3 })] },
  v48: { name: 'El gran final', win: [5, 8], items: [
    n(1, 8, 0.25, { fg: 4 }), n(1, 5, 0.25, { lig: 'P', fg: 1 }), n(2, 8, 0.25, { fg: 4 }), n(2, 5, 0.25, { lig: 'P', fg: 1 }),
    n(3, 7, 0.25, { fg: 3 }), n(3, 5, 0.25, { lig: 'P', fg: 1 }), n(4, 7, 0.25, { fg: 3 }), n(4, 5, 0.25, { lig: 'P', fg: 1 }),
    n(5, 7, 0.25, { fg: 3 }), n(5, 6, 0.25, { lig: 'P', fg: 2 }), n(5, 5, 0.25, { lig: 'P', fg: 1 }), n(6, 8, 0.25, { fg: 4 }),
    n(6, 5, 0.5, { lig: 'P', fg: 1 }), n(5, 7, 0.5, { fg: 3 }), n(6, 5, 2, { vib: true, fg: 1 })] },
  // ── Sección T: turnarounds sobre el blues de 12 compases en La (swing lento: se escriben en tresillos).
  // Cada vuelta = compases 9-12; la frase suena en el 11 (A7) y el 12 (E7). form.fromBar: compás de la base.
  t01: { name: 'Turnaround cromático descendente', form: { fromBar: 9 }, noRest: true, win: [5, 9], items: [
    r(4), r(4),
    n(3, 9, 2 * T, { fg: 4, also: [{ s: 5, f: 5, fg: 1 }] }), n(3, 9, T, { fg: 4, also: [{ s: 5, f: 5, fg: 1 }] }),
    n(3, 8, 2 * T, { fg: 3, also: [{ s: 5, f: 5, fg: 1 }] }), n(3, 8, T, { fg: 3, also: [{ s: 5, f: 5, fg: 1 }] }),
    n(3, 7, 2 * T, { fg: 2, also: [{ s: 5, f: 5, fg: 1 }] }), n(3, 7, T, { fg: 2, also: [{ s: 5, f: 5, fg: 1 }] }),
    n(3, 6, 2 * T, { fg: 2, also: [{ s: 5, f: 5, fg: 1 }] }), n(3, 6, T, { fg: 2, also: [{ s: 5, f: 5, fg: 1 }] }),
    n(5, 7, 1, { fg: 3, also: [{ s: 2, f: 6, fg: 2 }, { s: 3, f: 7, fg: 4 }] }), r(1), r(2)] },
  t02: { name: 'Turnaround cromático ascendente', form: { fromBar: 9 }, noRest: true, win: [5, 9], items: [
    r(4), r(4),
    n(3, 6, 2 * T, { fg: 2, also: [{ s: 5, f: 5, fg: 1 }] }), n(3, 6, T, { fg: 2, also: [{ s: 5, f: 5, fg: 1 }] }),
    n(3, 7, 2 * T, { fg: 2, also: [{ s: 5, f: 5, fg: 1 }] }), n(3, 7, T, { fg: 2, also: [{ s: 5, f: 5, fg: 1 }] }),
    n(3, 8, 2 * T, { fg: 3, also: [{ s: 5, f: 5, fg: 1 }] }), n(3, 8, T, { fg: 3, also: [{ s: 5, f: 5, fg: 1 }] }),
    n(3, 9, 2 * T, { fg: 4, also: [{ s: 5, f: 5, fg: 1 }] }), n(3, 9, T, { fg: 4, also: [{ s: 5, f: 5, fg: 1 }] }),
    n(5, 7, 1, { fg: 3, also: [{ s: 2, f: 6, fg: 2 }, { s: 3, f: 7, fg: 4 }] }), r(1), r(2)] },
  t03: { name: 'Turnaround en sextas', form: { fromBar: 9 }, noRest: true, win: [5, 9], items: [
    r(4), r(4),
    n(3, 9, 2 * T, { fg: 3, also: [{ s: 5, f: 9, fg: 4 }] }), n(3, 9, T, { fg: 3, also: [{ s: 5, f: 9, fg: 4 }] }),
    n(3, 8, 2 * T, { fg: 2, also: [{ s: 5, f: 8, fg: 3 }] }), n(3, 8, T, { fg: 2, also: [{ s: 5, f: 8, fg: 3 }] }),
    n(3, 7, 2 * T, { fg: 1, also: [{ s: 5, f: 7, fg: 2 }] }), n(3, 7, T, { fg: 1, also: [{ s: 5, f: 7, fg: 2 }] }),
    n(3, 6, 2 * T, { fg: 1, also: [{ s: 5, f: 6, fg: 1 }] }), n(3, 6, T, { fg: 1, also: [{ s: 5, f: 6, fg: 1 }] }),
    n(3, 7, 2, { fg: 1, also: [{ s: 5, f: 7, fg: 2 }] }), r(2)] },
  t04: { name: 'Turnaround con la 1ª cuerda al aire', form: { fromBar: 9 }, noRest: true, win: [0, 8], items: [
    r(4), r(4),
    n(2, 8, 2 * T, { fg: 4, also: [{ s: 5, f: 0 }] }), n(2, 8, T, { fg: 4, also: [{ s: 5, f: 0 }] }),
    n(2, 7, 2 * T, { fg: 3, also: [{ s: 5, f: 0 }] }), n(2, 7, T, { fg: 3, also: [{ s: 5, f: 0 }] }),
    n(2, 6, 2 * T, { fg: 2, also: [{ s: 5, f: 0 }] }), n(2, 6, T, { fg: 2, also: [{ s: 5, f: 0 }] }),
    n(2, 5, 2 * T, { fg: 1, also: [{ s: 5, f: 0 }] }), n(2, 5, T, { fg: 1, also: [{ s: 5, f: 0 }] }),
    n(6, 0, 1, { also: [{ s: 2, f: 0 }, { s: 3, f: 1, fg: 1 }] }), r(1), r(2)] },
  t05: { name: 'Turnaround en tresillos', form: { fromBar: 9 }, noRest: true, win: [3, 8], items: [
    r(4), r(4),
    n(1, 5, T, { fg: 1 }), n(2, 8, T, { fg: 4 }), n(2, 5, T, { fg: 1 }),
    n(3, 8, T, { fg: 4 }), n(3, 7, T, { fg: 3 }), n(3, 6, T, { fg: 2 }),
    n(3, 5, T, { fg: 1 }), n(4, 7, T, { fg: 3 }), n(4, 6, T, { fg: 2 }),
    n(4, 5, T, { fg: 1 }), n(4, 4, T, { fg: 1 }), n(4, 3, T, { fg: 1 }),
    n(5, 7, 1, { fg: 3, also: [{ s: 2, f: 6, fg: 2 }, { s: 3, f: 7, fg: 4 }] }), r(1), r(2)] },
  t06: { name: 'Turnaround de rock', form: { fromBar: 9 }, noRest: true, win: [5, 9], items: [
    r(4), r(4),
    n(2, 5, 2 * T, { fg: 1, also: [{ s: 5, f: 5, fg: 1 }] }), n(2, 5, T, { fg: 1, also: [{ s: 5, f: 5, fg: 1 }] }),
    n(2, 5, 2 * T, { fg: 1, also: [{ s: 5, f: 5, fg: 1 }] }), n(2, 5, T, { fg: 1, also: [{ s: 5, f: 5, fg: 1 }] }),
    n(3, 8, 2 * T, { fg: 4 }), n(3, 7, T, { fg: 3 }), n(3, 6, 2 * T, { fg: 2 }), n(3, 5, T, { fg: 1 }),
    n(5, 7, 1, { fg: 3, also: [{ s: 2, f: 6, fg: 2 }, { s: 3, f: 7, fg: 4 }] }), r(1), r(2)] },
};
