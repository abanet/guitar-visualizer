#!/usr/bin/env node
/*
 * Sustituye un vídeo PROGRAMADO (aún no publicado) de YouTube por otro fichero, conservando todo lo
 * demás: título, descripción, etiquetas, categoría, idioma, "hecho para niños", fecha de publicación
 * programada y listas de reproducción. Se sube SIN notificar a los suscriptores (notifySubscribers=false).
 * Pensado para corregir vídeos con un fallo antes de que se publiquen (p.ej. los "Vertical" de
 * TodasTriadas con el salto de octava, 2026-09-28).
 *
 * Pasos: 1) lee el vídeo viejo y en qué listas está; 2) sube el nuevo como privado con el mismo publishAt;
 * 3) miniatura; 4) mismas listas; 5) SOLO con --delete-old y si todo lo anterior fue bien, borra el viejo.
 * Sin --delete-old no borra nada (modo seguro: deja los dos y dice cuál sobra).
 *
 * Uso: node scripts/replace-scheduled-video.js --old <videoId> --video <fichero.mp4> [--thumbnail <img>] [--delete-old]
 * Cuota aprox.: 1600 (subida) + 50 (miniatura) + 50/lista + 50 (borrado) + lecturas.
 */
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { loadOAuthClient } = require('./upload-youtube');

const a = {};
for (let i = 2; i < process.argv.length; i++) if (process.argv[i].startsWith('--')) a[process.argv[i].slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true;

(async () => {
  if (!a.old || !a.video) { console.error('Uso: --old <videoId> --video <mp4> [--thumbnail <img>] [--delete-old]'); process.exit(1); }
  const root = path.resolve(__dirname, '..');
  const auth = await loadOAuthClient(path.join(root, 'scripts/lib/youtube-oauth-client.json'), path.join(root, 'scripts/.youtube-token.json'));
  const yt = google.youtube({ version: 'v3', auth });

  // 1) vídeo viejo
  const old = (await yt.videos.list({ part: ['snippet', 'status'], id: [a.old] })).data.items[0];
  if (!old) throw new Error('No encuentro el vídeo ' + a.old);
  if (!old.status.publishAt || old.status.privacyStatus !== 'private') throw new Error(`${a.old} no está programado (privacy=${old.status.privacyStatus}, publishAt=${old.status.publishAt}) — no lo toco`);
  console.log(`Viejo: ${a.old} · "${old.snippet.title}" · sale ${old.status.publishAt}`);
  const lists = [];
  let pageToken;
  do {
    const r = await yt.playlists.list({ part: ['snippet'], mine: true, maxResults: 50, pageToken });
    for (const p of r.data.items) {
      const it = await yt.playlistItems.list({ part: ['snippet'], playlistId: p.id, videoId: a.old, maxResults: 1 });
      if (it.data.items.length) lists.push({ id: p.id, title: p.snippet.title, position: it.data.items[0].snippet.position });
    }
    pageToken = r.data.nextPageToken;
  } while (pageToken);
  console.log('  listas: ' + (lists.map(l => `${l.title} (pos ${l.position})`).join(', ') || '(ninguna)'));

  // 2) subir el nuevo
  const s = old.snippet;
  const res = await yt.videos.insert({
    part: ['snippet', 'status'], notifySubscribers: false,
    requestBody: {
      snippet: { title: s.title, description: s.description, tags: s.tags, categoryId: s.categoryId, defaultLanguage: s.defaultLanguage, defaultAudioLanguage: s.defaultAudioLanguage },
      status: { privacyStatus: 'private', publishAt: old.status.publishAt, selfDeclaredMadeForKids: !!old.status.madeForKids, license: old.status.license, embeddable: old.status.embeddable, publicStatsViewable: old.status.publicStatsViewable },
    },
    media: { body: fs.createReadStream(path.resolve(a.video)) },
  });
  const nid = res.data.id;
  console.log(`Nuevo: ${nid} (privado, sale ${res.data.status.publishAt})`);

  // 3) miniatura
  // Justo tras subir, YouTube a veces rechaza la miniatura ("can't be set… might not be properly
  // authorized", visto con Bb 2026-09-29) mientras procesa el vídeo: se reintenta con pausa.
  if (a.thumbnail) {
    for (let t = 1; ; t++) {
      try { await yt.thumbnails.set({ videoId: nid, media: { body: fs.createReadStream(path.resolve(a.thumbnail)) } }); break; }
      catch (e) { if (t >= 5) throw e; console.log(`  miniatura rechazada (intento ${t}/5) — reintento en 30 s`); await new Promise((r) => setTimeout(r, 30000)); }
    }
    console.log('  miniatura puesta');
  }
  // 4) listas (misma posición)
  for (const l of lists) {
    await yt.playlistItems.insert({ part: ['snippet'], requestBody: { snippet: { playlistId: l.id, position: l.position, resourceId: { kind: 'youtube#video', videoId: nid } } } });
    console.log(`  añadido a "${l.title}" (pos ${l.position})`);
  }
  // 5) borrar el viejo
  if (a['delete-old']) { await yt.videos.delete({ id: a.old }); console.log(`Viejo ${a.old} BORRADO`); }
  else console.log(`(el viejo ${a.old} sigue ahí — bórralo con --delete-old o a mano)`);
  console.log(`OK ${a.old} -> ${nid}`);
})().catch(e => { console.error('ERROR: ' + (e.errors ? JSON.stringify(e.errors) : e.message)); process.exitCode = 1; });
