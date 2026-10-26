#!/usr/bin/env node
/*
 * Publica un short vertical (los de ~/shorts) como Reel en Instagram (@banetmasa) y en la página de
 * Facebook BanetMasa, por la API Graph de Meta. Objetivo acordado con Alberto (2026-10-25): llevar
 * gente a YouTube, así que el texto debe acabar empujando al vídeo completo del canal.
 *
 * Por qué sube el fichero en vez de pasar una URL: la API de Instagram pide normalmente una
 * video_url pública y no tenemos dónde alojar los shorts; las dos APIs aceptan en cambio la subida
 * "resumable" a rupload.facebook.com con el fichero local, que es lo que se hace aquí.
 *
 * Credenciales (gitignoradas por scripts/.meta-*; se crearon el 2026-10-25 desde la app de Meta
 * "BanetMasa Publicador"): scripts/.meta-token.json con page_id, ig_user_id y un token de página
 * que no caduca. Ese token sirve para las dos redes porque @banetmasa está vinculada a la página.
 *
 * Uso:
 *   node scripts/publish-meta.js --video short.mp4 --texto "…" [--texto-fb "…"] [--solo ig|fb]
 *   node scripts/publish-meta.js --video short.mp4 --texto-file texto.txt
 *   node scripts/publish-meta.js --comprobar          (valida token y cuentas, no publica nada)
 *
 * --texto va en los dos; --texto-fb lo sustituye en Facebook (allí los enlaces sí son clicables,
 * en Instagram no: en Instagram conviene "enlace en la bio"). Publica en el momento: Instagram no
 * permite programar Reels por API, el calendario se lleva fuera (como con los runners de YouTube).
 */
const fs = require('fs');
const path = require('path');

const GRAPH = 'https://graph.facebook.com/v21.0';
const TOKEN_FILE = path.join(__dirname, '.meta-token.json');

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const next = argv[i + 1];
    out[argv[i].slice(2)] = next === undefined || next.startsWith('--') ? true : (i++, next);
  }
  return out;
}

async function api(method, url, params, extra = {}) {
  const body = params ? new URLSearchParams(params) : undefined;
  const r = await fetch(method === 'GET' && params ? `${url}?${body}` : url,
    { method, body: method === 'GET' ? undefined : body, ...extra });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`${method} ${url.replace(GRAPH, '')}: ${j.error ? j.error.message : r.status}`);
  return j;
}

// Subida del fichero entero a una URL de rupload (mismo protocolo en Instagram y en Facebook).
async function subir(uploadUrl, token, file) {
  const buf = fs.readFileSync(file);
  const r = await fetch(uploadUrl, {
    method: 'POST',
    headers: { Authorization: `OAuth ${token}`, offset: '0', file_size: String(buf.length) },
    body: buf,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false || j.error) throw new Error(`subida: ${JSON.stringify(j.error || j.debug_info || j)}`);
}

const espera = ms => new Promise(r => setTimeout(r, ms));

async function instagram(cfg, file, texto) {
  const tk = cfg.page_access_token;
  const c = await api('POST', `${GRAPH}/${cfg.ig_user_id}/media`,
    { media_type: 'REELS', upload_type: 'resumable', caption: texto, share_to_feed: 'true', access_token: tk });
  await subir(c.uri || `https://rupload.facebook.com/ig-api-upload/v21.0/${c.id}`, tk, file);
  // Instagram procesa el vídeo antes de dejar publicarlo: se espera a FINISHED (suele ser < 1 min).
  for (let i = 0; i < 60; i++) {
    const s = await api('GET', `${GRAPH}/${c.id}`, { fields: 'status_code,status', access_token: tk });
    if (s.status_code === 'FINISHED') break;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error(`Instagram no pudo procesar el vídeo: ${s.status}`);
    await espera(5000);
  }
  const p = await api('POST', `${GRAPH}/${cfg.ig_user_id}/media_publish`, { creation_id: c.id, access_token: tk });
  const m = await api('GET', `${GRAPH}/${p.id}`, { fields: 'permalink', access_token: tk });
  return m.permalink;
}

async function facebook(cfg, file, texto) {
  const tk = cfg.page_access_token;
  const s = await api('POST', `${GRAPH}/${cfg.page_id}/video_reels`, { upload_phase: 'start', access_token: tk });
  await subir(s.upload_url, tk, file);
  await api('POST', `${GRAPH}/${cfg.page_id}/video_reels`,
    { upload_phase: 'finish', video_id: s.video_id, video_state: 'PUBLISHED', description: texto, access_token: tk });
  return `https://www.facebook.com/reel/${s.video_id}`;
}

async function main() {
  const a = args(process.argv.slice(2));
  if (!fs.existsSync(TOKEN_FILE)) { console.error(`Falta ${TOKEN_FILE} (ver cabecera).`); process.exit(1); }
  const cfg = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));

  if (a.comprobar) {
    const pg = await api('GET', `${GRAPH}/${cfg.page_id}`, { fields: 'name,instagram_business_account{username}', access_token: cfg.page_access_token });
    console.log(`✓ página "${pg.name}" · Instagram @${pg.instagram_business_account && pg.instagram_business_account.username}`);
    return;
  }

  const texto = a['texto-file'] ? fs.readFileSync(a['texto-file'], 'utf8').trim() : a.texto;
  if (!a.video || !texto) { console.error('Uso: publish-meta.js --video <mp4> --texto "…" [--texto-fb "…"] [--solo ig|fb] | --comprobar'); process.exit(1); }
  if (!fs.existsSync(a.video)) { console.error(`No existe ${a.video}`); process.exit(1); }

  if (a.solo !== 'fb') console.log(`✓ Instagram: ${await instagram(cfg, a.video, texto)}`);
  if (a.solo !== 'ig') console.log(`✓ Facebook: ${await facebook(cfg, a.video, a['texto-fb'] || texto)}`);
}

main().catch(e => { console.error(`✗ ${e.message}`); process.exit(1); });
