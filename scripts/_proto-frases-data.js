// PROTOTIPO "vocabulario": frases de ejemplo en La menor, escritas a partir de clichés de dominio común
// (no transcritas de ningún método). Cada nota: n(cuerda 6..1, traste, pulsos, opciones).
//   bend: semitonos (2 = un tono, 1 = medio, 0.5 = cuarto) · rel: el bending vuelve a bajar
//   lig: 'P' pull-off / 'H' hammer-on desde la nota anterior (misma cuerda) · slide: se llega deslizando
//   vib: vibrato · also: notas que suenan a la vez · fg: dedo · r(pulsos) = silencio
const n = (str, f, d, o = {}) => ({ s: 6 - str, f, d, ...o });
const r = d => ({ r: true, d });
const T = 1 / 3, X = 1 / 6;

module.exports = {
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
