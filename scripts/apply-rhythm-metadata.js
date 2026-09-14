#!/usr/bin/env node
/*
 * Cataloga por API un lote de vídeos de Ritmo subidos "en blanco" (sin título/descripción propios,
 * solo el título que YouTube autocompleta con el nombre de archivo) a partir de UN vídeo de
 * referencia que sí se ha subido a mano con metadatos completos (título, descripción, tags,
 * miniatura, playlist) — ver conversación: subir por la web no gasta cuota de la Data API, y
 * videos.update/thumbnails.set/playlistItems.insert cuestan 50 unidades cada uno frente a las
 * 1600 de subir por API, así que este es el camino barato para catalogar el resto del lote.
 *
 * Cómo empareja cada vídeo con su BPM: YouTube usa el nombre de archivo como título por defecto
 * si no lo tocas al subir, así que se lee el título actual de cada vídeo del canal con la MISMA
 * lógica que bpmFromFilename() en render-rhythm-video.js (número al final, o antes de un sufijo
 * "_Render"). Solo se tocan los vídeos cuyo BPM detectado tenga un .mp4 correspondiente en --dir
 * (así nunca se toca por error un vídeo del canal que no sea de este lote) y que NO sean el propio
 * vídeo de referencia.
 *
 * Plantilla de título/descripción: se coge el título/descripción del vídeo de referencia y se
 * sustituye toda aparición del número --reference-bpm por el BPM real de cada vídeo. Si ese
 * número no aparece ni una vez (o aparece muchas), se avisa — puede que el título de referencia
 * no lleve el BPM en texto, revisa el resultado en --apply=false (por defecto) antes de aplicar.
 *
 * Miniatura: por defecto se extrae un frame directo del propio .mp4 ya renderizado (ffmpeg -ss)
 * — no se genera nada a mano con PIL/etc., se reutiliza el diseño real de la app, que ya está
 * validado visualmente. Si en cambio tienes miniaturas ya diseñadas a mano (una por BPM, nombre
 * cualquiera pero con el número de BPM en algún punto del nombre — p.ej. "thumb-105-final.png"),
 * pásalas con --thumbnails <carpeta> y se usan esas en vez de sacar el frame del vídeo. El
 * emparejamiento es SOLO por número: se buscan todos los números del nombre de archivo y se
 * comprueba cuál de ellos coincide con un BPM real de --dir; si un archivo no tiene ningún número
 * reconocible como BPM del lote, o tiene varios candidatos ambiguos, se avisa y se omite (nunca
 * se adivina).
 *
 * Uso (dry-run, no cambia nada, solo imprime lo que haría):
 *   node scripts/apply-rhythm-metadata.js --token scripts/.youtube-token-todoritmos.json \
 *     --reference <videoId> --reference-bpm 100 --dir ./RitmoSoulMediumSmooth --playlist <playlistId>
 *
 * Cuando el resultado se vea bien, añade --apply para ejecutar de verdad.
 *
 * Opciones:
 *   --token <path>           Token OAuth del canal destino (obligatorio, ver youtube-whoami.js)
 *   --client-secret <path>   Por defecto scripts/lib/youtube-oauth-client.json
 *   --reference <videoId>    ID del vídeo subido a mano con metadatos completos (obligatorio)
 *   --reference-bpm <n>      BPM de ese vídeo de referencia, tal como aparece en su título/descripción (obligatorio)
 *   --dir <path>             Carpeta con los .mp4 ya renderizados (obligatorio — de aquí salen la lista de BPMs válidos y, si no hay --thumbnails, las miniaturas)
 *   --thumbnails <path>      Carpeta con miniaturas ya diseñadas, una por BPM (opcional, ver arriba)
 *   --playlist <id>          Playlist a la que añadir cada vídeo (opcional)
 *   --thumbnail-at <seg>     Segundo del vídeo del que extraer la miniatura si NO se usa --thumbnails (por defecto 5)
 *   --apply                  Sin esto, solo se imprime un dry-run — no se llama a la API de escritura
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);
const { google } = require('googleapis');
const { loadOAuthClient } = require('./upload-youtube');

const AUDIO_EXT_RE = /\.(m4a|mp3|wav|aac)$/i; // no se usa aquí pero mantiene el mismo criterio que el resto del pipeline
const VIDEO_EXT_RE = /\.mp4$/i;
const IMAGE_EXT_RE = /\.(png|jpe?g|webp)$/i;

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

// Igual que bpmFromFilename() en render-rhythm-video.js — se duplica aquí a propósito (input
// distinto: título de YouTube, no nombre de archivo en disco) en vez de importarla, para no atar
// este script a cambios futuros en el formato de nombre de los .mp4.
function bpmFromTitle(title) {
  const name = String(title || '').replace(/[_\-\s]*render$/i, '').trim();
  const m = name.match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : null;
}

function replaceBpm(text, refBpm, newBpm) {
  if (!text) return { text, count: 0 };
  const re = new RegExp(`\\b${refBpm}\\b`, 'g');
  const matches = text.match(re);
  return { text: text.replace(re, String(newBpm)), count: matches ? matches.length : 0 };
}

async function extractThumbnail(videoPath, atSec, tmpDir) {
  const out = path.join(tmpDir, path.parse(videoPath).name + '.jpg');
  await execFileP('ffmpeg', ['-y', '-ss', String(atSec), '-i', videoPath, '-frames:v', '1', '-q:v', '2', out]);
  return out;
}

// Busca, entre TODOS los números que aparecen en el nombre de archivo, cuál coincide con un BPM
// real del lote (validBpms). Si no hay ninguno o hay más de uno, se avisa y se descarta el
// archivo entero — mejor omitir una miniatura que adivinar mal a qué vídeo pertenece.
function loadThumbnailsByBpm(thumbnailsDir, validBpms) {
  const map = new Map();
  const files = fs.readdirSync(thumbnailsDir).filter((f) => IMAGE_EXT_RE.test(f));
  for (const f of files) {
    const numbers = (path.parse(f).name.match(/\d+/g) || []).map((n) => parseInt(n, 10));
    const candidates = [...new Set(numbers.filter((n) => validBpms.has(n)))];
    if (candidates.length === 0) { console.warn(`⚠ ${f}: ningún número del nombre coincide con un BPM de este lote — se omite.`); continue; }
    if (candidates.length > 1) { console.warn(`⚠ ${f}: varios números coinciden con BPMs del lote (${candidates.join(', ')}) — ambiguo, se omite. Renómbralo dejando solo el BPM.`); continue; }
    const bpm = candidates[0];
    if (map.has(bpm)) { console.warn(`⚠ ${f}: ya había otra miniatura para ${bpm} BPM (${map.get(bpm)}) — se queda la primera, revisa nombres duplicados.`); continue; }
    map.set(bpm, path.join(thumbnailsDir, f));
  }
  return map;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.token || !args.reference || !args['reference-bpm'] || !args.dir) {
    console.error('Uso: node scripts/apply-rhythm-metadata.js --token <token.json> --reference <videoId> --reference-bpm <n> --dir <carpeta> [--playlist <id>] [--apply]');
    process.exit(1);
  }
  const repoRoot = path.resolve(__dirname, '..');
  const clientSecretPath = path.resolve(args['client-secret'] || path.join(repoRoot, 'scripts/lib/youtube-oauth-client.json'));
  const tokenPath = path.resolve(args.token);
  const dir = path.resolve(args.dir);
  const refBpm = parseInt(args['reference-bpm'], 10);
  const thumbnailAt = args['thumbnail-at'] ? parseFloat(args['thumbnail-at']) : 5;
  const apply = !!args.apply;

  if (!fs.existsSync(dir)) { console.error('No existe: ' + dir); process.exit(1); }
  const localVideos = fs.readdirSync(dir).filter((f) => VIDEO_EXT_RE.test(f));
  const bpmToFile = new Map();
  for (const f of localVideos) {
    const bpm = bpmFromTitle(path.parse(f).name);
    if (bpm) bpmToFile.set(bpm, path.join(dir, f));
  }
  if (!bpmToFile.size) { console.error('Ningún .mp4 con BPM reconocible en ' + dir); process.exit(1); }
  console.log(`${bpmToFile.size} vídeos locales reconocidos (BPM): ${[...bpmToFile.keys()].sort((a, b) => a - b).join(', ')}`);

  let bpmToThumb = null;
  // Si no se pasa --thumbnails a mano, se usa <dir>/thumbnails cuando existe (convención: las
  // miniaturas diseñadas a mano viven junto a los propios .mp4, en su propia subcarpeta).
  const thumbsDir = args.thumbnails ? path.resolve(args.thumbnails) : path.join(dir, 'thumbnails');
  if (args.thumbnails && !fs.existsSync(thumbsDir)) { console.error('No existe: ' + thumbsDir); process.exit(1); }
  if (fs.existsSync(thumbsDir) && fs.statSync(thumbsDir).isDirectory()) {
    bpmToThumb = loadThumbnailsByBpm(thumbsDir, new Set(bpmToFile.keys()));
    console.log(`${bpmToThumb.size} miniatura(s) reconocidas en ${thumbsDir} (BPM): ${[...bpmToThumb.keys()].sort((a, b) => a - b).join(', ')}`);
  }

  const auth = await loadOAuthClient(clientSecretPath, tokenPath);
  const youtube = google.youtube({ version: 'v3', auth });

  const refRes = await youtube.videos.list({ part: ['snippet'], id: [args.reference] });
  const ref = refRes.data.items && refRes.data.items[0];
  if (!ref) { console.error('No se encontró el vídeo de referencia ' + args.reference + ' en este canal.'); process.exit(1); }
  const refSnippet = ref.snippet;
  console.log(`Referencia: "${refSnippet.title}" (${args.reference})`);

  const titleCheck = replaceBpm(refSnippet.title, refBpm, '{BPM}');
  const descCheck = replaceBpm(refSnippet.description, refBpm, '{BPM}');
  if (titleCheck.count !== 1) console.warn(`⚠ el título de referencia contiene el número ${refBpm} ${titleCheck.count} veces (se esperaba 1) — revisa la plantilla resultante abajo.`);
  if (descCheck.count < 1) console.warn(`⚠ la descripción de referencia no contiene el número ${refBpm} — el BPM no se sustituirá ahí.`);

  // Canal → playlist "uploads" (todos los vídeos del canal) → de ahí sacamos título+id de cada uno.
  const chRes = await youtube.channels.list({ part: ['contentDetails'], mine: true });
  const uploadsId = chRes.data.items[0].contentDetails.relatedPlaylists.uploads;
  let items = [];
  let pageToken;
  do {
    const res = await youtube.playlistItems.list({ part: ['snippet'], playlistId: uploadsId, maxResults: 50, pageToken });
    items = items.concat(res.data.items);
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  const jobs = [];
  for (const item of items) {
    const videoId = item.snippet.resourceId.videoId;
    if (videoId === args.reference) continue;
    const bpm = bpmFromTitle(item.snippet.title);
    if (!bpm || !bpmToFile.has(bpm)) continue; // no es de este lote (u otro vídeo cualquiera del canal)
    jobs.push({ videoId, bpm, currentTitle: item.snippet.title, videoPath: bpmToFile.get(bpm) });
  }
  jobs.sort((a, b) => a.bpm - b.bpm);
  if (!jobs.length) { console.error('No se encontró en el canal ningún vídeo "en blanco" cuyo título coincida con un BPM de ' + dir); process.exit(1); }

  console.log(`\n${jobs.length} vídeo(s) a catalogar (modo ${apply ? 'APLICAR' : 'DRY-RUN — no se toca nada'}):\n`);

  const tmpDir = apply ? fs.mkdtempSync(path.join(os.tmpdir(), 'gv-thumbs-')) : null;
  for (const job of jobs) {
    const newTitle = replaceBpm(refSnippet.title, refBpm, job.bpm).text;
    const newDescription = replaceBpm(refSnippet.description, refBpm, job.bpm).text;
    const manualThumb = bpmToThumb ? bpmToThumb.get(job.bpm) : null;
    console.log(`— ${job.videoId} (título actual: "${job.currentTitle}")`);
    console.log(`    título nuevo: ${newTitle}`);
    if (bpmToThumb) {
      console.log(manualThumb ? `    miniatura: ${manualThumb}` : `    ⚠ sin miniatura manual para ${job.bpm} BPM — se omite ese paso`);
    } else {
      console.log(`    miniatura de: ${job.videoPath} @ ${thumbnailAt}s`);
    }
    if (args.playlist) console.log(`    playlist: ${args.playlist}`);

    if (!apply) continue;

    await youtube.videos.update({
      part: ['snippet'],
      requestBody: {
        id: job.videoId,
        snippet: { ...refSnippet, title: newTitle, description: newDescription },
      },
    });
    const thumbPath = manualThumb || (bpmToThumb ? null : await extractThumbnail(job.videoPath, thumbnailAt, tmpDir));
    if (thumbPath) {
      await youtube.thumbnails.set({ videoId: job.videoId, media: { body: fs.createReadStream(thumbPath) } });
      if (!manualThumb) fs.unlinkSync(thumbPath);
    }
    if (args.playlist) {
      await youtube.playlistItems.insert({
        part: ['snippet'],
        requestBody: { snippet: { playlistId: args.playlist, resourceId: { kind: 'youtube#video', videoId: job.videoId } } },
      });
    }
    console.log('    ✓ hecho');
  }
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  if (!apply) console.log('\n(dry-run: repite el comando con --apply para ejecutar de verdad)');
}

main().catch((e) => { console.error(e); process.exit(1); });
