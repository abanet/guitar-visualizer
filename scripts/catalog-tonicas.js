#!/usr/bin/env node
/*
 * Cataloga la serie "Localiza la tónica" ya subida (privada, título = nombre de fichero) en BanetMasa:
 *   - 2 de todo el mástil (QuintasMayores… / MayoresxCuartas… LocalizaTonica)
 *   - 60 por forma (EscalaCTriadasEscala <Tono> Notas forma<X>)
 * Para cada vídeo: título, descripción, tags, categoría 27, idioma es, no infantil, sin publicidad
 * pagada, miniatura, programado (--publish-at, sin notificar: eso se decide al subir, no por API) y listas:
 *   - pública "Localiza las notas en el mástil" (todos, en orden de publicación)
 *   - oculta "Ejercicios en <Tono> mayor" (los 60 por forma)
 *   - pública existente "¡Conquista el Mástil! 🚀🎸🎸" (los 2 de todo el mástil)
 * Acordado con Alberto 2026-10-01. Reanudable: anota cada vídeo terminado en --done (por defecto
 * scripts/.catalog-tonicas-done.txt) y se para limpio al agotar la cuota (seguir al día siguiente).
 *
 * Uso: node scripts/catalog-tonicas.js --publish-at 2026-10-03T10:00:00Z [--dry-run] [--limit N]
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { google } = require('googleapis');
const { loadOAuthClient } = require('./upload-youtube');

const a = {};
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith('--')) { const n = process.argv[i + 1]; if (n === undefined || n.startsWith('--')) a[k.slice(2)] = true; else { a[k.slice(2)] = n; i++; } } }
if (!a['publish-at']) { console.error('Falta --publish-at'); process.exit(1); }
const DRY = !!a['dry-run'], LIMIT = a.limit ? parseInt(a.limit, 10) : Infinity;
const ROOT = path.resolve(__dirname, '..');
const LT = path.join(os.homedir(), 'Downloads', 'LocalizaTonica');
const DONE = path.resolve(a.done || path.join(__dirname, '.catalog-tonicas-done.txt'));
const done = new Set(fs.existsSync(DONE) ? fs.readFileSync(DONE, 'utf8').split('\n').filter(Boolean) : []);

const KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'Fs', 'Db', 'Ab', 'Eb', 'Bb', 'F']; // círculo de quintas
const FORMS = ['C', 'A', 'G', 'E', 'D'];
const NAME = (k) => k.replace(/s$/, '#');
// Acordes diatónicos con su grafía correcta (sin repetir letra).
const CHORDS = {
  C: 'C Dm Em F G Am Bdim', G: 'G Am Bm C D Em F#dim', D: 'D Em F#m G A Bm C#dim', A: 'A Bm C#m D E F#m G#dim',
  E: 'E F#m G#m A B C#m D#dim', B: 'B C#m D#m E F# G#m A#dim', Fs: 'F# G#m A#m B C# D#m E#dim',
  Db: 'Db Ebm Fm Gb Ab Bbm Cdim', Ab: 'Ab Bbm Cm Db Eb Fm Gdim', Eb: 'Eb Fm Gm Ab Bb Cm Ddim',
  Bb: 'Bb Cm Dm Eb F Gm Adim', F: 'F Gm Am Bb C Dm Edim',
};
const DEG = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];

const PL_SERIE = 'Localiza las notas en el mástil';
const PL_CONQUISTA = '¡Conquista el Mástil! 🚀🎸🎸';
const PL_KEY = (k) => `Ejercicios en ${NAME(k)} mayor`;

function descForma(k, f, serieUrl) {
  const n = NAME(k), ch = CHORDS[k].split(' ').map((c, i) => `${DEG[i]} ${c}`).join(' · ');
  return `¿Sabes dónde está la tónica de cada acorde de ${n} mayor dentro de la Forma ${f}? En este ejercicio la vas a encontrar sin pensar.

Suena la progresión de los 7 acordes de la escala de ${n} mayor y, en cada acorde, se iluminan todas sus tónicas dentro de la Forma ${f} del sistema CAGED. Las notas de la escala quedan de fondo como referencia y arriba ves en todo momento qué grado está sonando.

🎸 Los acordes de ${n} mayor
${ch}

🎯 Cómo practicarlo
1. Primera vuelta: solo mira. Fíjate en cuántas veces aparece cada tónica dentro de la forma y en qué cuerdas.
2. Segunda vuelta: di el nombre de la nota en voz alta justo cuando cambia el acorde, antes de mirar.
3. Después, toca la tónica en cuanto suene el acorde. Empieza por la más cómoda y ve añadiendo las demás.
4. Reto final: cierra los ojos y búscalas de memoria. Abre solo para comprobar.

💡 Saber dónde está la tónica de cada acorde es la base para improvisar siguiendo la armonía, construir arpegios y moverte por la escala sin perderte. Cuando lo domines en una forma, pasa a la siguiente: las 5 formas juntas cubren todo el mástil.

📚 La serie completa (12 tonalidades × 5 formas): ${serieUrl}

#guitarra #CAGED #escalamayor #mástil #tónicas #improvisación`;
}
function descCirculo(quintas, serieUrl) {
  const route = quintas ? 'C · G · D · A · E · B · F# · Db · Ab · Eb · Bb · F' : 'C · F · Bb · Eb · Ab · Db · F# · B · E · A · D · G';
  const c = quintas ? 'quintas' : 'cuartas';
  return `Localiza todas las notas de la guitarra en los 15 primeros trastes, una a una, siguiendo el círculo de ${c}. Al terminar tendrás el mástil entero en la cabeza.

Cada acorde dura 5 compases. Sus tónicas aparecen una cada 2 tiempos, de izquierda a derecha y en zigzag: cuando acaba un acorde, la siguiente nota empieza por la más cercana a la última. Las notas que ya has encontrado se quedan como referencia hasta que todo el mástil queda completo.

🎵 El recorrido
${route}

🎯 Cómo practicarlo
1. Antes de que aparezca cada nota, intenta adivinar dónde va a salir. La barra de progreso y la cuenta atrás te avisan de cuándo cambia la nota.
2. Toca cada nota en cuanto se ilumina y di su nombre en voz alta.
3. Cuando lo tengas dominado, ve por delante del vídeo: busca la siguiente nota antes de que aparezca.

💡 Es el mismo recorrido que la serie "Tónicas de los acordes", pero en todo el mástil y sin escala de fondo: perfecto como calentamiento o para repasar.

📚 Más ejercicios para localizar notas: ${serieUrl}

#guitarra #mástil #notasdelaguitarra #círculode${c} #ejercicios`;
}
const tagsForma = (k, f) => {
  const n = NAME(k);
  return ['guitarra', 'tónicas', 'tónica de los acordes', 'CAGED', `forma ${f}`, `forma ${f} CAGED`, 'sistema CAGED', 'escala mayor',
    `escala de ${n} mayor`, `${n} mayor`, 'grados de la escala', 'acordes de la escala', 'armonía', 'mástil de guitarra',
    'localizar notas', 'notas en el mástil', 'improvisación', 'ejercicios de guitarra', 'guitar', 'CAGED system',
    'chord roots', 'root notes', 'fretboard', 'major scale'];
};
const tagsCirculo = (quintas) => ['guitarra', 'notas de la guitarra', 'notas en el mástil', 'aprender el mástil', 'localizar notas',
  quintas ? 'círculo de quintas' : 'círculo de cuartas', 'ejercicios de guitarra', 'mástil de guitarra', 'tónicas', 'calentamiento guitarra',
  'fretboard', 'guitar notes', 'learn the fretboard', quintas ? 'circle of fifths' : 'circle of fourths', 'guitar exercises'];

// JPG < 2 MB para YouTube (las plantillas PNG de Alberto rozan el límite).
function jpgFor(png) {
  const out = path.join(os.tmpdir(), path.basename(png).replace(/\.png$/i, '.jpg').replace(/\s+/g, '_'));
  if (!fs.existsSync(out)) execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '88', png, '--out', out], { stdio: 'ignore' });
  return out;
}

(async () => {
  const auth = await loadOAuthClient(path.join(ROOT, 'scripts/lib/youtube-oauth-client.json'), path.join(ROOT, 'scripts/.youtube-token.json'));
  const yt = google.youtube({ version: 'v3', auth });

  // Vídeos privados de la serie (título = nombre de fichero, subidos por Alberto).
  const up = (await yt.channels.list({ part: ['contentDetails'], mine: true })).data.items[0].contentDetails.relatedPlaylists.uploads;
  const ids = []; let pt;
  do { const r = await yt.playlistItems.list({ part: ['contentDetails'], playlistId: up, maxResults: 50, pageToken: pt }); ids.push(...r.data.items.map((i) => i.contentDetails.videoId)); pt = r.data.nextPageToken; } while (pt);
  const vids = {};
  for (let i = 0; i < ids.length; i += 50) {
    const r = await yt.videos.list({ part: ['snippet', 'status'], id: ids.slice(i, i + 50) });
    for (const v of r.data.items) {
      const t = v.snippet.title;
      let m;
      if ((m = t.match(/^EscalaCTriadasEscala[ _-]([A-G](?:s|b)?)[ _-]Notas[ _-]forma([CAGED])$/))) vids[`${m[1]}-${m[2]}`] = v;
      else if (/^QuintasMayores.*LocalizaTonica$/.test(t)) vids.quintas = v;
      else if (/^MayoresxCuartas.*LocalizaTonica$/.test(t)) vids.cuartas = v;
      // Vídeos a medio catalogar (ya con el título final pero sin anotar en --done).
      else if ((m = t.match(/^Tónicas de los acordes en ([A-G][#b]?) mayor \| Forma ([CAGED]) \(CAGED\)$/))) vids[`${m[1].replace('#', 's')}-${m[2]}`] = v;
      else if ((m = t.match(/^Localiza las notas en todo el mástil \| Por (quintas|cuartas)$/))) vids[m[1]] = v;
    }
  }
  const plan = ['quintas', 'cuartas', ...KEYS.flatMap((k) => FORMS.map((f) => `${k}-${f}`))];
  const missing = plan.filter((p) => !vids[p] && !done.has(p));
  console.log(`Encontrados ${plan.length - missing.length}/${plan.length} (ya hechos: ${done.size})${missing.length ? ' · faltan: ' + missing.join(', ') : ''}`);

  // Listas: buscar por nombre exacto; crear si no existen.
  const lists = {}; pt = undefined;
  do { const r = await yt.playlists.list({ part: ['snippet'], mine: true, maxResults: 50, pageToken: pt }); for (const p of r.data.items) lists[p.snippet.title] = p.id; pt = r.data.nextPageToken; } while (pt);
  async function ensure(name, privacy, description) {
    if (lists[name]) return lists[name];
    if (DRY) { console.log(`[dry] crearía lista ${privacy} "${name}"`); return 'DRY'; }
    const r = await yt.playlists.insert({ part: ['snippet', 'status'], requestBody: { snippet: { title: name, description, defaultLanguage: 'es' }, status: { privacyStatus: privacy } } });
    console.log(`✓ lista ${privacy} creada: "${name}" ${r.data.id}`);
    await new Promise((res) => setTimeout(res, 5000)); // propagación (ver catalog-youtube-video.js)
    return (lists[name] = r.data.id);
  }
  const serieId = await ensure(PL_SERIE, 'public', 'Ejercicios para localizar las notas en el mástil de la guitarra: las tónicas de los acordes de la escala mayor en cada forma CAGED (12 tonalidades × 5 formas) y todas las notas en el mástil siguiendo el círculo de quintas y de cuartas.');
  const serieUrl = `https://www.youtube.com/playlist?list=${serieId}`;
  if (!lists[PL_CONQUISTA]) console.log(`⚠ no encuentro la lista "${PL_CONQUISTA}" — los de todo el mástil irán solo a la de la serie`);

  let n = 0;
  for (const key of plan) {
    if (done.has(key)) continue;
    if (n >= LIMIT) break;
    const v = vids[key]; if (!v) continue;
    const circ = key === 'quintas' || key === 'cuartas';
    const [k, f] = circ ? [] : key.split('-');
    const title = circ ? `Localiza las notas en todo el mástil | Por ${key}` : `Tónicas de los acordes en ${NAME(k)} mayor | Forma ${f} (CAGED)`;
    const description = circ ? descCirculo(key === 'quintas', serieUrl) : descForma(k, f, serieUrl);
    const tags = circ ? tagsCirculo(key === 'quintas') : tagsForma(k, f);
    const thumb = circ
      ? jpgFor(path.join(LT, 'thumbnails', `Localiza las notas por ${key}.png`))
      : path.join(LT, 'formas', 'thumbnails', `EscalaCTriadasEscala-${k}_Notas_forma${f}.jpg`);
    // Si YouTube no deja crear la lista de tonalidad (límite de creación), se cataloga igual y queda sin anotar en --done.
    let keyList = null, pending = false;
    if (!circ) {
      try { keyList = await ensure(PL_KEY(k), 'unlisted', `Todos los ejercicios del canal en la tonalidad de ${NAME(k)} mayor, para practicar por tonalidad.`); }
      catch (e) { pending = true; console.error(`⚠ no se pudo crear "${PL_KEY(k)}": ${e.message}`); }
    }
    const listsFor = circ ? [serieId, lists[PL_CONQUISTA]].filter(Boolean) : [serieId, keyList].filter(Boolean);
    if (DRY) { console.log(`[dry] ${v.id} "${v.snippet.title}" → "${title}" · ${tags.length} tags · ${path.basename(thumb)} · listas ${listsFor.length}`); n++; continue; }
    try {
      if (v.status.privacyStatus === 'public') throw new Error('ya es público — no lo toco');
      await yt.videos.update({ part: ['snippet', 'status', 'paidProductPlacementDetails'], requestBody: { id: v.id,
        snippet: { title, description, tags, categoryId: '27', defaultLanguage: 'es', defaultAudioLanguage: 'es' },
        status: { privacyStatus: 'private', publishAt: a['publish-at'], selfDeclaredMadeForKids: false, embeddable: true, license: 'youtube' },
        paidProductPlacementDetails: { hasPaidProductPlacement: false } } });
      if (!fs.existsSync(thumb)) throw new Error('falta miniatura ' + thumb);
      await yt.thumbnails.set({ videoId: v.id, media: { body: fs.createReadStream(thumb) } });
      for (const pl of listsFor) {
        const has = (await yt.playlistItems.list({ part: ['id'], playlistId: pl, videoId: v.id })).data.items.length;
        if (!has) await yt.playlistItems.insert({ part: ['snippet'], requestBody: { snippet: { playlistId: pl, resourceId: { kind: 'youtube#video', videoId: v.id } } } });
      }
      if (pending) { console.log(`◐ ${key} ${v.id} "${title}" — falta la lista "${PL_KEY(k)}"`); continue; }
      fs.appendFileSync(DONE, key + '\n'); done.add(key); n++;
      console.log(`✓ ${key} ${v.id} "${title}"`);
    } catch (e) {
      const reason = e.errors && e.errors[0] && e.errors[0].reason;
      console.error(`✗ ${key} ${v.id}: ${reason || ''} ${e.message}`);
      if (reason === 'quotaExceeded' || /quota/i.test(e.message)) { console.error('Cuota agotada — sigue mañana con el mismo comando.'); break; }
    }
  }
  console.log(`Hechos en esta pasada: ${n} · total ${done.size}/${plan.length}`);
})().catch((e) => { console.error('ERROR', e.message); process.exitCode = 1; });
