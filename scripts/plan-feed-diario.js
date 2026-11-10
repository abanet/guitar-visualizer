#!/usr/bin/env node
/**
 * plan-feed-diario.js — reparte la casilla del feed a DOS vídeos por día entre todos los planes de catalogación.
 *
 * Por qué (11-10, Alberto): "el feed diario dos al día, uno a las 17:00 y otro a la hora que veas oportuna". Con las
 * series grandes salían 4-5 vídeos al feed cada día (uno por bloque de cada plan) y se saturaba a los suscriptores.
 * Segunda franja: 00:00 UTC (tarde de América; la audiencia orgánica es España + LatAm, ver memoria feed-un-video-diario).
 *
 * Reglas, en este orden:
 *  1. Candidatos de un día: el primer vídeo de cada lista de serie ese día (las "Ejercicios en X" son listas por
 *     tonalidad, no de serie: no cuentan). Así el elegido siempre es la cabeza de su bloque (la Forma C, el fijo…).
 *  2. Prioridad a las listas que aún no han salido nunca en el feed ("las listas nuevas que todavía no se conozcan").
 *  3. Después, la lista que lleva más días sin feed (rotación) y, a igualdad, la que ya tenía feed:true en el plan.
 *  4. Los dos primeros según 2-3 (sin forzar planes distintos: forzarlo daba la 2ª franja a la misma lista 7 días seguidos). El 1º sale a las 17:00 UTC del día y el
 *     2º a las 00:00 UTC del día siguiente (es la noche del mismo día en América).
 * El resto de vídeos conserva su hora y queda con feed:false.
 *
 * Uso: node scripts/plan-feed-diario.js [--desde 2026-11-11] [--aplicar]
 *   Sin --aplicar solo escribe el informe (scripts/.feed-diario.json + resumen en pantalla).
 *   Con --aplicar reescribe feed y publishAtUTC en los planes. Los vídeos YA catalogados no cambian por esto: su hora
 *   se mueve con la API y la casilla en Studio (el informe marca cuáles son, campo "catalogado").
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const DESDE = opt('desde', '2026-11-11');
const APLICAR = !!opt('aplicar', false);
const PLANES = ['patrones-nuevos', 'arpegios-sueltos', 'cambios-arpegio'];
const esSerie = (l) => l && !/^Ejercicios en /.test(l) && !/\(arriba\)$/.test(l);
const sumaDia = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

const planes = {}, hechos = {};
for (const f of PLANES) {
  planes[f] = JSON.parse(fs.readFileSync(path.join(__dirname, `.catalog-${f}-plan.json`), 'utf8'));
  const h = path.join(__dirname, `.catalog-${f}-plan.hechos.json`);
  hechos[f] = fs.existsSync(h) ? JSON.parse(fs.readFileSync(h, 'utf8')) : {};
}
// Los 100 I7-IV7 del 11-04 se catalogaron por Studio y no están en .hechos (memoria sesion-2026-11-08): fechas 11-11 → 11-17.
const catalogado = (f, e) => !!hechos[f][e.stem + (e.serie ? '|' + e.serie : '')] || (f === 'cambios-arpegio' && e.publishAtUTC < '2026-11-17T23:59');

// Candidatos por día: la primera entrada (orden del plan) de cada lista de serie.
const porDia = new Map();
for (const f of PLANES) planes[f].forEach((e, i) => {
  if (!e.publishAtUTC) return;
  const dia = e.publishAtUTC.slice(0, 10);
  if (dia < DESDE) return;
  const l = (e.listas || []).find(esSerie);
  if (!l) return;
  const m = porDia.get(dia) || new Map(); porDia.set(dia, m);
  if (!m.has(l)) m.set(l, { f, i, e, lista: l });
});

const ultimaVez = new Map();   // lista → último día con feed
const elegidos = [];
for (const dia of [...porDia.keys()].sort()) {
  const cands = [...porDia.get(dia).values()];
  const clave = (c) => [ultimaVez.has(c.lista) ? 1 : 0, ultimaVez.get(c.lista) || '', c.e.feed ? 0 : 1];
  cands.sort((a, b) => { const x = clave(a), y = clave(b); for (let k = 0; k < x.length; k++) if (x[k] !== y[k]) return x[k] < y[k] ? -1 : 1; return 0; });
  const uno = cands[0];
  const dos = cands[1];
  [[uno, dia + 'T17:00:00.000Z'], [dos, sumaDia(dia, 1) + 'T00:00:00.000Z']].forEach(([c, at]) => {
    if (!c) return;
    const nuevaLista = !ultimaVez.has(c.lista);
    ultimaVez.set(c.lista, dia);
    elegidos.push({ dia, at, plan: c.f, stem: c.e.stem, serie: c.e.serie, lista: c.lista, antes: c.e.publishAtUTC, catalogado: catalogado(c.f, c.e), nuevaLista });
  });
}

fs.writeFileSync(path.join(__dirname, '.feed-diario.json'), JSON.stringify(elegidos, null, 1));
for (const x of elegidos) console.log(`${x.dia} ${x.at.slice(11, 16)} ${x.catalogado ? 'CAT' : '   '} ${x.plan.padEnd(16)} ${x.stem}${x.serie && x.serie !== 'fijo' ? '_' + x.serie : ''}  [${x.lista}]`);
const listasSinFeed = new Set();
for (const m of porDia.values()) for (const l of m.keys()) if (!ultimaVez.has(l)) listasSinFeed.add(l);
console.log(`\n${elegidos.length} vídeos con feed en ${porDia.size} días; ${elegidos.filter((x) => x.catalogado).length} ya catalogados (hora por API + casilla en Studio).`);
if (listasSinFeed.size) console.log('Listas que se quedan sin ningún feed:', [...listasSinFeed].join(' · '));

if (APLICAR) {
  const sel = new Map(elegidos.map((x) => [x.plan + '#' + x.stem + '#' + (x.serie || ''), x]));
  for (const f of PLANES) {
    for (const e of planes[f]) {
      if (!e.publishAtUTC || e.publishAtUTC.slice(0, 10) < DESDE) continue;
      const x = sel.get(f + '#' + e.stem + '#' + (e.serie || ''));
      e.feed = !!x;
      if (x) e.publishAtUTC = x.at;
    }
    fs.writeFileSync(path.join(__dirname, `.catalog-${f}-plan.json`), JSON.stringify(planes[f], null, 1));
  }
  console.log('Planes reescritos.');
}
