#!/usr/bin/env node
/*
 * Calendario de Reels de Instagram + página de Facebook (2026-10-25). Lee
 * ~/guitar-visualizer-assets/shorts/calendario.json y publica con publish-meta.js las entradas cuya
 * hora ya ha llegado. Sin tarea automática (Alberto 2026-10-25: el Mac está apagado muchas veces,
 * "iremos publicando en las sesiones que tengamos abiertas"): se lanza a mano o en un bucle de la
 * sesión de Claude, y al empezar cada sesión conviene mirar `--lista`.
 *
 * Instagram no deja programar Reels por API, por eso el calendario es nuestro. Reglas:
 *  - Solo publica entradas con "aprobado": true. Alberto aprueba cada texto antes de que salga
 *    (publicar es público e irreversible); las propuestas entran con aprobado false.
 *  - Una sola publicación por ejecución: si el Mac estuvo apagado y se acumulan varias, salen
 *    espaciadas en vez de todas de golpe.
 *  - No publica algo más de 12 h tarde salvo con --aunque-tarde: lo deja como "atrasado" para
 *    decidir con Alberto si sale ya o se replanifica (con sesiones manuales pasará a menudo).
 *  - El enlace de Facebook apunta al vídeo de YouTube: la entrada lleva "youtube_publico_desde" y no
 *    sale antes de esa hora (los vídeos del canal se programan días antes de hacerse públicos).
 *
 * Entrada:
 *   { "id": "pentatonica_menor_A_E", "cuando": "2026-10-27T20:30:00+01:00",
 *     "video": "short_….mp4", "ig": "texto…", "fb": "texto…", "youtube": "https://youtu.be/…",
 *     "youtube_publico_desde": "2026-10-27T18:00:00Z", "aprobado": false, "estado": "pendiente" }
 * Al publicar se añaden "estado": "publicado", "publicado_en", "ig_url", "fb_url".
 *
 * Uso: node scripts/publish-meta-calendario.js [--lista] [--simular] [--aunque-tarde]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR = path.join(os.homedir(), 'guitar-visualizer-assets', 'shorts');
const CAL = path.join(DIR, 'calendario.json');
const MAX_RETRASO_MS = 12 * 3600 * 1000;

const cal = JSON.parse(fs.readFileSync(CAL, 'utf8'));
const guardar = () => fs.writeFileSync(CAL, JSON.stringify(cal, null, 2) + '\n');
const ahora = Date.now();
const log = m => console.log(`[${new Date().toISOString()}] ${m}`);

if (process.argv.includes('--lista')) {
  for (const e of cal) {
    const f = new Date(e.cuando).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const atrasado = (e.estado || 'pendiente') === 'pendiente' && ahora - Date.parse(e.cuando) > MAX_RETRASO_MS;
    console.log(`${f}  ${(atrasado ? 'ATRASADO' : e.estado || 'pendiente').padEnd(10)} ${e.aprobado ? 'aprobado ' : 'SIN OK   '} ${e.id}${fs.existsSync(path.join(DIR, e.video)) ? '' : '  (falta vídeo)'}`);
  }
  process.exit(0);
}

for (const e of cal) {
  if ((e.estado || 'pendiente') !== 'pendiente' || !e.aprobado) continue;
  const t = Date.parse(e.cuando);
  if (t > ahora) continue;
  if (e.youtube_publico_desde && Date.parse(e.youtube_publico_desde) > ahora) continue;
  if (ahora - t > MAX_RETRASO_MS && !process.argv.includes('--aunque-tarde')) { log(`atrasado (más de 12 h): ${e.id} — sale con --aunque-tarde o se replanifica`); continue; }
  const video = path.join(DIR, e.video);
  if (!fs.existsSync(video)) { log(`falta el vídeo de ${e.id}: ${video}`); continue; }
  if (process.argv.includes('--simular')) { log(`publicaría ${e.id}`); break; }
  log(`publicando ${e.id}`);
  try {
    const out = execFileSync(process.execPath, [path.join(__dirname, 'publish-meta.js'), '--video', video, '--texto', e.ig, '--texto-fb', e.fb || e.ig],
      { encoding: 'utf8', timeout: 15 * 60 * 1000 });
    e.ig_url = (out.match(/Instagram: (\S+)/) || [])[1];
    e.fb_url = (out.match(/Facebook: (\S+)/) || [])[1];
    e.estado = 'publicado';
    e.publicado_en = new Date().toISOString();
    log(out.trim());
  } catch (err) {
    // Si falla a medias (p. ej. Instagram sí y Facebook no) se marca para revisarlo a mano: reintentar
    // a ciegas publicaría el Reel dos veces en la red que sí funcionó.
    e.estado = 'error';
    e.error = String(err.stderr || err.message).trim().slice(0, 500);
    log(`ERROR ${e.id}: ${e.error}`);
  }
  guardar();
  break;
}
