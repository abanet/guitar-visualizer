#!/usr/bin/env node
/*
 * Sesiones para la serie "Cambios entre arpegios de 7ª" (Alberto, 2026-10-26: "quiero practicar mucho el
 * cambio de un arpegio a otro"): una sesión por tonalidad y forma CAGED de arranque, lista para
 * scripts/generate-videos-from-sessions.js.
 *
 * Por qué así: el motor ya existe — pestaña Arpegios, "Enviar al editor" (ashSendToEditor), que coloca en
 * cada compás la forma de arpegio de la Librería más cercana a la anterior, empezando por la forma CAGED
 * elegida en #ashStartPos. Así se hicieron a mano los vídeos de A7-E7 (jun 2026). La Librería vive en el
 * localStorage del navegador (y las sesiones guardadas solo llevan los NOMBRES de las entradas, no sus notas):
 * la buena estaba en Firefox. scripts/expand-arpeggio-library.py la completa a 12 tónicas × 5 formas y aquí se
 * mete en el localStorage de la página antes de cargarla (gv_lib_v2, que loadLibFromStorage reconstruye).
 *
 * Uso:
 *   node scripts/make-arpeggio-change-sessions.js --xml-dir <carpeta con <Nombre>-<K>.XML> \
 *     [--keys C,G,…] [--forms E,D,C,A,G] [--ciclo 4] [--out <carpeta>] [--libreria <libreria.json completa>]
 * Deja <out>/<K>/<Nombre>-<K>_Forma<X>.json (una carpeta por tonalidad, porque el audio va por tonalidad).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');

const LIBRERIA = '~/guitar-visualizer-assets/libreria-arpegios/libreria_completa.json';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const next = argv[i + 1];
    out[argv[i].slice(2)] = next === undefined || next.startsWith('--') ? true : (i++, next);
  }
  return out;
}
const tilde = (p) => path.resolve(String(p).replace(/^~/, os.homedir()));

(async () => {
  const a = parseArgs(process.argv.slice(2));
  if (!a['xml-dir']) { console.error('Falta --xml-dir'); process.exit(1); }
  const xmlDir = tilde(a['xml-dir']);
  const out = tilde(a.out || path.join(xmlDir, 'sesiones'));
  const forms = String(a.forms || 'E,D,C,A,G').split(',');
  const keysWanted = a.keys ? String(a.keys).split(',') : null;
  const lib = JSON.parse(fs.readFileSync(tilde(a.libreria || LIBRERIA), 'utf8'));
  if (!lib.entries || !lib.entries.some((e) => e.notes)) { console.error('--libreria no trae formas con notas'); process.exit(1); }

  const xmls = fs.readdirSync(xmlDir).filter((f) => /-([A-G][sb]?)\.XML$/i.test(f))
    .filter((f) => !keysWanted || keysWanted.includes(f.match(/-([A-G][sb]?)\.XML$/i)[1]));
  if (!xmls.length) { console.error('No hay XML <Nombre>-<K>.XML en', xmlDir); process.exit(1); }

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await context.addInitScript((libStr) => { try { localStorage.setItem('gv_lib_v2', libStr); } catch (e) {} }, JSON.stringify(lib));
  const page = await context.newPage();
  page.on('dialog', (d) => d.dismiss());
  page.on('pageerror', (e) => console.error('  pageerror:', e.message));
  const appUrl = 'file://' + path.join(__dirname, '..', 'guitarvisualizer.html');

  for (const f of xmls) {
    const key = f.match(/-([A-G][sb]?)\.XML$/i)[1];
    const xmlText = fs.readFileSync(path.join(xmlDir, f), 'utf8');
    for (const form of forms) {
      // Página nueva para cada sesión: al cargar un segundo XML en la misma página, "Enviar al editor"
      // seguía colocando los arpegios del primero (10-26: las 12 tonalidades salían con A7-D7, los ciclos
      // ya convertidos a 'custom' sobreviven a loadXML). Recargar cuesta ~1 s y quita cualquier arrastre.
      await page.goto(appUrl);
      const res = await page.evaluate(async ({ xmlText, name, form, ciclo, tonica }) => {
        // loadXML lee con FileReader (asíncrono). Esperar a que `cycles` tenga contenido NO basta: desde la
        // segunda tonalidad ya lo tiene, el del XML anterior, y las sesiones salían con los acordes de otra
        // tonalidad (10-26: las de C traían A7-D7). Se vacía el rótulo "N compases" (#t3), que loadXML
        // rellena al final de su onload, y se espera a que vuelva a tener texto.
        const t3 = document.getElementById('t3');
        t3.textContent = '';
        loadXML({ files: [new File([xmlText], name)] });
        for (let i = 0; i < 200 && !t3.textContent; i++) await new Promise((r) => setTimeout(r, 50));
        if (!t3.textContent) throw new Error('el XML no terminó de cargar: ' + name);
        // La vuelta del ejercicio es la progresión (C7 C7 F7 F7 = 4 compases), no los 12 que la app supone por
        // defecto: si no, el contador "VUELTA x/y" del vídeo cuenta mal (salía 1/9 en vez de 1/24).
        document.getElementById('cycleLen').value = String(ciclo);
        showTab('generate');
        document.getElementById('ashStartPos').value = form;
        // El I7 se queda en SU forma todo el vídeo (bug visto por Alberto el 10-27, "las dos posiciones en
        // diferentes sitios"): #ashStartPos solo fija el PRIMER compás y luego la optimización global elige
        // la posición más barata de toda la canción — en Forma C (las 12 tonalidades) y en Ab Forma D el I7
        // se iba a otra forma (G7 de trastes 7-10 a 2-6) y el vídeo dejaba de ser "Forma C". Con la forma
        // manual del I7 (el mismo mecanismo que el selector por acorde de la pestaña) el IV7 se elige junto
        // a ella. Solo en memoria: no se llama a ashSavePosOverride.
        ashPosOverride = { [noteToSt(tonica) + '|7']: form };
        ashSendToEditor(true);
        const s = buildSession();
        delete s.library; // la Librería ya no hace falta: los fotogramas van en la sesión
        return { s, status: document.getElementById('ashSendStatus')?.textContent || '' };
      }, { xmlText, name: f, form, ciclo: parseInt(a.ciclo || 4, 10), tonica: key.replace(/s$/, '#') });
      // Comprobación: el primer arpegio de la sesión tiene que ser el acorde I de la tonalidad del fichero.
      const tonica = key.replace(/s$/, '#');
      const primero = (JSON.stringify(res.s).match(/"name":"([A-G][#b]?)7 arpegio/) || [])[1];
      const enar = { 'C#': 'Db', 'D#': 'Eb', 'Gb': 'F#', 'G#': 'Ab', 'A#': 'Bb' };
      if ((enar[primero] || primero) !== (enar[tonica] || tonica)) throw new Error(`${f} forma ${form}: el primer arpegio es ${primero}7, no ${tonica}7`);
      // Y el I7 tiene que estar en la forma pedida en TODOS los compases (ver ashPosOverride arriba).
      const formasI = new Set([...JSON.stringify(res.s).matchAll(/"name":"([A-G][#b]?)7 arpegio \(auto, forma ([^)]*)\)"/g)]
        .filter((m) => (enar[m[1]] || m[1]) === (enar[tonica] || tonica)).map((m) => m[2]));
      if (formasI.size !== 1 || !formasI.has(form)) throw new Error(`${f} forma ${form}: el I7 sale en las formas ${[...formasI].join(', ')}`);
      const dir = path.join(out, key);
      fs.mkdirSync(dir, { recursive: true });
      const dest = path.join(dir, f.replace(/\.XML$/i, `_Forma${form}.json`));
      fs.writeFileSync(dest, JSON.stringify(res.s));
      console.log(`✓ ${path.relative(out, dest)}  ${res.status}`);
    }
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
