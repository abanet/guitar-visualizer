#!/usr/bin/env node
/*
 * Verificador de sincronización ESPECÍFICO del módulo Ritmo (a diferencia de verify-sync.js,
 * pensado para Tríadas/Arpegios): en vez de buscar "algún cambio de escena" genérico, mide el
 * instante EXACTO en que se enciende el punto de pulso del Tiempo 1 y del Tiempo 2 (los círculos
 * de la fila inferior, ver tvBuild()/buildBeats() en guitarvisualizer.html) y lo compara con el
 * instante real en que suena cada uno de esos dos primeros golpes en el audio.
 *
 * Por qué solo los dos primeros golpes: si el golpe 1 y el golpe 2 coinciden con sus círculos
 * dentro de tolerancia, el resto del vídeo también — ambos se calculan con la misma rejilla fija
 * (mismo instante de arranque + mismo BPM declarado), así que un desajuste en cualquier golpe
 * posterior ya se habría visto como un desajuste creciente entre el 1 y el 2 (arranque distinto)
 * o como un desajuste igual en ambos (problema de BPM real vs BPM declarado). Comprobar todo el
 * vídeo golpe a golpe no aporta nada que esto no detecte ya.
 *
 * Cómo mide cada cosa, en una sola pasada de ffmpeg cada vez (sin extraer frames/wav a mano):
 *   - VÍDEO: recorta un cuadrado pequeño centrado en el círculo del Tiempo N y mide su brillo
 *     medio (filtro signalstats + metadata=print) fotograma a fotograma — el círculo está
 *     apagado (fondo oscuro, ~YAVG 25) o encendido (relleno de color, ~YAVG 80-90), así que el
 *     salto es nítido y fácil de localizar con precisión de 1 fotograma (1/25s a 25fps).
 *   - AUDIO: mide el nivel RMS por ventanas muy cortas (astats + metadata=print) y localiza el
 *     ataque percusivo del golpe (subida brusca desde el silencio) cerca del instante teórico.
 *
 * El instante teórico de cada golpe (para buscar cerca de ahí, no a ciegas en todo el vídeo) es
 * el mismo cálculo que usa render-rhythm-video.js en modo --dir: introBars*beats*(60/bpm) para
 * el golpe 1, más 60/bpm para el golpe 2. El BPM se lee del nombre de archivo (misma convención
 * que bpmFromFilename() allí — número al final, o antes de un sufijo "_Render").
 *
 * Uso:
 *   node scripts/verify-rhythm-sync.js --dir <carpeta con los .mp4 de Ritmo>
 *
 * Opciones:
 *   --dir <path>          Carpeta con los .mp4 a comprobar (obligatorio)
 *   --intro-bars <n>      Compases de cuenta atrás antes del golpe 1 (por defecto: 2)
 *   --beats <n>           Tiempos por compás (por defecto: 4)
 *   --tolerance-ms <n>    Desfase audio/vídeo tolerado antes de marcar sospechoso (por defecto: 100)
 *   --dot-x <n>           X del centro del círculo del Tiempo 1, a 1920x1080 (por defecto: 675)
 *   --dot-spacing <n>     Distancia horizontal entre círculos consecutivos (por defecto: 190)
 *   --dot-y <n>           Y del centro de los círculos (por defecto: 868)
 *   --crop <n>            Lado del cuadrado de recorte alrededor del centro (por defecto: 50)
 *
 * Si tu vídeo no es 1920x1080 o el diseño de la fila de pulso ha cambiado de sitio, mide las
 * coordenadas de nuevo (ver el comentario de calibración más abajo) y pásalas por CLI.
 */
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i++; }
    }
  }
  return out;
}

// Misma convención que bpmFromFilename() en render-rhythm-video.js.
function bpmFromFilename(file) {
  const name = path.parse(file).name.replace(/[_\-\s]*render$/i, '');
  const m = name.match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : null;
}

// Ejecuta el filtro dado y devuelve [{ t, value }] parseando "pts_time:" + la clave pedida de
// metadata=print — sirve igual para YAVG (vídeo) que para RMS_level (audio).
async function extractTimeSeries(args, valueKey) {
  const { stdout } = await execFileP('ffmpeg', args, { maxBuffer: 1024 * 1024 * 256 }).catch((e) => e);
  const text = typeof stdout === 'string' ? stdout : '';
  const series = [];
  const re = new RegExp(`pts_time:([0-9.]+)[\\s\\S]*?${valueKey}=(-?[0-9.]+)`, 'g');
  let m;
  while ((m = re.exec(text))) series.push({ t: parseFloat(m[1]), value: parseFloat(m[2]) });
  return series;
}

// Busca, DENTRO de [nearSec-before, nearSec+after], el primer cruce ascendente que deje la señal
// por encima de baseline + 0.5*(pico-baseline) — baseline y pico se calculan sobre la propia
// ventana, así que no hace falta un umbral fijo en dB/brillo que dependa de la mezcla de cada tema.
function findRisingEdge(series, nearSec, before, after) {
  const win = series.filter((p) => p.t >= nearSec - before && p.t <= nearSec + after);
  if (win.length < 2) return null;
  const values = win.map((p) => p.value);
  const lo = Math.min(...values), hi = Math.max(...values);
  if (hi - lo < 1e-6) return null; // señal plana en toda la ventana: no hay golpe que localizar aquí
  const threshold = lo + 0.5 * (hi - lo);
  for (let i = 1; i < win.length; i++) {
    if (win[i - 1].value < threshold && win[i].value >= threshold) return win[i].t;
  }
  return null;
}

async function checkFile(videoPath, bpm, cfg) {
  const beat1 = cfg.introBars * cfg.beats * (60 / bpm);
  const beat2 = beat1 + 60 / bpm;
  const endWindow = beat2 + 0.6;

  const dot1X = Math.round(cfg.dotX - cfg.crop / 2);
  const dot2X = Math.round(cfg.dotX + cfg.dotSpacing - cfg.crop / 2);
  const dotY = Math.round(cfg.dotY - cfg.crop / 2);

  const [video1, video2, audio] = await Promise.all([
    extractTimeSeries(['-i', videoPath, '-t', String(endWindow),
      '-vf', `crop=${cfg.crop}:${cfg.crop}:${dot1X}:${dotY},signalstats,metadata=print:file=-`, '-f', 'null', '-'], 'lavfi\\.signalstats\\.YAVG'),
    extractTimeSeries(['-i', videoPath, '-t', String(endWindow),
      '-vf', `crop=${cfg.crop}:${cfg.crop}:${dot2X}:${dotY},signalstats,metadata=print:file=-`, '-f', 'null', '-'], 'lavfi\\.signalstats\\.YAVG'),
    extractTimeSeries(['-i', videoPath, '-t', String(endWindow),
      '-af', 'asetnsamples=n=512,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-', '-f', 'null', '-'], 'lavfi\\.astats\\.Overall\\.RMS_level'),
  ]);

  // La ventana de audio se escala con el propio periodo del beat (60/bpm): a BPM alto, el hueco
  // entre clics del conteo es corto, y una ventana ancha fija (p.ej. 0.5s) puede llegar a
  // enganchar el clic ANTERIOR en vez del golpe real que buscamos — se vio de verdad (BPM 120-160
  // del lote de Ritmo Soul, sep 2026): desfases de 400-500ms en golpe1 pero casi 0 en golpe2 del
  // MISMO archivo, algo que no tiene sentido como fallo real (un desfase real afecta a ambos
  // golpes por igual) y sí como este artefacto de medición. El lado del vídeo no tiene este
  // problema — el punto de un tiempo dado solo se enciende una vez por compás, muy lejos en el
  // tiempo (4 beats antes como muy cerca), así que su ventana puede quedarse ancha y fija.
  const beatPeriod = 60 / bpm;
  const audioWindow = Math.min(0.3, 0.35 * beatPeriod);

  const visual1 = findRisingEdge(video1, beat1, 0.5, 0.5);
  const visual2 = findRisingEdge(video2, beat2, 0.5, 0.5);
  const audio1 = findRisingEdge(audio, beat1, audioWindow, audioWindow);
  const audio2 = findRisingEdge(audio, beat2, audioWindow, audioWindow);

  const gap1 = visual1 != null && audio1 != null ? (visual1 - audio1) * 1000 : null;
  const gap2 = visual2 != null && audio2 != null ? (visual2 - audio2) * 1000 : null;
  return { beat1, beat2, visual1, visual2, audio1, audio2, gap1, gap2 };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dir) {
    console.error('Uso: node scripts/verify-rhythm-sync.js --dir <carpeta con .mp4 de Ritmo> [--tolerance-ms 100]');
    process.exitCode = 1; return;
  }
  const dir = path.resolve(args.dir);
  const cfg = {
    introBars: args['intro-bars'] !== undefined ? parseFloat(args['intro-bars']) : 2,
    beats: args.beats !== undefined ? parseFloat(args.beats) : 4,
    dotX: args['dot-x'] !== undefined ? parseFloat(args['dot-x']) : 675,
    dotY: args['dot-y'] !== undefined ? parseFloat(args['dot-y']) : 868,
    dotSpacing: args['dot-spacing'] !== undefined ? parseFloat(args['dot-spacing']) : 190,
    crop: args.crop !== undefined ? parseFloat(args.crop) : 50,
  };
  const toleranceMs = args['tolerance-ms'] !== undefined ? parseFloat(args['tolerance-ms']) : 100;

  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.mp4')).sort();
  if (!files.length) { console.error('No hay .mp4 en ' + dir); process.exitCode = 1; return; }

  console.log(`Comprobando ${files.length} vídeo(s) de Ritmo en ${dir} (tolerancia ${toleranceMs}ms)…\n`);
  let suspicious = 0, skipped = 0;
  for (const f of files) {
    const bpm = bpmFromFilename(f);
    if (!bpm) { console.log(`⚠ ${f}: sin BPM reconocible en el nombre — omitido`); skipped++; continue; }
    try {
      const r = await checkFile(path.join(dir, f), bpm, cfg);
      if (r.gap1 == null || r.gap2 == null) {
        console.log(`⚠ ${f} (${bpm} BPM): no se pudo localizar el golpe 1 y/o 2 con claridad — revisar a mano`);
        skipped++;
        continue;
      }
      const flag = Math.abs(r.gap1) > toleranceMs || Math.abs(r.gap2) > toleranceMs;
      if (flag) suspicious++;
      console.log(`${flag ? '✗ SOSPECHOSO' : '✓'} ${f} (${bpm} BPM): golpe1 desfase ${r.gap1.toFixed(0)}ms, golpe2 desfase ${r.gap2.toFixed(0)}ms`);
    } catch (e) {
      console.log(`⚠ ${f}: error al analizar (${e.message})`);
      skipped++;
    }
  }
  console.log(`\n${suspicious ? '✗' : '✓'} ${suspicious} sospechoso(s), ${skipped} omitido(s), de ${files.length} vídeo(s).`);
  process.exitCode = suspicious ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
