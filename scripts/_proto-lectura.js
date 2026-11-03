#!/usr/bin/env node
/*
 * LECTURA RÍTMICA (TodoRitmos) — prototipo de vídeo, idea de Alberto 11-02. Sin commit.
 * Un ejercicio por vídeo: cuenta de un compás, y por cada tempo de la escalera una vuelta ESCUCHA (suenan las
 * palmadas) y otra TU TURNO (solo el metrónomo). Mismo lenguaje que el vocabulario de frases (figura en curso en
 * amarillo, conteo "1 e y a" con el pulso encendido, metrónomo, escalera de tempos).
 * Sonido (Alberto: "clic de baqueta o palmada para las notas, con base de metrónomo"): metrónomo de madera (el 1 más
 * agudo) + palmada sintetizada en las notas; los acentos suenan más fuertes; la nota ligada no se vuelve a tocar.
 *
 * Uso: node scripts/_proto-lectura.js --ej n1_01 [--tempos 60,65 | auto] [--out <dir>] [--num 1]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);
const EJ = require('./_proto-lectura-data');
const { renderGuitarTrack } = require('./lib/_proto-guitar-ks');

const SR = 44100, EPS = 1e-6;
const DUR = { w: 4, hd: 3, h: 2, qd: 1.5, q: 1, '8d': 0.75, '8': 0.5, '16': 0.25 };
const LEVEL = { n1: 'Nivel 1', n2: 'Nivel 2', n3: 'Nivel 3' };
const VF_PATH = path.join(os.homedir(), 'guitar-visualizer-assets', 'vendor', 'vexflow-5.0.0.js');

function parseArgs(argv) { const a = {}; for (let i = 2; i < argv.length; i++) if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; return a; }

function parseBars(txt, ts) {
  return txt.split('|').map((bar, b) => {
    const notes = bar.trim().split(/\s+/).map(tok => { const m = tok.match(/^(w|hd|h|qd|q|8d|8|16)(r?)(~?)(>?)$/); if (!m) throw new Error(`figura desconocida: ${tok}`); return { d: m[1], r: !!m[2], tie: !!m[3], acc: !!m[4] }; });
    const sum = notes.reduce((s, n) => s + DUR[n.d], 0);
    if (Math.abs(sum - ts[0] * 4 / ts[1]) > EPS) throw new Error(`compás ${b + 1}: suma ${sum} pulsos, no ${ts[0]}`);
    return notes;
  });
}

// ── Sonidos ───────────────────────────────────────────────────────────────────────────────────────────────────
function addClick(buf, t, one) {   // metrónomo de madera: dos parciales, golpe muy corto
  const i0 = Math.floor(t * SR), f1 = one ? 1900 : 1350, f2 = f1 * 2.7, amp = one ? 0.42 : 0.3;
  for (let j = 0; j < SR * 0.05 && i0 + j < buf.length; j++) { const tt = j / SR, env = Math.exp(-tt / 0.008);
    buf[i0 + j] += amp * env * (Math.sin(2 * Math.PI * f1 * tt) + 0.35 * Math.sin(2 * Math.PI * f2 * tt)); }
}
function bandpass(f0, q) { const w = 2 * Math.PI * f0 / SR, al = Math.sin(w) / (2 * q), a0 = 1 + al; const b0 = al / a0, b2 = -al / a0, a1 = -2 * Math.cos(w) / a0, a2 = (1 - al) / a0; let x1 = 0, x2 = 0, y1 = 0, y2 = 0; return x => { const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; }; }
function addClap(buf, t, acc) {   // palmada: tres ráfagas de ruido muy seguidas + cola, filtradas en ~1,2 kHz
  const i0 = Math.floor(t * SR), bp = bandpass(1150, 1.1), bp2 = bandpass(2400, 1.4), amp = acc ? 1.0 : 0.6;
  for (let j = 0; j < SR * 0.18 && i0 + j < buf.length; j++) {
    const tt = j / SR, bursts = [0, 0.009, 0.018].reduce((s, o) => s + (tt >= o ? Math.exp(-(tt - o) / 0.004) : 0), 0) * 0.6 + (tt >= 0.022 ? Math.exp(-(tt - 0.022) / 0.045) : 0);
    const n = Math.random() * 2 - 1; buf[i0 + j] += amp * bursts * (bp(n) * 1.6 + bp2(n) * 0.5);
  }
}
// Nota sostenida (Alberto 11-02: "solo se da un golpe seco, así que suena igual una blanca que una negra"):
// un tono suave (La 440 con dos armónicos) que DURA lo que la figura (con ligaduras incluidas) y se corta un poco
// antes de la siguiente para que dos notas seguidas se distingan; el acento suena más fuerte.
function addNote(buf, t, dur, acc) {
  const i0 = Math.floor(t * SR), n = Math.floor(dur * SR), amp = acc ? 0.55 : 0.3, f = 440, rel = Math.min(0.05, dur * 0.25), on = dur - Math.max(0.06, dur * 0.1);
  for (let j = 0; j < n && i0 + j < buf.length; j++) {
    const tt = j / SR, att = Math.min(1, tt / 0.012), env = tt < on ? att * (acc && tt < 0.08 ? 1.3 - 0.3 * tt / 0.08 : 1) : Math.max(0, 1 - (tt - on) / rel);
    if (env <= 0 && tt > on) break;
    buf[i0 + j] += amp * env * (Math.sin(2 * Math.PI * f * tt) + 0.35 * Math.sin(4 * Math.PI * f * tt) + 0.12 * Math.sin(6 * Math.PI * f * tt));
  }
}
// Tono suave tipo piano eléctrico: seno + un poco de 2º armónico, ataque blando, caída lenta y corte al final de la figura.
function addSoft(buf, t, dur, acc, f) {
  const i0 = Math.floor(t * SR), n = Math.floor(dur * SR), amp = acc ? 0.5 : 0.3, on = dur - Math.max(0.06, dur * 0.1), rel = 0.05;
  for (let j = 0; j < n && i0 + j < buf.length; j++) {
    const tt = j / SR, att = Math.min(1, tt / 0.006), dec = Math.exp(-tt / 1.6), env = (tt < on ? 1 : Math.max(0, 1 - (tt - on) / rel)) * att * dec;
    buf[i0 + j] += amp * env * (Math.sin(2 * Math.PI * f * tt) + 0.18 * Math.sin(4 * Math.PI * f * tt) * Math.exp(-tt / 0.3));
  }
}
function wav(buf) {
  let pk = 1e-9; for (const v of buf) pk = Math.max(pk, Math.abs(v)); const k = 0.89 / pk, n = buf.length, out = Buffer.alloc(44 + n * 4);
  out.write('RIFF', 0); out.writeUInt32LE(36 + n * 4, 4); out.write('WAVEfmt ', 8); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22);
  out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { const s = Math.round(Math.max(-1, Math.min(1, buf[i] * k)) * 32767); out.writeInt16LE(s, 44 + i * 4); out.writeInt16LE(s, 46 + i * 4); }
  return out;
}

(async () => {
  const args = parseArgs(process.argv), P = EJ[args.ej];
  if (!P) { console.error(`--ej: ${Object.keys(EJ).join(' | ')}`); process.exit(1); }
  const bars = parseBars(P.bars, P.ts), BPB = P.ts[0], lapBeats = bars.length * BPB;
  const flat = []; let at = 0; bars.forEach(bar => bar.forEach(n => { flat.push({ ...n, at }); at += DUR[n.d]; }));
  flat.forEach((n, i) => { n.sound = !n.r && !(i > 0 && flat[i - 1].tie); });   // la nota ligada no se vuelve a tocar
  flat.forEach((n, i) => { if (!n.sound) return; let d = DUR[n.d]; for (let k = i; flat[k].tie && flat[k + 1]; k++) d += DUR[flat[k + 1].d]; n.len = d; });   // duración real con ligaduras
  const lvl = args.ej.slice(0, 2);
  const tempos = !args.tempos || args.tempos === 'auto' ? (P.tempos || [60, 65, 70, 75, 80, 85, 90, 95, 100]) : String(args.tempos).split(',').map(Number);
  const outDir = path.resolve(String(args.out || '~/Downloads/LecturaRitmica-prueba').replace(/^~/, os.homedir()));
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-lectura-'));

  // Pasos de 1/4 de pulso (lo justo para que la semicorchea en curso se vea); los fotogramas repetidos se cachean.
  const steps = [], clicks = [], claps = []; let t = 0;
  const curAt = a => flat.findIndex(n => a > n.at - EPS && a < n.at + DUR[n.d] - EPS);
  const push = (a, b, extra) => steps.push({ dur: b / 4, a, ...extra });
  const b0 = 60 / tempos[0];
  for (let q = 0; q < BPB * 4; q++) { if (q % 4 === 0) clicks.push({ t, one: q === 0 }); push(-1, b0, { bpm: tempos[0], beat: Math.floor(q / 4), lap: 0, caption: 'PREPÁRATE', cur: -1, pulse: -1, intro: true }); t += b0 / 4; }
  tempos.forEach((bpm, li) => {
    const b = 60 / bpm;
    ['ESCUCHA', 'TU TURNO'].forEach(caption => {
      for (let q = 0; q < lapBeats * 4; q++) {
        const a = q / 4, pulse = Math.floor(a + EPS);
        if (q % 4 === 0) clicks.push({ t, one: pulse % BPB === 0 });
        const n = flat.find(x => Math.abs(x.at - a) < EPS);
        if (caption === 'ESCUCHA' && n && n.sound) claps.push({ t, acc: n.acc, dur: n.len * b });
        push(a, b, { bpm, beat: pulse % BPB, lap: li, caption, cur: curAt(a), pulse });
        t += b / 4;
      }
    });
  });
  steps.push({ dur: 2, bpm: tempos[tempos.length - 1], beat: -1, lap: tempos.length, caption: '', cur: -1, pulse: -1 });
  const total = t + 2;

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto('file://' + path.join(__dirname, 'lib', '_proto-lectura-frame.html') + '?vf=' + encodeURIComponent('file://' + VF_PATH));
  await page.waitForFunction(() => typeof VexFlow !== 'undefined');
  const cache = new Map(); let nPng = 0;
  const que = P.que + '.';
  for (const s of steps) {
    const data = { title: `Lectura rítmica · ${LEVEL[lvl] || ''}`, subtitle: `${args.num ? 'Ejercicio ' + args.num + ' · ' : ''}${P.name}`, caption: s.caption, how: P.how,
      bpm: s.bpm, beat: s.beat, tempos, lap: s.lap, ts: P.ts, bars, cur: s.cur, pulse: s.pulse, nota: 'E',   // solo la nota y en inglés (Alberto 11-02: "igual lo tocan con una trompeta", "nunca Mi")
      intro: s.intro ? { lbl: 'QUÉ TRABAJA', que, end: 'Primero escucha · luego te toca a ti' } : undefined };
    const sig = JSON.stringify(data);
    if (!cache.has(sig)) { await page.evaluate(d => render(d), data); const png = path.join(tmp, `f${String(nPng++).padStart(4, '0')}.png`); await page.screenshot({ path: png }); cache.set(sig, png); }
    s.png = cache.get(sig);
  }
  await browser.close();

  const buf = new Float32Array(Math.ceil(total * SR));
  clicks.forEach(c => addClick(buf, c.t, c.one));
  // Sonido de las notas (Alberto 11-02: "un sonido menos agudo, y con el sonido de guitarra que hemos logrado"):
  // la guitarra de las frases (lib/_proto-guitar-ks.js) en el La de 220 Hz (3ª cuerda, traste 2; Alberto: el de 110 "parece un robot"), sostenida lo que
  // dura la figura (cut). En los ejercicios con acentos, las notas sin acento van más suaves.
  const hasAcc = flat.some(n => n.acc);
  const SON = String(args.sonido || 'suave'), NOTA = 329.63;   // E4 (Alberto 11-02: más dulce y una nota para tocar encima)
  if (SON === 'suave') claps.forEach(c => addSoft(buf, c.t, c.dur, c.acc, NOTA));
  const g = SON === 'suave' ? null : renderGuitarTrack(claps.map(c => ({ t: c.t, freq: NOTA, cut: Math.max(0.12, c.dur - Math.min(0.08, c.dur * 0.12)), soft: hasAcc && !c.acc })), total, { drive: 0.6 });
  const nS = g ? (g.length - 44) / 4 : 0;
  for (let i = 0; i < nS && i < buf.length; i++) buf[i] += 0.9 * (g.readInt16LE(44 + i * 4) / 32768);
  const w = path.join(tmp, 'audio.wav'); fs.writeFileSync(w, wav(buf));
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, steps.map(s => `file '${s.png}'\nduration ${s.dur.toFixed(4)}`).join('\n') + `\nfile '${steps[steps.length - 1].png}'\n`);
  const out = path.join(outDir, `Lectura_${args.num ? String(args.num).padStart(2, '0') + '_' : ''}${args.ej}_${tempos[0]}-${tempos[tempos.length - 1]}bpm.mp4`);
  await execFileP('nice', ['-n', '19', 'ffmpeg', '-loglevel', 'error', '-y', '-threads', '2', '-f', 'concat', '-safe', '0', '-i', list, '-i', w,
    '-vf', 'fps=25,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { maxBuffer: 1 << 24 });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`✓ ${out} (${total.toFixed(1)} s, ${steps.length} pasos, ${nPng} fotogramas distintos)`);
})().catch(e => { console.error(e.stderr || e); process.exitCode = 1; });
