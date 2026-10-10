// Sonido de guitarra (el pluck de miPlayTone del Mástil interactivo) renderizado OFFLINE nota a
// nota, para los generadores que construyen el vídeo fotograma a fotograma (capítulo 1 "construye la
// posición", secuencias…). renderToneTrackInPage se pasa tal cual a page.evaluate(): se ejecuta
// dentro del navegador y devuelve el WAV en base64.
// Pluck de miPlayTone (guitarvisualizer.html) con instante de inicio explícito, para renderizarlo
// OFFLINE en un OfflineAudioContext. Devuelve el WAV (PCM 16 bits estéreo) en base64.
function renderToneTrackInPage({ events, total }) {
  const rate = 44100, ctx = new OfflineAudioContext(2, Math.ceil(rate * total), rate);
  const bus = ctx.createDynamicsCompressor();
  bus.threshold.value = -24; bus.knee.value = 30; bus.ratio.value = 12; bus.attack.value = 0.003; bus.release.value = 0.25;
  bus.connect(ctx.destination);
  const len = Math.floor(rate * 1.4), imp = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) { const d = imp.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5); }
  events.forEach(({ t, freq, glide, bend, vib, soft, ligs }) => {
    const ligEnd = ligs ? ligs[ligs.length - 1].at : 0;   // ligados: la MISMA voz sigue sonando y salta de nota, sin ataque nuevo
    const now = t + 0.01, sustain = 2.0, sum = ctx.createGain();
    let lg = null;   // vibrato: un LFO sobre la afinación, que entra poco a poco tras el ataque
    if (vib) { const lfo = ctx.createOscillator(); lfo.frequency.value = vib.rate; lg = ctx.createGain(); lg.gain.setValueAtTime(0, now + vib.from); lg.gain.linearRampToValueAtTime(vib.cents, now + vib.from + 0.25); lfo.connect(lg); lfo.start(now); lfo.stop(now + sustain + 0.3 + ligEnd); }
    [{ mult: 1, gain: 1.0, detune: 0 }, { mult: 1, gain: 0.5, detune: 6 }, { mult: 2, gain: 0.45, detune: 0 }, { mult: 3, gain: 0.22, detune: 0 }, { mult: 4, gain: 0.10, detune: 0 }].forEach(h => {
      const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = freq * h.mult; osc.detune.value = h.detune; if (lg) lg.connect(osc.detune);
      if (glide) { osc.frequency.setValueAtTime(freq * h.mult, now + glide.from); osc.frequency.exponentialRampToValueAtTime(glide.to * h.mult, now + glide.at); }   // glissando: desliza hasta la nota siguiente sin volver a pulsar
      if (bend) bend.forEach(([bt, bf], i) => { if (i % 2 === 0) osc.frequency.setValueAtTime(bf * h.mult, now + bt); else osc.frequency.exponentialRampToValueAtTime(bf * h.mult, now + bt); });   // bending: pares [inicio, fin] de cada tramo
      const g = ctx.createGain(); g.gain.value = h.gain; osc.connect(g); g.connect(sum); osc.start(now); osc.stop(now + sustain + 0.3 + ligEnd);
      if (ligs) { let pf = bend ? bend[bend.length - 1][1] : freq; ligs.forEach(l => { osc.frequency.setValueAtTime(pf * h.mult, now + l.at - (l.dur || 0.008)); osc.frequency.exponentialRampToValueAtTime(l.freq * h.mult, now + l.at + (l.dur ? 0 : 0.004)); pf = l.freq; }); }
    });
    const cb = ctx.createBuffer(1, Math.floor(rate * 0.008), rate), cd = cb.getChannelData(0);
    for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * (1 - i / cd.length);
    const click = ctx.createBufferSource(); click.buffer = cb;
    const cf = ctx.createBiquadFilter(); cf.type = 'highpass'; cf.frequency.value = 1500;
    const cg = ctx.createGain(); cg.gain.value = soft ? 0.06 : 0.5;   // ligado: casi sin golpe de púa click.connect(cf); cf.connect(cg); cg.connect(sum); click.start(now);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 0.7;
    filt.frequency.setValueAtTime(Math.min(9000, freq * 10), now); filt.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 1.5), now + sustain);
    const env = ctx.createGain(); env.gain.setValueAtTime(0, now); env.gain.linearRampToValueAtTime(soft ? 0.6 : 0.9, now + (soft ? 0.014 : 0.004));
    if (!ligs) env.gain.exponentialRampToValueAtTime(0.001, now + sustain);
    else { let t0 = now + 0.004, pk = 0.9; ligs.forEach(l => { const ta = now + l.at; env.gain.exponentialRampToValueAtTime(Math.max(0.002, pk * Math.pow(0.001 / pk, (ta - t0) / sustain)), ta); env.gain.linearRampToValueAtTime(0.42, ta + 0.015); t0 = ta + 0.015; pk = 0.42; }); env.gain.exponentialRampToValueAtTime(0.001, t0 + sustain); }   // pequeño realce al ligar, como el tirón del dedo
    sum.connect(filt); filt.connect(env);
    const dry = ctx.createGain(); dry.gain.value = 0.8; dry.connect(bus);
    const conv = ctx.createConvolver(); conv.buffer = imp; const wet = ctx.createGain(); wet.gain.value = 0.16; conv.connect(wet); wet.connect(bus);
    env.connect(dry); env.connect(conv);
  });
  return ctx.startRendering().then(buf => {
    const n = buf.length, L = buf.getChannelData(0), Rr = buf.getChannelData(1), out = new DataView(new ArrayBuffer(44 + n * 4));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
    out.setUint32(24, rate, true); out.setUint32(28, rate * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) { out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, Rr[i])) * 32767, true); }
    let s = ''; const b = new Uint8Array(out.buffer); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  });
}


module.exports = { renderToneTrackInPage };
