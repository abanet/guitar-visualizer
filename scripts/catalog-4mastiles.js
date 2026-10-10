#!/usr/bin/env node
/*
 * Cataloga la serie "Triadas en 4 mástiles" (formato nuevo, estático) ya subida con el nombre de fichero como
 * título (<Acorde>_TriadasEn4Mastiles_90bpm, p.ej. "C TriadasEn4Mastiles 90bpm", "F#dim TriadasEn4Mastiles 90bpm")
 * en BanetMasa, UNA TÓNICA por llamada: sus cuatro vídeos (mayor, menor, disminuida, aumentada).
 * Acordado con Alberto el 2026-10-09: se publican TODOS de golpe (misma --publish-at para las 12 tónicas) y sin
 * feed, salvo C mayor, A menor, B disminuida y C aumentada (la casilla del feed se quita a mano en Studio).
 * Van a la lista que ya existe "Triadas | 4 mástiles simultáneos"; los 28 vídeos antiguos de esa lista se pasan
 * a privados cuando salgan estos.
 * Reanudable: scripts/.catalog-4mastiles-done.txt. IDs extra: scripts/.catalog-4mastiles-ids.txt o --extra-ids.
 *
 * Uso: node scripts/catalog-4mastiles.js --tonic C --publish-at 2026-10-14T16:00:00Z [--thumbs <dir>] [--dry-run]
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
const THUMBS = path.resolve(a.thumbs || path.join(os.homedir(), 'guitar-visualizer-assets', 'miniaturas-4mastiles'));
const DONE = path.join(__dirname, '.catalog-4mastiles-done.txt');
const done = new Set(fs.existsSync(DONE) ? fs.readFileSync(DONE, 'utf8').split('\n').filter(Boolean) : []);

// Calidades, en el orden en que se catalogan: sufijo del fichero, nombre y fórmula.
const QUALS = [
  { suf: '', name: 'mayor', formula: 'Fundamental · 3ª mayor · 5ª justa' },
  { suf: 'm', name: 'menor', formula: 'Fundamental · 3ª menor · 5ª justa' },
  { suf: 'dim', name: 'disminuida', formula: 'Fundamental · 3ª menor · 5ª disminuida' },
  { suf: 'aug', name: 'aumentada', formula: 'Fundamental · 3ª mayor · 5ª aumentada' },
];
const PL_SERIE = 'Triadas | 4 mástiles simultáneos';   // ya existe (PLNh27KOVkmlw); no se crea ni se renombra
const PL_CERRADAS = 'Una triada por todo el mástil';
const titleFor = (q) => `Triadas de ${NAME} ${q.name} en los 4 grupos de cuerdas | Todas las inversiones`;
let PL_SERIE_ID = null, PL_CERRADAS_ID = null;
const plUrl = (id) => `https://www.youtube.com/playlist?list=${id}`;
function description(q) {
  return `Todas las triadas de ${NAME} ${q.name} de un vistazo: las tres inversiones en cada uno de los cuatro grupos de tres cuerdas de la guitarra.

Cada mástil muestra un grupo de cuerdas (3-2-1, 4-3-2, 5-4-3 y 6-5-4) con sus tres figuras: fundamental, 1ª inversión y 2ª inversión. Arriba tienes las notas de cada disposición y la distancia entre ellas. A lo largo del vídeo las notas alternan entre su nombre y su intervalo, para que aprendas las dos cosas.

Suena el acorde de fondo a 90 bpm para que toques cada figura mientras la miras.

🎸 La triada ${q.name}
${q.formula}

🎯 Cómo practicarlo
1. Elige un grupo de cuerdas y toca sus tres figuras de grave a agudo y vuelta.
2. Di en voz alta qué inversión es cada una y qué nota queda en el bajo.
3. Pasa al grupo de cuerdas siguiente buscando la figura más cercana, sin saltar de zona.
4. Cuando las veas claras, cambia de acorde: las figuras son las mismas, desplazadas.

📚 Todas las triadas en 4 mástiles: ${plUrl(PL_SERIE_ID)}
📚 Practícalas enlazadas por todo el mástil: ${plUrl(PL_CERRADAS_ID)}

#guitarra #triadas #inversiones #mástil #acordes #armonía`;
}
const tagsFor = (q) => ['guitarra', 'triadas', 'inversiones de triadas', `triada de ${NAME} ${q.name}`, `${NAME} ${q.name}`,
  `triadas ${q.name === 'mayor' ? 'mayores' : q.name === 'menor' ? 'menores' : q.name + 's'}`, 'fundamental', 'primera inversión', 'segunda inversión', 'grupos de cuerdas',
  'todo el mástil', 'mástil de guitarra', 'acordes de guitarra', 'armonía', 'intervalos', 'ejercicios de guitarra', 'backing track', '90 bpm',
  'guitar', 'triads', 'triad inversions', 'string sets', 'fretboard'];
const fileStem = (q) => `${NAME}${q.suf}_TriadasEn4Mastiles_90bpm`;
const norm = (t) => t.replace(/[ _]+/g, ' ').trim();
const thumbFor = (q) => path.join(THUMBS, `${fileStem(q)}.jpg`);
const idOf = (q) => `${T}${q.suf}`;

if (require.main === module) (async () => {
  const auth = await loadOAuthClient(path.join(ROOT, 'scripts/lib/youtube-oauth-client.json'), path.join(ROOT, 'scripts/.youtube-token.json'));
  const yt = google.youtube({ version: 'v3', auth });

  const up = (await yt.channels.list({ part: ['contentDetails'], mine: true })).data.items[0].contentDetails.relatedPlaylists.uploads;
  const ids = new Set(); let pt;
  do { const r = await yt.playlistItems.list({ part: ['contentDetails'], playlistId: up, maxResults: 50, pageToken: pt }); r.data.items.forEach((i) => ids.add(i.contentDetails.videoId)); pt = r.data.nextPageToken; } while (pt);
  if (a['extra-ids']) String(a['extra-ids']).split(',').forEach((id) => ids.add(id.trim()));
  const idsFile = path.join(__dirname, '.catalog-4mastiles-ids.txt');
  if (fs.existsSync(idsFile)) fs.readFileSync(idsFile, 'utf8').split(/\s+/).filter(Boolean).forEach((id) => ids.add(id));
  const all = [...ids], vids = {};
  for (let i = 0; i < all.length; i += 50) {
    const r = await yt.videos.list({ part: ['snippet', 'status'], id: all.slice(i, i + 50) });
    for (const v of r.data.items) for (const q of QUALS) if (norm(v.snippet.title) === norm(fileStem(q)) || v.snippet.title === titleFor(q)) vids[idOf(q)] = v;
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
  if (!PL_SERIE_ID) throw new Error(`no encuentro la lista "${PL_SERIE}"`);

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
