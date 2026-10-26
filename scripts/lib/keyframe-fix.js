/*
 * Fotogramas clave borrosos de la grabación de Playwright (2026-10-26).
 *
 * Todos los generadores graban con recordVideo de Playwright, que codifica en VP8 con parámetros fijos
 * (-b:v 1M -deadline realtime -speed 8, en playwright-core; no se pueden cambiar desde la API). Con esa
 * tasa, cada fotograma clave —uno cada 128, es decir cada 5,12 s a 25 fps— sale con menos calidad: un
 * leve "flash" borroso de TODA la imagen (medido: baja la nitidez hasta del texto fijo y del logo).
 * Alberto lo veía como un parpadeo en "Cambios entre arpegios", donde el mástil está quieto.
 *
 * keyframeFix() localiza esos fotogramas en la grabación y devuelve un trozo de filtro para la cadena
 * de vídeo del montaje final (justo después de trim+setpts): los descarta por su marca de tiempo, conservando las de
 * los demás, y fps=25 rellena cada hueco repitiendo el fotograma anterior — 40 ms en un fotograma suelto,
 * imperceptible, misma duración y misma sincronía. Alberto: "a partir de ahora los haremos todos de
 * esta forma". Para desactivarlo en un caso concreto: GV_KEEP_KEYFRAMES=1.
 */
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);

const FPS = 25; // el de recordVideo de Playwright (por defecto)

async function keyframeFix(silentPath, trimSec, log = () => {}) {
  if (process.env.GV_KEEP_KEYFRAMES === '1') return '';
  try {
    // Se leen TODOS los fotogramas (marca de tiempo y tipo), no solo los clave: hace falta el primero que
    // sobrevive al trim para saber dónde cae cada fotograma clave en la línea de tiempo del montaje.
    const r = await execFileP('ffmpeg', ['-i', silentPath, '-vf', 'showinfo', '-an', '-f', 'null', '-'],
      { maxBuffer: 256 * 1024 * 1024 });
    const frames = [...String(r.stderr).matchAll(/pts_time:([\d.]+).*?type:([IPB])/g)].map((m) => ({ t: parseFloat(m[1]), key: m[2] === 'I' }));
    // trim=start conserva los fotogramas con marca >= trimSec y setpts=PTS-STARTPTS pone el primero en 0.
    const start = frames.map((f) => f.t).filter((t) => t >= trimSec - 1e-6).sort((a, b) => a - b)[0];
    if (start === undefined) return '';
    const keys = frames.filter((f) => f.key && f.t > start + 1e-6).map((f) => +(f.t - start).toFixed(4));
    if (!keys.length) return '';
    log(`fotogramas clave borrosos de la grabación sustituidos: ${keys.length}`);
    // Por TIEMPO, no por número de fotograma (10-26): la grabación de Playwright no va a ritmo constante
    // al principio, y contar fotogramas (t×25) se desfasaba uno o dos en los primeros ~40 s —se quitaba
    // el vecino y el borroso seguía ahí: Alberto lo vio en el progresivo avanzado. Tolerancia de 5 ms,
    // muy por debajo de los 40 ms entre fotogramas.
    return `,select='not(${keys.map((t) => `lt(abs(t-${t})\\,0.005)`).join('+')})',fps=${FPS}`;
  } catch (e) {
    log('aviso: no se pudieron localizar los fotogramas clave (' + e.message + '); el vídeo sale sin corregir');
    return '';
  }
}

module.exports = { keyframeFix };
