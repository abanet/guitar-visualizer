#!/usr/bin/env node
/*
 * Genera un vídeo por cada sesión .json exportada desde la app (botón "Guardar ejercicio"),
 * usando el mismo audio para todas. A diferencia de generate-triad-videos.js (que genera las
 * tríadas desde cero con autoGenerateTriads), este script carga sesiones YA HECHAS con
 * applySession() — útil cuando ya tienes los ejercicios exportados a mano.
 *
 * Uso:
 *   node scripts/generate-videos-from-sessions.js --dir <carpeta con *.json> --audio <audio.m4a> --out <carpeta salida>
 *
 * Opciones:
 *   --app <path>         Ruta al HTML de la app (por defecto: guitarvisualizerv4_3_14(7).html)
 *   --dir <path>          Carpeta con los .json de sesión a procesar (obligatorio)
 *   --audio <path>        Audio m4a/mp3/wav, el mismo para todas las sesiones (obligatorio)
 *   --out <dir>            Carpeta de salida (por defecto: ./video-out)
 *   --extra <seg>         Segundos extra al final de cada vídeo (por defecto: 2)
 *   --vis-config <path>   JSON con la configuración visual a aplicar (opcional)
 *   --concurrency <n>     Vídeos en paralelo (por defecto: 1 — más sube el riesgo de saltos en la animación en máquinas de pocos núcleos)
 *   --width/--height      Tamaño del viewport grabado (por defecto: 1600x900)
 *
 * Nota: para lanzarlo con un clic desde la propia app (en vez de terminal), usa
 * scripts/server.js — expone este mismo runBatch() por HTTP para el botón "Generar vídeos".
 */
const path = require('path');
const fs = require('fs');
const { runBatch } = require('./lib/batch-sessions');

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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dir || !args.audio) {
    console.error('Uso: node scripts/generate-videos-from-sessions.js --dir <carpeta con .json> --audio <audio.m4a> [opciones]');
    process.exitCode = 1; return;
  }

  const repoRoot = path.resolve(__dirname, '..');
  const appPath = path.resolve(repoRoot, args.app || 'guitarvisualizerv4_3_14(7).html');
  const dir = path.resolve(args.dir);
  const audioPath = path.resolve(args.audio);
  const outDir = path.resolve(args.out || './video-out');
  const extraSec = args.extra !== undefined ? parseFloat(args.extra) : 2;
  const concurrency = args.concurrency ? parseInt(args.concurrency, 10) : 1;
  const width = args.width ? parseInt(args.width, 10) : 1600;
  const height = args.height ? parseInt(args.height, 10) : 900;
  const visConfigPath = args['vis-config'] ? path.resolve(args['vis-config']) : null;
  let visConfig = null;
  if (visConfigPath) visConfig = JSON.parse(fs.readFileSync(visConfigPath, 'utf8'));

  for (const p of [appPath, dir, audioPath]) {
    if (!fs.existsSync(p)) { console.error('No existe: ' + p); process.exitCode = 1; return; }
  }

  // Refleja en la terminal cada cambio de estado/mensaje mientras corre (mismo mecanismo que usa
  // scripts/server.js para el polling del botón "Generar vídeos" de la app).
  const lastPrinted = {};
  const onUpdate = (state) => {
    state.jobs.forEach((j) => {
      const key = `${j.status}:${j.message}:${j.error || ''}`;
      if (lastPrinted[j.tag] !== key) {
        lastPrinted[j.tag] = key;
        console.log(`[${j.tag}] ${j.status}${j.message ? ' — ' + j.message : ''}${j.error ? ' — ERROR: ' + j.error : ''}`);
      }
    });
  };

  const state = await runBatch({ appPath, dir, audioPath, outDir, extraSec, visConfig, visConfigPath, concurrency, width, height, onUpdate });

  if (state.fatalError) {
    console.error('Error: ' + state.fatalError);
    process.exitCode = 1; return;
  }
  console.log(`\nHecho en ${((state.finishedAt - state.startedAt) / 1000).toFixed(1)}s: ${state.ok}/${state.jobs.length} vídeos generados en ${outDir}`);
  if (state.skipped && state.skipped.length) console.log('Omitidos (no parecían sesiones): ' + state.skipped.join(', '));
  state.jobs.filter((j) => j.status === 'error').forEach((j) => console.error(`  ✗ ${j.tag}: ${j.error}`));

  process.exitCode = state.fail ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
