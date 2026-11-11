#!/usr/bin/env node
/*
 * backing-visualizer.js — formato "base para improvisar" (11-11).
 *
 * Por qué (Alberto, 11-11): "un formato nuevo para presentar los vídeos de los backings: que se sepa en cada momento
 * dónde están los acordes, que se vea la escala principal del tema con sus grados y triadas… y la estructura del tema
 * en su conjunto". Decisiones de esa conversación:
 *   - Mapa del tema entero arriba (bloques proporcionales a los compases, mismo color cada vez que vuelve la sección)
 *     y debajo la rejilla de la sección que suena, que pasa de página si no cabe.
 *   - Acorde actual grande con su grado; anterior atenuado; siguiente con cuenta atrás en pulsos.
 *   - Escala con grados y las notas del acorde encendidas; NOTAS GUÍA hacia el siguiente acorde (qué se queda y
 *     qué se mueve) en los dos últimos pulsos antes del cambio.
 *   - Escala recomendada por acorde: los acordes de fuera de la escala cambian la fila (F mayor en Do menor → Do
 *     dórico con A natural; G mayor → menor armónica con B natural) y la nota nueva se marca en violeta.
 *   - Triadas diatónicas coloreadas por función (tónica / subdominante / dominante) + los de fuera, aparte.
 *   - Pulso visible (cuatro puntos, el 1 en rojo). Sin mástil (Alberto: "va a enfollonar demasiado").
 *   - Sin letra ni melodía del tema original: solo acordes y estructura, sobre una base propia de BiaB.
 *
 * Uso: node scripts/backing-visualizer.js <tema.json> [--desde 67 --compases 10] [--out <dir>]
 *   Con --desde/--compases sale un clip (sin cuenta de entrada); sin ellos, el tema entero con su entrada.
 * Por ahora solo tonalidades menores con la menor natural como escala base (lo que pide el primer tema).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const T = JSON.parse(fs.readFileSync(args[0], 'utf8'));
const DESDE = Number(opt('desde', 0)), NCLIP = Number(opt('compases', 0));
const OUT = path.resolve(String(opt('out', path.join(os.homedir(), 'Downloads', 'Backings', T.titulo.replace(/\W+/g, '')))).replace(/^~/, os.homedir()));

// ── Armonía ─────────────────────────────────────────────────────────────────────────────────────────────────
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NOM = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const bonito = s => s.replace(/([A-G])b/g, '$1♭').replace(/([A-G])#/g, '$1♯');
const tonica = PC[T.tonalidad[0]] + (T.tonalidad[1] === 'b' ? -1 : T.tonalidad[1] === '#' ? 1 : 0);
const MENOR = [0, 2, 3, 5, 7, 8, 10], GRADOS = ['1', '2', '♭3', '4', '5', '♭6', '♭7'];
const ROMANOS = ['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII'], FUNCION = ['T', 'S', 'T', 'S', 'D', 'T', 'D'];
const parse = c => { const m = c.match(/^([A-G])([b#]?)(.*)$/); const r = (PC[m[1]] + (m[2] === 'b' ? -1 : m[2] === '#' ? 1 : 0) + 12) % 12;
  const q = m[3]; const tri = /^m(?!aj)/.test(q) ? [0, 3, 7] : /dim|°/.test(q) ? [0, 3, 6] : [0, 4, 7];
  const sep = /7/.test(q) ? (/maj7/.test(q) ? [11] : [10]) : [];
  return { raiz: r, menor: tri[1] === 3, tonos: [...tri, ...sep].map(i => (r + i) % 12), q }; };
// Grado, función y escala recomendada de cada acorde respecto a la tonalidad menor.
function analiza(c) {
  const a = parse(c), rel = (a.raiz - tonica + 12) % 12, idx = MENOR.indexOf(rel);
  const diat = idx >= 0 && a.tonos.slice(0, 3).every(t => MENOR.includes((t - tonica + 12) % 12));
  if (diat) { const sep = /7/.test(a.q) ? '7' : ''; return { ...a, grado: ROMANOS[idx] + sep, f: FUNCION[idx], fuera: false, escala: null }; }
  // Los préstamos de este primer tema (Alberto no domina los modos: solo los dos casos sin ambigüedad).
  if (rel === 5 && !a.menor) return { ...a, grado: 'IV', f: 'S', fuera: true, escala: { nombre: 'Do dórico', cambia: 8, por: 9, marca: '6ª ♮', motivo: 'A natural en lugar de A♭' } };
  if (rel === 7 && !a.menor) return { ...a, grado: 'V', f: 'D', fuera: true, escala: { nombre: 'Do menor armónica', cambia: 10, por: 11, marca: '7ª ♮', motivo: 'B natural en lugar de B♭ (la sensible)' } };
  return { ...a, grado: '?', f: 'X', fuera: true, escala: null };
}
// Nodos del mapa de funciones: solo los acordes que tiene el tema (Fm y Fm7 son el mismo nodo iv), en el orden de
// la escala dentro de cada función; los de fuera, detrás.
const idDe = c => analiza(c).grado.replace('7', '').replace(/[^\w]/g, s => ({ '♭': 'b', '°': 'o' }[s] || ''));
const NODOS = (() => { const vistos = new Map();
  for (const c of new Set(T.compases.flat())) { const z = analiza(c), id = idDe(c); if (!vistos.has(id)) vistos.set(id, { id, r: z.grado.replace('7', ''), c: NOM[z.raiz] + (z.menor ? 'm' : '') + (z.escala ? ' · ' + (z.escala.por === 9 ? 'dórico' : 'armónica') : ''), f: z.f === 'X' ? 'T' : z.f, fuera: z.fuera, orden: z.fuera ? 20 : (z.raiz - tonica + 12) % 12 }); }
  return [...vistos.values()].sort((a, b) => a.orden - b.orden); })();
const COLOR = { T: 'var(--ton)', S: 'var(--sub)', D: 'var(--dom)', X: 'var(--fuera)' };
const COLOR_SEC = { A: '#5b8def', B: '#3fb8af', S: '#d9a441', C: '#c46bd6', '': '#6b7684' };

// ── Línea de tiempo en medios compases ──────────────────────────────────────────────────────────────────────
const medios = T.compases.flat();
const total = T.compases.length, bpm = T.bpm, corchea = 60 / bpm / 2;
const seccionDe = b => T.secciones.find(s => b >= s.desde && b <= s.hasta);
const cambioTras = m => { for (let k = m + 1; k < medios.length; k++) if (medios[k] !== medios[m]) return k; return -1; };
const anteriorA = m => { for (let k = m - 1; k >= 0; k--) if (medios[k] !== medios[m]) return medios[k]; return null; };

function estado(b, corch) {   // b: compás 1..total, corch: 0..7
  const pulso = Math.floor(corch / 2), m = (b - 1) * 2 + (pulso < 2 ? 0 : 1);
  const ac = medios[m], A = analiza(ac), sig = cambioTras(m);
  const pulsosHasta = sig < 0 ? Infinity : (sig - m) * 2 - (pulso % 2) - corch % 2 / 2;
  const S = analiza(sig < 0 ? ac : medios[sig]);
  const cerca = pulsosHasta <= 2;
  const sec = seccionDe(b), iSec = T.secciones.indexOf(sec), sigSec = T.secciones[iSec + 1];
  const fracBar = (corch + 0.5) / 8, pos = (b - 1 + fracBar) / total;
  // Mapa
  const mapa = T.secciones.map((s, i) => ({ nombre: s.nombre, compases: s.hasta - s.desde + 1, color: COLOR_SEC[s.letra],
    estado: i === iSec ? 'act' : i < iSec ? 'pasado' : '', lleno: i < iSec ? 1 : i === iSec ? (b - s.desde + fracBar) / (s.hasta - s.desde + 1) : 0 }));
  // Rejilla de la sección, por páginas de 12 compases.
  const n = sec.hasta - sec.desde + 1, pags = Math.ceil(n / 12), pag = Math.floor((b - sec.desde) / 12);
  const desdeP = sec.desde + pag * 12, hastaP = Math.min(sec.hasta, desdeP + 11);
  const rejilla = [];
  for (let k = desdeP; k <= hastaP; k++) {
    const [x, y] = T.compases[k - 1];
    // Medio compás que suena (m) y el del siguiente acorde (sig); con un solo acorde en el compás, cuenta el compás entero.
    const mitades = x === y ? [[x, [0, 1]]] : [[x, [0]], [y, [1]]];
    rejilla.push({ n: k, estado: k === b ? 'act' : k < b ? 'pasado' : '', cab: k === b ? fracBar : undefined,
      acordes: mitades.map(([c, hs]) => { const ms = hs.map(h => (k - 1) * 2 + h), z = analiza(c);
        return { nombre: bonito(c), grado: z.grado, color: COLOR[z.f], on: ms.includes(m), sig: cerca && sig >= 0 && ms.includes(sig) && !ms.includes(m) }; }) });
  }
  // Escala para el acorde que suena (con la nota cambiada si es un préstamo).
  const esc = MENOR.map(i => (tonica + i) % 12);
  let escalaTit = `Escala: <b>Do menor natural</b>`, nueva = -1;
  if (A.escala) { const j = esc.indexOf((tonica + A.escala.cambia) % 12); esc[j] = (tonica + A.escala.por) % 12; nueva = j; escalaTit = `Escala para ${bonito(ac)}: <b>${A.escala.nombre}</b> · <em>${A.escala.motivo}</em>`; }
  const papel = t => { const i = A.tonos.indexOf(t); return i === 0 ? 'R' : i === 1 ? '3' : i === 2 ? '5' : i === 3 ? '7' : ''; };
  const proximos = cerca && sig >= 0 ? S.tonos : [];
  const escala = esc.map((pc, j) => ({ l: NOM[pc], g: j === nueva ? (A.escala.por === 9 ? '6' : '7') : GRADOS[j], ton: pc === tonica, on: A.tonos.includes(pc), color: COLOR[A.f],
    marca: A.tonos.includes(pc) ? papel(pc) : j === nueva ? A.escala.marca : '', nueva: j === nueva, viene: proximos.includes(pc) && !A.tonos.includes(pc) }));
  // Notas guía hacia el siguiente acorde: comunes y movimientos al tono más cercano.
  let guia = '';
  if (cerca && sig >= 0) {
    const queda = A.tonos.filter(t => S.tonos.includes(t)).map(t => NOM[t]);
    const mueve = A.tonos.filter(t => !S.tonos.includes(t)).map(t => { let best = null; for (const u of S.tonos) { const d = ((u - t + 18) % 12) - 6; if (!best || Math.abs(d) < Math.abs(best.d)) best = { u, d }; } return `${NOM[t]} → ${NOM[best.u]}`; });
    guia = `Notas guía hacia <b>${bonito(medios[sig])}</b>: ${queda.length ? queda.join(', ') + ' se ' + (queda.length > 1 ? 'quedan' : 'queda') : 'ninguna común'}${mueve.length ? ' · ' + mueve.join(' · ') : ''}`;
  }
  // Triadas: las diatónicas y los acordes de fuera que tenga el tema.
  const fueraTema = [...new Set(medios)].map(analiza).filter(x => x.fuera);
  const triadas = MENOR.map((i, j) => { const r = (tonica + i) % 12, tri = [0, 2, 4].map(k => MENOR[(j + k) % 7]); const q = (tri[1] - tri[0] + 12) % 12 === 3 ? ((tri[2] - tri[0] + 12) % 12 === 6 ? 'dim' : 'm') : '';
    return { r: ROMANOS[j], c: NOM[r] + q, f: FUNCION[j], on: !A.fuera && A.raiz === r, fuera: false }; })
    .concat(fueraTema.filter((x, i, a) => a.findIndex(y => y.grado === x.grado) === i).map(x => ({ r: x.grado, c: NOM[x.raiz] + (x.menor ? 'm' : ''), f: x.f, on: A.fuera && A.raiz === x.raiz, fuera: true })));
  const restan = sec.hasta - b + 1;
  return {
    titulo: T.titulo, subtitulo: T.subtitulo, tonalidadNombre: 'Do menor', bpm, compas: b, total, pulso,
    mapa, cabezalMapa: pos, seccion: sec,
    secSig: sigSec ? { texto: restan <= 2 ? `${sigSec.nombre} en ${restan} ${restan === 1 ? 'compás' : 'compases'}` : `luego: ${sigSec.nombre}`, cerca: restan <= 2 } : { texto: 'último tramo', cerca: false },
    rejilla, pagina: pags > 1 ? `página ${pag + 1} de ${pags}` : '',
    anterior: anteriorA(m) ? bonito(anteriorA(m)) : '',
    actual: { nombre: bonito(ac), grado: A.grado, color: COLOR[A.f] },
    siguiente: sig < 0 ? null : { nombre: bonito(medios[sig]), grado: S.grado, color: COLOR[S.f], cerca, cuenta: `en ${Math.max(1, Math.round(pulsosHasta))} ${Math.round(pulsosHasta) === 1 ? 'pulso' : 'pulsos'}` },
    funciones: ['T', 'S', 'D'].map(f => ({ f, nodos: NODOS.filter(x => x.f === f).map(x => ({ ...x, estado: x.id === idDe(ac) ? 'on' : sig >= 0 && cerca && x.id === idDe(medios[sig]) ? 'sig' : anteriorA(m) && x.id === idDe(anteriorA(m)) ? 'prev' : '' })) })),
    flecha: anteriorA(m) ? [idDe(anteriorA(m)), idDe(ac)] : null,
    escalaTit, escala, guia, triadas, prestamo: A.escala ? `Escala: ${A.escala.nombre} · ${A.escala.motivo}` : sec.letra === 'S' ? 'Para improvisar: Do menor natural · o la pentatónica de Do menor' : '',
  };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-backing-'));
  const b0 = DESDE || 1, b1 = NCLIP ? Math.min(total, b0 + NCLIP - 1) : total;
  const pasos = [];
  if (!NCLIP) for (let k = 0; k < T.compasesEntrada * 8; k++) {   // cuenta de entrada: el primer acorde ya visible
    const e = estado(1, 0); const quedan = T.compasesEntrada * 4 - Math.floor(k / 2);
    e.entrada = quedan <= 4 ? String(quedan) : ''; e.pulso = Math.floor(k / 2) % 4; e.compas = 1; pasos.push(e);
  }
  for (let b = b0; b <= b1; b++) for (let c = 0; c < 8; c++) pasos.push(estado(b, c));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto('file://' + path.join(__dirname, 'lib', 'backing-frame.html'));
  const cache = new Map(); let n = 0;
  for (const e of pasos) {
    const sig = JSON.stringify(e);
    if (!cache.has(sig)) { await page.evaluate(d => render(d), e); const f = path.join(tmp, `f${String(n++).padStart(5, '0')}.png`); await page.screenshot({ path: f }); cache.set(sig, f); }
    e.png = cache.get(sig);
  }
  await browser.close();
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, pasos.map(e => `file '${e.png}'\nduration ${corchea.toFixed(5)}`).join('\n') + `\nfile '${pasos[pasos.length - 1].png}'\n`);
  const t0 = NCLIP ? (T.compasesEntrada + b0 - 1) * 8 * corchea : 0, dur = pasos.length * corchea;
  const nombre = NCLIP ? `${T.titulo.replace(/\W+/g, '')}_prueba_c${b0}-${b1}.mp4` : `${T.titulo.replace(/\W+/g, '')}_base_${T.tonalidad}_${bpm}bpm.mp4`;
  const out = path.join(OUT, nombre);
  execFileSync('nice', ['-n', '19', 'ffmpeg', '-loglevel', 'error', '-y', '-threads', '2', '-f', 'concat', '-safe', '0', '-i', list, '-ss', t0.toFixed(3), '-t', dur.toFixed(3), '-i', T.audio,
    '-map', '0:v', '-map', '1:a', '-vf', 'fps=25,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`✓ ${out} (${dur.toFixed(1)} s, ${pasos.length} pasos, ${n} fotogramas distintos)`);
})().catch(e => { console.error(e); process.exitCode = 1; });
