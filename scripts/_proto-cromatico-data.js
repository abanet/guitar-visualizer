// PROTOTIPO: "Cromática a octavas" (PDF que trajo Alberto el 11-05, ~/Downloads/Cromática a octavas.pdf), escrita como
// "frase" para _proto-frases.js (--datos scripts/_proto-cromatico-data.js --frase octavas).
// La escala cromática en octavas y en corcheas: cada nota seguida de su octava dos cuerdas más arriba (6ª-4ª, 5ª-3ª,
// 4ª-2ª, 3ª-1ª), en primera posición (trastes 0-4, un dedo por traste: traste N = dedo N; al aire sin dedo).
// Sube de E a G#, compás de giro (G# · silencio de blanca · G#) y baja de G a E: 36 pulsos = 9 compases, igual que el PDF.
// Sin número de dedo (Alberto 11-05: "quita el dedo, salvo que encuentres información fiable").
const n = (str, f, d = 0.5) => ({ s: 6 - str, f, d });
// Cada par: [cuerda, traste] de la nota grave y de su octava.
const SUBE = [
  [[6, 0], [4, 2]], [[6, 1], [4, 3]], [[6, 2], [4, 4]], [[6, 3], [3, 0]], [[6, 4], [3, 1]],
  [[5, 0], [3, 2]], [[5, 1], [3, 3]], [[5, 2], [2, 0]], [[5, 3], [2, 1]], [[5, 4], [2, 2]],
  [[4, 0], [2, 3]], [[4, 1], [2, 4]], [[4, 2], [1, 0]], [[4, 3], [1, 1]], [[4, 4], [1, 2]], [[3, 0], [1, 3]],
];
const GIRO = [[3, 1], [1, 4]];
// Marcas (11-05, Alberto: "hay un cromatismo que estaría bien marcar de alguna manera gráfica"): la nota grave lleva
// crom = la grave anterior (flecha de medio tono) y la aguda octDe = su grave (línea de octava).
const pos = ([str, f]) => ({ s: 6 - str, f });
// Sin la línea de octava: a Alberto no le gustó ("el de las rayas no me ha gustado", 11-05); queda la flecha de ½.
// 11-05: tampoco la flecha de ½ ("las líneas tampoco me convencen, fuera").
const pares = lista => lista.flatMap(([a, b]) => [n(...a), n(...b)]);
const par = ([a, b]) => [n(...a), { ...n(...b), octDe: pos(a) }];
const BAJA = [...SUBE].reverse();

// Versión cerrada (Alberto 11-06: "haría falta una versión sin cuerdas al aire, quizá empezando en A de la sexta
// cuerda"): el mismo dibujo 5 trastes más arriba (trastes 5-9), de A a C# y vuelta; se puede llevar a cualquier traste.
const mueve = (lista, d) => lista.map(([x, y]) => [[x[0], x[1] + d], [y[0], y[1] + d]]);
const CERR = 5, SUBE_C = mueve(SUBE, CERR), GIRO_C = [[GIRO[0][0], GIRO[0][1] + CERR], [GIRO[1][0], GIRO[1][1] + CERR]], BAJA_C = [...SUBE_C].reverse();

module.exports = {
  octavas: { title: 'Cromática a octavas', name: 'Escala cromática en octavas · 1ª posición', rootPc: -1, pagina: 16, sostenidos: true, seguido: true, proximas: 2, anticipaPar: true, entradaCorta: true, tiraCromatica: true, cabezal: true, noRest: true, compasEntreVueltas: true, sinSubtitulo: true, backingVol: 2.6,   // balance de los patrones melódicos con esta misma base (a 1,3 el compás vacío casi no se oía)
    fretMax: 4, maxFretW: 200, rowLabel: ' ', naturales: true,
    items: [...pares([...SUBE, GIRO]), { r: true, d: 2 }, ...pares([GIRO, ...BAJA])] },
};
module.exports.octavasCerrada = { ...module.exports.octavas, title: 'Cromática a octavas · sin cuerdas al aire', name: 'Escala cromática en octavas · posición cerrada',
  fretMin: 5, fretMax: 9, items: [...pares([...SUBE_C, GIRO_C]), { r: true, d: 2 }, ...pares([GIRO_C, ...BAJA_C])] };
