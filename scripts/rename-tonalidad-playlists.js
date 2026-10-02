#!/usr/bin/env node
/*
 * Renombra las listas "Tonalidad de X" de BanetMasa (backings para improvisar) a un nombre que diga qué
 * contienen (Alberto 2026-10-01): mayores → "Backing tracks en G mayor", menores → "Backing tracks en Em".
 * Cada lista sigue siendo la misma (mismo ID, mismos vídeos). playlists.update REEMPLAZA el snippet entero:
 * se reenvía la descripción y el idioma que ya tuviera para no borrarlos. Si no tenía descripción se pone
 * una de una línea. 50 unidades de cuota por lista.
 *
 * Uso: node scripts/rename-tonalidad-playlists.js [--dry-run]
 */
const path = require('path');
const { google } = require('googleapis');
const { loadOAuthClient } = require('./upload-youtube');

const DRY = process.argv.includes('--dry-run');
const newName = (key) => (/m$/.test(key) ? `Backing tracks en ${key}` : `Backing tracks en ${key} mayor`);

(async () => {
  const ROOT = path.resolve(__dirname, '..');
  const auth = await loadOAuthClient(path.join(ROOT, 'scripts/lib/youtube-oauth-client.json'), path.join(ROOT, 'scripts/.youtube-token.json'));
  const yt = google.youtube({ version: 'v3', auth });
  const lists = []; let pt;
  do { const r = await yt.playlists.list({ part: ['snippet', 'status'], mine: true, maxResults: 50, pageToken: pt }); lists.push(...r.data.items); pt = r.data.nextPageToken; } while (pt);
  const targets = lists.filter((p) => /^Tonalidad de [A-G][b#]?m?$/.test(p.snippet.title));
  console.log(`${targets.length} listas "Tonalidad de …"`);
  let ok = 0;
  for (const p of targets) {
    const key = p.snippet.title.replace('Tonalidad de ', '');
    const title = newName(key);
    const description = (p.snippet.description || '').trim() || `Backing tracks para improvisar en ${/m$/.test(key) ? key : key + ' mayor'}.`;
    if (DRY) { console.log(`[dry] ${p.id}  "${p.snippet.title}" → "${title}"${p.snippet.description ? '' : '  (+ descripción)'}`); continue; }
    try {
      await yt.playlists.update({ part: ['snippet'], requestBody: { id: p.id, snippet: { title, description, defaultLanguage: p.snippet.defaultLanguage || 'es' } } });
      console.log(`✓ "${p.snippet.title}" → "${title}"`); ok++;
    } catch (e) {
      const reason = e.errors && e.errors[0] && e.errors[0].reason;
      console.error(`✗ ${p.snippet.title}: ${reason || ''} ${e.message}`);
      if (reason === 'quotaExceeded') break;
    }
  }
  if (!DRY) console.log(`Renombradas ${ok}/${targets.length}`);
})().catch((e) => { console.error('ERROR', e.message); process.exitCode = 1; });
