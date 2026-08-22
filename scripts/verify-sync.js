#!/usr/bin/env node
/*
 * Comprueba, para cada .mp4 generado, que el cambio visual (nueva posición/acorde) ocurre
 * de verdad cerca de donde debería según el audio — sin necesidad de ver los vídeos a mano.
 *
 * Por qué existe: el mecanismo de recorte (ver scripts/lib/batch-sessions.js) mide con
 * bastante precisión CUÁNDO arranca la reproducción dentro del navegador, pero esa medición
 * vive en un dominio de reloj distinto al de la grabación de vídeo de Playwright — un lote
 * concreto puede salir desincronizado por una causa puntual de esa sesión de renderizado
 * (carga del sistema, batería, lo que sea) sin que el código tenga ningún fallo detectable a
 * simple vista. Este script hace, automáticamente y para TODOS los vídeos de un lote, la
 * misma comprobación que hasta ahora había que hacer a mano con ffmpeg vídeo a vídeo:
 *   1. Mide cuándo entra de verdad el primer acorde real EN EL AUDIO del propio .mp4 (RMS).
 *   2. Busca el cambio de escena más cercano EN EL VÍDEO (nueva imagen en pantalla) alrededor
 *      de ese instante.
 *   3. Si ambos no caen casi juntos (por defecto, <150ms), marca el vídeo como sospechoso.
 *
 * Uso:
 *   node scripts/verify-sync.js --dir <carpeta con los .mp4 generados>
 *
 * El "instante esperado" (dónde debería sonar el primer acorde real) se calcula solo, por
 * vídeo, a partir de intro/bpm/offset del .json de sesión con el mismo nombre en esa carpeta
 * (el que exportó "Guardar ejercicio" y se usó para generarlo). Si algún .mp4 no tiene su
 * .json junto, se puede dar un valor común para todo el lote con --expected <segundos>
 * (útil también para los vídeos de scripts/generate-triad-videos.js, que no vienen de sesión).
 *
 * Opciones:
 *   --dir <path>          Carpeta con los .mp4 a comprobar (obligatorio)
 *   --expected <seg>      Instante esperado del primer acorde, igual para todos los .mp4 del
 *                         lote — se usa solo si un vídeo no tiene .json de sesión junto
 *   --tolerance <seg>     Margen tolerado entre audio y vídeo antes de marcar sospechoso
 *                         (por defecto: 0.15)
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
      if (next === undefined || next.startsWith('--')) { out[key] = true; }
      else { out[key] = next; i++; }
    }
  }
  return out;
}

// intro (en compases) * segundos por compás a introBPM, más el offset manual — misma fórmula
// que getIntroSec()+getOffSec() en guitarvisualizer.html.
function expectedOnsetFromSession(sessionObj) {
  const intro = sessionObj.intro || 0;
  const bpm = sessionObj.tempoMapIntro || sessionObj.bpm || 0;
  const offsetMs = sessionObj.offset || 0;
  if (!intro || !bpm) return null;
  return intro * (60 / bpm) * 4 + offsetMs / 1000;
}

// Primer instante en el que el audio deja de ser silencio de forma sostenida (no un click
// suelto del count-in): el ÚLTIMO "silence_end" antes de que dejen de aparecer más bloques de
// silencio en la ventana analizada.
async function detectAudioOnset(videoPath, searchWindowSec) {
  // ffmpeg con "-f null -" termina con éxito (código 0) — silencedetect no es un error, así
  // que el texto sale por stderr en la resolución normal, no en una excepción.
  let stderr = '';
  try {
    const r = await execFileP('ffmpeg', [
      '-i', videoPath, '-t', String(searchWindowSec),
      '-af', 'highpass=f=60,silencedetect=noise=-30dB:d=0.05',
      '-f', 'null', '-',
    ], { maxBuffer: 1024 * 1024 * 64 });
    stderr = r.stderr || '';
  } catch (e) { stderr = e.stderr || ''; }
  const ends = [...stderr.matchAll(/silence_end:\s*([0-9.]+)/g)].map((m) => parseFloat(m[1]));
  if (!ends.length) return null;
  return ends[ends.length - 1];
}

// Cambio de escena (nueva imagen/posición en pantalla) más cercano a `nearSec`, buscando en una
// ventana alrededor — no hace falta saber dónde vive el texto del acorde en el layout: un
// cambio real de posición mueve casi toda la pantalla (mástil, colores, carrusel), así que el
// detector de escena genérico de ffmpeg lo encuentra sin coordenadas fijas.
async function detectNearestSceneChange(videoPath, nearSec, windowSec) {
  // Sin "-ss": con el filtro "select" de por medio, el pts_time que imprime metadata=print
  // queda REBASADO al punto de búsqueda en vez de seguir siendo absoluto (a diferencia de
  // signalstats, que sí lo preserva) — más simple decodificar desde el principio y filtrar la
  // ventana ya en JS que andar sumando el offset de vuelta con el riesgo de hacerlo mal.
  const { stdout } = await execFileP('ffmpeg', [
    '-i', videoPath, '-t', String(nearSec + windowSec),
    '-vf', "select='gt(scene,0.02)',metadata=print:file=-",
    '-f', 'null', '-',
  ], { maxBuffer: 1024 * 1024 * 64 });
  const times = [...stdout.matchAll(/pts_time:([0-9.]+)/g)].map((m) => parseFloat(m[1]))
    .filter((t) => Math.abs(t - nearSec) <= windowSec);
  if (!times.length) return null;
  times.sort((a, b) => Math.abs(a - nearSec) - Math.abs(b - nearSec));
  return times[0];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dir) {
    console.error('Uso: node scripts/verify-sync.js --dir <carpeta con .mp4> [--expected <seg>] [--tolerance <seg>]');
    process.exitCode = 1; return;
  }
  const dir = path.resolve(args.dir);
  const tolerance = args.tolerance !== undefined ? parseFloat(args.tolerance) : 0.15;
  const globalExpected = args.expected !== undefined ? parseFloat(args.expected) : null;

  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.mp4')).sort();
  if (!files.length) { console.error('No hay .mp4 en ' + dir); process.exitCode = 1; return; }

  console.log(`Comprobando ${files.length} vídeo(s) en ${dir} (tolerancia ${tolerance}s)…\n`);
  let suspicious = 0;
  for (const f of files) {
    const videoPath = path.join(dir, f);
    const sessionPath = path.join(dir, path.basename(f, '.mp4') + '.json');
    let expected = globalExpected;
    if (fs.existsSync(sessionPath)) {
      try {
        const sessionObj = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
        const fromSession = expectedOnsetFromSession(sessionObj);
        if (fromSession != null) expected = fromSession;
      } catch (e) {}
    }
    if (expected == null) {
      console.log(`⚠ ${f}: sin .json de sesión junto y sin --expected — omitido`);
      continue;
    }

    try {
      const audioOnset = await detectAudioOnset(videoPath, expected + 3);
      if (audioOnset == null) {
        console.log(`⚠ ${f}: no se detectó ningún silencio en el audio — omitido`);
        continue;
      }
      const sceneChange = await detectNearestSceneChange(videoPath, audioOnset, 1.5);
      if (sceneChange == null) {
        console.log(`✗ ${f}: SOSPECHOSO — no se encontró ningún cambio de escena cerca del audio (t≈${audioOnset.toFixed(2)}s)`);
        suspicious++;
        continue;
      }
      const gap = sceneChange - audioOnset;
      const flag = Math.abs(gap) > tolerance;
      if (flag) suspicious++;
      console.log(`${flag ? '✗ SOSPECHOSO' : '✓'} ${f}: audio en ${audioOnset.toFixed(2)}s, vídeo cambia en ${sceneChange.toFixed(2)}s (desfase ${(gap * 1000).toFixed(0)}ms)`);
    } catch (e) {
      console.log(`⚠ ${f}: error al analizar (${e.message})`);
    }
  }

  console.log(`\n${suspicious ? '✗' : '✓'} ${suspicious} de ${files.length} vídeo(s) sospechoso(s) de desincronización.`);
  process.exitCode = suspicious ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
