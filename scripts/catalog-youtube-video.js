#!/usr/bin/env node
/*
 * Cataloga un vídeo YA SUBIDO a YouTube (título, descripción, tags, categoría, miniatura,
 * playlist y fecha de publicación programada) — complemento de upload-youtube.js, que sube
 * vídeos nuevos; este actualiza metadata de vídeos existentes (p.ej. los que se suben primero
 * con un título provisional desde otro proceso y se catalogan después con este script).
 *
 * Uso:
 *   node scripts/catalog-youtube-video.js --video-id <id> --title "Título" \
 *     --description-file descripcion.txt --tags "a,b,c" --category 10 \
 *     --publish-at 2026-09-20T22:00:00Z --thumbnail miniatura.png \
 *     --playlist-name "Ritmos X" --playlist-description-file playlist-desc.txt \
 *     [--token scripts/.youtube-token-todoritmos.json]
 *
 * Opciones:
 *   --video-id <id>                  ID del vídeo a catalogar (obligatorio)
 *   --title <texto>                  Título nuevo (obligatorio)
 *   --description-file <path>        Fichero de texto con la descripción completa
 *   --description <texto>            Alternativa a --description-file para descripciones cortas
 *   --tags <lista>                   Tags separados por coma
 *   --category <id>                  ID de categoría de YouTube (por defecto 10 = Music)
 *   --language <código>              Idioma del vídeo y del audio (p.ej. es). Sin esto, videos.update
 *                                    borra el idioma que ya tuviera el vídeo (el snippet se reemplaza entero)
 *   --privacy <valor>                private | unlisted | public (por defecto: public, o private
 *                                    si se pasa --publish-at, que lo exige la API)
 *   --publish-at <fecha>             Fecha/hora ISO 8601 futura para programar la publicación
 *   --thumbnail <path>               Imagen de miniatura (jpg/png) a asignar al vídeo
 *   --playlist-name <texto>          Nombre de la playlist — si no existe una con ese nombre
 *                                    exacto entre las del canal, se crea (pública)
 *   --playlist-description-file <path> / --playlist-description <texto>
 *                                    Descripción para la playlist, solo se usa si hay que crearla
 *   --client-secret <path>           Por defecto scripts/lib/youtube-oauth-client.json
 *   --token <path>                   Por defecto scripts/.youtube-token.json
 */
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { loadOAuthClient } = require('./upload-youtube');

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

async function findOrCreatePlaylist(youtube, name, description) {
  let pageToken;
  do {
    const res = await youtube.playlists.list({ part: ['snippet'], mine: true, maxResults: 50, pageToken });
    const found = (res.data.items || []).find((p) => p.snippet.title === name);
    if (found) return found.id;
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  console.log(`Playlist "${name}" no existe todavía — creándola…`);
  const created = await youtube.playlists.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: { title: name, description: description || '' },
      status: { privacyStatus: 'public' },
    },
  });
  console.log(`✓ Playlist creada: ${created.data.id}`);
  // Pequeño margen: justo tras crearla, playlistItems.list a veces devuelve 404
  // "playlist not found" (propagación no instantánea del lado de YouTube) — visto de verdad
  // catalogando el primer vídeo de "Ritmos AfroCubano Bolero" (2026-09-17).
  await new Promise((r) => setTimeout(r, 5000));
  return created.data.id;
}

async function addToPlaylistIfMissing(youtube, playlistId, videoId) {
  let pageToken;
  do {
    const res = await youtube.playlistItems.list({ part: ['snippet'], playlistId, maxResults: 50, pageToken });
    if ((res.data.items || []).some((it) => it.snippet.resourceId.videoId === videoId)) {
      console.log('(ya estaba en la playlist)');
      return;
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  await youtube.playlistItems.insert({
    part: ['snippet'],
    requestBody: { snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } } },
  });
  console.log('✓ Añadido a la playlist.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args['video-id'] || !args.title) {
    console.error('Uso: node scripts/catalog-youtube-video.js --video-id <id> --title "Título" [opciones]');
    process.exit(1);
  }

  let description = args.description || '';
  if (args['description-file']) description = fs.readFileSync(path.resolve(args['description-file']), 'utf8');

  let playlistDescription = args['playlist-description'] || '';
  if (args['playlist-description-file']) playlistDescription = fs.readFileSync(path.resolve(args['playlist-description-file']), 'utf8');

  const tags = args.tags ? String(args.tags).split(',').map((t) => t.trim()).filter(Boolean) : [];
  const categoryId = args.category || '10';

  let privacy = args.privacy || 'public';
  let publishAt;
  if (args['publish-at']) {
    const d = new Date(args['publish-at']);
    if (Number.isNaN(d.getTime())) { console.error('--publish-at no es una fecha válida: ' + args['publish-at']); process.exit(1); }
    if (d.getTime() <= Date.now()) { console.error('--publish-at debe ser una fecha futura: ' + args['publish-at']); process.exit(1); }
    publishAt = d.toISOString();
    privacy = 'private';
  }

  const repoRoot = path.resolve(__dirname, '..');
  const clientSecretPath = path.resolve(args['client-secret'] || path.join(repoRoot, 'scripts/lib/youtube-oauth-client.json'));
  const tokenPath = path.resolve(args.token || path.join(repoRoot, 'scripts/.youtube-token.json'));

  const auth = await loadOAuthClient(clientSecretPath, tokenPath);
  const youtube = google.youtube({ version: 'v3', auth });

  // Comprobación de seguridad (mismo gotcha que youtube-whoami.js): confirma a qué canal
  // pertenece este token ANTES de tocar nada, para no editar el vídeo equivocado en el canal
  // equivocado sin darnos cuenta.
  const chCheck = await youtube.channels.list({ part: ['snippet'], mine: true });
  console.log(`Canal: ${chCheck.data.items[0].snippet.title} · token: ${tokenPath}`);

  console.log(`Catalogando ${args['video-id']}: "${args.title}"…`);
  await youtube.videos.update({
    // "paidProductPlacementDetails" es la casilla "No, mi vídeo no incluye una promoción de
    // pago" de Studio — igual que en upload-youtube.js, se fija aquí siempre en false (ningún
    // vídeo del canal la tiene) para no depender de marcarla a mano por vídeo (pedido de
    // Alberto tras notar que catalog-youtube-video.js, a diferencia de upload-youtube.js, no la
    // tocaba y tuvo que marcarla manualmente en Studio la primera vez).
    part: ['snippet', 'status', 'paidProductPlacementDetails'],
    requestBody: {
      id: args['video-id'],
      snippet: {
        title: args.title, description, tags, categoryId,
        ...(args.language ? { defaultLanguage: args.language, defaultAudioLanguage: args.language } : {}),
      },
      status: {
        privacyStatus: privacy,
        selfDeclaredMadeForKids: false,
        containsSyntheticMedia: false,
        ...(publishAt ? { publishAt } : {}),
      },
      paidProductPlacementDetails: { hasPaidProductPlacement: false },
    },
  });
  console.log('✓ Metadata actualizada.');
  if (publishAt) console.log(`  Programado para publicarse: ${publishAt}`);

  if (args.thumbnail) {
    const thumbPath = path.resolve(args.thumbnail);
    if (!fs.existsSync(thumbPath)) { console.error('No existe la miniatura: ' + thumbPath); process.exit(1); }
    console.log('Subiendo miniatura…');
    await youtube.thumbnails.set({ videoId: args['video-id'], media: { body: fs.createReadStream(thumbPath) } });
    console.log('✓ Miniatura subida.');
  }

  if (args['playlist-name']) {
    const playlistId = await findOrCreatePlaylist(youtube, args['playlist-name'], playlistDescription);
    await addToPlaylistIfMissing(youtube, playlistId, args['video-id']);
  }

  console.log(`\nListo: https://studio.youtube.com/video/${args['video-id']}/edit`);
}

main().catch((e) => { console.error(e); process.exit(1); });
