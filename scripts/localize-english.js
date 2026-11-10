#!/usr/bin/env node
/*
 * Inglés para los vídeos YA publicados (Alberto 11-04: "ve a los antiguos para añadir el inglés… unos pocos
 * cada día hasta completarlos todos"). Por la API y no por Chrome para no gastar tokens: el script lee cada vídeo,
 * traduce título y descripción con las reglas de scripts/lib/traduccion-en.js y guarda la parte 'localizations'
 * en la misma videos.update (≈51 unidades de cuota por vídeo → ~190 vídeos/día por canal).
 *
 * Seguridad: solo toca vídeos que NO tengan ya inglés; reenvía el snippet tal cual (título, descripción, etiquetas,
 * categoría) para no borrar nada (el gotcha de catalog-youtube-video.js con llamadas parciales); si alguna línea de
 * la descripción no tiene regla, NO lo toca y la apunta en el informe de pendientes.
 *
 * Uso:
 *   node scripts/localize-english.js --inventario [--token …]      # vuelca todos los vídeos del canal (≈80 unidades)
 *   node scripts/localize-english.js --pendientes                    # qué líneas/títulos faltan por traducir (sin API)
 *   node scripts/localize-english.js --max 150 [--solo-publicos] [--dry-run] [--token …]
 * Ficheros (por canal, según el token): scripts/.localize-<canal>-inventario.json, -hechos.json, -pendientes.txt
 */
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { loadOAuthClient } = require('./upload-youtube');
const { IDIOMAS, traducirTitulo, traducirDescripcion } = require('./lib/traduccion-en');
// Traducción completa a todos los idiomas, o null si falta alguna regla.
function traducirTodo(title, description) {
  const loc = {}, faltan = new Set();
  for (const l of IDIOMAS) {
    const t = traducirTitulo(title, l), d = traducirDescripcion(description, l);
    if (t == null) faltan.add('TÍTULO: ' + title);
    d.faltan.forEach((x) => faltan.add(x));
    loc[l] = { title: t, description: d.texto };
  }
  return { loc, faltan: [...faltan] };
}
// hechos[id] = lista de idiomas ya puestos por el script (antes del 11-04 noche: fecha = solo 'en').
const idiomasHechos = (h) => (Array.isArray(h) ? h : h ? ['en'] : []);
const completo = (v, h) => IDIOMAS.every((l) => (v.langs || (v.en ? ['en'] : [])).includes(l) || idiomasHechos(h).includes(l));

const a = {};
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith('--')) { const n = process.argv[i + 1]; if (n === undefined || n.startsWith('--')) a[k.slice(2)] = true; else { a[k.slice(2)] = n; i++; } } }
const root = path.resolve(__dirname, '..');
const tokenPath = path.resolve(a.token || path.join(root, 'scripts/.youtube-token.json'));
const canal = /todoritmos/i.test(tokenPath) ? 'todoritmos' : 'banetmasa';
const F = (s) => path.join(__dirname, `.localize-${canal}-${s}`);
const leer = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);

function pendientes(inv, hechos) {
  const faltaT = {}, faltaL = {};
  for (const v of inv) {
    if (completo(v, hechos[v.id])) continue;
    if (traducirTitulo(v.title) == null) faltaT[v.title] = (faltaT[v.title] || 0) + 1;
    for (const l of traducirDescripcion(v.description).faltan) faltaL[l] = (faltaL[l] || 0) + 1;
  }
  return { faltaT, faltaL };
}

async function main() {
  if (a.pendientes) {
    const inv = leer(F('inventario.json'), []), hechos = leer(F('hechos.json'), {});
    const { faltaT, faltaL } = pendientes(inv, hechos);
    const ok = inv.filter((v) => !completo(v, hechos[v.id]) && traducirTodo(v.title, v.description).faltan.length === 0);
    const out = ['# TÍTULOS SIN REGLA', ...Object.entries(faltaT).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${n}\t${k}`),
      '', '# LÍNEAS SIN REGLA', ...Object.entries(faltaL).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${n}\t${k}`)];
    fs.writeFileSync(F('pendientes.txt'), out.join('\n'));
    console.log(`${canal}: ${inv.length} vídeos · completos (${IDIOMAS.join('/')}) ${inv.filter((v) => completo(v, hechos[v.id])).length} · traducibles ya ${ok.length} (públicos ${ok.filter((v) => v.privacy === 'public').length})`);
    console.log(`títulos sin regla ${Object.keys(faltaT).length} · líneas sin regla ${Object.keys(faltaL).length} → ${F('pendientes.txt')}`);
    return;
  }

  const auth = await loadOAuthClient(path.join(root, 'scripts/lib/youtube-oauth-client.json'), tokenPath);
  const yt = google.youtube({ version: 'v3', auth });
  const ch = (await yt.channels.list({ part: ['snippet', 'contentDetails'], mine: true })).data.items[0];
  console.log(`Canal: ${ch.snippet.title}`);

  if (a.inventario) {
    const uploads = ch.contentDetails.relatedPlaylists.uploads, ids = [];
    let pageToken;
    do { const r = await yt.playlistItems.list({ part: ['contentDetails'], playlistId: uploads, maxResults: 50, pageToken }); ids.push(...r.data.items.map((i) => i.contentDetails.videoId)); pageToken = r.data.nextPageToken; } while (pageToken);
    // La lista de subidas pagina mal: devuelve repetidos y se SALTA vídeos (11-04: faltaban la mezcla de pentatónicas
    // y casi todos los maratones). Se completa con los vídeos de todas las listas del canal (1 unidad por página).
    let lpt, pags = 0;
    do {
      const pl = await yt.playlists.list({ part: ['id'], mine: true, maxResults: 50, pageToken: lpt });
      for (const p of pl.data.items) {
        // Freno (11-05: el primer intento agotó la cuota del día): si un token de página se repite, la lista se corta ahí.
        let t; const vistos = new Set();
        do { const r = await yt.playlistItems.list({ part: ['contentDetails'], playlistId: p.id, maxResults: 50, pageToken: t }); ids.push(...r.data.items.map((i) => i.contentDetails.videoId)); t = r.data.nextPageToken; if (vistos.has(t)) break; vistos.add(t); } while (t);
        pags += vistos.size + 1; if (pags % 50 < vistos.size + 1) console.log(`  … ${pags} páginas, ${new Set(ids).size} vídeos`);
      }
      lpt = pl.data.nextPageToken;
    } while (lpt);
    ids.splice(0, ids.length, ...new Set(ids));
    const inv = [];
    for (let i = 0; i < ids.length; i += 50) {
      const r = await yt.videos.list({ part: ['snippet', 'status', 'localizations'], id: ids.slice(i, i + 50) });
      for (const v of r.data.items) inv.push({ id: v.id, title: v.snippet.title, description: v.snippet.description, privacy: v.status.privacyStatus, publishAt: v.status.publishAt || null, en: !!(v.localizations && v.localizations.en), langs: Object.keys(v.localizations || {}) });
    }
    fs.writeFileSync(F('inventario.json'), JSON.stringify(inv));
    console.log(`${inv.length} vídeos (${inv.filter((v) => v.en).length} ya con inglés) → ${F('inventario.json')}`);
    return;
  }

  const inv = leer(F('inventario.json'), []), hechos = leer(F('hechos.json'), {});
  const max = Number(a.max || 150);
  // Primero los públicos (los que ya ve la gente), luego los programados por fecha de salida.
  const cola = inv.filter((v) => !completo(v, hechos[v.id]) && (!a['solo-publicos'] || v.privacy === 'public'))
    .sort((x, y) => (x.privacy === 'public' ? 0 : 1) - (y.privacy === 'public' ? 0 : 1) || String(x.publishAt).localeCompare(String(y.publishAt)));
  let n = 0;
  for (const v0 of cola) {
    if (n >= max) break;
    const tr = traducirTodo(v0.title, v0.description);
    if (tr.faltan.length) continue;
    // Releer el vídeo justo antes (1 unidad): el inventario puede estar viejo.
    const v = (await yt.videos.list({ part: ['snippet', 'localizations'], id: [v0.id] })).data.items[0];
    if (!v) continue;
    const tiene = Object.keys(v.localizations || {});
    if (IDIOMAS.every((l) => tiene.includes(l))) { hechos[v.id] = IDIOMAS; continue; }
    if (v.snippet.title !== v0.title || v.snippet.description !== v0.description) { console.log(`  cambió desde el inventario, se salta: ${v.id}`); continue; }
    const sn = v.snippet;
    if (a['dry-run']) { console.log(`[dry] ${v.id} ${tr.loc.en.title}`); n++; continue; }
    try {
      await yt.videos.update({ part: ['snippet', 'localizations'], requestBody: { id: v.id,
        snippet: { title: sn.title, description: sn.description, tags: sn.tags || [], categoryId: sn.categoryId, defaultLanguage: sn.defaultLanguage || 'es', ...(sn.defaultAudioLanguage ? { defaultAudioLanguage: sn.defaultAudioLanguage } : {}) },
        // Se respetan los idiomas que ya tuviera (p. ej. inglés puesto a mano en Studio) y se añaden los que faltan.
        localizations: { ...tr.loc, ...(v.localizations || {}) } } });
    } catch (e) {
      if (/quota/i.test(String(e.message))) { console.log('Cuota agotada: se sigue mañana.'); break; }
      console.log(`  ERROR ${v.id}: ${e.message}`); continue;
    }
    hechos[v.id] = IDIOMAS; n++;
    fs.writeFileSync(F('hechos.json'), JSON.stringify(hechos));
    console.log(`✓ ${n} ${v.id} ${tr.loc.en.title}`);
  }
  console.log(`Hechos hoy: ${n}. Total completos por este script: ${Object.values(hechos).filter((h) => idiomasHechos(h).length === IDIOMAS.length).length}.`);
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });
