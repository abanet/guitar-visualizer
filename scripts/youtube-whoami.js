#!/usr/bin/env node
/*
 * Comprueba a qué canal de YouTube apunta un token OAuth ANTES de subir nada de verdad —
 * ver el gotcha documentado en scripts/upload-youtube.js: la cuenta de Google puede gestionar
 * varios canales/marca, y el selector de cuentas al autorizar a veces muestra nombres antiguos
 * o confusos. Esto evita repetir el caso ya visto de un vídeo subido al canal equivocado sin
 * que la API devolviera ningún error.
 *
 * Uso (con un token nuevo, para un canal que aún no has verificado):
 *   node scripts/youtube-whoami.js --token scripts/.youtube-token-todoritmos.json
 *
 * Si scripts/.youtube-token-todoritmos.json no existe todavía, este script dispara el mismo
 * flujo de autorización que upload-youtube.js (abre una URL, la autorizas en el navegador) y
 * cachea el token ahí — así puedes verificar el canal ANTES de la primera subida real.
 *
 * Opciones:
 *   --token <path>          Token a comprobar (por defecto scripts/.youtube-token.json)
 *   --client-secret <path>  Igual que en upload-youtube.js (por defecto scripts/lib/youtube-oauth-client.json)
 */
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(__dirname, '..');
  const clientSecretPath = path.resolve(repoRoot, args['client-secret'] || 'scripts/lib/youtube-oauth-client.json');
  const tokenPath = path.resolve(repoRoot, args.token || 'scripts/.youtube-token.json');

  const auth = await loadOAuthClient(clientSecretPath, tokenPath);
  const youtube = google.youtube({ version: 'v3', auth });
  const res = await youtube.channels.list({ part: ['snippet', 'statistics'], mine: true });
  const channels = res.data.items || [];
  if (!channels.length) { console.error('El token no tiene ningún canal asociado (¿cuenta sin canal de YouTube?).'); process.exit(1); }

  console.log(`\nToken: ${tokenPath}`);
  channels.forEach((c) => {
    console.log(`  Canal: ${c.snippet.title}`);
    console.log(`  ID:    ${c.id}`);
    console.log(`  Subs:  ${c.statistics.subscriberCount}`);
  });
  console.log('\nSi este NO es el canal al que quieres subir, borra el token (' + tokenPath + ') y vuelve a autorizar eligiendo el canal correcto.\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
