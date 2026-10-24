#!/usr/bin/env node
/*
 * Cataloga la serie "Pentatónica menor / mayor: improvisa sobre la base" (vídeos de generate-pentatonic-mix.js en
 * modo penta-menor / penta-mayor) ya subida con el nombre de fichero como título (p.ej. "PentatonicaMenor A FormaE"),
 * UNA TONALIDAD por llamada. Para cada vídeo: título, descripción, tags, categoría 27, idioma es, no infantil,
 * miniatura (generate-pentatonica-thumbnails.py), programado (--publish-at) y listas:
 *   - pública "Pentatónica menor|mayor: improvisa sobre la base (CAGED)" (se crea si no existe)
 *   - la de la tonalidad ("Ejercicios en A menor", "Ejercicios en C mayor") SOLO si ya existe: no todas las
 *     tonalidades menores tienen lista, y que falte no debe bloquear el vídeo.
 * Decisiones de Alberto (2026-10-24): menor y mayor a la vez en dos franjas, una tonalidad al día (sus 6 vídeos
 * juntos), 27-10 → 02-11; las listas antiguas ("Pentatónica menor" 32, "Pentatónica Mayor" 21) se quedan públicas
 * detrás. En el feed solo la Forma E de cada tonalidad (casilla de Studio, no API).
 * Reanudable: scripts/.catalog-pentatonica-<serie>-done.txt.
 *
 * Uso: node scripts/catalog-pentatonica.js --serie menor --key A --publish-at 2026-10-27T18:00:00Z [--dry-run]
 *      node scripts/catalog-pentatonica.js --serie menor --key A --print     (título + descripción, sin API)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const a = {};
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith('--')) { const n = process.argv[i + 1]; if (n === undefined || n.startsWith('--')) a[k.slice(2)] = true; else { a[k.slice(2)] = n; i++; } } }
// Por tonalidad: las cinco notas de la pentatónica y las dos de la escala de siete que se quitan (grafía correcta).
const SERIES = {
  menor: { file: 'PentatonicaMenor', modo: 'menor', acorde: 'm7', padre: 'escala menor natural', quita: 'la 2ª y la 6ª menor', ivs: '1 · 3m · 4 · 5 · 7m',
    otra: 'mayor', keys: {
      A: ['A C D E G', 'B y F'], E: ['E G A B D', 'F# y C'], B: ['B D E F# A', 'C# y G'], Fs: ['F# A B C# E', 'G# y D'],
      C: ['C Eb F G Bb', 'D y Ab'], G: ['G Bb C D F', 'A y Eb'], D: ['D F G A C', 'E y Bb'] } },
  mayor: { file: 'PentatonicaMayor', modo: 'mayor', acorde: '6', padre: 'escala mayor', quita: 'la 4ª y la 7ª', ivs: '1 · 2M · 3M · 5 · 6M',
    otra: 'menor', keys: {
      C: ['C D E G A', 'F y B'], G: ['G A B D E', 'C y F#'], D: ['D E F# A B', 'G y C#'], A: ['A B C# E F#', 'D y G#'],
      Eb: ['Eb F G Bb C', 'Ab y D'], Bb: ['Bb C D F G', 'Eb y A'], F: ['F G A C D', 'Bb y E'] } },
};
const S = SERIES[a.serie];
if (!S || !S.keys[a.key] || (!a['publish-at'] && !a.print)) { console.error(`Uso: --serie <menor|mayor> --key <${S ? Object.keys(S.keys).join('|') : 'tonalidad'}> --publish-at <ISO> [--dry-run] | --print`); process.exit(1); }
const DRY = !!a['dry-run'], K = a.key, NAME = K.replace(/s$/, '#'), CHORD = NAME + S.acorde;
const [NOTAS, FUERA] = S.keys[K];
const ROOT = path.resolve(__dirname, '..');
const THUMBS = path.join(os.homedir(), 'guitar-visualizer-assets', 'miniaturas-pentatonica');
const DONE = path.join(__dirname, `.catalog-pentatonica-${a.serie}-done.txt`);
const done = new Set(fs.existsSync(DONE) ? fs.readFileSync(DONE, 'utf8').split('\n').filter(Boolean) : []);
const FORMS = ['C', 'A', 'G', 'E', 'D'];
const plName = (modo) => `Pentatónica ${modo}: improvisa sobre la base (CAGED)`;
const PL_SERIE = plName(S.modo), PL_OTRA = plName(S.otra);
const PL_SERIE_DESC = `La pentatónica ${S.modo} en cada forma del sistema CAGED y en varias tonalidades, sobre una base de un solo acorde a 95 bpm: la escala en el mástil y consejos de improvisación que van saliendo mientras tocas.`;
const PL_KEY = `Ejercicios en ${NAME} ${S.modo}`;
let PL_SERIE_ID = null, PL_OTRA_ID = null;
const plUrl = (id) => `https://www.youtube.com/playlist?list=${id}`;
const stem = (f, c) => `${S.file}_${K}_Forma${f}${c ? '_Cerrada' : ''}`;
const titleFor = (f, c) => `Pentatónica de ${NAME} ${S.modo} | Forma ${f}${c ? ' cerrada' : ''} (CAGED) | Improvisa sobre ${CHORD}`;
function description(f, c) {
  return `Improvisa con la pentatónica de ${NAME} ${S.modo} en la Forma ${f}${c ? ' cerrada' : ''} del sistema CAGED, sobre una base de ${CHORD} a 95 bpm (120 compases, unos 5 minutos).

La pentatónica ${S.modo} es la ${S.padre} sin ${S.quita}: cinco notas (${NOTAS}) con las que es muy difícil que algo suene mal. En el mástil brillan sus notas en esta forma y, en gris, las dos que se quitan (${FUERA}), para que veas de dónde sale. Arriba tienes la fórmula (${S.ivs}) y el metrónomo.

💡 Mientras tocas van saliendo 17 consejos de improvisación, de uno en uno: dejar silencios, tocar con pocas notas, repetir una idea, pregunta y respuesta… y en qué nota terminar cada frase y qué sensación deja cada una.${c ? `

🔒 Versión cerrada: la misma Forma ${f}, 12 trastes más arriba y sin cuerdas al aire.` : ''}

🎯 Cómo practicarlo
1. La primera vuelta, toca solo la escala de arriba abajo para situarte en la forma.
2. Después improvisa encima siguiendo el consejo que esté en pantalla.
3. Cuando te sientas cómodo en esta forma, pasa a la siguiente: las 5 formas juntas cubren todo el mástil.

📚 Toda la serie de la pentatónica ${S.modo}: ${plUrl(PL_SERIE_ID)}${PL_OTRA_ID ? `
🎸 Pentatónica ${S.otra}: ${plUrl(PL_OTRA_ID)}` : ''}

#guitarra #pentatonica #improvisacion #CAGED #ejerciciosdeguitarra`;
}
const tagsFor = (f) => ['guitarra', 'pentatónica', `pentatónica ${S.modo}`, `pentatónica de ${NAME} ${S.modo}`, `escala pentatónica ${S.modo}`, 'improvisación', 'improvisar con la pentatónica',
  'backing track', `backing track ${CHORD}`, `${NAME} ${S.modo}`, 'CAGED', 'sistema CAGED', `forma ${f}`, `forma ${f} CAGED`, 'posiciones de la pentatónica', 'cajas de la pentatónica',
  'solos de guitarra', 'ejercicios de guitarra', 'rutina de guitarra', '95 bpm', 'guitar', `${S.modo === 'menor' ? 'minor' : 'major'} pentatonic`, 'pentatonic scale', 'improvisation', 'CAGED system'];
const thumbFor = (f, c) => path.join(THUMBS, `${stem(f, c)}.jpg`);
const idOf = (f, c) => `${K}-${f}${c ? '-cerrada' : ''}`;

if (a.print) {
  PL_SERIE_ID = 'ID_DE_LA_LISTA'; PL_OTRA_ID = 'ID_DE_LA_OTRA';
  for (const f of FORMS) console.log(`──────── ${stem(f)}\n${titleFor(f)}  (${titleFor(f).length} car.)\n\n${description(f)}\n`);
  process.exit(0);
}

const { google } = require('googleapis');
const { loadOAuthClient } = require('./upload-youtube');
(async () => {
  const auth = await loadOAuthClient(path.join(ROOT, 'scripts/lib/youtube-oauth-client.json'), path.join(ROOT, 'scripts/.youtube-token.json'));
  const yt = google.youtube({ version: 'v3', auth });

  const up = (await yt.channels.list({ part: ['contentDetails'], mine: true })).data.items[0].contentDetails.relatedPlaylists.uploads;
  const ids = new Set(); let pt;
  do { const r = await yt.playlistItems.list({ part: ['contentDetails'], playlistId: up, maxResults: 50, pageToken: pt }); r.data.items.forEach((i) => ids.add(i.contentDetails.videoId)); pt = r.data.nextPageToken; } while (pt);
  if (a['extra-ids']) String(a['extra-ids']).split(',').forEach((id) => ids.add(id.trim()));
  const norm = (t) => t.replace(/[ _-]+/g, ' ').trim();
  const all = [...ids], vids = {};
  for (let i = 0; i < all.length; i += 50) {
    const r = await yt.videos.list({ part: ['snippet', 'status'], id: all.slice(i, i + 50) });
    for (const v of r.data.items) for (const f of FORMS) for (const c of [false, true]) {
      if (norm(v.snippet.title) === norm(stem(f, c)) || v.snippet.title === titleFor(f, c)) vids[idOf(f, c)] = v;
    }
  }
  // Orden: C, A, G, E, D, y la cerrada justo detrás de su forma.
  const plan = FORMS.flatMap((f) => [[f, false], [f, true]]).filter(([f, c]) => vids[idOf(f, c)] || done.has(idOf(f, c)));
  console.log(`pentatónica ${S.modo} · ${NAME}: ${plan.length} vídeos (${plan.map(([f, c]) => idOf(f, c)).join(', ')}) · ya hechos: ${plan.filter(([f, c]) => done.has(idOf(f, c))).length}`);
  const sin = FORMS.filter((f) => !vids[idOf(f, false)] && !done.has(idOf(f, false)));
  if (sin.length) console.log(`⚠ no encuentro subidas las formas: ${sin.join(', ')}`);

  const lists = {}; pt = undefined;
  do { const r = await yt.playlists.list({ part: ['snippet'], mine: true, maxResults: 50, pageToken: pt }); for (const p of r.data.items) lists[p.snippet.title] = p.id; pt = r.data.nextPageToken; } while (pt);
  PL_SERIE_ID = lists[PL_SERIE]; PL_OTRA_ID = lists[PL_OTRA] || null;
  if (!PL_SERIE_ID && DRY) console.log(`[dry] crearía la lista pública "${PL_SERIE}"`);
  else if (!PL_SERIE_ID) {
    const r = await yt.playlists.insert({ part: ['snippet', 'status'], requestBody: { snippet: { title: PL_SERIE, description: PL_SERIE_DESC, defaultLanguage: 'es' }, status: { privacyStatus: 'public' } } });
    PL_SERIE_ID = r.data.id; console.log(`✓ lista pública creada: "${PL_SERIE}" ${PL_SERIE_ID}`);
    await new Promise((res) => setTimeout(res, 5000));
  }
  const keyList = lists[PL_KEY];
  if (!keyList) console.log(`(no existe la lista "${PL_KEY}": solo va a la de la serie)`);

  let n = 0;
  for (const [f, c] of plan) {
    const key = idOf(f, c);
    if (done.has(key)) continue;
    const v = vids[key], title = titleFor(f, c), tags = tagsFor(f), thumb = thumbFor(f, c);
    if (DRY) { console.log(`[dry] ${v.id} "${v.snippet.title}" (${v.status.privacyStatus}) → "${title}" (${title.length}) · ${tags.length} tags (${tags.join(',').length} car.) · miniatura ${fs.existsSync(thumb) ? 'existe' : 'FALTA'} · lista tonalidad ${keyList ? 'sí' : 'no'}`); continue; }
    try {
      if (v.status.privacyStatus === 'public') throw new Error('ya es público — no lo toco');
      const falta = [];
      await yt.videos.update({ part: ['snippet', 'status', 'paidProductPlacementDetails'], requestBody: { id: v.id,
        snippet: { title, description: description(f, c), tags, categoryId: '27', defaultLanguage: 'es', defaultAudioLanguage: 'es' },
        status: { privacyStatus: 'private', publishAt: a['publish-at'], selfDeclaredMadeForKids: false, embeddable: true, license: 'youtube' },
        paidProductPlacementDetails: { hasPaidProductPlacement: false } } });
      try { await yt.thumbnails.set({ videoId: v.id, media: { body: fs.readFileSync(thumb) } }); }
      catch (e) { falta.push(`miniatura (${e.code || e.message})`); }
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
  console.log(`Completos en esta pasada: ${n} · ${NAME} ${S.modo} ${plan.filter(([f, c]) => done.has(idOf(f, c))).length}/${plan.length}`);
})().catch((e) => { console.error('ERROR', e.message); process.exitCode = 1; });
