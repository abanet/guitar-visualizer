#!/usr/bin/env node
/*
 * Genera la lista de "capítulos" de YouTube (líneas "M:SS Texto") para pegar en la descripción o
 * en un comentario del vídeo de tempo progresivo — un enlace por cada BPM redondo (múltiplo de
 * --every, por defecto 10) para que quien lo vea pueda saltar directamente a, por ejemplo,
 * "cuando suena a 60 BPM" — YouTube convierte automáticamente cualquier "M:SS" en un enlace que
 * salta ahí, tanto en la descripción (que además los agrupa como capítulos reales si el primero
 * es 0:00 y hay al menos 3, separados 10s o más) como en un comentario normal.
 *
 * Usa el mismo mapa de tempo del XML que --xml en render-rhythm-video.js, y replica en Node la
 * fórmula de getBarStartTime()/getIntroSec() de guitarvisualizer.html (duración de un compás =
 * beats*(60/bpm), acumulada desde el fin de la intro). A diferencia de render-rhythm-video.js —
 * que delega TODO el cálculo de tiempos en el propio navegador para no arriesgarse a que este
 * script y la app se desincronicen— aquí sí se reimplementa la fórmula en Node: un timestamp de
 * YouTube es como mucho a nivel de segundo entero, así que el margen de una reimplementación
 * (unos pocos ms, si acaso) es irrelevante para este uso, y evita levantar un navegador entero
 * solo para leer un número.
 *
 * Uso:
 *   node scripts/generate-youtube-chapters.js --xml tema.xml
 *   node scripts/generate-youtube-chapters.js --xml tema.xml --every 10 --beats 4 --out capitulos.txt
 *
 * Opciones:
 *   --xml <path>         MusicXML con mapa de tempo (obligatorio)
 *   --every <n>           Marcar solo los BPM múltiplos de n (por defecto: 10)
 *   --beats <n>           Tiempos por compás (por defecto: 4, igual que el resto de la app)
 *   --intro-bars <n>      Compases de intro/claqueta antes del primer compás real (por defecto:
 *                         se detecta del propio XML, igual que hace la app al cargarlo — el
 *                         primer compás con acorde marca dónde empieza el cuerpo)
 *   --offset-ms <n>       Offset fino en ms, solo si el vídeo se generó con --offset-ms distinto
 *                         de 0 (por defecto: 0)
 *   --out <path>          Si se pasa, además de imprimir por pantalla, guarda el texto ahí
 */
const fs = require('fs');
const path = require('path');
const { parseTempoByMeasure } = require('./lib/tempo-progression');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) { out[key] = true; }
      else { out[key] = next; i++; }
    }
  }
  return out;
}

// Mismo criterio que loadXML() en guitarvisualizer.html: el primer compás del primer <part> que
// trae un <harmony> marca dónde acaba la intro/claqueta.
function detectIntroBarsFromXml(xmlText) {
  const partMatch = xmlText.match(/<part\b[^>]*>([\s\S]*?)<\/part>/);
  const partContent = partMatch ? partMatch[1] : xmlText;
  const measureRe = /<measure\b[^>]*?(?:\/>|>([\s\S]*?)<\/measure>)/g;
  let m, idx = 0;
  while ((m = measureRe.exec(partContent))) {
    if (/<harmony\b/.test(m[1] || '')) return idx;
    idx++;
  }
  return 0;
}

function fmtChapter(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

function buildChapters(xmlText, { beats, every, introBars, offSec }) {
  const temposByMeasure = parseTempoByMeasure(xmlText); // ya recortado a partir del primer acorde
  if (!temposByMeasure.length) throw new Error('No se encontró ningún compás con tempo en el XML.');
  if (introBars === undefined) introBars = detectIntroBarsFromXml(xmlText);

  const introSec = introBars * beats * (60 / temposByMeasure[0]);

  // Tiempo (en el vídeo ya renderizado) en que arranca cada compás, acumulando la duración real
  // de cada compás anterior — misma fórmula que getBarStartTime() en guitarvisualizer.html.
  const barStart = new Array(temposByMeasure.length);
  let t = introSec + offSec;
  for (let i = 0; i < temposByMeasure.length; i++) {
    barStart[i] = t;
    t += beats * (60 / temposByMeasure[i]);
  }

  const chapters = [{ sec: 0, bpm: temposByMeasure[0] }];
  let prevBpm = temposByMeasure[0];
  temposByMeasure.forEach((bpm, i) => {
    if (bpm !== prevBpm && bpm % every === 0) chapters.push({ sec: barStart[i], bpm });
    prevBpm = bpm;
  });
  return chapters;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.xml) {
    console.error('Uso: node scripts/generate-youtube-chapters.js --xml <archivo.xml> [--every 10] [--beats 4] [--out capitulos.txt]');
    process.exit(1);
  }
  const xmlPath = path.resolve(args.xml);
  if (!fs.existsSync(xmlPath)) { console.error('No existe: ' + xmlPath); process.exit(1); }
  const xmlText = fs.readFileSync(xmlPath, 'utf8');

  const beats = args.beats ? parseInt(args.beats, 10) : 4;
  const every = args.every ? parseInt(args.every, 10) : 10;
  const introBars = args['intro-bars'] !== undefined ? parseInt(args['intro-bars'], 10) : undefined;
  const offSec = args['offset-ms'] !== undefined ? parseFloat(args['offset-ms']) / 1000 : 0;

  let chapters;
  try {
    chapters = buildChapters(xmlText, { beats, every, introBars, offSec });
  } catch (e) { console.error(e.message); process.exit(1); }

  const text = chapters.map((c) => `${fmtChapter(c.sec)} ${c.bpm} BPM`).join('\n');
  console.log(text);
  if (args.out) {
    fs.writeFileSync(path.resolve(args.out), text + '\n');
    console.error('\nGuardado en ' + path.resolve(args.out));
  }
}

if (require.main === module) main();
module.exports = { buildChapters, fmtChapter, detectIntroBarsFromXml };
