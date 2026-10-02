#!/usr/bin/env node
/**
 * Miniaturas de "Localiza la tónica" por forma CAGED: la tonalidad escrita en la píldora de la plantilla
 * de su forma (~/Downloads/LocalizaTonica/thumbnails/PlantillaForma<X>.png, hechas por Alberto).
 * Una por vídeo EscalaCTriadasEscala-<Tono>_Notas_forma<X>.mp4.
 *
 * Uso: node scripts/generate-localiza-tonica-thumbnails.js --videos ~/Downloads/LocalizaTonica/formas \
 *        --templates ~/Downloads/LocalizaTonica/thumbnails [--out <dir>] [--force] [--only C,Fs]
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
if (!a.videos || !a.templates) { console.error('Uso: --videos <dir> --templates <dir> [--out <dir>] [--force] [--only C,Fs]'); process.exit(1); }
a.out = a.out || path.join(a.videos, 'thumbnails');
const only = a.only ? new Set(a.only.split(',')) : null;

// Medido sobre cada plantilla (2026-09-29): "TONALIDAD:" acaba en x≈397-410 y la píldora está centrada en
// y≈576 a esa altura. x = fin de "TONALIDAD:" + ~27 px de aire; y = centro de la píldora.
const GEO = { A: { x: 424, y: 575 }, C: { x: 425, y: 574 }, D: { x: 432, y: 574 }, E: { x: 437, y: 578 }, G: { x: 426, y: 573 } };

const RE = /^EscalaCTriadasEscala-([A-G](?:s|b)?)_Notas_forma([CAGED])\.mp4$/;
(async () => {
  fs.mkdirSync(a.out, { recursive: true });
  const videos = fs.readdirSync(a.videos).filter((f) => RE.test(f) && (!only || only.has(f.match(RE)[1]))).sort();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });
  const html = 'file://' + path.join(__dirname, 'lib', 'localiza-tonica-thumbnail.html');
  let n = 0, skip = 0;
  for (const f of videos) {
    const out = path.join(a.out, f.replace(/\.mp4$/, '.jpg'));
    if (!a.force && fs.existsSync(out)) { skip++; continue; }
    const [, key, forma] = f.match(RE);
    const bg = path.resolve(a.templates, `PlantillaForma${forma}.png`);
    const qs = new URLSearchParams({ bg: 'file://' + bg, tono: key.replace(/s$/, '#'), x: GEO[forma].x, y: GEO[forma].y });
    await page.goto(`${html}?${qs}`);
    await page.evaluate(async () => { await document.fonts.ready; await document.getElementById('bg').decode(); });
    await page.screenshot({ path: out, type: 'jpeg', quality: 92 });
    console.log(`✓ ${path.basename(out)}`); n++;
  }
  await browser.close();
  console.log(`Hechas ${n}, ya existían ${skip} → ${a.out}`);
})();
