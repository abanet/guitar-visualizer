#!/usr/bin/env node
/**
 * Miniaturas para los vídeos de "Tríadas en la escala" (arpegios / acordes).
 *
 * Toma la plantilla de Alberto con huecos (tónica encima de "MAYOR" y letra
 * detrás de "FORMA") y estampa encima, con Chrome headless, lo que cambia en
 * cada vídeo: tónica, forma CAGED y la etiqueta "CERRADA" si toca. La
 * plantilla no se retoca: solo se escribe texto en los huecos.
 * Las posiciones viven en scripts/lib/escala-triadas-thumbnail.html y están
 * medidas sobre la plantilla de 1672×941 (arpegios y acordes comparten
 * geometría); el acento turquesa/ámbar sale del nombre del vídeo.
 *
 * Uso:
 *   node scripts/generate-escala-triadas-thumbnails.js \
 *     --videos ~/Downloads/EscalaCTriadasEscala/arpegios \
 *     --template ~/Downloads/EscalaCTriadasEscala/arpegios/thumbnails/plantillaArpegiosEscalaForma_vacia.png
 *   (acordes: --videos .../acordes --template .../acordes/thumbnails/PlantillaAcordesEscala_vacia.png)
 *   [--out <dir>]  (por defecto <videos>/thumbnails)
 *   [--force]      (regenera aunque ya exista la miniatura)
 *   [--tonic-size <px>]  (tamaño de la tónica; por defecto 315 — las plantillas de séptimas usan ~255)
 *
 * Salida: <out>/<nombre del vídeo>.jpg (JPEG, <2 MB para YouTube).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const a = { force: false };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--force') a.force = true;
    else if (k.startsWith('--')) a[k.slice(2)] = argv[++i];
  }
  if (!a.videos || !a.template) {
    console.error('Uso: --videos <dir> --template <png> [--out <dir>] [--force]');
    process.exit(1);
  }
  a.out = a.out || path.join(a.videos, 'thumbnails');
  return a;
}

// EscalaCTriadasEscala-Fs_Notas_formaC_cerrada.mp4
// EscalaCTriadasEscala-A_FormasAcorde_Notas_formaE.mp4
const RE = /-([A-G](?:s|b)?)_(FormasAcorde_)?Notas_forma([CAGED])(_cerrada)?\.mp4$/;

(async () => {
  const args = parseArgs(process.argv);
  fs.mkdirSync(args.out, { recursive: true });
  const videos = fs.readdirSync(args.videos).filter(f => RE.test(f)).sort();
  if (!videos.length) { console.error('No hay vídeos reconocibles en', args.videos); process.exit(1); }

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });
  const html = 'file://' + path.join(__dirname, 'lib', 'escala-triadas-thumbnail.html');
  let hechos = 0, saltados = 0;
  for (const f of videos) {
    const out = path.join(args.out, f.replace(/\.mp4$/, '.jpg'));
    if (!args.force && fs.existsSync(out)) { saltados++; continue; }
    const [, key, acordes, forma, cerrada] = f.match(RE);
    const tonica = key.replace(/s$/, '#');
    const qs = new URLSearchParams({
      bg: 'file://' + path.resolve(args.template), tonica, forma, cerrada: cerrada ? '1' : '0',
      tipo: acordes ? 'acordes' : 'arpegios', ...(args['tonic-size'] ? { tsize: args['tonic-size'] } : {}),
    });
    await page.goto(`${html}?${qs}`);
    await page.evaluate(async () => { await document.fonts.ready; await document.getElementById('bg').decode(); });
    await page.screenshot({ path: out, type: 'jpeg', quality: 92 });
    console.log(`✓ ${path.basename(out)}  (${tonica} · forma ${forma}${cerrada ? ' · cerrada' : ''})`);
    hechos++;
  }
  await browser.close();
  console.log(`Hechas ${hechos}, ya existían ${saltados} → ${args.out}`);
})();
