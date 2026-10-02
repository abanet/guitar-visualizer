#!/usr/bin/env node
/**
 * Miniaturas del vídeo largo "Explora la posición": tónica + forma (+ CERRADA) sobre la plantilla vacía
 * de Alberto. Una por vídeo <Tónica>_Forma<X>[_Cerrada]_ExploraLaPosicion.mp4.
 *
 * Uso: node scripts/generate-posicion-thumbnails.js --videos ~/Downloads/PosicionEscala \
 *        --template ~/Downloads/PosicionEscala/thumbnails/Plantilla_Vacía.png [--out <dir>] [--force]
 * Salida: <out>/<nombre del vídeo>.jpg (por defecto <videos>/thumbnails)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const a = { force: false };
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i];
  if (k === '--force') a.force = true; else if (k.startsWith('--')) a[k.slice(2)] = process.argv[++i];
}
if (!a.videos || !a.template) { console.error('Uso: --videos <dir> --template <png> [--out <dir>] [--force]'); process.exit(1); }
a.out = a.out || path.join(a.videos, 'thumbnails');

const RE = /^([A-G](?:s|b)?)_Forma([CAGED])(_Cerrada)?_ExploraLaPosicion\.mp4$/;
(async () => {
  fs.mkdirSync(a.out, { recursive: true });
  const videos = fs.readdirSync(a.videos).filter(f => RE.test(f)).sort();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });
  const html = 'file://' + path.join(__dirname, 'lib', 'posicion-thumbnail.html');
  let n = 0, skip = 0;
  for (const f of videos) {
    const out = path.join(a.out, f.replace(/\.mp4$/, '.jpg'));
    if (!a.force && fs.existsSync(out)) { skip++; continue; }
    const [, key, forma, cerrada] = f.match(RE);
    const qs = new URLSearchParams({ bg: 'file://' + path.resolve(a.template), tonica: key.replace(/s$/, '#'), forma, cerrada: cerrada ? '1' : '0' });
    await page.goto(`${html}?${qs}`);
    await page.evaluate(async () => { await document.fonts.ready; await document.getElementById('bg').decode(); });
    await page.screenshot({ path: out, type: 'jpeg', quality: 92 });
    console.log(`✓ ${path.basename(out)}`); n++;
  }
  await browser.close();
  console.log(`Hechas ${n}, ya existían ${skip} → ${a.out}`);
})();
