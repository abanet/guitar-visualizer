// Comprobación tras grabar una pieza: si el recorte inicial falla (la marca de sincronía no se detecta
// y se usa la estimación de reserva), el vídeo empieza con la APP (pantalla blanca) en vez del
// reproductor negro — y además queda desfasado del audio. Visto 2026-09-28 en C Forma E (Tríadas):
// 0,75 s de la pestaña "Estructuras en escala" al empezar el capítulo. Quien graba lo repite.
const { execFile } = require('child_process');

// Brillo máximo (0-255) del primer segundo, muestreado 4 veces por segundo sobre la imagen entera
// reducida a 1 píxel. El reproductor en modo presentación ronda 5-10; la app sin él, >200.
function leadingBrightness(file) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', ['-loglevel', 'quiet', '-i', file, '-t', '1', '-vf', 'fps=4,scale=1:1,format=gray', '-f', 'rawvideo', '-'],
      { encoding: 'buffer', maxBuffer: 1 << 20 }, (err, out) => (err ? reject(err) : resolve(Math.max(0, ...out))));
  });
}
const startsWithApp = async (file) => (await leadingBrightness(file)) > 60;

// Graba con record() (devuelve la ruta del mp4) hasta que el vídeo empiece limpio, máx. `tries` veces.
async function recordWithStartCheck(record, { tries = 3, log = console.log } = {}) {
  for (let a = 1; ; a++) {
    // También se repite si la grabación falla (p.ej. TimeoutError de Playwright, racha vista de
    // madrugada 2026-09-29): antes la pieza se quedaba sin hacer y el vídeo largo salía sin capítulos.
    let out;
    try { out = await record(); } catch (e) {
      if (a >= tries) throw e;
      log(`⚠ la grabación falló (${e.name || ''} ${String(e.message || e).split('\n')[0]}) — se repite (intento ${a + 1}/${tries})`);
      await new Promise((r) => setTimeout(r, 20000));
      continue;
    }
    if (!(await startsWithApp(out))) return out;
    if (a >= tries) throw new Error(`${out}: empieza con la app a la vista tras ${tries} intentos`);
    log(`⚠ ${out} empieza con la app a la vista (recorte inicial fallido) — se repite (intento ${a + 1}/${tries})`);
  }
}
module.exports = { leadingBrightness, startsWithApp, recordWithStartCheck };
