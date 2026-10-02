#!/usr/bin/env node
/*
 * Cataloga la serie "Acordes de la escala sin mover la mano izquierda" ya subida (privada, título = nombre
 * de fichero: EscalaCTriadasEscala <Tono> FormasAcorde Notas forma<X>[ cerrada]) en BanetMasa, UNA TONALIDAD
 * por llamada (se publica una tonalidad al día, por quintas — Alberto 2026-10-02).
 * Para cada vídeo: título, descripción, tags, categoría 27, idioma es, no infantil, sin publicidad pagada,
 * miniatura, programado (--publish-at, sin notificar: eso se decide al subir, no por API) y listas:
 *   - pública "Acordes de la escala en cada posición (CAGED)" (la antigua "Acordes en acción", mismo ID;
 *     se renombra aquí si aún tiene el nombre viejo). Conviven con los 5 de C de 2025.
 *   - oculta "Ejercicios en <Tono> mayor"
 * Reanudable: anota cada vídeo terminado en --done (por defecto scripts/.catalog-acordes-done.txt). Un vídeo
 * al que le falte la miniatura o la lista de tonalidad queda catalogado pero SIN anotar (se repite al relanzar).
 *
 * --series arpegios: la serie gemela "Arpegios de los acordes de <Tono> mayor…" (ficheros sin "FormasAcorde",
 * miniaturas en …/arpegios/thumbnails, lista pública "Arpegios de triadas", done .catalog-arpegios-done.txt).
 *
 * Uso: node scripts/catalog-acordes-escala.js --key C --publish-at 2026-10-05T10:00:00Z [--series arpegios] [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { google } = require('googleapis');
const { loadOAuthClient } = require('./upload-youtube');

const a = {};
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith('--')) { const n = process.argv[i + 1]; if (n === undefined || n.startsWith('--')) a[k.slice(2)] = true; else { a[k.slice(2)] = n; i++; } } }
const KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'Fs', 'Db', 'Ab', 'Eb', 'Bb', 'F']; // círculo de quintas
const SERIE = a.series || 'acordes'; // acordes | arpegios
if (!a['publish-at'] || !KEYS.includes(a.key) || !['acordes', 'arpegios'].includes(SERIE)) { console.error(`Uso: --key <${KEYS.join('|')}> --publish-at <ISO> [--series acordes|arpegios]`); process.exit(1); }
const DRY = !!a['dry-run'], K = a.key, ARP = SERIE === 'arpegios';
const ROOT = path.resolve(__dirname, '..');
const THUMBS = path.join(os.homedir(), 'Downloads', a.dir || 'SUBIREscalaCTriadasEscala', SERIE, 'thumbnails');
const DONE = path.resolve(a.done || path.join(__dirname, `.catalog-${SERIE}-done.txt`));
const done = new Set(fs.existsSync(DONE) ? fs.readFileSync(DONE, 'utf8').split('\n').filter(Boolean) : []);

const FORMS = ['C', 'A', 'G', 'E', 'D'];
const NAME = (k) => k.replace(/s$/, '#');
// Acordes diatónicos con su grafía correcta (sin repetir letra).
const CHORDS = {
  C: 'C Dm Em F G Am Bdim', G: 'G Am Bm C D Em F#dim', D: 'D Em F#m G A Bm C#dim', A: 'A Bm C#m D E F#m G#dim',
  E: 'E F#m G#m A B C#m D#dim', B: 'B C#m D#m E F# G#m A#dim', Fs: 'F# G#m A#m B C# D#m E#dim',
  Db: 'Db Ebm Fm Gb Ab Bbm Cdim', Ab: 'Ab Bbm Cm Db Eb Fm Gdim', Eb: 'Eb Fm Gm Ab Bb Cm Ddim',
  Bb: 'Bb Cm Dm Eb F Gm Adim', F: 'F Gm Am Bb C Dm Edim',
};
const DEG = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];

// acordes: la antigua "Acordes en acción" (se renombra si aún tiene el nombre viejo); arpegios: la lista
// pública "Arpegios de triadas" que ya existía (no se renombra).
const PL_SERIE_ID = ARP ? 'PLtLRU6jwtF902134G2SGUo30f3nn6emr5' : 'PLtLRU6jwtF92QqPYkiNgIkAriC5lG8997';
const PL_SERIE = ARP ? null : 'Acordes de la escala en cada posición (CAGED)';
// Los arpegios se subieron con el MISMO nombre de fichero que tuvieron las tónicas ("… <Tono> Notas forma<X>"):
// solo cuentan los subidos desde esta fecha (las tónicas son anteriores y ya tienen su título final).
const ARP_SINCE = '2026-10-02';
const PL_KEY = (k) => `Ejercicios en ${NAME(k)} mayor`;
const serieUrl = `https://www.youtube.com/playlist?list=${PL_SERIE_ID}`;

const titleFor = (k, f, cerrada) => `${ARP ? 'Arpegios de los acordes de' : 'Acordes de la escala de'} ${NAME(k)} mayor sin mover la mano izquierda | Forma ${f}${cerrada ? ' cerrada' : ''} (CAGED)`;
function description(k, f, cerrada) {
  const n = NAME(k), ch = CHORDS[k].split(' ').map((c, i) => `${DEG[i]} ${c}`).join(' · ');
  if (ARP) return `El arpegio de cada acorde de la escala de ${n} mayor sin salir de una sola posición: la Forma ${f}${cerrada ? ' cerrada' : ''} del sistema CAGED. Sigues los cambios de acorde sin mover la mano izquierda por el mástil.

Suena la progresión de los acordes de ${n} mayor y, en cada uno, se iluminan las notas de su tríada (tónica, 3ª y 5ª) dentro de la posición, con el nombre de cada nota. La escala queda de fondo como referencia.${cerrada ? `

🔒 Versión cerrada: la misma Forma ${f}, 12 trastes más arriba y sin cuerdas al aire.` : ''}

🎸 Los acordes de ${n} mayor
${ch}

🎯 Cómo practicarlo
1. Toca cada arpegio despacio, de la nota más grave a la más aguda y vuelta, mientras suena su acorde.
2. Después empieza cada arpegio por la nota más cercana a donde acabaste el anterior, sin volver siempre a la tónica.
3. Improvisa con la escala apoyándote en las notas del arpegio: en los tiempos fuertes, notas del acorde; el resto, de paso.
4. Reto final: sin mirar el vídeo, cambia de arpegio justo cuando cambia el acorde.

💡 Los arpegios son el puente entre los acordes y la escala: te dicen qué notas suenan "dentro" en cada momento. Cuando domines una forma pasa a la siguiente: las 5 formas juntas cubren todo el mástil.

📚 Más ejercicios de arpegios de tríadas: ${serieUrl}

#guitarra #CAGED #arpegios #tríadas #escalamayor #improvisación`;
  return `Los 7 acordes de la escala de ${n} mayor sin salir de una sola posición: la Forma ${f}${cerrada ? ' cerrada' : ''} del sistema CAGED. Cambias de acorde sin mover la mano izquierda por el mástil.

Suena la progresión de los acordes de ${n} mayor y, en cada uno, se ilumina una forma de ese acorde dentro de la posición, con el nombre de cada nota. La escala queda de fondo como referencia, para que veas de qué notas de la escala está hecho cada acorde.${cerrada ? `

🔒 Versión cerrada: la misma Forma ${f}, 12 trastes más arriba y sin cuerdas al aire.` : ''}

🎸 Los acordes de ${n} mayor
${ch}

🎯 Cómo practicarlo
1. Primero toca solo los acordes, siguiendo el vídeo. Si alguna forma te resulta incómoda quita notas: con la tríada basta.
2. Improvisa con la escala y, cuando cambie el acorde, pasa más a menudo por sus notas.
3. Termina tus frases en una nota del acorde que suena: notas del acorde en los tiempos fuertes, el resto de paso.
4. Alterna frases con golpes del acorde, sin salir de la posición.

💡 Ver los acordes dentro de la escala es lo que te permite acompañar e improvisar en la misma zona del mástil. Cuando domines una forma pasa a la siguiente: las 5 formas juntas cubren todo el mástil.

📚 La serie completa (12 tonalidades × 5 formas): ${serieUrl}

#guitarra #CAGED #acordes #escalamayor #mástil #improvisación`;
}
const tagsFor = (k, f) => {
  const n = NAME(k);
  if (ARP) return ['guitarra', 'arpegios', 'arpegios de tríadas', 'arpegios de guitarra', `arpegios en ${n} mayor`, `escala de ${n} mayor`, `${n} mayor`,
    'CAGED', 'sistema CAGED', `forma ${f}`, `forma ${f} CAGED`, 'escala mayor', 'acordes de la escala', 'tríadas', 'notas del acorde',
    'relación acorde-escala', 'armonía', 'mástil de guitarra', 'improvisación', 'ejercicios de guitarra', 'backing track',
    'guitar', 'CAGED system', 'triad arpeggios', 'chord tones', 'fretboard'];
  return ['guitarra', 'acordes de la escala', 'acordes de la escala mayor', `acordes de ${n} mayor`, `escala de ${n} mayor`, `${n} mayor`,
    'CAGED', 'sistema CAGED', `forma ${f}`, `forma ${f} CAGED`, 'escala mayor', 'posiciones de la escala mayor', 'acordes dentro de la escala',
    'relación acorde-escala', 'armonía', 'mástil de guitarra', 'improvisación', 'ejercicios de guitarra', 'backing track',
    'guitar', 'CAGED system', 'major scale chords', 'chord shapes', 'fretboard'];
};
const thumbFor = (k, f, cerrada) => path.join(THUMBS, `EscalaCTriadasEscala-${k}${ARP ? '' : '_FormasAcorde'}_Notas_forma${f}${cerrada ? '_cerrada' : ''}.jpg`);
const idOf = (k, f, cerrada) => `${k}-${f}${cerrada ? '-cerrada' : ''}`;

(async () => {
  const auth = await loadOAuthClient(path.join(ROOT, 'scripts/lib/youtube-oauth-client.json'), path.join(ROOT, 'scripts/.youtube-token.json'));
  const yt = google.youtube({ version: 'v3', auth });

  // Vídeos de la tonalidad: por nombre de fichero o, si se quedaron a medias, por el título final.
  const up = (await yt.channels.list({ part: ['contentDetails'], mine: true })).data.items[0].contentDetails.relatedPlaylists.uploads;
  const ids = new Set(); let pt;
  do { const r = await yt.playlistItems.list({ part: ['contentDetails'], playlistId: up, maxResults: 50, pageToken: pt }); r.data.items.forEach((i) => ids.add(i.contentDetails.videoId)); pt = r.data.nextPageToken; } while (pt);
  // --extra-ids a,b: vídeos que la lista de subidas se salta (pasa: 2026-10-02 omitía B formaE y Bb formaC).
  if (a['extra-ids']) String(a['extra-ids']).split(',').forEach((id) => ids.add(id.trim()));
  const all = [...ids], vids = {};
  for (let i = 0; i < all.length; i += 50) {
    const r = await yt.videos.list({ part: ['snippet', 'status'], id: all.slice(i, i + 50) });
    for (const v of r.data.items) {
      const t = v.snippet.title;
      let m;
      if (ARP) {
        if ((m = t.match(/^EscalaCTriadasEscala[ _-]([A-G](?:s|b)?)[ _-]Notas[ _-]forma([CAGED])([ _-]cerrada)?$/))) { if (v.snippet.publishedAt >= ARP_SINCE) vids[idOf(m[1], m[2], m[3])] = v; }
        else if ((m = t.match(/^Arpegios de los acordes de ([A-G][#b]?) mayor sin mover la mano izquierda \| Forma ([CAGED])( cerrada)? \(CAGED\)$/))) vids[idOf(m[1].replace('#', 's'), m[2], m[3])] = v;
      } else if ((m = t.match(/^EscalaCTriadasEscala[ _-]([A-G](?:s|b)?)[ _-]FormasAcorde[ _-]Notas[ _-]forma([CAGED])([ _-]cerrada)?$/))) vids[idOf(m[1], m[2], m[3])] = v;
      else if ((m = t.match(/^Acordes de la escala de ([A-G][#b]?) mayor sin mover la mano izquierda \| Forma ([CAGED])( cerrada)? \(CAGED\)$/))) vids[idOf(m[1].replace('#', 's'), m[2], m[3])] = v;
    }
  }
  // Orden: C, A, G, E, D, y cada cerrada justo detrás de su forma.
  const plan = FORMS.flatMap((f) => [idOf(K, f), idOf(K, f, true)]).filter((p) => vids[p] || done.has(p));
  console.log(`${NAME(K)} mayor: ${plan.length} vídeos (${plan.join(', ')}) · ya hechos: ${plan.filter((p) => done.has(p)).length}`);
  const sinForma = FORMS.filter((f) => !vids[idOf(K, f)] && !done.has(idOf(K, f)));
  if (sinForma.length) console.log(`⚠ no encuentro subidas las formas: ${sinForma.join(', ')}`);

  // Lista de la serie: mismo ID de siempre, nombre nuevo (playlists.update reemplaza el snippet entero).
  const serie = (await yt.playlists.list({ part: ['snippet'], id: [PL_SERIE_ID] })).data.items[0];
  if (PL_SERIE && serie.snippet.title !== PL_SERIE) {
    if (DRY) console.log(`[dry] renombraría la lista "${serie.snippet.title}" → "${PL_SERIE}"`);
    else {
      await yt.playlists.update({ part: ['snippet'], requestBody: { id: PL_SERIE_ID, snippet: { title: PL_SERIE, description: serie.snippet.description, defaultLanguage: serie.snippet.defaultLanguage || 'es' } } });
      console.log(`✓ lista renombrada: "${serie.snippet.title}" → "${PL_SERIE}"`);
    }
  }
  const lists = {}; pt = undefined;
  do { const r = await yt.playlists.list({ part: ['snippet'], mine: true, maxResults: 50, pageToken: pt }); for (const p of r.data.items) lists[p.snippet.title] = p.id; pt = r.data.nextPageToken; } while (pt);
  let keyList = lists[PL_KEY(K)];
  if (!keyList && !DRY) {
    try {
      const r = await yt.playlists.insert({ part: ['snippet', 'status'], requestBody: { snippet: { title: PL_KEY(K), description: `Todos los ejercicios del canal en la tonalidad de ${NAME(K)} mayor, para practicar por tonalidad.`, defaultLanguage: 'es' }, status: { privacyStatus: 'unlisted' } } });
      keyList = r.data.id; console.log(`✓ lista unlisted creada: "${PL_KEY(K)}" ${keyList}`);
      await new Promise((res) => setTimeout(res, 5000)); // propagación (ver catalog-youtube-video.js)
    } catch (e) { console.error(`⚠ no se pudo crear "${PL_KEY(K)}": ${e.message}`); }
  }

  let n = 0;
  for (const key of plan) {
    if (done.has(key)) continue;
    const v = vids[key], [, f, c] = key.split('-'), cerrada = !!c;
    const title = titleFor(K, f, cerrada), tags = tagsFor(K, f), thumb = thumbFor(K, f, cerrada);
    if (DRY) { console.log(`[dry] ${v.id} "${v.snippet.title}" → "${title}" (${title.length}) · ${tags.length} tags (${tags.join(',').length} car.) · miniatura ${fs.existsSync(thumb) ? 'existe' : 'FALTA'} · lista tonalidad ${keyList ? 'sí' : 'por crear'}`); continue; }
    try {
      if (v.status.privacyStatus === 'public') throw new Error('ya es público — no lo toco');
      const falta = [];
      await yt.videos.update({ part: ['snippet', 'status', 'paidProductPlacementDetails'], requestBody: { id: v.id,
        snippet: { title, description: description(K, f, cerrada), tags, categoryId: '27', defaultLanguage: 'es', defaultAudioLanguage: 'es' },
        status: { privacyStatus: 'private', publishAt: a['publish-at'], selfDeclaredMadeForKids: false, embeddable: true, license: 'youtube' },
        paidProductPlacementDetails: { hasPaidProductPlacement: false } } });
      try { await yt.thumbnails.set({ videoId: v.id, media: { body: fs.readFileSync(thumb) } }); }
      catch (e) { falta.push(`miniatura (${e.code || e.message})`); }
      if (!keyList) falta.push(`lista "${PL_KEY(K)}"`);
      for (const pl of [PL_SERIE_ID, keyList].filter(Boolean)) {
        const has = (await yt.playlistItems.list({ part: ['id'], playlistId: pl, videoId: v.id })).data.items.length;
        if (!has) await yt.playlistItems.insert({ part: ['snippet'], requestBody: { snippet: { playlistId: pl, resourceId: { kind: 'youtube#video', videoId: v.id } } } });
      }
      if (falta.length) { console.log(`◐ ${key} ${v.id} "${title}" — falta: ${falta.join(', ')}`); continue; }
      fs.appendFileSync(DONE, key + '\n'); done.add(key); n++;
      console.log(`✓ ${key} ${v.id} "${title}"`);
    } catch (e) {
      const reason = e.errors && e.errors[0] && e.errors[0].reason;
      console.error(`✗ ${key} ${v.id}: ${reason || ''} ${e.message}`);
      if (reason === 'quotaExceeded' || /exceeded your.*quota/i.test(e.message)) { console.error('Cuota agotada — sigue mañana con el mismo comando.'); break; }
    }
  }
  console.log(`Completos en esta pasada: ${n} · ${NAME(K)} mayor ${plan.filter((p) => done.has(p)).length}/${plan.length}`);
})().catch((e) => { console.error('ERROR', e.message); process.exitCode = 1; });
