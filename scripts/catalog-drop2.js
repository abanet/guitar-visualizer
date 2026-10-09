#!/usr/bin/env node
/*
 * Cataloga la serie "Triadas Drop 2" ya subida (borradores/privados con el nombre de fichero como título:
 * <Acorde>Drop2, p.ej. CDrop2, F#dimDrop2, BbaugDrop2) en BanetMasa, UNA TÓNICA por llamada: sus cuatro
 * vídeos (mayor, menor, disminuida, aumentada). Acordado con Alberto el 2026-10-09: una tónica al día por
 * quintas a las 16:30 UTC (C 10-19 … F 10-30) y en el feed solo el mayor (la casilla del feed se quita a
 * mano en Studio en los otros tres, no por API).
 * Para cada vídeo: título, descripción, tags, categoría 27, idioma es, no infantil, miniatura, programado
 * (--publish-at) y lista pública "Triadas Drop 2 | La triada abierta" (se crea si no existe).
 * Reanudable: anota cada vídeo terminado en scripts/.catalog-drop2-done.txt; uno al que le falte la
 * miniatura queda catalogado pero SIN anotar (se repite al relanzar).
 * IDs extra (los borradores no siempre salen en la lista de subidas): scripts/.catalog-drop2-ids.txt o --extra-ids.
 *
 * Uso: node scripts/catalog-drop2.js --tonic C --publish-at 2026-10-19T16:30:00Z [--thumbs <dir>] [--dry-run]
 *      (--tonic: C G D A E B Fs Db Ab Eb Bb F)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { google } = require('googleapis');
const { loadOAuthClient } = require('./upload-youtube');

const a = {};
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith('--')) { const n = process.argv[i + 1]; if (n === undefined || n.startsWith('--')) a[k.slice(2)] = true; else { a[k.slice(2)] = n; i++; } } }
const TONICS = ['C', 'G', 'D', 'A', 'E', 'B', 'Fs', 'Db', 'Ab', 'Eb', 'Bb', 'F']; // círculo de quintas
if (!a['publish-at'] || !TONICS.includes(a.tonic)) { console.error(`Uso: --tonic <${TONICS.join('|')}> --publish-at <ISO> [--thumbs <dir>] [--dry-run]`); process.exit(1); }
const DRY = !!a['dry-run'], T = a.tonic, NAME = T.replace(/s$/, '#');
const ROOT = path.resolve(__dirname, '..');
const THUMBS = path.resolve(a.thumbs || path.join(os.homedir(), 'guitar-visualizer-assets', 'miniaturas-drop2'));
const DONE = path.join(__dirname, '.catalog-drop2-done.txt');
const done = new Set(fs.existsSync(DONE) ? fs.readFileSync(DONE, 'utf8').split('\n').filter(Boolean) : []);

// Calidades, en el orden en que se catalogan: sufijo del fichero, nombre y fórmula.
const QUALS = [
  { suf: '', name: 'mayor', formula: 'Fundamental · 3ª mayor · 5ª justa' },
  { suf: 'm', name: 'menor', formula: 'Fundamental · 3ª menor · 5ª justa' },
  { suf: 'dim', name: 'disminuida', formula: 'Fundamental · 3ª menor · 5ª disminuida' },
  { suf: 'aug', name: 'aumentada', formula: 'Fundamental · 3ª mayor · 5ª aumentada' },
];
const PL_SERIE = 'Triadas Drop 2 | La triada abierta';
const PL_SERIE_DESC = 'Las triadas Drop 2 (triadas en disposición abierta) de los 12 acordes mayores, menores, disminuidos y aumentados, posición a posición por todo el mástil y a 90 bpm.';
const PL_CERRADAS = 'Una triada por todo el mástil';
const titleFor = (q) => `Triadas Drop 2 de ${NAME} ${q.name} por todo el mástil | La triada abierta | 90 bpm`;
let PL_SERIE_ID = null, PL_CERRADAS_ID = null;
const plUrl = (id) => `https://www.youtube.com/playlist?list=${id}`;
function description(q) {
  return `Todas las triadas Drop 2 de ${NAME} ${q.name}, una detrás de otra, por todo el mástil y a 90 bpm.

Una triada Drop 2 es una triada en disposición abierta. Se toma la triada cerrada y se baja una octava la nota del medio. Así, las tres notas quedan más separadas y se distribuyen en cuerdas diferentes, creando una sonoridad más amplia y abierta que la triada cerrada.

En el vídeo se ilumina cada posición con su digitación mientras suena el acorde, y en amarillo se anuncia la posición siguiente para que puedas preparar la mano. De fondo quedan todas las notas del acorde en el mástil.

🎸 La triada ${q.name}
${q.formula}

🎯 Cómo practicarlo
1. Toca cada posición cuando se ilumine, siguiendo el ritmo de la base.
2. Fíjate en qué nota queda en el bajo en cada una: ahí está la inversión.
3. Compara cada triada abierta con su triada cerrada: son las mismas tres notas, con una de ellas una octava más abajo.
4. Cuando te las sepas, úsalas para acompañar: al estar tan abiertas dejan mucho espacio y suenan muy bien con otro instrumento.

📚 Todas las triadas Drop 2: ${plUrl(PL_SERIE_ID)}
📚 Las triadas cerradas por todo el mástil: ${plUrl(PL_CERRADAS_ID)}

#guitarra #triadas #drop2 #triadasabiertas #mástil #acordes`;
}
const tagsFor = (q) => ['guitarra', 'triadas', 'triadas drop 2', 'drop 2', 'triadas abiertas', 'triada abierta', `triada de ${NAME} ${q.name}`, `${NAME} ${q.name}`,
  `triadas ${q.name === 'mayor' ? 'mayores' : q.name === 'menor' ? 'menores' : q.name + 's'}`, 'inversiones', 'todo el mástil', 'mástil de guitarra', 'acordes de guitarra', 'acompañamiento',
  'armonía', 'ejercicios de guitarra', 'backing track', '90 bpm', 'guitar', 'drop 2 triads', 'open triads', 'spread triads', 'fretboard'];
const fileStem = (q) => `${NAME}${q.suf}Drop2`;
const thumbFor = (q) => path.join(THUMBS, `${fileStem(q)}.jpg`);
const idOf = (q) => `${T}${q.suf}`;

if (require.main === module) (async () => {
  const auth = await loadOAuthClient(path.join(ROOT, 'scripts/lib/youtube-oauth-client.json'), path.join(ROOT, 'scripts/.youtube-token.json'));
  const yt = google.youtube({ version: 'v3', auth });

  const up = (await yt.channels.list({ part: ['contentDetails'], mine: true })).data.items[0].contentDetails.relatedPlaylists.uploads;
  const ids = new Set(); let pt;
  do { const r = await yt.playlistItems.list({ part: ['contentDetails'], playlistId: up, maxResults: 50, pageToken: pt }); r.data.items.forEach((i) => ids.add(i.contentDetails.videoId)); pt = r.data.nextPageToken; } while (pt);
  if (a['extra-ids']) String(a['extra-ids']).split(',').forEach((id) => ids.add(id.trim()));
  const idsFile = path.join(__dirname, '.catalog-drop2-ids.txt');
  if (fs.existsSync(idsFile)) fs.readFileSync(idsFile, 'utf8').split(/\s+/).filter(Boolean).forEach((id) => ids.add(id));
  const all = [...ids], vids = {};
  for (let i = 0; i < all.length; i += 50) {
    const r = await yt.videos.list({ part: ['snippet', 'status'], id: all.slice(i, i + 50) });
    for (const v of r.data.items) for (const q of QUALS) if (v.snippet.title === fileStem(q) || v.snippet.title === titleFor(q)) vids[idOf(q)] = v;
  }
  const plan = QUALS.filter((q) => vids[idOf(q)] || done.has(idOf(q)));
  console.log(`${NAME}: ${plan.length} vídeos (${plan.map(idOf).join(', ')}) · ya hechos: ${plan.filter((q) => done.has(idOf(q))).length}`);
  const sin = QUALS.filter((q) => !vids[idOf(q)] && !done.has(idOf(q)));
  if (sin.length) console.log(`⚠ no encuentro subidos: ${sin.map(fileStem).join(', ')}`);

  const lists = {}; pt = undefined;
  do { const r = await yt.playlists.list({ part: ['snippet'], mine: true, maxResults: 50, pageToken: pt }); for (const p of r.data.items) lists[p.snippet.title] = p.id; pt = r.data.nextPageToken; } while (pt);
  PL_CERRADAS_ID = lists[PL_CERRADAS];
  if (!PL_CERRADAS_ID) throw new Error(`no encuentro la lista "${PL_CERRADAS}"`);
  PL_SERIE_ID = lists[PL_SERIE];
  if (!PL_SERIE_ID && DRY) console.log(`[dry] crearía la lista pública "${PL_SERIE}"`);
  else if (!PL_SERIE_ID) {
    const r = await yt.playlists.insert({ part: ['snippet', 'status'], requestBody: { snippet: { title: PL_SERIE, description: PL_SERIE_DESC, defaultLanguage: 'es' }, status: { privacyStatus: 'public' } } });
    PL_SERIE_ID = r.data.id; console.log(`✓ lista pública creada: "${PL_SERIE}" ${PL_SERIE_ID}`);
    await new Promise((res) => setTimeout(res, 5000));
  }

  let n = 0;
  for (const q of plan) {
    const key = idOf(q);
    if (done.has(key)) continue;
    const v = vids[key], title = titleFor(q), tags = tagsFor(q), thumb = thumbFor(q);
    if (DRY) { console.log(`[dry] ${v.id} "${v.snippet.title}" (${v.status.privacyStatus}) → "${title}" (${title.length}) · ${tags.length} tags (${tags.join(',').length} car.) · miniatura ${fs.existsSync(thumb) ? 'existe' : 'FALTA'}`); continue; }
    try {
      if (v.status.privacyStatus === 'public') throw new Error('ya es público — no lo toco');
      const falta = [];
      await yt.videos.update({ part: ['snippet', 'status', 'paidProductPlacementDetails'], requestBody: { id: v.id,
        snippet: { title, description: description(q), tags, categoryId: '27', defaultLanguage: 'es', defaultAudioLanguage: 'es' },
        status: { privacyStatus: 'private', publishAt: a['publish-at'], selfDeclaredMadeForKids: false, embeddable: true, license: 'youtube' },
        paidProductPlacementDetails: { hasPaidProductPlacement: false } } });
      try { await yt.thumbnails.set({ videoId: v.id, media: { body: fs.readFileSync(thumb) } }); }
      catch (e) { falta.push(`miniatura (${e.code || e.message})`); }
      const has = (await yt.playlistItems.list({ part: ['id'], playlistId: PL_SERIE_ID, videoId: v.id })).data.items.length;
      if (!has) await yt.playlistItems.insert({ part: ['snippet'], requestBody: { snippet: { playlistId: PL_SERIE_ID, resourceId: { kind: 'youtube#video', videoId: v.id } } } });
      if (falta.length) { console.log(`◐ ${key} ${v.id} "${title}" — falta: ${falta.join(', ')}`); continue; }
      fs.appendFileSync(DONE, key + '\n'); done.add(key); n++;
      console.log(`✓ ${key} ${v.id} "${title}"`);
    } catch (e) {
      const reason = e.errors && e.errors[0] && e.errors[0].reason;
      console.error(`✗ ${key} ${v.id}: ${reason || ''} ${e.message}`);
      if (reason === 'quotaExceeded' || /exceeded your.*quota/i.test(e.message)) { console.error('Cuota agotada — sigue mañana con el mismo comando.'); break; }
    }
  }
  console.log(`Completos en esta pasada: ${n} · ${NAME} ${plan.filter((q) => done.has(idOf(q))).length}/${plan.length}`);
})().catch((e) => { console.error('ERROR', e.message); process.exitCode = 1; });

module.exports = { QUALS, titleFor, tagsFor, thumbFor, description, fileStem };
