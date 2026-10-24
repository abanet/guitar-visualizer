#!/usr/bin/env node
/*
 * Verificación de "Drop 2 por ciclos (Goodrick)" — jsdom, sin navegador.
 *  1. Syntax check de TODOS los <script> de guitarvisualizer.html.
 *  2. generateDrop2Cycle sobre el ciclo 4 de Re mayor (8 compases): en cada cambio exactamente 2 notas
 *     comunes (misma cuerda/traste) y 2 voces que bajan 1-2 semitonos al grado inferior de la escala;
 *     todo en cuerdas 4-3-2-1, abertura ≤ 4, 4 notas por frame (tras svgStringToParsed), notas del
 *     acorde correcto. Imprime la tabla para comprobarla con la guitarra.
 *  2b. Los 6 ciclos (v4.5.0) en Re mayor (las menores, en su fase): notas comunes y
 *     sentido de cada ciclo, 4 notas del acorde, y que el modo 'auto' da lo mismo que el ciclo fijo
 *     (y que en cada cambio solo UN sentido da las 4 notas: la deducción automática es inequívoca).
 *  3. Flujo completo con el XML real (--xml, por defecto ~/Downloads/BossaCuartasD.XML si existe):
 *     loadXML → autoGenerateTriads con el bloque activado; reinicio en cada vuelta y compases vacíos.
 *  4. Regresión: autoGenerateTriads en modo voice leading libre da EXACTAMENTE los mismos SVG que la
 *     versión de master (git show master:guitarvisualizer.html), con el fixture y con el XML real.
 *
 * Uso: node tools/test-drop2-cycle.js [--xml <ruta.XML>] [--base <ref git>]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const args = {};
for (let i = 2; i < process.argv.length; i++) if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[++i];
const HTML = fs.readFileSync(path.join(ROOT, 'guitarvisualizer.html'), 'utf8');
// La base de prueba se movió de Descargas a la carpeta de assets (10-14); se busca en los dos sitios.
const defXml = [path.join(os.homedir(), 'guitar-visualizer-assets', 'pruebaGoodrick', 'BossaCuartasD.XML'),
  path.join(os.homedir(), 'Downloads', 'BossaCuartasD.XML')].find((f) => fs.existsSync(f));
const XML_PATH = args.xml || defXml || null;
const FIXTURE = path.join(ROOT, 'tools/test-fixtures/test-progression.musicxml');

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗ ' + msg); } };

// ── 1. Syntax check ────────────────────────────────────────────────────────────────────────────
console.log('1. Syntax check de los <script>');
{
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g; let m, n = 0;
  while ((m = re.exec(HTML))) {
    if (m[1] && /\ssrc=/.test(m[1])) continue;
    n++;
    try { new vm.Script(m[2], { filename: 'script#' + n }); } catch (e) { ok(false, `script #${n}: ${e.message}`); }
  }
  console.log(`  ${n} scripts revisados`);
}

function makeApp(html) {
  const vc = new VirtualConsole(); const errs = [];
  vc.on('jsdomError', (e) => errs.push(String(e.message || e)));
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', virtualConsole: vc, pretendToBeVisual: true,
    beforeParse(w) { w.alert = (s) => { w.__alerts.push(String(s)); }; w.__alerts = []; w.confirm = () => true; } });
  return { w: dom.window, errs };
}
const settle = (ms) => new Promise((r) => setTimeout(r, ms));
async function loadXmlInto(w, xmlText) {
  const file = new w.File([xmlText], 'tema.xml', { type: 'text/xml' });
  w.loadXML({ files: [file] });
  for (let i = 0; i < 50 && !w.eval('cycles.length'); i++) await settle(100);
  await settle(200);
}
const svgsOf = (w) => w.eval('getAllBars()').map((b) => (b.imgs || []).map((s) => (s && s.data) || null));

(async () => {
  const { w, errs } = makeApp(HTML);
  await settle(800);
  ok(!errs.length, 'errores al cargar la app en jsdom: ' + errs.slice(0, 3).join(' | '));

  // ── 2. Ciclo 4 en Re mayor ───────────────────────────────────────────────────────────────────
  console.log('\n2. Ciclo 4 en Re mayor, cuerdas 4-3-2-1 (arranque automático, traste de referencia 7)');
  const prog = ['DMaj7', 'GMaj7', 'C#m7b5', 'F#m7', 'Bm7', 'Em7', 'A7', 'DMaj7'];
  const res = w.generateDrop2Cycle(prog, { refFret: 7 });
  const SCALE = [2, 4, 6, 7, 9, 11, 1]; // Re mayor
  const NN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const INV = ['Fund.', '1ª inv', '2ª inv', '3ª inv'];
  console.log('  Arranque: ' + res.startDesc);
  console.log('  comp  acorde   cuerda: 4   3   2   1   notas            grados        inversión  cambio');
  res.out.forEach((e, i) => {
    ok(!!e, `compás ${i + 1}: sin voicing`);
    if (!e) return;
    const fr = e.voicing.frets.map((f) => String(f).padStart(3)).join(' ');
    const change = i === 0 ? 'inicio' : `comunes ${e.common.map((k) => 4 - k).join(',')} · bajan ${e.moved.map((k) => 4 - k).join(',')}`;
    console.log(`  ${String(i + 1).padStart(4)}  ${e.chord.padEnd(7)}        ${fr}   ${e.voicing.notes.join('-').padEnd(16)} ${e.voicing.intervals.join('-').padEnd(13)} ${INV[e.inv].padEnd(10)} ${change}`);
    // 4 notas, cuerdas 4-1, abertura ≤ 4, notas del acorde
    ok(e.voicing.frets.length === 4, `compás ${i + 1}: ${e.voicing.frets.length} notas`);
    ok(JSON.stringify(e.voicing.strings) === '[2,3,4,5]', `compás ${i + 1}: cuerdas ${e.voicing.strings}`);
    const span = Math.max(...e.voicing.frets) - Math.min(...e.voicing.frets);
    ok(span <= 4, `compás ${i + 1}: abertura ${span}`);
    ok(Math.min(...e.voicing.frets) >= 3, `compás ${i + 1}: traste mínimo ${Math.min(...e.voicing.frets)} < 3`);
    const tones = w.drop2ChordTones(e.chord).map((t) => t.pc);
    ok(e.midi.every((m) => tones.includes(m % 12)) && new Set(e.midi.map((m) => m % 12)).size === 4, `compás ${i + 1}: notas fuera de ${e.chord} o repetidas`);
    // tras el viaje SVG → parsed (lo que reproduce el visualizador): 4 notas en las mismas celdas
    const svg = w.generateNeckSVG(e.voicing, e.chord, 0, 15);
    const parsed = w.svgStringToParsed(svg);
    ok(parsed.notes.length === 4, `compás ${i + 1}: el frame parseado tiene ${parsed.notes.length} notas`);
    const cells = parsed.notes.map((n) => n.string + ':' + n.fret).sort().join();
    const want = e.voicing.strings.map((s, k) => s + ':' + e.voicing.frets[k]).sort().join();
    ok(cells === want, `compás ${i + 1}: celdas parseadas ${cells} ≠ ${want}`);
    ok(parsed.notes.filter((n) => n.isRoot).length === 1, `compás ${i + 1}: debe haber exactamente una tónica roja`);
    if (i === 0) return;
    const p = res.out[i - 1];
    let common = 0, down = 0;
    for (let k = 0; k < 4; k++) {
      const d = e.midi[k] - p.midi[k];
      if (d === 0) { common++; ok(e.voicing.frets[k] === p.voicing.frets[k], `compás ${i + 1}: nota común cambia de traste`); continue; }
      ok(d === -1 || d === -2, `compás ${i + 1}: la voz de la cuerda ${4 - k} se mueve ${d} semitonos`);
      const di = SCALE.indexOf(p.midi[k] % 12), dj = SCALE.indexOf(e.midi[k] % 12);
      ok(di >= 0 && dj === (di + 6) % 7, `compás ${i + 1}: la voz de la cuerda ${4 - k} no baja un grado de la escala (${NN[p.midi[k] % 12]}→${NN[e.midi[k] % 12]})`);
      down++;
    }
    ok(common === 2 && down === 2, `compás ${i + 1}: ${common} comunes / ${down} que bajan (deben ser 2/2)`);
  });
  ok(!res.warnings.length, 'avisos inesperados: ' + res.warnings.join(' | '));
  // Señales de bajada: cada frame marca (data-move) las 2 voces que bajarán en el PRÓXIMO cambio,
  // con los semitonos reales; el último no marca nada. Deben llegar al frame parseado (note.move).
  res.out.forEach((e, i) => {
    const marks = e.voicing.moves.map((d, k) => [d, k]).filter(([d]) => d != null);
    const n = res.out[i + 1];
    if (!n) { ok(!marks.length, `compás ${i + 1}: el último no debe llevar señales`); return; }
    ok(marks.length === 2, `compás ${i + 1}: ${marks.length} señales de bajada (deben ser 2)`);
    marks.forEach(([d, k]) => ok(d === n.midi[k] - e.midi[k] && d < 0, `compás ${i + 1}: señal de la cuerda ${4 - k} = ${d}`));
    const parsed = w.svgStringToParsed(w.generateNeckSVG(e.voicing, e.chord, 0, 15));
    ok(parsed.notes.filter((x) => Number.isFinite(x.move)).length === marks.length, `compás ${i + 1}: las señales no llegan al frame parseado`);
  });
  console.log('  señales de bajada: ' + res.out.map((e) => (e.nextMoves || []).map((x) => 'c' + x.string + x.d).join(',') || '—').join(' | '));

  // Inversión inicial elegida a mano: cada una debe arrancar en esa inversión
  for (let inv = 0; inv < 4; inv++) {
    const r = w.generateDrop2Cycle(prog, { startInv: inv, refFret: 7 });
    ok(r.out[0] && r.out[0].inv === inv, `inversión inicial ${inv}: arranca en ${r.out[0] && r.out[0].inv}`);
    console.log(`  inversión inicial ${INV[inv]}: ${r.startDesc}${r.warnings.length ? '  [' + r.warnings.length + ' aviso(s): ' + r.warnings[0] + ']' : ''}`);
  }
  // Otra tonalidad (Bb mayor) con la misma regla
  {
    const r = w.generateDrop2Cycle(['Bbmaj7', 'Ebmaj7', 'Am7b5', 'Dm7', 'Gm7', 'Cm7', 'F7', 'Bbmaj7'], { refFret: 7 });
    let good = r.out.every((e) => e);
    for (let i = 1; i < r.out.length && good; i++) { const c = r.out[i].midi.filter((m, k) => m === r.out[i - 1].midi[k]).length; if (c !== 2 && !r.out[i].jumped) good = false; }
    ok(good, 'Bb mayor: la regla 2 comunes / 2 bajan no se cumple');
    console.log('  Bb mayor: ' + r.startDesc + ' → ' + r.out.map((e) => e.voicing.frets.join('-')).join(' | '));
  }
  // Protección: arranque bajo (7ª en el bajo, referencia traste 3) → sube una octava y avisa
  {
    const r = w.generateDrop2Cycle(prog, { startInv: 0, refFret: 2, minFret: 3 });
    console.log('  Protección (fundamental, referencia traste 2): ' + r.out.map((e) => e.voicing.frets.join('-') + (e.jumped ? '⤴' : '')).join(' | '));
    r.out.forEach((e, i) => ok(Math.min(...e.voicing.frets) >= 3 || e.restart, `protección: compás ${i + 1} por debajo del traste 3`));
  }

  // ── 2b. Los 6 ciclos en las 3 escalas ───────────────────────────────────────────────────────
  console.log('\n2b. Los 6 ciclos (cuerdas 4-3-2-1) en Re mayor');
  {
    const NAMES = { '0,4,7,11': ['Maj7'], '0,3,7,10': ['m7'], '0,4,7,10': ['7'], '0,3,6,10': ['m7b5'], '0,3,7,11': ['mMaj7', 'm(maj7)', 'mM7'],
      '0,4,8,11': ['Maj7#5', 'maj7#5', '+Maj7', 'Maj7+5'], '0,3,6,9': ['dim7', 'o7', '°7'] };
    const LET = ['D', 'E', 'F', 'G', 'A', 'B', 'C'];
    // Las menores (melódica: D E F G A B C#; armónica: D E F G A Bb C#) quedan para su fase: la app
    // todavía no reconoce el acorde menor con 7ª mayor (DmMaj7 cae a tríada menor en
    // resolveChordDefs) y hay que saber antes cómo lo escribe BiaB en el XML.
    const SCALES = { 'Re mayor': ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'] };
    const pcOf = (n) => (({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 })[n[0]] + (n.includes('#') ? 1 : n.includes('b') ? -1 : 0) + 12) % 12;
    const symOf = (sc, d) => {
      const pcs = [0, 2, 4, 6].map((k) => pcOf(sc[(d + k) % 7]));
      const key = pcs.map((x) => (x - pcs[0] + 12) % 12).join();
      for (const q of NAMES[key] || []) { const sym = sc[d] + q, t = w.drop2ChordTones(sym); if (t && t.map((x) => x.pc).sort().join() === pcs.slice().sort().join()) return sym; }
      return null;
    };
    for (const [sname, sc] of Object.entries(SCALES)) {
      const syms = [0, 1, 2, 3, 4, 5, 6].map((d) => symOf(sc, d));
      ok(syms.every(Boolean), `${sname}: algún acorde no se reconoce (${syms.join(' ')})`);
      if (!syms.every(Boolean)) continue;
      const line = [];
      for (const cyc of [2, 3, 4, 5, 6, 7]) {
        const prog = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => syms[(k * (cyc - 1)) % 7]);
        const res = w.generateDrop2Cycle(prog, { refFret: 7, cycle: cyc });
        const auto = w.generateDrop2Cycle(prog, { refFret: 7, cycle: 'auto' });
        ok(JSON.stringify(res.out.map((e) => e && e.midi)) === JSON.stringify(auto.out.map((e) => e && e.midi)), `${sname} ciclo ${cyc}: 'auto' da otra cosa que el ciclo fijo`);
        ok(JSON.stringify(auto.cyclesUsed) === JSON.stringify([cyc]), `${sname} ciclo ${cyc}: ciclos detectados ${auto.cyclesUsed}`);
        const dir = w.eval('DROP2_CYCLE_RULES')[cyc] === 'up' ? 1 : -1;
        let bad = 0;
        res.out.forEach((e, i) => {
          if (!e) { bad++; return; }
          const tones = w.drop2ChordTones(e.chord).map((t) => t.pc);
          if (!(e.midi.every((m) => tones.includes(m % 12)) && new Set(e.midi.map((m) => m % 12)).size === 4)) bad++;
          if (Math.max(...e.voicing.frets) - Math.min(...e.voicing.frets) > 4) bad++;
          if (i === 0 || e.jumped) return;
          const p = res.out[i - 1];
          let common = 0;
          for (let k = 0; k < 4; k++) {
            const d = e.midi[k] - p.midi[k];
            if (d === 0) { common++; continue; }
            if (!(d * dir >= 1 && d * dir <= 2)) bad++;
            const di = sc.map(pcOf).indexOf(p.midi[k] % 12), dj = sc.map(pcOf).indexOf(e.midi[k] % 12);
            if (dj !== (di + 7 + dir) % 7) bad++; // un grado de la escala, en el sentido del ciclo
          }
          if (common !== w.eval('DROP2_CYCLE_COMMON')[cyc]) bad++;
          // Deducción inequívoca: el sentido contrario no puede dar también las 4 notas.
          if (w.drop2Step(p.midi, w.drop2ChordTones(e.chord), dir > 0 ? 'down' : 'up')) bad++;
        });
        ok(!bad, `${sname} ciclo ${cyc}: ${bad} fallo(s) en la regla (${prog.join(' ')})`);
        const jumps = res.out.filter((e) => e && e.jumped).length;
        line.push(`c${cyc}${bad ? '✗' : '✓'}${jumps ? '⤴' + jumps : ''}`);
        if (sname === 'Re mayor') {
          console.log(`  ciclo ${cyc} (${w.eval('DROP2_CYCLE_COMMON')[cyc]} común/es, ${dir > 0 ? 'suben' : 'bajan'}): ${prog.join(' ')}`);
          console.log('     ' + res.out.map((e) => e.voicing.frets.join('-') + (e.jumped ? '⤴' : '')).join(' | '));
        }
      }
      console.log(`  ${sname} (${syms.join(' ')}): ${line.join(' ')}`);
    }
    // Una progresión que mezcla ciclos (ii-V-I-vi: ciclo 4, 4, 6, y vuelta con ciclo 4): en auto vale.
    const mix = w.generateDrop2Cycle(['Em7', 'A7', 'DMaj7', 'Bm7', 'Em7'], { refFret: 7, cycle: 'auto' });
    ok(mix.out.every((e) => e && !e.restart || e === mix.out[0]) && !mix.warnings.length, 'progresión mezclada: ' + mix.warnings.join(' | '));
    console.log('  mezcla Em7 A7 DMaj7 Bm7 Em7 (auto, ciclos ' + mix.cyclesUsed.join(',') + '): ' + mix.out.map((e) => e.voicing.frets.join('-')).join(' | '));
  }

  // ── 3. Flujo completo con el XML real ────────────────────────────────────────────────────────
  if (XML_PATH) {
    console.log('\n3. Flujo completo con ' + path.basename(XML_PATH));
    const app = makeApp(HTML); await settle(800);
    await loadXmlInto(app.w, fs.readFileSync(XML_PATH, 'utf8'));
    app.w.document.getElementById('triadDrop2Cycle').checked = true;
    app.w.onTriadDrop2CycleChange();
    await app.w.autoGenerateTriads();
    console.log('  ' + (app.w.__alerts.pop() || '(sin resumen)').split('\n').join('\n  '));
    // v4.5.0: la UI arranca en ciclo automático; con este XML (ciclo 4) debe salir lo mismo que
    // con el ciclo 4 fijo de la v4.4.0.
    ok(app.w.document.getElementById('triadDrop2CycleSel').value === 'auto', 'el selector de ciclo no arranca en automático');
    const autoSvgs = JSON.stringify(svgsOf(app.w));
    app.w.document.getElementById('triadDrop2CycleSel').value = '4';
    await app.w.autoGenerateTriads(); app.w.__alerts.pop();
    ok(JSON.stringify(svgsOf(app.w)) === autoSvgs, 'ciclo automático ≠ ciclo 4 fijo con el XML real');
    console.log('  automático = ciclo 4 fijo: ' + (JSON.stringify(svgsOf(app.w)) === autoSvgs ? 'sí' : 'NO'));
    // Notas guía (opción, apagada por defecto): con ella, 2 notas con data-guide por frame (3ª y 7ª)
    // y el resto de cada SVG idéntico; sin ella, ningún data-guide.
    ok(!autoSvgs.includes('data-guide'), 'sin la opción no debe haber data-guide');
    app.w.document.getElementById('triadDrop2Guides').checked = true;
    await app.w.autoGenerateTriads(); app.w.__alerts.pop();
    const gb = app.w.eval('getAllBars()').map((b) => (b.imgs || [])[0]).filter(Boolean);
    const badG = gb.filter((sl) => sl.svgParsed.notes.filter((n) => n.guide).map((n) => n.label).length !== 2).length;
    ok(badG === 0, `${badG} frames sin exactamente 2 notas guía`);
    ok(JSON.stringify(svgsOf(app.w)).replace(/ data-guide=\\"1\\"| data-move=\\"0\\"| data-drop2cycle=\\"\d\\"/g, '') === autoSvgs, 'con notas guía cambia algo más que data-guide y la placa de "se queda"');
    // Placa "═" (move 0): en cada frame con señales, las 2 notas comunes del próximo cambio.
    const withMoves = gb.filter((sl) => sl.svgParsed.notes.some((n) => Number.isFinite(n.move) && n.move !== 0));
    const badS = withMoves.filter((sl) => sl.svgParsed.notes.filter((n) => n.move === 0).length !== 2).length;
    ok(badS === 0, `${badS} frames sin exactamente 2 placas de "se queda"`);
    ok(gb.every((sl) => sl.svgParsed.drop2Guides === true), 'frames sin la marca drop2Guides');
    ok(withMoves.every((sl) => sl.svgParsed.drop2Cycle === 4), 'frames con señales sin data-drop2cycle=4');
    ok(/la 7ª baja a la 3ª/.test(app.w.drop2GuideSentence(4)), 'frase del ciclo 4');
    console.log(`  notas guía: ${gb.length} frames, ${badG ? badG + ' mal' : 'todos con 2 (3ª y 7ª)'}; placas "se queda": ${withMoves.length} frames, ${badS ? badS + ' mal' : 'todos con 2'}`);
    app.w.document.getElementById('triadDrop2Guides').checked = false;
    const bars = app.w.eval('getAllBars()');
    const firstFrets = [];
    let n4 = 0, nBars = 0;
    bars.forEach((b, bi) => {
      const s = (b.imgs || [])[0];
      if (!s) return;
      nBars++;
      const fr = s.svgParsed.notes.map((n) => n.fret).join('-');
      if (s.svgParsed.notes.length === 4) n4++;
      firstFrets[bi] = fr;
    });
    ok(n4 === nBars, `${nBars - n4} frames sin 4 notas`);
    const laps = [];
    bars.forEach((b, bi) => { if (/^DMaj7$/i.test(b.chord) && bi > 0 && bars[bi - 1].chord === b.chord) laps.push(bi); });
    const startF = firstFrets[bars.findIndex((b) => b.chord)];
    console.log(`  ${nBars} compases con frame; arranque ${startF}; compases donde se repite Dmaj7: ${laps.length}`);
    laps.forEach((bi) => ok(firstFrets[bi] === startF, `compás ${bi + 1}: no reinicia en el voicing inicial (${firstFrets[bi]})`));
    const empties = bars.map((b, bi) => [b, bi]).filter(([b, bi]) => bi > 2 && bi < bars.length - 1 && !b.chord);
    console.log('  compases sin acorde en el XML tras la claqueta: ' + (empties.length ? empties.map(([, bi]) => bi + 1).join(',') : 'ninguno (el importador ya les pone el último acorde)'));
    [35, 36, 37, 38].forEach((n) => { if (bars[n - 1]) console.log(`  compás ${n}: ${bars[n - 1].chord || '—'} → ${firstFrets[n - 1] || 'sin frame'}`); });
    ok(errs.length === 0 && app.errs.length === 0, 'errores de jsdom: ' + app.errs.slice(0, 3).join(' | '));
  } else console.log('\n3. (sin XML real: pasa --xml <ruta> para el flujo completo)');

  // ── 4. Regresión de tríadas (voice leading libre) contra master ─────────────────────────────
  console.log('\n4. Regresión: tríadas con voice leading libre, igual que ' + (args.base || 'master'));
  const baseHtml = execFileSync('git', ['show', (args.base || 'master') + ':guitarvisualizer.html'], { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
  const inputs = [['fixture', fs.readFileSync(FIXTURE, 'utf8')]];
  if (XML_PATH) inputs.push([path.basename(XML_PATH), fs.readFileSync(XML_PATH, 'utf8')]);
  for (const [name, xml] of inputs) {
    const out = [];
    for (const html of [baseHtml, HTML]) {
      const app = makeApp(html); await settle(800);
      await loadXmlInto(app.w, xml);
      await app.w.autoGenerateTriads();
      out.push(JSON.stringify(svgsOf(app.w)));
    }
    const nFrames = JSON.parse(out[1]).flat().filter(Boolean).length;
    ok(nFrames > 0, `${name}: no se generó ninguna tríada`);
    ok(out[0] === out[1], `${name}: las tríadas generadas difieren de la versión base`);
    console.log(`  ${name}: ${nFrames} frames de tríadas, ${out[0] === out[1] ? 'idénticos' : 'DISTINTOS'}`);
  }
  // Y las funciones puras con varias progresiones
  {
    const base = makeApp(baseHtml); await settle(800);
    const progs = [['C', 'Am', 'F', 'G'], ['Dm', 'G7', 'Cmaj7', 'A7'], ['E', 'B', 'C#m', 'A', 'F#m', 'G#dim']];
    for (const p of progs) {
      const a = JSON.stringify(base.w.generateTriadVoiceLeading(p, {}));
      const b = JSON.stringify(w.generateTriadVoiceLeading(p, {}));
      ok(a === b, 'generateTriadVoiceLeading difiere para ' + p.join(' '));
    }
    console.log('  generateTriadVoiceLeading: ' + progs.length + ' progresiones comparadas');
  }

  console.log(fails ? `\n✗ ${fails} comprobación(es) fallida(s)` : '\n✓ Todo correcto');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
