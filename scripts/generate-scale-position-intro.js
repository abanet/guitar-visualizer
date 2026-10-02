#!/usr/bin/env node
/*
 * Capítulo 1 del vídeo largo de una posición: "construir la posición" (diseño de Alberto,
 * 2026-09-27). Mástil vacío → aparecen las notas de la posición CAGED una a una desde la TÓNICA MÁS
 * GRAVE, sonando a la vez (una por pulso); al completar la octava (7 notas) brillan todas y pasan a
 * fantasma; se repite con la octava siguiente; al final, las notas sueltas (por debajo de la 1ª
 * tónica y por encima de la última octava completa) como un último grupo, igual. Termina con toda
 * la posición en fantasma. Solo suenan las notas, sin backing.
 *
 * La posición es la MISMA caja que el resto de capítulos (asActiveNotes de guitarvisualizer.html:
 * en mayor, la caja de referencia corregida desplazada a la tónica). Imagen: un fotograma por
 * estado (scripts/lib/scale-intro-frame.html) unidos con fundidos por ffmpeg. Sonido: el pluck de
 * guitarra del Mástil interactivo (miPlayTone), renderizado offline nota a nota en el navegador.
 *
 * Uso: node scripts/generate-scale-position-intro.js --root C --position E [--bpm 85] [--out <dir>]
 *      [--badges]  (intervalo en placa pequeña junto a cada nota, respecto a la tónica de la escala)
 *      [--next "las tríadas"]  (lo que se anuncia en el subtítulo: "Localiza la escala mayor de C antes de comenzar con …")
 * Salida: <out>/<Root>_Forma<X>_ConstruyeLaPosicion.mp4 (por defecto ~/Downloads/PosicionEscala)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);
const { renderToneTrackInPage } = require('./lib/pluck-audio');

const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const POS_LABELS = ['E', 'D', 'C', 'A', 'G'];
const APPEAR = 0.12, TO_GHOST = 0.45; // s de fundido: aparición de nota / paso a fantasma

function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  return a;
}

(async () => {
  const args = parseArgs(process.argv);
  const root = args.root || 'C', posLabel = (args.position || 'E').toUpperCase(), bpm = parseFloat(args.bpm || 85);
  const posIdx = POS_LABELS.indexOf(posLabel);
  if (posIdx < 0) { console.error('--position debe ser E, D, C, A o G'); process.exit(1); }
  const beat = 60 / bpm;
  const outDir = path.resolve(args.out || path.join(os.homedir(), 'Downloads', 'PosicionEscala'));
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-intro-'));

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const app = await browser.newPage();
  app.on('dialog', d => d.accept());
  await app.goto('file://' + path.resolve(__dirname, '..', 'guitarvisualizer.html'));
  const box = await app.evaluate(({ root, posIdx }) => {
    showTab('arpscale');
    document.getElementById('asRoot').value = root; document.getElementById('asScale').value = 'major';
    document.getElementById('asPos').value = String(posIdx); document.getElementById('asQuality').value = 'triads';
    asGenerate();
    const rp = noteToSt(root), IV = { 0: 'R', 2: '2', 4: '3', 5: '4', 7: '5', 9: '6', 11: '7' };
    return asActiveNotes().map(n => ({ string: n.string, fret: n.fret, label: n.note, isRoot: !!n.isRoot, iv: IV[((n.st - rp) % 12 + 12) % 12] || '' }));
  }, { root, posIdx });

  // Grave → agudo; octavas completas desde cada tónica; lo que sobra = último grupo, en el orden en
  // que sigue la mano: PRIMERO las de encima de la última octava (continuando hacia el agudo) y
  // DESPUÉS las de debajo de la 1ª tónica — un solo salto (1ª cuerda → 6ª). Antes iban de grave a
  // agudo y saltaba de la octava a la 6ª y otra vez a la 1ª (corregido a petición de Alberto).
  // --closed: la misma posición 12 trastes más arriba, sin cuerdas al aire (vídeo "Forma X cerrada").
  if (args.closed) box.forEach(n => { n.fret += 12; });
  const notes = box.map(n => ({ ...n, midi: OPEN_MIDI[n.string] + n.fret })).sort((a, b) => a.midi - b.midi);
  const first = notes.findIndex(n => n.isRoot);
  const groups = [];
  let i = first;
  while (i >= 0 && i + 7 <= notes.length && notes[i].isRoot) { groups.push({ caption: `${groups.length + 1}ª octava`, notes: notes.slice(i, i + 7) }); i += 7; }
  const rest = [...notes.slice(Math.max(i, 0)), ...notes.slice(0, Math.max(0, first))];
  if (rest.length) groups.push({ caption: 'Notas que completan la posición', notes: rest });
  console.log(`${root} forma ${posLabel}: ${notes.length} notas → ` + groups.map(g => `${g.caption} (${g.notes.map(n => n.label).join(' ')})`).join(' · '));

  // Pasos: {state: Map key→estado, dur (s), xfadeIn (s), caption, sound?: nota}
  const key = n => n.string + ':' + n.fret;
  const state = new Map(notes.map(n => [key(n), 'hidden']));
  const steps = [];
  // xfadeIn mínimo 0,04 s (corte casi seco): con 0 la cadena de xfade se desfasaba y el vídeo salía cortado.
  const push = (dur, xfadeIn, caption, sound) => steps.push({ state: new Map(state), dur, xfadeIn: Math.max(0.04, xfadeIn), caption, sound });
  push(2 * beat, 0, '');                                                   // mástil vacío
  // Primero las TÓNICAS, de grave a agudo, sonando — para localizar de un vistazo la zona del mástil
  // (pedido de Alberto). Se quedan encendidas todo el capítulo: al recorrer las octavas vuelven a
  // sonar al pasar por ellas, pero nunca pasan a fantasma.
  const tonics = notes.filter(n => n.isRoot);
  tonics.forEach(n => { state.set(key(n), 'active'); push(2 * beat, APPEAR, 'Las tónicas: aquí está la escala', n); });
  push(beat, 0, 'Las tónicas: aquí está la escala');
  const afterFlash = n => n.isRoot ? 'active' : 'ghost';
  groups.forEach(g => {
    // Una tónica ya encendida que vuelve a sonar hace un DESTELLO (estado 'flash') durante su pulso y
    // vuelve a 'active' — si no, parecía inmóvil y no se veía que era la que sonaba (Alberto).
    g.notes.forEach(n => {
      if (n.isRoot) { state.set(key(n), 'flash'); push(beat, 0.08, g.caption, n); state.set(key(n), 'active'); }
      else { state.set(key(n), 'active'); push(beat, APPEAR, g.caption, n); }
    });
    g.notes.forEach(n => state.set(key(n), 'flash')); push(beat, 0.15, g.caption);
    g.notes.forEach(n => state.set(key(n), afterFlash(n))); push(beat, TO_GHOST, g.caption);
  });
  push(3 * beat, 0, '');                                                   // toda la posición en fantasma

  // Fotogramas
  const frameUrl = 'file://' + path.join(__dirname, 'lib', 'scale-intro-frame.html');
  const frets = notes.map(n => n.fret);
  const fretMin = Math.max(1, Math.min(...frets) - 1), fretMax = Math.max(...frets) + 1;
  const title = `Escala de ${root} mayor · Forma ${posLabel}${args.closed ? ' cerrada' : ''}`;
  // Texto de Alberto: el capítulo 1 presenta la posición ANTES de lo que viene (por defecto, las
  // tríadas: es el capítulo 2 del vídeo largo). --next cambia lo que se anuncia.
  const subtitle = `Localiza la escala mayor de ${root} antes de comenzar con ${args.next || 'las tríadas'}…`;
  for (let k = 0; k < steps.length; k++) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const data = { title, subtitle, caption: steps[k].caption, fretMin, fretMax,
      badges: !!args.badges,
      notes: notes.map(n => ({ string: n.string, fret: n.fret, label: n.label, isRoot: n.isRoot, iv: n.iv, state: steps[k].state.get(key(n)) })) };
    await page.addInitScript(d => { window.__DATA__ = d; }, data);
    await page.goto(frameUrl);
    steps[k].png = path.join(tmp, `f${String(k).padStart(3, '0')}.png`);
    await page.screenshot({ path: steps[k].png });
    await page.close();
  }

  // Audio: una nota por paso "de aparición", en el instante en que aparece.
  let t = 0; const events = [];
  steps.forEach(s => { if (s.sound) events.push({ t, freq: 82.4069 * Math.pow(2, (s.sound.midi - 40) / 12) }); t += s.dur; });
  const total = t;
  const wavB64 = await app.evaluate(renderToneTrackInPage, { events, total });
  const wav = path.join(tmp, 'notas.wav');
  fs.writeFileSync(wav, Buffer.from(wavB64, 'base64'));
  await browser.close();

  // Vídeo: cadena de xfade; cada paso dura lo suyo y el fundido de ENTRADA se come el final del anterior.
  const ff = ['-loglevel', 'error', '-y'];
  steps.forEach((s, k) => { const next = steps[k + 1]; ff.push('-loop', '1', '-framerate', '25', '-t', (s.dur + (next ? next.xfadeIn : 0)).toFixed(3), '-i', s.png); });
  ff.push('-i', wav);
  let fc = '', prev = '[0]', off = 0;
  for (let k = 1; k < steps.length; k++) {
    off += steps[k - 1].dur;
    const x = steps[k].xfadeIn;
    const last = k === steps.length - 1;
    fc += `${prev}[${k}]xfade=transition=fade:duration=${x}:offset=${off.toFixed(3)}${last ? ',format=yuv420p[v]' : `[v${k}];`}`;
    prev = `[v${k}]`;
  }
  const out = path.join(outDir, `${root.replace('#', 's')}_Forma${posLabel}${args.closed ? '_Cerrada' : ''}_ConstruyeLaPosicion.mp4`);
  ff.push('-filter_complex', fc, '-map', '[v]', '-map', `${steps.length}:a`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out);
  await execFileP('nice', ['-n', '10', 'ffmpeg', ...ff], { maxBuffer: 1 << 24 });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`✓ ${out} (${total.toFixed(1)} s, ${steps.length} pasos)`);
})().catch(e => { console.error(e); process.exitCode = 1; });
