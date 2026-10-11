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
  slide: { name: 'Deslizamiento a la caja 2', win: [5, 10], items: [
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
};
