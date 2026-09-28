#!/usr/bin/env node
/**
 * Miniaturas de "Tríadas en 4 mástiles": estampa el acorde (tónica blanca + calidad en turquesa) sobre
 * la plantilla vacía de Alberto, como en su ejemplo "Cm". Una por vídeo <Acorde>_TriadasEn4Mastiles_*.mp4.
 *
 * Uso: node scripts/generate-triadas4m-thumbnails.js --videos ~/Downloads/SUBIRTriadasEn4Mastiles \
 *        --template ~/Downloads/SUBIRTriadasEn4Mastiles/thumnails/PlantillaVacia.png [--out <dir>] [--force]
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

const RE = /^([A-G][#b]?(?:m|dim|aug)?)_TriadasEn4Mastiles_.*\.mp4$/;
(async () => {
  fs.mkdirSync(a.out, { recursive: true });
  const videos = fs.readdirSync(a.videos).filter(f => RE.test(f)).sort();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });
  const html = 'file://' + path.join(__dirname, 'lib', 'triadas4m-thumbnail.html');
  let n = 0, skip = 0;
  for (const f of videos) {
    const out = path.join(a.out, f.replace(/\.mp4$/, '.jpg'));
    if (!a.force && fs.existsSync(out)) { skip++; continue; }
    const chord = f.match(RE)[1];
    await page.goto(`${html}?${new URLSearchParams({ bg: 'file://' + path.resolve(a.template), chord })}`);
    await page.evaluate(async () => { await document.fonts.ready; await document.getElementById('bg').decode(); });
    await page.screenshot({ path: out, type: 'jpeg', quality: 92 });
    console.log(`✓ ${path.basename(out)}`); n++;
  }
  await browser.close();
  console.log(`Hechas ${n}, ya existían ${skip} → ${a.out}`);
})();
