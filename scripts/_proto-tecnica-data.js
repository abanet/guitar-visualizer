// Ejercicios de TÉCNICA (pilar 1 de la estrategia del canal) para scripts/_proto-tecnica.js
// (--datos scripts/_proto-tecnica-data.js). Alberto 11-10: "me interesa empezar con ejercicios de técnica porque quiero
// meterlos en mi rutina; genera todos los que se te ocurran durante la noche para verlos mañana y decidir". Son
// propuestas: se renderizan con 3 tempos para revisarlas rápido; las que le gusten se hacen con la escalera completa.
// Cada ejercicio dura un número entero de compases (lo pide la base). Escala de referencia: La menor en la posición
// del traste 5 (la de casi todo el canal); los de dedos sueltos van sin escala de fondo (rootPc -1), como el Spider.
const n = (str, f, d, o = {}) => ({ s: 6 - str, f, d, ...o });
const R = (d) => ({ r: true, d });
const T = 1 / 3, S = 0.25, C = 0.5;
// Rótulo de cierre (11-11, Alberto): cuando ya te lo sabes, tu tempo fijo y a la rutina (TodoRitmos, en la descripción).
const FINAL = '¿Ya te lo sabes? Elige tu tempo en la lista de fijos y hazlo a diario';
const FINAL_FIJO = 'Cuando te salga limpio, pasa al vídeo de 10 bpm más';   // vídeos a tempo fijo (--recorrido)
// 11-11 (Alberto): siempre sonando, sin "escucha / tu turno" ("la idea es que el alumno esté todo el rato haciendo el
// ejercicio"); el rótulo solo en el primer compás de la cuenta; "Ejercicio N" en el subtítulo.
const base = (nivel, nombre, o) => ({ title: `Técnica · ${nivel}`, name: nombre, pagina: 8, seguido: true, rotuloUnCompas: true, etiquetaNum: 'Ejercicio', rotuloFinal: FINAL, rotuloFinalFijo: FINAL_FIJO, ...o });   // 8 pulsos por página de tablatura (como el Spider en semicorcheas)
// Púa alterna: abajo en las posiciones pares (cuenta de notas, no de pulsos).
const alterna = (items) => { let k = 0; return items.map(it => (it.r ? it : { ...it, strum: k++ % 2 ? 'u' : 'd' })); };

// Pentatónica de La menor, forma E (traste 5): [cuerda, traste, dedo].
const PENTA_E = [[6, 5, 1], [6, 8, 4], [5, 5, 1], [5, 7, 3], [4, 5, 1], [4, 7, 3], [3, 5, 1], [3, 7, 3], [2, 5, 1], [2, 8, 4], [1, 5, 1], [1, 8, 4]];
// La menor natural, tres notas por cuerda desde el traste 5 (posición de La).
const TNPC = [[6, [5, 7, 8]], [5, [5, 7, 8]], [4, [5, 7, 9]], [3, [5, 7, 9]], [2, [6, 8, 10]], [1, [7, 8, 10]]];
const DEDO3 = (fs) => (fs[2] - fs[0] === 3 ? [1, 3, 4] : [1, 2, 4]);   // 3 trastes: 1-3-4; 4 trastes (estirando): 1-2-4

// Las 5 formas (CAGED) de la pentatónica de La menor: [cuerda, [traste, dedo], [traste, dedo]] de la 6ª a la 1ª.
// E8 (forma E a la octava, trastes 17-20): ya no se usa desde que la G va abajo (11-11); se deja por si vuelve la pareja alta.
const FORMAS = {
  E: [[6, [5, 1], [8, 4]], [5, [5, 1], [7, 3]], [4, [5, 1], [7, 3]], [3, [5, 1], [7, 3]], [2, [5, 1], [8, 4]], [1, [5, 1], [8, 4]]],
  D: [[6, [8, 2], [10, 4]], [5, [7, 1], [10, 4]], [4, [7, 1], [10, 4]], [3, [7, 1], [9, 3]], [2, [8, 2], [10, 4]], [1, [8, 2], [10, 4]]],
  C: [[6, [10, 1], [12, 3]], [5, [10, 1], [12, 3]], [4, [10, 1], [12, 3]], [3, [9, 1], [12, 4]], [2, [10, 1], [13, 4]], [1, [10, 1], [12, 3]]],
  A: [[6, [12, 1], [15, 4]], [5, [12, 1], [15, 4]], [4, [12, 1], [14, 3]], [3, [12, 1], [14, 3]], [2, [13, 2], [15, 4]], [1, [12, 1], [15, 4]]],
  // 11-11 (Alberto: "la forma G la dibuja en el traste 15, hay que empezarla en el 3"): la G va abajo, trastes 2-5.
  G: [[6, [3, 2], [5, 4]], [5, [3, 2], [5, 4]], [4, [2, 1], [5, 4]], [3, [2, 1], [5, 4]], [2, [3, 2], [5, 4]], [1, [3, 2], [5, 4]]],
};
// 11-11 (Alberto: "falta la posición con cuerdas al aire, la que empieza en el 12 y encaja con las cuerdas al aire"):
// la forma A abierta, trastes 0-3 (dedo 0 = cuerda al aire). Regla de siempre: forma con cuerdas al aire → las dos.
FORMAS.A0 = [[6, [0, 0], [3, 3]], [5, [0, 0], [3, 3]], [4, [0, 0], [2, 2]], [3, [0, 0], [2, 2]], [2, [1, 1], [3, 3]], [1, [0, 0], [3, 3]]];
FORMAS.E8 = FORMAS.E.map(([s, a, b]) => [s, [a[0] + 12, a[1]], [b[0] + 12, b[1]]]);
const TRASTE = { A0: 0, G: 3, E: 5, D: 8, C: 10, A: 12, E8: 17 };
const nombreForma = (f) => (f === 'E8' ? 'E (octava)' : f === 'A0' ? 'A abierta' : f);
// Recorrido por varias formas (11-11, Alberto: "baja por una posición, se desplaza a la siguiente y sube por ella; al
// llegar arriba hay que desplazarse a la primera para cerrar el ciclo"): una pasada por forma, alternando 6ª→1ª y
// 1ª→6ª, ida por todas y vuelta por las de en medio, para acabar en la 6ª y enlazar con la primera:
// pareja E↓ D↑ (y vuelta a la E); las cinco G↓ E↑ D↓ C↑ A↓ C↑ D↓ E↑ (y vuelta a la G). Una forma sola: 6ª→1ª y vuelta.
// (sube = de la 6ª a la 1ª: de grave a agudo, con martillos.)
// empieza = true: arranca de la 6ª (con martillos); false: el mismo ciclo en sentido contrario, desde la 1ª (11-11, la
// segunda mitad de los tempos, avisada en pantalla: P.cambioMitad).
const RUTA = (formas, empieza = true) => { const r = formas.length === 1 ? [formas[0], formas[0]] : [...formas, ...formas.slice(1, -1).reverse()]; return r.map((f, i) => ({ f, sube: (i % 2 === 0) === empieza })); };
// nota(s, f, fg, k, sube): k = posición de la nota dentro de la forma en ese sentido (0, 1, 2…; par = cambio de cuerda).
function ejerciciosPorFormas(clave, tecnica, nota, extra = {}) {
  const tramo = (forma, sube, t) => { const notas = FORMAS[forma].flatMap(([s, a, b]) => [[s, ...a], [s, ...b]]); const orden = sube ? notas : [...notas].reverse();
    return orden.map(([s, f, fg], k) => ({ ...nota(s, f, fg, k, sube), tramo: t })); };
  const hacer = (formas, nombre) => { const v = [true, false].map(e => RUTA(formas, e).flatMap(({ f, sube }) => tramo(f, sube, formas.indexOf(f))).concat([R(2)]));
    return base('Inicial', nombre, { porTramo: true, ...extra, items: v[0], vueltas: v, cambioMitad: true, capCambio: 'SENTIDO CONTRARIO',
      avisoCambio: '¡Cambio de sentido! Ahora se empieza por la 1ª cuerda' }); };
  const out = {};
  for (const f of ['E', 'D', 'C', 'A', 'G']) out[`${clave}_${f}`] = hacer([f], `${tecnica} por la pentatónica · forma ${f} (traste ${TRASTE[f]})`);
  out[`${clave}_A0`] = hacer(['A0'], `${tecnica} por la pentatónica · forma A abierta (cuerdas al aire)`);
  for (const [a, b] of [['A0', 'G'], ['G', 'E'], ['E', 'D'], ['D', 'C'], ['C', 'A']]) out[`${clave}_${a}${b}`] = hacer([a, b], `${tecnica} por la pentatónica · enlace forma ${nombreForma(a)} ↔ forma ${nombreForma(b)}`);
  out[`${clave}_todas`] = hacer(['G', 'E', 'D', 'C', 'A'], `${tecnica} por las 5 formas de la pentatónica (G E D C A)`);
  return out;
}

module.exports = {
  // ── INICIAL ──────────────────────────────────────────────────────────────────────────────────────────────────
  // Trinos: dos dedos alternando con martillo y tirón sin volver a atacar; las 6 parejas de dedos en cada cuerda.
  // 11-11 (Alberto): por todas las cuerdas, bajando de la 6ª a la 1ª en un tempo y subiendo de la 1ª a la 6ª en el
  // siguiente (P.vueltas), en lugar de quedarse en la 3ª.
  trinos: (() => {
    const cuerda = str => [[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]].flatMap(([a, b]) => [0, 1, 2, 3, 4, 5, 6, 7].map(k => n(str, 4 + (k % 2 ? b : a), S, { fg: k % 2 ? b : a, ...(k ? { lig: k % 2 ? 'H' : 'P' } : {}) })));
    const baja = [6, 5, 4, 3, 2, 1].flatMap(cuerda), sube = [1, 2, 3, 4, 5, 6].flatMap(cuerda);
    return base('Inicial', 'Trinos con las 6 parejas de dedos, cuerda a cuerda', { rootPc: -1, rotulo: 'Ataca solo la 1ª nota de cada pareja: el resto, martillo y tirón',
      items: baja, vueltas: [baja, sube] });
  })(),
  // Púa alterna: cuatro golpes por traste (abajo-arriba), dedos 1-2-3-4 y vuelta, en cada cuerda.
  // 11-11 (Alberto): por todas las cuerdas, bajando 6→1 en un tempo y subiendo 1→6 en el siguiente.
  puaUnaCuerda: (() => {
    const cuerda = str => [1, 2, 3, 4, 4, 3, 2, 1].flatMap(fg => [0, 1, 2, 3].map(k => n(str, 4 + fg, S, { fg, ...(k ? {} : { acc: true }) })));
    const baja = alterna([6, 5, 4, 3, 2, 1].flatMap(cuerda)), sube = alterna([1, 2, 3, 4, 5, 6].flatMap(cuerda));
    return base('Inicial', 'Púa alterna: 4 golpes por nota, cuerda a cuerda', { rootPc: -1, rowLabel: 'púa', rotulo: 'Abajo-arriba sin parar: la mano derecha no se detiene nunca',
      items: baja, vueltas: [baja, sube] });
  })(),
  // Ligados por la pentatónica: en cada cuerda se ataca la primera y la segunda entra de martillo; de bajada, tirón.
  // 11-11 (Alberto: "un vídeo por posición, uno que enlace dos posiciones…"; elegido lo más útil para el alumno): las 5
  // formas sueltas, las 5 parejas vecinas (el cambio de posición es lo difícil) y las 5 seguidas. Ver FORMAS / RUTA.
  ...ejerciciosPorFormas('ligadosPenta', 'Ligados', (s, f, fg, k, sube) => n(s, f, C, { fg, ...(k % 2 ? { lig: sube ? 'H' : 'P' } : {}) })),
  // Cambio de cuerda con púa alterna: dos notas por cuerda (abajo en la primera, arriba en la segunda) por la pentatónica.
  puaPenta: base('Inicial', 'Púa alterna por la pentatónica: dos notas por cuerda', { rowLabel: 'púa', rotulo: 'Fíjate en la púa al cambiar de cuerda: siempre abajo-arriba',
    items: alterna([...PENTA_E, ...[...PENTA_E].reverse()].map(([s, f, fg]) => n(s, f, C, { fg })).concat([R(4)])) }),
  // Bending afinado: primero la nota de llegada, luego el bending que tiene que sonar igual (tono y medio tono).
  bendAfinado: base('Inicial', 'Bending afinado: primero la nota, luego el bending', { rotulo: 'Escucha la nota de llegada y estira hasta que suene igual',
    items: [n(3, 9, 1, { fg: 3 }), n(3, 7, 1, { fg: 3, bend: 2 }), n(3, 9, 1, { fg: 3 }), n(3, 7, 1, { fg: 3, bend: 2, rel: true }),
      n(2, 10, 1, { fg: 3 }), n(2, 8, 1, { fg: 3, bend: 2 }), n(2, 10, 1, { fg: 3 }), n(2, 8, 1, { fg: 3, bend: 2, rel: true }),
      n(2, 9, 1, { fg: 4 }), n(2, 8, 1, { fg: 3, bend: 1 }), n(2, 9, 1, { fg: 4 }), n(2, 8, 1, { fg: 3, bend: 1, rel: true }),
      n(1, 8, 1, { fg: 4 }), n(1, 7, 1, { fg: 3, bend: 1 }), n(1, 8, 2, { fg: 4, vib: true })] }),

  // ── INTERMEDIO ───────────────────────────────────────────────────────────────────────────────────────────────
  // Salto de cuerda: la pentatónica de dos en dos saltándose una cuerda (6-4, 5-3, 4-2, 3-1) con púa alterna.
  saltoPenta: base('Intermedio', 'Salto de cuerda por la pentatónica (6-4, 5-3, 4-2, 3-1)', { rowLabel: 'púa', rotulo: 'Que no suene la cuerda que saltas: apágala con la mano derecha',
    items: alterna([[6, 4], [5, 3], [4, 2], [3, 1]].flatMap(([a, b]) => {
      const de = s => PENTA_E.filter(x => x[0] === s);
      return [...de(a), ...de(b)].map(([s, f, fg]) => n(s, f, C, { fg })); }).concat([R(0)]).filter(it => !(it.r && it.d === 0))) }),
  // Tres notas por cuerda ligadas: ataca una y liga dos (martillo subiendo, tirón bajando), en tresillos.
  ligados3nps: base('Intermedio', 'Ligados a tres notas por cuerda (A menor)', { rotulo: 'Una púa por cuerda: las otras dos notas, con la mano izquierda',
    items: [...TNPC.flatMap(([s, fs]) => fs.map((f, k) => n(s, f, T, { fg: DEDO3(fs)[k], ...(k ? { lig: 'H' } : {}) }))),
      ...[...TNPC].reverse().flatMap(([s, fs]) => [...fs].reverse().map((f, k) => n(s, f, T, { fg: [...DEDO3(fs)].reverse()[k], ...(k ? { lig: 'P' } : {}) }))), R(4)] }),
  // Púa alterna a tres notas por cuerda: el cambio de cuerda cae una vez abajo y otra arriba (lo difícil).
  pua3nps: base('Intermedio', 'Púa alterna a tres notas por cuerda (A menor)', { rowLabel: 'púa', rotulo: 'Con 3 notas por cuerda, cada cuerda empieza con una púa distinta',
    items: alterna([...TNPC.flatMap(([s, fs]) => fs.map((f, k) => n(s, f, S, { fg: DEDO3(fs)[k] }))),
      ...[...TNPC].reverse().flatMap(([s, fs]) => [...fs].reverse().map((f, k) => n(s, f, S, { fg: [...DEDO3(fs)].reverse()[k] }))), R(3)]) }),
  // Púa alterna con apagado: semicorcheas en la 6ª al aire con palm mute y acentos que cambian de sitio (rítmica rock).
  palmMute: base('Intermedio', 'Púa alterna con palm mute y acentos (6ª al aire)', { rootPc: -1, rowLabel: 'púa', rotulo: 'Mano derecha apoyada en el puente: el acento sale abriendo un poco',
    items: alterna([0, 1, 2, 3].flatMap(desp => [...Array(16)].map((_, k) => n(6, 0, S, { pm: true, ...((k % 4) === desp ? { acc: true } : {}) })))) }),
  // Independencia: dedos 1-3 en una cuerda y 2-4 en la siguiente, a la vez que se cruza (la "araña" de 4 dedos).
  independencia: base('Intermedio', 'Independencia de dedos: 1-3 y 2-4 en cuerdas vecinas', { rootPc: -1, rotulo: 'Deja cada dedo apoyado hasta que lo necesites',
    items: [[6, 5], [5, 4], [4, 3], [3, 2], [2, 1]].flatMap(([a, b]) => [n(a, 5, C, { fg: 1 }), n(b, 7, C, { fg: 3 }), n(a, 6, C, { fg: 2 }), n(b, 8, C, { fg: 4 }),
      n(b, 5, C, { fg: 1 }), n(a, 7, C, { fg: 3 }), n(b, 6, C, { fg: 2 }), n(a, 8, C, { fg: 4 })]).concat([R(4)]) }),

  // ── AVANZADO ─────────────────────────────────────────────────────────────────────────────────────────────────
  // Grupos de seis en la pentatónica, bajando (el clásico del rock): seis notas en dos cuerdas y se baja una cuerda.
  seisPenta: base('Avanzado', 'Grupos de seis bajando por la pentatónica (tresillos)', { rotulo: 'Pulsa el tresillo: el acento cae siempre en la 1ª de cada grupo de tres',
    items: [[1, 2, 3], [2, 3, 4], [3, 4, 5], [4, 5, 6]].flatMap(cs => cs.flatMap(s => PENTA_E.filter(x => x[0] === s).reverse()).map(([s, f, fg], k) => n(s, f, T, { fg, ...(k % 3 ? {} : { acc: true }) })))
      .concat([n(6, 5, 2, { fg: 1, vib: true }), R(2)]) }),
  // Tres notas por cuerda en semicorcheas con ligado en la cuerda que baja: legato "a la Satriani" (ataca 1 de cada 3).
  legatoRapido: base('Avanzado', 'Legato en semicorcheas: una púa por cuerda', { rotulo: 'Volumen igual en todas las notas: los ligados tienen que sonar como las atacadas',
    items: [...TNPC.flatMap(([s, fs]) => fs.map((f, k) => n(s, f, S, { fg: DEDO3(fs)[k], ...(k ? { lig: 'H' } : {}) }))),
      ...[...TNPC].reverse().flatMap(([s, fs]) => [...fs].reverse().map((f, k) => n(s, f, S, { fg: [...DEDO3(fs)].reverse()[k], ...(k ? { lig: 'P' } : {}) }))), R(3)] }),
  // Secuencia de cuatro en la escala (1234, 2345…) con púa alterna: velocidad con orden.
  cuatrosEscala: base('Avanzado', 'Grupos de cuatro por la escala con púa alterna', { rowLabel: 'púa', rotulo: 'Sube de cuatro en cuatro: 1-2-3-4, 2-3-4-5, 3-4-5-6…',
    items: (() => { const L = TNPC.flatMap(([s, fs]) => fs.map((f, k) => ({ s, f, fg: DEDO3(fs)[k] })));
      const out = []; for (let i = 0; i + 3 < L.length; i++) for (let k = 0; k < 4; k++) out.push(n(L[i + k].s, L[i + k].f, S, { fg: L[i + k].fg, ...(k ? {} : { acc: true }) }));
      return alterna(out.concat([n(1, 10, 1, { fg: 4, vib: true })])); })() }),
};
