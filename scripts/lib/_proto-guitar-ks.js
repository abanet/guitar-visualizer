// Guitarra eléctrica por MODELO FÍSICO de cuerda (Karplus-Strong) + ampli con algo de saturación + pantalla, en Node.
//
// Por qué (Alberto, 11-02, mejora nº 1 del vocabulario de frases): el pluck de osciladores (_proto-pluck-audio.js)
// suena a sintetizador, y en una frase de blues el sonido es la mitad de la lección (cómo suena un bending afinado,
// un vibrato, un ligado). En un modelo de cuerda la afinación es la longitud del bucle de retardo: bending, vibrato,
// ligados y deslizamientos se hacen cambiando esa longitud sobre la MISMA cuerda que ya vibra, que es lo que pasa
// en una guitarra de verdad. Sin muestras descargadas: todo se calcula aquí.
//
// Recibe los mismos eventos que renderToneTrackInPage ({ t, freq, bend, vib, ligs, mute, cut, soft }) con t absoluto
// y devuelve un WAV estéreo de 16 bits (Buffer).

const SR = 44100;

function pitchFn(e) {
  // Frecuencia en función del tiempo desde el ataque (s), en cents respecto a e.freq: bending (pares [inicio, fin]
  // de cada tramo, curva suave), ligados/deslizamientos (saltos o rampas cortas) y vibrato (solo hacia arriba,
  // como se hace con la mano: la cuerda se estira y vuelve).
  const c = f => 1200 * Math.log2(f / e.freq);
  const segs = [];   // [t0, t1, c0, c1]
  if (e.bend) for (let i = 0; i + 1 < e.bend.length; i += 2) segs.push([e.bend[i][0], e.bend[i + 1][0], c(e.bend[i][1]), c(e.bend[i + 1][1])]);
  if (e.ligs) { let pc = segs.length ? segs[segs.length - 1][3] : 0; e.ligs.forEach(l => { const d = l.dur || 0.006; segs.push([l.at - (l.dur ? d : 0), l.at + (l.dur ? 0 : d), pc, c(l.freq)]); pc = c(l.freq); }); }
  segs.sort((a, b) => a[0] - b[0]);
  const v = e.vib;
  return tt => {
    let cents = 0;
    for (const [t0, t1, c0, c1] of segs) { if (tt >= t1) cents = c1; else if (tt > t0) { const x = (tt - t0) / (t1 - t0), s = x * x * (3 - 2 * x); cents = c0 + (c1 - c0) * s; break; } else break; }
    if (v && tt > v.from) { const ramp = Math.min(1, (tt - v.from) / 0.3); const ph = 2 * Math.PI * v.rate * (tt - v.from) + 0.6 * Math.sin(2 * Math.PI * 0.7 * (tt - v.from));   // vibrato de blues: ancho e irregular
      cents += ramp * v.cents * 2.2 * (1 - Math.cos(ph)) / 2; }
    return e.freq * Math.pow(2, cents / 1200);
  };
}

function biquad(type, f0, q, gainDb = 0) {
  const w = 2 * Math.PI * f0 / SR, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * q), A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else { b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; }   // peaking
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return x => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}

function renderGuitarTrack(events, total, opts = {}) {
  const n = Math.ceil(SR * total), dry = new Float32Array(n);
  const drive = opts.drive ?? 3.5;
  // Cada nota apaga la anterior (el dedo se levanta / la púa vuelve a la cuerda), salvo las que suenan juntas
  // (dobles cuerdas y rasgueos: mismo instante ± 30 ms).
  const evs = events.map(e => ({ ...e, t: e.t + 0.01 })).sort((a, b) => a.t - b.t);
  const pitched = evs.filter(e => !e.mute);
  pitched.forEach(e => { const nx = pitched.find(o => o.t > e.t + 0.03); e.end = Math.min(nx ? nx.t + 0.02 : total, e.cut ? e.t + e.cut + 0.03 : Infinity, e.t + 6); });
  for (const e of evs) {
    const i0 = Math.floor(e.t * SR);
    if (e.mute) {   // golpe apagado (rastrillado): cuerda muy amortiguada + ruido de púa
      const N = Math.round(SR / 110), buf = new Float32Array(N); let k = 0, prev = 0;
      for (let j = 0; j < N; j++) buf[j] = (Math.random() * 2 - 1) * 0.5;
      for (let j = 0; j < SR * 0.07 && i0 + j < n; j++) { const y = buf[k]; const nv = 0.5 * (y + prev) * 0.93; prev = y; buf[k] = nv; k = (k + 1) % N; dry[i0 + j] += y * 0.55 * Math.exp(-j / (SR * 0.018)); }
      continue;
    }
    const f = pitchFn(e), maxN = Math.ceil(SR / 50) + 4, line = new Float32Array(maxN);
    // Excitación: un periodo de ruido, suavizado (púa media) y con el filtro de peine de la posición de la púa.
    // Intensidad distinta en cada púa (±20 %): nadie toca dos notas iguales (11-02: "que se parezca a una guitarra blusera").
    const N0 = SR / e.freq, P = Math.floor(N0), amp = (e.soft ? 0.35 : 0.8) * (0.8 + 0.4 * Math.random());
    let lp = 0; const ex = new Float32Array(P);
    for (let j = 0; j < P; j++) { lp = lp * 0.7 + (Math.random() * 2 - 1) * 0.3; ex[j] = lp; }   // ataque suave (11-02: "bastante metálico")
    const pk = Math.max(1, Math.round(P * 0.2)); for (let j = P - 1; j >= pk; j--) ex[j] -= ex[j - pk];
    let mean = 0; ex.forEach(x => mean += x / P); for (let j = 0; j < P; j++) line[j] = (ex[j] - mean) * amp;
    // Ligados: un pequeño impulso al caer el dedo (hammer-on) o al tirar (pull-off); el deslizamiento no lo lleva.
    // Pull-off (baja de nota): el dedo PULSA la cuerda al soltarla → casi un ataque nuevo (Alberto 11-02: "no sé si la nota
    // del pull-off se aprecia bien": caía ~3 dB en vez de sonar como una nota nueva). Hammer-on (sube): golpe más suave.
    let pf0 = e.bend ? e.bend[e.bend.length - 1][1] : e.freq;
    const kicks = (e.ligs || []).filter(l => !l.dur || (pf0 = l.freq, false)).map(l => { const down = l.freq < pf0; pf0 = l.freq; return { i: Math.floor((e.t + l.at) * SR), amp: (down ? 0.6 : 0.5) * (0.85 + 0.3 * Math.random()), P: Math.floor(SR / l.freq) }; });
    let w = P % maxN, prevOut = 0, tailEnd = Math.min(n, Math.floor(e.end * SR) + Math.floor(SR * 0.03));
    const T60 = Math.max(2.8, Math.min(7, 4 * Math.pow(220 / e.freq, 0.35)));   // los graves sostienen más; ampli al borde de saturación = mucho sustain
    // Pastilla de MÁSTIL: la pastilla "oye" la cuerda en un punto (~1/4 de su longitud) y anula los armónicos con un
    // nodo ahí: es el hueco característico de una Strat/Les Paul en la pastilla del mástil.
    const hist = new Float32Array(maxN); let hw = 0;
    for (let i = i0; i < tailEnd; i++) {
      const tt = (i - i0) / SR, fr = f(tt), d = SR / fr - 0.5;
      let rp = w - d; while (rp < 0) rp += maxN;
      const r0 = Math.floor(rp), fracp = rp - r0, a = line[r0 % maxN], b = line[(r0 + 1) % maxN], y = a + (b - a) * fracp;
      const g = Math.pow(10, -3 / (T60 * fr));
      let nv = (0.52 * y + 0.48 * prevOut) * g; prevOut = y;
      if (kicks.length && kicks[0].i === i) { const k = kicks.shift(); let lp2 = 0;   // excitación de un periodo de la nota nueva, como la púa pero más blanda
        for (let j = 0; j < k.P; j++) { lp2 = lp2 * 0.75 + (Math.random() * 2 - 1) * 0.25; line[(w - j + maxN) % maxN] = line[(w - j + maxN) % maxN] * 0.7 + lp2 * k.amp; } }
      line[w] = nv; w = (w + 1) % maxN;
      const fade = i > e.end * SR ? Math.max(0, 1 - (i - e.end * SR) / (SR * 0.03)) : 1;
      hist[hw] = y; const pd = Math.round(0.24 * d), yp = y - 0.85 * hist[(hw - pd + maxN) % maxN]; hw = (hw + 1) % maxN;
      dry[i] += yp * fade;
    }
  }
  // Pastilla + ampli: paso alto, realce de medios, saturación suave (tanh) y pantalla de 12" (paso bajo empinado).
  // Ampli de válvulas al borde de la saturación (blues): dos etapas de saturación ASIMÉTRICA (como una válvula, que
  // no recorta igual arriba que abajo: armónicos pares, sonido "gordo"), entre ellas el "tone stack" con los medios
  // empujados (~750 Hz), y una pantalla de 12" (graves con cuerpo, agudos cortados por encima de ~4 kHz).
  const hp = biquad('hp', 100, 0.7), pre = biquad('lp', 3400, 0.7);
  const stBass = biquad('pk', 120, 0.8, -2), stMid = biquad('pk', 750, 0.7, 6), stTreble = biquad('pk', 2600, 0.9, -2);
  const cabLo = biquad('pk', 110, 1.0, 3), cab1 = biquad('lp', 3300, 0.8), cab2 = biquad('lp', 4200, 0.7), cabHp = biquad('hp', 75, 0.7);
  const tube = (x, k, b) => Math.tanh(k * (x + b)) - Math.tanh(k * b);
  const amp = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a1 = tube(pre(hp(dry[i])), drive, 0.2), a2 = tube(stTreble(stMid(stBass(a1))) * 0.9, 1.8, -0.12);
    amp[i] = cabHp(cab2(cab1(cabLo(a2)))) * 0.6;
  }
  // Delay discreto (Alberto 11-02: "un mínimo delay para darle profundidad"): ~320 ms, pocas repeticiones, oscurecidas
  // y abiertas en estéreo (izquierda un poco antes que derecha).
  const dly = (ms, fb, mix) => { const L = Math.round(SR * ms / 1000), b = new Float32Array(L), lpf = biquad('lp', 2200, 0.7), out = new Float32Array(n); let i2 = 0;
    for (let i = 0; i < n; i++) { const y = b[i2]; b[i2] = amp[i] + lpf(y) * fb; i2 = (i2 + 1) % L; out[i] = y * mix; } return out; };
  const dl = dly(310, 0.28, 0.16), dr = dly(335, 0.28, 0.16);
  // Reverb de sala (Schroeder: 4 peines + 2 pasatodo por canal, con retardos distintos para dar anchura).
  const verb = (combs, aps) => {
    const C = combs.map(L => ({ b: new Float32Array(L), i: 0, s: 0 })), A = aps.map(L => ({ b: new Float32Array(L), i: 0 })), out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = amp[i] * 0.15; let s = 0;   // (más cola que la primera versión: realimentación 0.84)
      for (const c of C) { const y = c.b[c.i]; c.s = y * 0.55 + c.s * 0.45; c.b[c.i] = x + c.s * 0.84; c.i = (c.i + 1) % c.b.length; s += y; }
      for (const a of A) { const bv = a.b[a.i], y = -s + bv; a.b[a.i] = s + bv * 0.5; a.i = (a.i + 1) % a.b.length; s = y; }
      out[i] = s;
    }
    return out;
  };
  // 8 peines (Freeverb) y amortiguación fuerte: con 4 peines la cola "pitaba" y sonaba metálica (11-02).
  const vl = verb([1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], [556, 441, 341, 225]), vr = verb([1139, 1211, 1300, 1379, 1445, 1514, 1580, 1640], [579, 464, 364, 248]);
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  let peak = 1e-9; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(amp[i] + dl[i] + vl[i] * 0.3), Math.abs(amp[i] + dr[i] + vr[i] * 0.3));
  const k = 0.89 / peak;
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, (amp[i] + dl[i] + vl[i] * 0.3) * k)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, (amp[i] + dr[i] + vr[i] * 0.3) * k)) * 32767), 46 + i * 4);
  }
  return buf;
}

module.exports = { renderGuitarTrack };
