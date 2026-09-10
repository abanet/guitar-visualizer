#!/usr/bin/env node
/*
 * Sube un vídeo ya generado al canal de YouTube (BanetMasa) vía la YouTube Data API v3 — título,
 * descripción (con capítulos por BPM si se pasa el XML, reutilizando la misma lógica que
 * generate-youtube-chapters.js), tags y miniatura, todo en una sola llamada.
 *
 * Sube SIEMPRE como "unlisted" salvo que se pida explícitamente --privacy public: la idea es dejar
 * el vídeo listo (metadata completa) pero con el "Publicar" final a mano en YouTube Studio, no
 * autopublicar sin revisión.
 *
 * Requiere credenciales OAuth propias (no vienen en el repo, ver más abajo) — la API sube vídeos
 * a TU canal, así que hace falta que autorices tu propia cuenta de Google una vez.
 *
 * ── Configuración inicial (una sola vez) ──────────────────────────────────────────────────────
 * 1. En https://console.cloud.google.com: crea un proyecto, activa "YouTube Data API v3"
 *    (APIs & Services → Library), y crea credenciales OAuth (APIs & Services → Credentials →
 *    Create Credentials → OAuth client ID → tipo "Desktop app"). Descarga el JSON.
 * 2. Guárdalo como scripts/lib/youtube-oauth-client.json (gitignored — son credenciales tuyas).
 * 3. En "OAuth consent screen", añade tu propia cuenta de Google como "Test user" (mientras la
 *    app no esté verificada, solo pueden autorizarla los usuarios de prueba que añadas ahí).
 * 4. La primera vez que subas un vídeo, este script imprime una URL — ábrela en tu navegador,
 *    autoriza, y el token queda cacheado en scripts/.youtube-token.json (gitignored). En modo
 *    "Testing" (sin verificar la app ante Google) ese token caduca cada 7 días: si pasa, el
 *    script vuelve a pedir autorización sin más.
 *
 * Uso:
 *   node scripts/upload-youtube.js --video tema.mp4 --title "Título" --xml tema.xml \
 *     --tags "guitarra,triadas,BanetMasa" [--privacy unlisted] [--thumbnail miniatura.jpg]
 *
 * Opciones:
 *   --video <path>         Vídeo a subir (obligatorio)
 *   --title <texto>         Título del vídeo (obligatorio)
 *   --xml <path>            MusicXML con mapa de tempo — si se pasa, añade a la descripción un
 *                           bloque de capítulos "M:SS BPM" (mismo cálculo que
 *                           generate-youtube-chapters.js), uno por cada múltiplo de --chapters-every
 *   --description <texto>   Texto adicional para la descripción (va ANTES del bloque de capítulos)
 *   --tags <lista>          Tags separados por coma
 *   --category <id>         ID de categoría de YouTube (por defecto 22 = People & Blogs)
 *   --privacy <valor>       private | unlisted | public (por defecto: unlisted)
 *   --thumbnail <path>      Imagen de miniatura (jpg/png) a subir junto con el vídeo
 *   --chapters-every <n>    Igual que en generate-youtube-chapters.js (por defecto 10)
 *   --client-secret <path>  Ruta al JSON de credenciales OAuth (por defecto scripts/lib/youtube-oauth-client.json)
 *   --token <path>          Ruta donde cachear el token (por defecto scripts/.youtube-token.json)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { google } = require('googleapis');
const { buildChapters, fmtChapter } = require('./generate-youtube-chapters');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) { out[key] = true; }
      else { out[key] = next; i++; }
    }
  }
  return out;
}

const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];

async function loadOAuthClient(clientSecretPath, tokenPath) {
  if (!fs.existsSync(clientSecretPath)) {
    console.error(
      `No encuentro las credenciales OAuth en ${clientSecretPath}.\n` +
      'Sigue la configuración inicial del cabecero de este script (crear proyecto + credenciales ' +
      'en Google Cloud Console) antes de subir vídeos.'
    );
    process.exit(1);
  }
  const creds = JSON.parse(fs.readFileSync(clientSecretPath, 'utf8'));
  const key = creds.installed || creds.web;
  if (!key) { console.error('El JSON de credenciales no tiene el formato esperado (falta "installed" o "web").'); process.exit(1); }

  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;

  const oauth2Client = new google.auth.OAuth2(key.client_id, key.client_secret, redirectUri);

  if (fs.existsSync(tokenPath)) {
    oauth2Client.setCredentials(JSON.parse(fs.readFileSync(tokenPath, 'utf8')));
    server.close();
  } else {
    const authUrl = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' });
    console.log('\nAbre esta URL en tu navegador y autoriza tu cuenta de Google:\n');
    console.log(authUrl + '\n');
    console.log('Esperando autorización...');
    const code = await new Promise((resolve, reject) => {
      server.on('request', (req, res) => {
        const url = new URL(req.url, redirectUri);
        if (url.pathname !== '/oauth2callback') { res.writeHead(404); res.end(); return; }
        const c = url.searchParams.get('code');
        const err = url.searchParams.get('error');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(err ? '<h1>Autorización cancelada.</h1> Puedes cerrar esta pestaña.'
                    : '<h1>✓ Autorizado.</h1> Puedes cerrar esta pestaña y volver a la terminal.');
        server.close();
        if (err) reject(new Error('Autorización rechazada: ' + err));
        else resolve(c);
      });
    });
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
    console.log('Token guardado en ' + tokenPath + '\n');
  }

  // Si el access_token cacheado ha caducado, la librería lo refresca sola al primer uso — nos
  // enganchamos a 'tokens' para persistir cualquier token nuevo (access_token renovado y, si
  // Google manda uno nuevo, refresh_token) y no perderlo entre ejecuciones.
  oauth2Client.on('tokens', (tokens) => {
    const merged = { ...(fs.existsSync(tokenPath) ? JSON.parse(fs.readFileSync(tokenPath, 'utf8')) : {}), ...tokens };
    fs.writeFileSync(tokenPath, JSON.stringify(merged, null, 2));
  });

  return oauth2Client;
}

function buildDescription({ descriptionExtra, xmlPath, chaptersEvery }) {
  const parts = [];
  if (descriptionExtra) parts.push(descriptionExtra);
  if (xmlPath) {
    const xmlText = fs.readFileSync(path.resolve(xmlPath), 'utf8');
    try {
      const chapters = buildChapters(xmlText, { beats: 4, every: chaptersEvery, introBars: undefined, offSec: 0 });
      const chapterText = chapters.map((c) => `${fmtChapter(c.sec)} ${c.bpm} BPM`).join('\n');
      parts.push(chapterText);
    } catch (e) {
      console.error('⚠ No se pudieron calcular capítulos desde el XML: ' + e.message);
    }
  }
  return parts.join('\n\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.video || !args.title) {
    console.error('Uso: node scripts/upload-youtube.js --video <archivo.mp4> --title "Título" [--xml tema.xml] [--tags a,b,c] [--privacy unlisted] [--thumbnail miniatura.jpg]');
    process.exit(1);
  }
  const videoPath = path.resolve(args.video);
  if (!fs.existsSync(videoPath)) { console.error('No existe: ' + videoPath); process.exit(1); }
  if (args.thumbnail && !fs.existsSync(path.resolve(args.thumbnail))) {
    console.error('No existe: ' + path.resolve(args.thumbnail)); process.exit(1);
  }
  const privacy = args.privacy || 'unlisted';
  if (!['private', 'unlisted', 'public'].includes(privacy)) {
    console.error('--privacy debe ser private, unlisted o public'); process.exit(1);
  }

  const repoRoot = path.resolve(__dirname, '..');
  const clientSecretPath = path.resolve(args['client-secret'] || path.join(repoRoot, 'scripts/lib/youtube-oauth-client.json'));
  const tokenPath = path.resolve(args.token || path.join(repoRoot, 'scripts/.youtube-token.json'));
  const chaptersEvery = args['chapters-every'] ? parseInt(args['chapters-every'], 10) : 10;

  const description = buildDescription({ descriptionExtra: args.description, xmlPath: args.xml, chaptersEvery });
  const tags = args.tags ? String(args.tags).split(',').map((t) => t.trim()).filter(Boolean) : [];
  const categoryId = args.category || '22';

  const auth = await loadOAuthClient(clientSecretPath, tokenPath);
  const youtube = google.youtube({ version: 'v3', auth });

  console.log(`Subiendo "${args.title}" (${privacy})…`);
  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: { title: args.title, description, tags, categoryId },
      status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
    },
    media: { body: fs.createReadStream(videoPath) },
  });
  const videoId = res.data.id;
  console.log(`✓ Subido: https://youtu.be/${videoId}`);
  console.log(`  Editar en Studio: https://studio.youtube.com/video/${videoId}/edit`);

  if (args.thumbnail) {
    console.log('Subiendo miniatura…');
    await youtube.thumbnails.set({ videoId, media: { body: fs.createReadStream(path.resolve(args.thumbnail)) } });
    console.log('✓ Miniatura subida.');
  }
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { buildDescription };
