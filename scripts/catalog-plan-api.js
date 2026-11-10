#!/usr/bin/env node
/*
 * Cataloga por la API un PLAN de catalogación (los .json que dejan catalog-patrones-nuevos.js,
 * catalog-cambios-arpegio.js…) sobre los borradores que Alberto sube desde Studio.
 *
 * Por qué (11-06): Studio por Chrome gasta muchos tokens, y catalog-youtube-video.js hace un vídeo por llamada, con
 * una sola lista y solo inglés. Aquí, por cada entrada del plan:
 *   1. Busca el borrador por título. Studio titula con el nombre del fichero, cambiando _ y - por espacios.
 *   2. videos.update: snippet, status (privado + publishAt) y localizations (los idiomas que traiga la entrada).
 *   3. thumbnails.set con su miniatura.
 *   4. playlistItems.insert en cada lista. Si una lista no existe, se crea pública.
 *   Total: ~200 unidades por vídeo con 2 listas.
 * El hueco "(enlace de la lista)" de los textos se rellena con la URL de la primera lista, en todos los idiomas.
 * La casilla del feed no existe en la API: el informe final lista los vídeos con feed:true para hacerlos en Studio.
 * Reanudable: lo hecho se guarda en <plan>.hechos.json; si la cuota se acaba, para y sigue al día siguiente.
 *
 * Uso: node scripts/catalog-plan-api.js --plan <plan.json> [--solo <texto en el stem>] [--max N] [--dry-run]
 *        [--nombre-subida <js: e => nombre del fichero subido>] [--miniatura <js: e => ruta de la miniatura>] [--token …]
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { google } = require('googleapis');
const { loadOAuthClient } = require('./upload-youtube');

const a = {};
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith('--')) { const n = process.argv[i + 1]; if (n === undefined || n.startsWith('--')) a[k.slice(2)] = true; else { a[k.slice(2)] = n; i++; } } }
const root = path.resolve(__dirname, '..');
const planPath = path.resolve(a.plan);
const hechosPath = planPath.replace(/\.json$/, '') + '.hechos.json';
const norm = (s) => s.replace(/\.mp4$/i, '').replace(/[_\-–]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
// Nombre con que se subió (sin .mp4). Por defecto, el del fichero del plan; los I7-IV7 llevan sufijo de serie.
const nombreSubida = a['nombre-subida'] ? eval(a['nombre-subida']) : (e) => path.basename(e.file || e.stem);
const ESCAPARATE = /\(arriba\)$/;   // listas que se ordenan a mano (escaparates): no se tocan por aquí

async function main() {
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const hechos = fs.existsSync(hechosPath) ? JSON.parse(fs.readFileSync(hechosPath, 'utf8')) : {};
  const auth = await loadOAuthClient(path.join(root, 'scripts/lib/youtube-oauth-client.json'), path.resolve(a.token || path.join(root, 'scripts/.youtube-token.json')));
  const yt = google.youtube({ version: 'v3', auth });
  const ch = (await yt.channels.list({ part: ['contentDetails', 'snippet'], mine: true })).data.items[0];
  console.log('Canal:', ch.snippet.title);

  // Borradores recientes por título normalizado (12 páginas = 600 subidas; con 6 se quedaban fuera borradores antiguos tras subir 100 nuevos, 11-10).
  const porTitulo = new Map();
  let t;
  for (let p = 0; p < 12; p++) {
    const r = await yt.playlistItems.list({ part: ['snippet'], playlistId: ch.contentDetails.relatedPlaylists.uploads, maxResults: 50, pageToken: t });
    r.data.items.forEach((it) => { const k = norm(it.snippet.title); if (!porTitulo.has(k)) porTitulo.set(k, it.snippet.resourceId.videoId); });
    t = r.data.nextPageToken; if (!t) break;
  }
  // Listas del canal.
  const listas = new Map();
  t = undefined;
  do { const r = await yt.playlists.list({ part: ['snippet'], mine: true, maxResults: 50, pageToken: t }); r.data.items.forEach((p) => listas.set(p.snippet.title, p.id)); t = r.data.nextPageToken; } while (t);
  const lista = async (nombre) => {
    if (listas.has(nombre)) return listas.get(nombre);
    if (a['dry-run']) return 'NUEVA';
    const r = await yt.playlists.insert({ part: ['snippet', 'status'], requestBody: { snippet: { title: nombre, defaultLanguage: 'es' }, status: { privacyStatus: 'public' } } });
    console.log(`  + lista nueva: ${nombre} (${r.data.id})`); listas.set(nombre, r.data.id); return r.data.id;
  };

  const cola = plan.filter((e) => !hechos[e.stem + (e.serie ? '|' + e.serie : '')] && (!a.solo || (e.stem + (e.serie || '')).includes(a.solo)));
  let n = 0;
  const feed = [];
  for (const e of cola) {
    if (a.max && n >= Number(a.max)) break;
    const clave = e.stem + (e.serie ? '|' + e.serie : '');
    const id = porTitulo.get(norm(nombreSubida(e)));
    if (!id) continue;   // aún no subido
    const nombresListas = (e.listas || []).filter((l) => l && !ESCAPARATE.test(l));
    if (a['dry-run']) { console.log(`[dry] ${id} ${e.title} → ${nombresListas.join(' + ')} · ${e.publishAtUTC}`); n++; continue; }
    try {
      const ids = []; for (const l of nombresListas) ids.push(await lista(l));
      const url = ids[0] ? `https://www.youtube.com/playlist?list=${ids[0]}` : '';
      const rell = (s) => (s || '').split('(enlace de la lista)').join(url);
      const loc = {};
      for (const [l, x] of Object.entries(e.localizations || {})) loc[l] = { title: x.title, description: rell(x.description) };
      if (e.titleEn && !loc.en) loc.en = { title: e.titleEn, description: rell(e.descriptionEn) };
      await yt.videos.update({ part: ['snippet', 'status', 'localizations'], requestBody: { id,
        snippet: { title: e.title, description: rell(e.description), tags: e.tags, categoryId: e.categoryId || '27', defaultLanguage: 'es', defaultAudioLanguage: 'es' },
        status: e.publishAtUTC ? { privacyStatus: 'private', publishAt: e.publishAtUTC, selfDeclaredMadeForKids: false } : { privacyStatus: 'public', selfDeclaredMadeForKids: false },   // sin fecha = público ya
        localizations: loc } });
      // --miniatura "e => ruta" para planes que no guardan la ruta (catalog-cambios-arpegio.js; 11-06 salieron 30 sin miniatura).
      const thumb = e.thumb || (a.miniatura ? eval(a.miniatura)(e) : undefined);
      if (thumb && fs.existsSync(thumb)) await yt.thumbnails.set({ videoId: id, media: { mimeType: 'image/jpeg', body: fs.createReadStream(thumb) } });
      else console.log(`  ! sin miniatura: ${thumb}`);
      for (const pid of ids) await yt.playlistItems.insert({ part: ['snippet'], requestBody: { snippet: { playlistId: pid, resourceId: { kind: 'youtube#video', videoId: id } } } });
    } catch (err) {
      if (/quota/i.test(String(err.message))) { console.log('Cuota agotada: se sigue mañana.'); break; }
      console.log(`  ERROR ${id} ${e.stem}: ${err.message}`); continue;
    }
    hechos[clave] = { id, at: new Date().toISOString() }; n++;
    fs.writeFileSync(hechosPath, JSON.stringify(hechos, null, 1));
    if (e.feed) feed.push(`${id} ${e.title}`);
    console.log(`✓ ${n} ${id} ${e.title} · ${e.publishAtUTC}`);
  }
  console.log(`Catalogados ahora: ${n}. Total del plan hechos: ${Object.keys(hechos).length}/${plan.length}.`);
  if (feed.length) console.log('Casilla del feed (Studio):\n  ' + feed.join('\n  '));
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });
