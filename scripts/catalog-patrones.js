#!/usr/bin/env node
/*
 * Cataloga la serie "Patrones melódicos de la escala mayor" (vídeos progresivos de generate-scale-sequences.js)
 * ya subida con el nombre de fichero como título (p.ej. "EscalasPorTerceras C FormaE 40-120bpm"), UNA TONALIDAD
 * y UN EJERCICIO por llamada. Para cada vídeo: título, descripción con los CAPÍTULOS por tempo, tags, categoría
 * 27, idioma es, no infantil, miniatura, programado (--publish-at) y listas:
 *   - pública "Patrones melódicos de la escala mayor" (se crea si no existe)
 *   - oculta "Ejercicios en <Tono> mayor"
 * Reanudable: scripts/.catalog-patrones-<serie>-done.txt. IDs extra: scripts/.catalog-patrones-ids.txt o --extra-ids.
 *
 * Series (--series): terceras | triadas | septimas (12 tonalidades) · grupos3 | grupos4 | alternas | sextas | zigzag (solo C)
 * Uso: node scripts/catalog-patrones.js --series terceras --key C --publish-at 2026-10-31T16:30:00Z [--thumbs <dir>] [--dry-run]
 *      node scripts/catalog-patrones.js --series terceras --key C --print     (título + descripción de cada forma, sin API)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const a = {};
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith('--')) { const n = process.argv[i + 1]; if (n === undefined || n.startsWith('--')) a[k.slice(2)] = true; else { a[k.slice(2)] = n; i++; } } }
const KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'Fs', 'Db', 'Ab', 'Eb', 'Bb', 'F']; // círculo de quintas
// Acordes diatónicos con su grafía correcta (los mismos que en catalog-acordes-escala.js).
const CHORDS = {
  C: 'C Dm Em F G Am Bdim', G: 'G Am Bm C D Em F#dim', D: 'D Em F#m G A Bm C#dim', A: 'A Bm C#m D E F#m G#dim',
  E: 'E F#m G#m A B C#m D#dim', B: 'B C#m D#m E F# G#m A#dim', Fs: 'F# G#m A#m B C# D#m E#dim',
  Db: 'Db Ebm Fm Gb Ab Bbm Cdim', Ab: 'Ab Bbm Cm Db Eb Fm Gdim', Eb: 'Eb Fm Gm Ab Bb Cm Ddim',
  Bb: 'Bb Cm Dm Eb F Gm Adim', F: 'F Gm Am Bb C Dm Edim',
};
const SUF7 = ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5'];
const tri = (k) => CHORDS[k].split(' '), sc = (k) => tri(k).map((c) => c.replace(/(m|dim)$/, '')), sev = (k) => sc(k).map((n, i) => n + SUF7[i]);
const pares = (k, salto, n = 3) => { const e = sc(k); return Array.from({ length: n }, (_, i) => `${e[i]}-${e[(i + salto) % 7]}`).join(', '); };
const range = (a0, b0) => { const r = []; for (let t = a0; t <= b0; t += 5) r.push(t); return r; };
// lap: pulsos por vuelta [posición de 17 notas, posición de 16 notas (Forma A)] — los que imprime el generador ("Vuelta: … = N compases").
const SERIES = {
  terceras: { file: 'EscalasPorTerceras', como: 'por terceras', tempos: range(40, 120), lap: [32, 32], notas: 'corcheas',
    que: (k) => `La escala recorrida por terceras: cada nota seguida de la que está dos grados por encima (${pares(k, 2)}…). En la fila de arriba ves qué dos notas suenan y si la tercera es mayor o menor, para ir asociando el sonido de cada una.` },
  triadas: { file: 'EscalasPorTriadas', como: 'por triadas', tempos: range(40, 120), lap: [28, 28], notas: 'tresillos',
    que: (k) => `La escala recorrida por triadas diatónicas: sobre cada nota, su triada (${tri(k).join(', ')}), tres notas por pulso. En la fila de arriba se ilumina el acorde que suena, con su grado.` },
  septimas: { file: 'EscalasPorSeptimas', como: 'por arpegios de 7ª', tempos: range(40, 120), lap: [44, 40], notas: 'corcheas',
    que: (k) => `La escala recorrida por arpegios de 7ª diatónicos: sobre cada nota, su acorde de cuatro notas (${sev(k).join(', ')}). En la fila de arriba se ilumina el acorde que suena, con su grado.` },
  grupos3: { file: 'EscalasPorGruposDe3', como: 'en grupos de 3 notas', tempos: range(40, 110), lap: [32, 32], notas: 'tresillos', soloC: true,
    que: 'La escala en grupos de tres notas seguidas: 1-2-3, 2-3-4, 3-4-5… Un grupo por pulso, en tresillos. Es una de las secuencias más usadas para ganar soltura y velocidad dentro de una posición.' },
  grupos4: { file: 'EscalasPorGruposDe4', como: 'en grupos de 4 notas', tempos: range(40, 90), lap: [32, 28], notas: 'semicorcheas', soloC: true,
    que: 'La escala en grupos de cuatro notas seguidas: 1-2-3-4, 2-3-4-5, 3-4-5-6… Un grupo por pulso, en semicorcheas. Es la secuencia clásica para trabajar la velocidad y la púa alterna.' },
  alternas: { file: 'EscalasPorTercerasAlternas', como: 'por terceras alternas', tempos: range(40, 120), lap: [32, 32], notas: 'corcheas', soloC: true,
    que: 'La escala por terceras alternas: una tercera sube y la siguiente baja (C-E, F-D, E-G, A-F…). Rompe la rutina de las terceras seguidas y obliga a pensar cada salto.' },
  sextas: { file: 'EscalasPorSextas', como: 'por sextas', tempos: range(40, 120), lap: [28, 24], notas: 'corcheas', soloC: true,
    que: 'La escala recorrida por sextas: cada nota seguida de la que está cinco grados por encima (C-A, D-B, E-C…). En la fila de arriba ves las dos notas y si la sexta es mayor o menor.' },
  zigzag: { file: 'EscalasPorTriadasZigzag', como: 'por triadas en zigzag', tempos: range(40, 110), lap: [28, 28], notas: 'tresillos', soloC: true,
    que: 'La escala por triadas en zigzag: una triada sube y la siguiente baja (C-E-G, A-F-D, E-G-B…). En la fila de arriba se ilumina el acorde que suena, con su grado.' },
};
const SERIE = a.series, S = SERIES[SERIE];
if (!S || !KEYS.includes(a.key) || (!a['publish-at'] && !a.print)) { console.error(`Uso: --series <${Object.keys(SERIES).join('|')}> --key <${KEYS.join('|')}> --publish-at <ISO> [--thumbs <dir>] [--dry-run] | --print`); process.exit(1); }
const DRY = !!a['dry-run'], K = a.key, NAME = K.replace(/s$/, '#');
const ROOT = path.resolve(__dirname, '..');
const THUMBS = path.resolve(a.thumbs || path.join(os.homedir(), 'guitar-visualizer-assets', 'miniaturas-patrones'));
const DONE = path.join(__dirname, `.catalog-patrones-${SERIE}-done.txt`);
const done = new Set(fs.existsSync(DONE) ? fs.readFileSync(DONE, 'utf8').split('\n').filter(Boolean) : []);
const FORMS = ['C', 'A', 'G', 'E', 'D'];
const T0 = S.tempos[0], T1 = S.tempos[S.tempos.length - 1];
const PL_SERIE = 'Patrones melódicos de la escala mayor';
const PL_SERIE_DESC = 'La escala mayor recorrida con los patrones melódicos de siempre (terceras, triadas, arpegios de 7ª, grupos de 3 y de 4 notas…) dentro de cada posición CAGED, con una base rítmica que sube el tempo en cada vuelta: empiezas despacio y acabas rápido.';
const PL_KEY = `Ejercicios en ${NAME} mayor`;
let PL_SERIE_ID = null;
const plUrl = (id) => `https://www.youtube.com/playlist?list=${id}`;
const stem = (f, c) => `${S.file}_${K}_Forma${f}${c ? '_Cerrada' : ''}_${T0}-${T1}bpm`;
const titleFor = (f, c) => `Escala de ${NAME} mayor ${S.como} | Forma ${f}${c ? ' cerrada' : ''} (CAGED) | ${T0}–${T1} bpm`;
const mmss = (t) => { const s = Math.floor(t); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
// Capítulos: 2 compases de cuenta al primer tempo y una vuelta entera por tempo.
function chapters(f) {
  const lap = S.lap[f === 'A' ? 1 : 0]; let t = 8 * 60 / T0;
  return S.tempos.map((bpm, i) => { const line = `${i === 0 ? '0:00' : mmss(t)} ${bpm} bpm`; t += lap * 60 / bpm; return line; }).join('\n');
}
function description(f, c) {
  return `La escala de ${NAME} mayor ${S.como} en la Forma ${f}${c ? ' cerrada' : ''} del sistema CAGED, con una base rítmica que empieza a ${T0} bpm y sube 5 bpm en cada vuelta hasta ${T1}.

${typeof S.que === 'function' ? S.que(K) : S.que}

Cada vuelta recorre la posición entera: sale de la tónica más grave, sube hasta arriba, baja hasta la nota más grave y vuelve a la tónica. Arriba a la derecha tienes el metrónomo y abajo la escalera de tempos, para saber siempre por dónde vas.${c ? `

🔒 Versión cerrada: la misma Forma ${f}, 12 trastes más arriba y sin cuerdas al aire.` : ''}

⏱️ Elige tu tempo
${chapters(f)}

🎯 Cómo practicarlo
1. Empieza desde el principio y toca encima. Las primeras vueltas son lentas a propósito: úsalas para memorizar el recorrido.
2. Cuando una vuelta se te resista, vuelve a su capítulo y repítela antes de seguir.
3. La próxima vez empieza un par de tempos más arriba.
4. Cuando lo tengas en esta forma, pasa a la siguiente: las 5 formas juntas cubren todo el mástil.${S.soloC ? `

💡 El patrón es el mismo en cualquier tonalidad: desplaza la posición los trastes que haga falta.` : ''}

📚 Todos los patrones melódicos: ${plUrl(PL_SERIE_ID)}

#guitarra #CAGED #escalamayor #técnica #velocidad #ejerciciosdeguitarra`;
}
const tagsFor = (f) => ['guitarra', 'escala mayor', `escala de ${NAME} mayor`, `${NAME} mayor`, 'patrones melódicos', 'secuencias de escala', `escala ${S.como}`,
  'CAGED', 'sistema CAGED', `forma ${f}`, `forma ${f} CAGED`, 'posiciones de la escala mayor', 'técnica de guitarra', 'velocidad', 'púa alterna', 'metrónomo',
  'ejercicios de guitarra', 'rutina de guitarra', 'backing track', `${T0}-${T1} bpm`, 'guitar', 'major scale sequences', 'scale patterns', 'CAGED system', 'fretboard'];
const thumbFor = (f, c) => path.join(THUMBS, `${stem(f, c)}.jpg`);
const idOf = (f, c) => `${K}-${f}${c ? '-cerrada' : ''}`;

if (a.print) {
  PL_SERIE_ID = 'ID_DE_LA_LISTA';
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
  const idsFile = path.join(__dirname, '.catalog-patrones-ids.txt');
  if (fs.existsSync(idsFile)) fs.readFileSync(idsFile, 'utf8').split(/\s+/).filter(Boolean).forEach((id) => ids.add(id));
  const norm = (t) => t.replace(/[ _]+/g, ' ').trim();
  const all = [...ids], vids = {};
  for (let i = 0; i < all.length; i += 50) {
    const r = await yt.videos.list({ part: ['snippet', 'status'], id: all.slice(i, i + 50) });
    for (const v of r.data.items) for (const f of FORMS) for (const c of [false, true]) {
      if (norm(v.snippet.title) === norm(stem(f, c)) || v.snippet.title === titleFor(f, c)) vids[idOf(f, c)] = v;
    }
  }
  // Orden: C, A, G, E, D, y cada cerrada justo detrás de su forma.
  const plan = FORMS.flatMap((f) => [[f, false], [f, true]]).filter(([f, c]) => vids[idOf(f, c)] || done.has(idOf(f, c)));
  console.log(`${SERIE} · ${NAME} mayor: ${plan.length} vídeos (${plan.map(([f, c]) => idOf(f, c)).join(', ')}) · ya hechos: ${plan.filter(([f, c]) => done.has(idOf(f, c))).length}`);
  const sin = FORMS.filter((f) => !vids[idOf(f, false)] && !done.has(idOf(f, false)));
  if (sin.length) console.log(`⚠ no encuentro subidas las formas: ${sin.join(', ')}`);

  const lists = {}; pt = undefined;
  do { const r = await yt.playlists.list({ part: ['snippet'], mine: true, maxResults: 50, pageToken: pt }); for (const p of r.data.items) lists[p.snippet.title] = p.id; pt = r.data.nextPageToken; } while (pt);
  PL_SERIE_ID = lists[PL_SERIE];
  if (!PL_SERIE_ID && DRY) console.log(`[dry] crearía la lista pública "${PL_SERIE}"`);
  else if (!PL_SERIE_ID) {
    const r = await yt.playlists.insert({ part: ['snippet', 'status'], requestBody: { snippet: { title: PL_SERIE, description: PL_SERIE_DESC, defaultLanguage: 'es' }, status: { privacyStatus: 'public' } } });
    PL_SERIE_ID = r.data.id; console.log(`✓ lista pública creada: "${PL_SERIE}" ${PL_SERIE_ID}`);
    await new Promise((res) => setTimeout(res, 5000));
  }
  const keyList = lists[PL_KEY];
  if (!keyList) console.log(`⚠ no existe la lista "${PL_KEY}"`);

  let n = 0;
  for (const [f, c] of plan) {
    const key = idOf(f, c);
    if (done.has(key)) continue;
    const v = vids[key], title = titleFor(f, c), tags = tagsFor(f), thumb = thumbFor(f, c);
    if (DRY) { console.log(`[dry] ${v.id} "${v.snippet.title}" (${v.status.privacyStatus}) → "${title}" (${title.length}) · ${tags.length} tags (${tags.join(',').length} car.) · miniatura ${fs.existsSync(thumb) ? 'existe' : 'FALTA'} · lista tonalidad ${keyList ? 'sí' : 'NO'}`); continue; }
    try {
      if (v.status.privacyStatus === 'public') throw new Error('ya es público — no lo toco');
      const falta = [];
      await yt.videos.update({ part: ['snippet', 'status', 'paidProductPlacementDetails'], requestBody: { id: v.id,
        snippet: { title, description: description(f, c), tags, categoryId: '27', defaultLanguage: 'es', defaultAudioLanguage: 'es' },
        status: { privacyStatus: 'private', publishAt: a['publish-at'], selfDeclaredMadeForKids: false, embeddable: true, license: 'youtube' },
        paidProductPlacementDetails: { hasPaidProductPlacement: false } } });
      try { await yt.thumbnails.set({ videoId: v.id, media: { body: fs.readFileSync(thumb) } }); }
      catch (e) { falta.push(`miniatura (${e.code || e.message})`); }
      if (!keyList) falta.push(`lista "${PL_KEY}"`);
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
  console.log(`Completos en esta pasada: ${n} · ${NAME} mayor ${plan.filter(([f, c]) => done.has(idOf(f, c))).length}/${plan.length}`);
})().catch((e) => { console.error('ERROR', e.message); process.exitCode = 1; });
