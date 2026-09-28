#!/usr/bin/env node
/*
 * Vídeo largo "explora una posición de la escala" (piloto pedido por Alberto 2026-09-27): monta en
 * un solo vídeo, para una tónica y una forma CAGED, los capítulos que ya existen renderizados:
 *   1 La escala (generate-scale-position-intro.js — construye la posición nota a nota)
 *   2 Tríadas de la escala       (generate-scale-triad-explore-videos.js sobre EscalaCTriadasEscala → triadas/)
 *   3 Acordes de la escala       (EscalaCTriadasEscala, --quality shapes-triads → acordes/)
 *   4 Arpegios de las tríadas    (EscalaCTriadasEscala, --quality triads → arpegios/)
 *   5 Pentatónicas               (EscalaCTriadasEscala, --quality pentatonic → pentatonicas/)
 *   6 Acordes de 7ª              (EscalaCCambiosaTodosGradosCon7, --quality shapes-sevenths → acordes/)
 *   7 Arpegios de 7ª             (EscalaCCambiosaTodosGradosCon7, --quality sevenths → arpegios/)
 * (Orden de Alberto: primero los acordes y luego sus arpegios, en tríadas y en tétradas.)
 * Un capítulo cuyo vídeo no exista se salta (con aviso).
 * De cada ejercicio se toman los 2 compases de cuenta + N vueltas + 1 compás (el I, para acabar
 * resuelto). Encima, sin tocar los vídeos de origen:
 *   - cartel del capítulo durante la cuenta (el clic marca la entrada),
 *   - franja "A continuación: …" en los últimos compases de cada capítulo,
 *   - barra de progreso por capítulos abajo (tramo actual llenándose + "Siguiente en m:ss"),
 *   - cierre de ~15 s con la posición en fantasma, invitación a la lista de backing tracks de la
 *     tonalidad para improvisar, y la mitad inferior libre para las pantallas finales de YouTube,
 *   - fichero de capítulos de YouTube (marcas de tiempo) junto al vídeo.
 *
 * Uso: node scripts/assemble-position-video.js --root C --position E [--laps 2] [--out <dir>] [--piezas]
 *   --piezas: capítulos desde <out>/piezas (versión con intervalo en placa)
 * Salida: <out>/<Root>_Forma<X>_ExploraLaPosicion.mp4 + ..._capitulos.txt (por defecto ~/Downloads/PosicionEscala)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);

const HOME = os.homedir();
const FONT = '/System/Library/Fonts/Supplemental/Arial Bold.ttf';
const W = 1600, H = 900, FPS = 25;
const BAR = { x: 30, y: 884, w: 1350, h: 6 };

function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  return a;
}
// Prioridad mínima y 2 hilos: puede montarse mientras otro lote GRABA en tiempo real sin quitarle CPU.
const ff = (args) => execFileP('nice', ['-n', '19', 'ffmpeg', '-loglevel', 'error', '-y', '-threads', '2', ...args], { maxBuffer: 1 << 26 });
async function duration(f) {
  try { await execFileP('ffmpeg', ['-i', f]); } catch (e) {
    const m = (e.stderr || '').match(/Duration:\s*(\d+):(\d+):([\d.]+)/); if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3];
  }
  throw new Error('sin duración: ' + f);
}
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

(async () => {
  const args = parseArgs(process.argv);
  const root = args.root || 'C', pos = (args.position || 'E').toUpperCase(), laps = parseInt(args.laps || 2, 10);
  const k = root.replace('#', 's');
  const outDir = path.resolve(args.out || path.join(HOME, 'Downloads', 'PosicionEscala'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-pos-'));
  const T = path.join(HOME, 'Downloads', args.triadas || 'SUBIREscalaCTriadasEscala'), S = path.join(HOME, 'Downloads', args.septimas || 'SUBIREscalaCCambiosaTodosGradosCon7');
  const bar85 = 4 * 60 / 85;
  // intro: compases de cuenta; cycle: compases por vuelta del backing
  // --piezas: todos los capítulos desde <out>/piezas (versión del vídeo largo, con el intervalo en
  // placa pequeña — ver scripts/lib/posicion-larga-vis-config.json), en vez de los vídeos sueltos.
  const P = path.join(outDir, 'piezas'), usePiezas = !!args.piezas;
  const src = (dir, sub, file) => usePiezas ? path.join(P, sub, file) : path.join(dir, sub, file);
  const CH = [
    { short: 'Escala', title: 'La escala', src: usePiezas ? path.join(P, `${k}_Forma${pos}_ConstruyeLaPosicion.mp4`) : path.join(outDir, `${k}_Forma${pos}_ConstruyeLaPosicion.mp4`), whole: true },
    // Tríadas de 3 notas (una por cuerda) que caben en la forma — ANTES de los arpegios (Alberto:
    // "después de la presentación dice que va a mostrar las tríadas pero muestra los arpegios").
    { short: 'Tríadas', title: 'Tríadas de la escala', sub: 'Todas las tríadas de 3 notas dentro de la forma', src: path.join(P, `${root}_major_Forma${pos}_TriadasEnPosicion.mp4`), cycle: 14 },
    { short: 'Enlace', title: 'Enlace de tríadas', sub: 'De un acorde al siguiente moviendo lo mínimo', src: path.join(P, `${root}_major_Forma${pos}_Enlace_TriadasEnPosicion.mp4`), cycle: 14 },
    // Orden de Alberto: primero los acordes y luego sus arpegios (tríadas y tétradas).
    { short: 'Acordes', title: 'Acordes de la escala', sub: 'Una forma de cada acorde', src: src(T, 'acordes', `EscalaCTriadasEscala-${k}_FormasAcorde_Notas_forma${pos}.mp4`), cycle: 14 },
    { short: 'Arpegios', title: 'Arpegios de las tríadas', sub: 'El arpegio de cada acorde', src: src(T, 'arpegios', `EscalaCTriadasEscala-${k}_Notas_forma${pos}.mp4`), cycle: 14 },
    { short: 'Pentatónicas', title: 'Pentatónicas de la escala', sub: 'La pentatónica de cada acorde', src: path.join(P, 'pentatonicas', `EscalaCTriadasEscala-${k}_Notas_forma${pos}.mp4`), cycle: 14 },
    { short: 'Acordes 7ª', title: 'Acordes de 7ª', sub: 'Una forma de cada cuatriada', src: usePiezas ? path.join(P, 'acordes7', `EscalaCCambiosaTodosGradosCon7-${k}_FormasAcorde_Notas_forma${pos}.mp4`) : path.join(S, 'acordes', `EscalaCCambiosaTodosGradosCon7-${k}_FormasAcorde_Notas_forma${pos}.mp4`), cycle: 24 },
    { short: 'Arpegios 7ª', title: 'Arpegios de 7ª', sub: 'Las cuatriadas de la escala', src: usePiezas ? path.join(P, 'arpegios7', `EscalaCCambiosaTodosGradosCon7-${k}_Notas_forma${pos}.mp4`) : path.join(S, 'arpegios', `EscalaCCambiosaTodosGradosCon7-${k}_Notas_forma${pos}.mp4`), cycle: 24 },
    { short: 'Notas guía', title: 'Notas guía', sub: 'La 3ª y la 7ª de cada acorde, enlazadas', src: path.join(P, 'guias', `EscalaCCambiosaTodosGradosCon7-${k}_Notas_forma${pos}.mp4`), cycle: 24 },
  ].filter(c => { if (fs.existsSync(c.src)) return true; console.log(`⚠ falta ${path.basename(c.src)} — capítulo "${c.title}" fuera`); return false; });
  for (const c of CH) c.dur = c.whole ? await duration(c.src) : (2 + laps * c.cycle + 1) * bar85;
  const next = i => CH[i + 1];

  // Carteles (PNG transparentes) con el mismo navegador que el resto de generadores.
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const shot = async (html, file) => { await page.setContent(`<html><body style="margin:0;width:${W}px;height:${H}px;background:transparent;font-family:Arial,Helvetica,sans-serif">${html}</body></html>`); await page.screenshot({ path: file, omitBackground: true }); };
  for (let i = 0; i < CH.length; i++) {
    const c = CH[i];
    c.card = path.join(tmp, `card${i}.png`);
    await shot(`<div style="position:absolute;inset:0;background:rgba(10,10,10,.82);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff">
      <div style="font:700 24px Arial;color:#e2b34f;letter-spacing:.14em">CAPÍTULO ${i + 1}</div>
      <div style="font:700 68px Arial;color:#8ab4ff;margin-top:14px;text-shadow:0 0 20px rgba(120,160,255,.45)">${c.title}</div>
      <div style="font:700 26px Arial;color:rgba(255,255,255,.7);margin-top:14px">${c.sub || ''}</div>
      <div style="font:700 20px Arial;color:rgba(255,255,255,.45);margin-top:26px">Escala de ${root} mayor · Forma ${pos}</div></div>`, c.card);
    if (next(i)) {
      c.ann = path.join(tmp, `ann${i}.png`);
      // Abajo a la derecha, bajo el mini-diagrama "Siguiente": el único hueco libre en TODOS los
      // ejercicios (abajo en el centro tapaba la fila de acordes — visto en el piloto).
      await shot(`<div style="position:absolute;right:78px;top:668px;width:380px;padding:14px 22px;border-radius:14px;background:rgba(15,15,15,.92);border:1px solid rgba(226,179,79,.6);box-shadow:0 8px 30px rgba(0,0,0,.6)">
        <div style="font:700 16px Arial;color:#e2b34f;letter-spacing:.1em">A CONTINUACIÓN</div><div style="font:700 25px Arial;color:#fff;margin-top:6px">${next(i).title}</div></div>`, c.ann);
    }
  }
  // Mensaje del cierre (Alberto: en vez de un capítulo de improvisación, invitar a la lista de
  // backing tracks de la tonalidad del canal). Va sobre la posición en fantasma y deja libre la
  // mitad inferior para las pantallas finales de YouTube.
  const outroCard = path.join(tmp, 'outro-card.png');
  await shot(`<div style="position:absolute;left:0;right:0;top:0;height:470px;background:linear-gradient(180deg,rgba(10,10,10,.92) 70%,rgba(10,10,10,0));display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
      <div style="font:700 24px Arial;color:#e2b34f;letter-spacing:.14em">AHORA TE TOCA A TI</div>
      <div style="font:700 52px Arial;color:#8ab4ff;margin-top:14px;text-shadow:0 0 20px rgba(120,160,255,.45)">Improvisa en ${root} mayor</div>
      <div style="font:700 28px Arial;color:rgba(255,255,255,.85);margin-top:16px">Busca en el canal <span style="color:#fff">backing tracks en ${root} mayor</span></div>
      <div style="font:700 22px Arial;color:rgba(255,255,255,.55);margin-top:10px">y prueba todo lo que has visto en esta posición</div></div>`, outroCard);
  await browser.close();

  // 1) Cada capítulo recortado + sus carteles, todos con el mismo formato (para concatenar sin recodificar).
  const segs = [];
  for (let i = 0; i < CH.length; i++) {
    const c = CH[i], d = c.dur, seg = path.join(tmp, `seg${i}.mp4`);
    const cardEnd = (c.whole && c.card !== 'count') ? 2.2 : 2 * bar85;           // capítulo 1: sin cuenta, el cartel tapa el mástil vacío del principio
    const annStart = d - ((c.whole && c.card !== 'count') ? 3.0 : 4 * bar85), annEnd = d - 0.3;
    const inputs = ['-i', c.src, '-loop', '1', '-t', d.toFixed(3), '-i', c.card];
    let fc = `[0:v]trim=0:${d.toFixed(3)},setpts=PTS-STARTPTS,fps=${FPS},scale=${W}:${H},setsar=1[v0];` +
      `[1]format=rgba,fade=out:st=${(cardEnd - 0.5).toFixed(3)}:d=0.5:alpha=1[c];[v0][c]overlay=enable='lte(t,${cardEnd.toFixed(3)})'[v1]`;
    let last = '[v1]';
    if (c.ann) {
      inputs.push('-loop', '1', '-t', d.toFixed(3), '-i', c.ann);
      fc += `;[2]format=rgba,fade=in:st=${annStart.toFixed(3)}:d=0.4:alpha=1,fade=out:st=${(annEnd - 0.4).toFixed(3)}:d=0.4:alpha=1[a];${last}[a]overlay=enable='between(t,${annStart.toFixed(3)},${annEnd.toFixed(3)})'[v2]`;
      last = '[v2]';
    }
    await ff([...inputs, '-filter_complex', fc, '-map', last, '-map', '0:a', '-t', d.toFixed(3),
      '-af', `atrim=0:${d.toFixed(3)},afade=out:st=${(d - 1.2).toFixed(3)}:d=1.2,aresample=44100`, '-ac', '2',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', seg]);
    c.realDur = await duration(seg);
    segs.push(seg);
    console.log(`✓ capítulo ${i + 1} ${c.title}: ${c.realDur.toFixed(1)} s`);
  }
  // Cierre: la posición en fantasma (último fotograma del capítulo 1) 15 s, en silencio.
  const outro = path.join(tmp, 'outro.mp4'), lastFrame = path.join(tmp, 'last.png');
  await ff(['-sseof', '-0.2', '-i', CH[0].src, '-frames:v', '1', lastFrame]);
  await ff(['-loop', '1', '-framerate', String(FPS), '-t', '15', '-i', lastFrame, '-loop', '1', '-t', '15', '-i', outroCard, '-f', 'lavfi', '-t', '15', '-i', 'anullsrc=r=44100:cl=stereo',
    '-filter_complex', `[0]scale=${W}:${H},setsar=1[b];[1]format=rgba,fade=in:st=0.3:d=0.7:alpha=1[c];[b][c]overlay,fade=in:st=0:d=0.6[v]`, '-map', '[v]', '-map', '2:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', outro]);
  segs.push(outro);

  // 2) Concatenar y 3) barra de progreso por capítulos encima.
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, segs.map(s => `file '${s}'`).join('\n'));
  const joined = path.join(tmp, 'joined.mp4');
  await ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined]);
  let t0 = 0; CH.forEach(c => { c.start = t0; t0 += c.realDur; });
  const musicEnd = t0, total = await duration(joined);
  const esc = s => s.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\\\'").replace(/,/g, '\\,');
  const fontOpt = `fontfile='${FONT.replace(/ /g, '\\ ')}'`;
  let bar = `color=c=0x3a3a3a:s=${BAR.w}x${BAR.h}:r=${FPS}:d=${total.toFixed(3)}[track];color=c=0x8ab4ff:s=${BAR.w}x${BAR.h}:r=${FPS}:d=${total.toFixed(3)}[fill];` +
    `[track][fill]overlay=x='-${BAR.w}+${BAR.w}*min(1,t/${musicEnd.toFixed(3)})':y=0:eval=frame[bar0]`;
  let lastB = '[bar0]';
  CH.forEach((c, i) => { if (i) { bar += `;${lastB}drawbox=x=${Math.round(BAR.w * c.start / musicEnd) - 2}:y=0:w=4:h=${BAR.h}:color=black:t=fill[bar${i}]`; lastB = `[bar${i}]`; } });
  let v = `[0:v]null[vv];${bar};[vv]${lastB}overlay=x=${BAR.x}:y=${BAR.y}:enable='lte(t,${musicEnd.toFixed(3)})'[vb]`;
  let lastV = '[vb]';
  CH.forEach((c, i) => {
    const x = BAR.x + Math.round(BAR.w * c.start / musicEnd), now = `between(t,${c.start.toFixed(3)},${(c.start + c.realDur).toFixed(3)})`;
    v += `;${lastV}drawtext=${fontOpt}:text='${esc(c.short)}':x=${x}:y=${BAR.y - 20}:fontsize=13:fontcolor=white@0.45:enable='lte(t,${musicEnd.toFixed(3)})'[l${i}a]`;
    v += `;[l${i}a]drawtext=${fontOpt}:text='${esc(c.short)}':x=${x}:y=${BAR.y - 20}:fontsize=13:fontcolor=0x8ab4ff:enable='${now}'[l${i}]`;
    lastV = `[l${i}]`;
    if (next(i)) {
      const end = (c.start + c.realDur).toFixed(3);
      v += `;${lastV}drawtext=${fontOpt}:text='Siguiente en %{eif\\:floor((${end}-t)/60)\\:d}\\:%{eif\\:mod(floor(${end}-t)\\,60)\\:d\\:2}':x=${BAR.x + BAR.w}-tw:y=${BAR.y - 20}:fontsize=13:fontcolor=0xe2b34f:enable='${now}'[n${i}]`;
      lastV = `[n${i}]`;
    }
  });
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${k}_Forma${pos}_ExploraLaPosicion.mp4`);
  await ff(['-i', joined, '-filter_complex', v, '-map', lastV, '-map', '0:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', out]);

  // 4) Capítulos de YouTube (el primero tiene que ser 0:00).
  const chapters = CH.map((c, i) => `${mmss(c.start)} ${i + 1}. ${c.title}`).join('\n');
  fs.writeFileSync(out.replace(/\.mp4$/, '_capitulos.txt'), chapters + '\n');
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`✓ ${out} (${mmss(total)})\n${chapters}`);
})().catch(e => { console.error(e.stderr || e); process.exitCode = 1; });
