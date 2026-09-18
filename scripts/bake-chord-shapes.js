#!/usr/bin/env node
/*
 * Incorpora las "formas de acorde" (paso 2b de la pestaña "Estructuras en escala") a la propia
 * app: reescribe la constante AS_SHAPES_DEFAULT de guitarvisualizer.html y actualiza el JSON
 * versionado de scripts/lib/. La app NO guarda nada en el navegador (tiene que funcionar igual
 * desde cualquier navegador/ordenador), así que este es el único camino para que unas formas
 * editadas en la pestaña pasen a formar parte de ella.
 *
 * Flujo:
 *   1. En la app: editar formas → "Exportar formas (JSON)" (baja chord-shapes-c-major.json).
 *   2. node scripts/bake-chord-shapes.js ~/Downloads/chord-shapes-c-major.json
 *      (sin argumento usa scripts/lib/chord-shapes-c-major.json — solo regenera el HTML desde él)
 *   3. Revisar el diff y commitear.
 *
 * Por defecto FUSIONA con lo que ya hay (solo pisa los acordes/cajas que trae el fichero, igual
 * que el botón Importar de la app); con --replace sustituye todo por el contenido del fichero.
 *
 * Formato del JSON:
 *   {"boxes":  {"<Forma>": [ {"string":0-5,"fret":n}, ... ]},
 *    "shapes": {"<tipo>|<Forma>|<grado>": [ [ {"string":0-5,"fret":n}, ... ], ... ]}}
 *   tipo = triads|sevenths · Forma = E|D|C|A|G · grado = 0..6 · cuerda 0 = Mi grave.
 *   "boxes" = las 5 cajas CAGED de C mayor TAL COMO SE TOCAN (con las correcciones a mano de
 *   scripts/lib/caged-scale-positions.json), REFERENCIA de las formas: en cualquier otra tónica
 *   la caja es esta misma desplazada. "shapes" = hasta 3 formas por acorde diatónico, en las
 *   mismas coordenadas (abiertas, sin +12). Un JSON antiguo que sea solo el objeto de formas
 *   (sin "boxes"/"shapes") también se acepta.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'guitarvisualizer.html');
const libPath = path.join(root, 'scripts/lib/chord-shapes-c-major.json');
const args = process.argv.slice(2);
const replace = args.includes('--replace');
const inputArg = args.find((a) => !a.startsWith('--'));

const norm = (o) => (o && (o.boxes || o.shapes)) ? { boxes: o.boxes || {}, shapes: o.shapes || {} } : { boxes: {}, shapes: o || {} };
let data = norm(JSON.parse(fs.readFileSync(libPath, 'utf8')));
if (inputArg) {
  const incoming = norm(JSON.parse(fs.readFileSync(path.resolve(inputArg.replace(/^~/, process.env.HOME)), 'utf8')));
  data = replace ? incoming : { boxes: { ...data.boxes, ...incoming.boxes }, shapes: { ...data.shapes, ...incoming.shapes } };
}

// Validación: un fichero mal formado no debe llegar a la app.
const errors = [];
const okNote = (n) => n && Number.isInteger(n.string) && n.string >= 0 && n.string <= 5 && Number.isInteger(n.fret) && n.fret >= 0 && n.fret <= 24;
for (const [form, box] of Object.entries(data.boxes)) {
  if (!/^[EDCAG]$/.test(form)) errors.push(`caja con Forma no válida: "${form}"`);
  if (!Array.isArray(box) || !box.length || !box.every(okNote)) errors.push(`caja ${form}: lista de notas no válida`);
}
for (const [key, variants] of Object.entries(data.shapes)) {
  if (!/^(triads|sevenths)\|[EDCAG]\|[0-6]$/.test(key)) { errors.push(`clave no válida: "${key}"`); continue; }
  if (!Array.isArray(variants) || variants.length > 3) errors.push(`${key}: debe ser una lista de 1-3 formas`);
  const box = data.boxes[key.split('|')[1]];
  const inBox = box ? new Set(box.map((n) => n.string + ':' + n.fret)) : null;
  (variants || []).forEach((v, i) => {
    if (!Array.isArray(v) || !v.length) { errors.push(`${key} forma ${i + 1}: vacía`); return; }
    v.forEach((n) => {
      if (!okNote(n)) errors.push(`${key} forma ${i + 1}: nota no válida ${JSON.stringify(n)}`);
      else if (inBox && !inBox.has(n.string + ':' + n.fret)) errors.push(`${key} forma ${i + 1}: cuerda ${n.string} traste ${n.fret} queda fuera de la caja ${key.split('|')[1]}`);
    });
  });
}
if (errors.length) { console.error(`No se ha tocado nada (${errors.length} problema(s)):\n  ` + errors.slice(0, 15).join('\n  ') + (errors.length > 15 ? `\n  … y ${errors.length - 15} más` : '')); process.exit(1); }

const byKey = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
data = { boxes: byKey(data.boxes), shapes: byKey(data.shapes) };
const compact = JSON.stringify({
  boxes: Object.fromEntries(Object.entries(data.boxes).map(([k, b]) => [k, b.map((n) => [n.string, n.fret])])),
  shapes: Object.fromEntries(Object.entries(data.shapes).map(([k, vs]) => [k, vs.map((v) => v.map((n) => [n.string, n.fret]))])),
});

const html = fs.readFileSync(htmlPath, 'utf8');
const re = /const AS_SHAPES_DEFAULT=\{.*?\};\n/s;
if (!re.test(html)) { console.error('No encuentro AS_SHAPES_DEFAULT en guitarvisualizer.html'); process.exit(1); }
fs.writeFileSync(htmlPath, html.replace(re, () => `const AS_SHAPES_DEFAULT=${compact};\n`));
fs.writeFileSync(libPath, JSON.stringify(data, null, 1) + '\n');
console.log(`✓ ${Object.keys(data.shapes).length} acordes y ${Object.keys(data.boxes).length} cajas incorporados a guitarvisualizer.html y scripts/lib/chord-shapes-c-major.json`);
