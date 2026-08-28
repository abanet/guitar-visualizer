/*
 * Analiza el mapa de tempo de un MusicXML de BiaB para detectar errores humanos al crear una
 * progresión de tempo (p.ej. "Tempo Track" de BiaB con incrementos regulares cada N compases).
 * Errores típicos que se buscan (reportados por Alberto, ago 2026):
 *   - un salto de BPM distinto al habitual (p.ej. incremento normal +2, pero en un punto +4)
 *   - un cambio de tempo que llega antes o después del período habitual (p.ej. cada 8 compases,
 *     pero en un punto el salto ocurre a los 4)
 * Ambos casos suelen deberse a lo mismo: un escalón de tempo intermedio que se olvidó al montar
 * el Tempo Track en BiaB (el salto "grande" es la suma de dos saltos "normales" fusionados).
 *
 * No depende del navegador ni de la app: parsea el XML con regex (nada de DOMParser en Node),
 * así se puede ejecutar como comprobación previa sin abrir Playwright.
 */

// Extrae el contenido del primer <part>…</part> (mismo criterio que loadXML() en
// guitarvisualizer.html: xml.querySelector('part'), el primero del documento).
function extractFirstPart(xmlText) {
  const m = xmlText.match(/<part\b[^>]*>([\s\S]*?)<\/part>/);
  return m ? m[1] : xmlText;
}

// Trocea el contenido de un <part> en sus <measure>…</measure> (o <measure .../> vacío).
function extractMeasures(partContent) {
  const out = [];
  const re = /<measure\b[^>]*?(?:\/>|>([\s\S]*?)<\/measure>)/g;
  let m;
  while ((m = re.exec(partContent))) out.push(m[1] || '');
  return out;
}

// Primer <sound tempo="…"> dentro de un fragmento (mismo criterio que querySelector('sound[tempo]')).
function firstTempoIn(text) {
  const m = text.match(/<sound\b[^>]*\btempo=["']([\d.]+)["']/);
  return m ? parseFloat(m[1]) : null;
}

// Lee el mapa de tempo completo del XML: un BPM (redondeado) por cada compás, en orden, YA
// RECORTADO a partir del primer compás con acorde (<harmony>) — el mismo "intro" que
// window._tempoMap descuenta en loadXML() de guitarvisualizer.html. Es imprescindible: sin esto,
// un tema con 2 compases de intro sin acorde antes de un ciclo real de 8 compases se leería como
// un primer tramo de 10 compases y se marcaría como fallo de periodo por error (caso real, ago
// 2026: los 3 XML de "progresionPop" tienen 2 compases de intro y el bug disparaba un falso
// positivo idéntico en los tres).
function parseTempoByMeasure(xmlText) {
  const partContent = extractFirstPart(xmlText);
  const measures = extractMeasures(partContent);
  const initial = firstTempoIn(xmlText) ?? (() => {
    const pm = xmlText.match(/<per-minute>([\d.]+)<\/per-minute>/);
    return pm ? parseFloat(pm[1]) : 120;
  })();
  let current = initial;
  const full = measures.map((mText) => {
    const t = firstTempoIn(mText);
    if (t != null) current = t;
    return Math.round(current);
  });
  const introIdx = measures.findIndex((mText) => /<harmony\b/.test(mText));
  return introIdx > 0 ? full.slice(introIdx) : full;
}

// Agrupa compases consecutivos con el mismo BPM en tramos: [{start, bpm}, …].
function buildSegments(temposByMeasure) {
  const segments = [];
  temposByMeasure.forEach((bpm, i) => {
    const last = segments[segments.length - 1];
    if (!last || last.bpm !== bpm) segments.push({ start: i, bpm });
  });
  return segments;
}

// Valor que más se repite en un array de números; en empate, el más pequeño (determinista).
function mode(values) {
  const counts = new Map();
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  let best = null, bestCount = -1;
  for (const [v, c] of counts) {
    if (c > bestCount || (c === bestCount && (best === null || v < best))) { best = v; bestCount = c; }
  }
  return { value: best, count: bestCount };
}

// Analiza la progresión y devuelve { segments, transitions, issues, note }.
// issues: [{ severity: 'warn'|'info', message: string }]
function analyzeTempoProgression(temposByMeasure) {
  const totalMeasures = temposByMeasure.length;
  const segments = buildSegments(temposByMeasure);
  const issues = [];

  if (totalMeasures === 0) {
    return { segments, transitions: [], issues, note: 'El XML no tiene compases (o no se pudo leer ninguno).' };
  }
  if (segments.length <= 1) {
    return { segments, transitions: [], issues, note: `Tempo fijo (${segments[0]?.bpm ?? '—'} BPM) — sin progresión que comprobar.` };
  }

  const transitions = [];
  for (let i = 0; i < segments.length - 1; i++) {
    transitions.push({
      atMeasure: segments[i + 1].start, // compás (0-based, desde el primero del XML) donde entra el nuevo tempo
      length: segments[i + 1].start - segments[i].start, // duración en compases del tramo ANTERIOR al salto
      delta: segments[i + 1].bpm - segments[i].bpm,
      fromBpm: segments[i].bpm,
      toBpm: segments[i + 1].bpm,
    });
  }
  const trailingLength = totalMeasures - segments[segments.length - 1].start;

  if (transitions.length === 1) {
    issues.push({ severity: 'info', message: `Un único cambio de tempo (${transitions[0].fromBpm}→${transitions[0].toBpm} BPM en el compás ${transitions[0].atMeasure + 1}) — no hay suficientes datos para saber si el patrón es el esperado.` });
    return { segments, transitions, issues, note: null };
  }

  const lengths = transitions.map((t) => t.length);
  const deltas = transitions.map((t) => t.delta);
  const modeLen = mode(lengths);
  const modeDelta = mode(deltas);
  // Con solo 2 transiciones y mayoría de 1, no hay forma de saber CUÁL de las dos es la errónea.
  const establishedLen = transitions.length >= 3 ? modeLen.count >= 2 : modeLen.count === transitions.length;
  const establishedDelta = transitions.length >= 3 ? modeDelta.count >= 2 : modeDelta.count === transitions.length;

  if (!establishedLen && !establishedDelta) {
    issues.push({ severity: 'info', message: `Los ${transitions.length} cambios de tempo no comparten ni duración de tramo ni salto de BPM — no se detecta un patrón regular, así que no se puede validar automáticamente. Revísalo a mano:\n` + transitions.map((t) => `    · compás ${t.atMeasure + 1}: ${t.fromBpm}→${t.toBpm} BPM tras ${t.length} compases`).join('\n') });
  } else {
    transitions.forEach((t) => {
      const lenBad = establishedLen && t.length !== modeLen.value;
      const deltaBad = establishedDelta && t.delta !== modeDelta.value;
      if (!lenBad && !deltaBad) return;
      const dobleLen = lenBad && Math.round(t.length) === modeLen.value * 2;
      const dobleDelta = deltaBad && t.delta === modeDelta.value * 2;
      if (dobleLen && dobleDelta) {
        issues.push({ severity: 'warn', message: `Compás ${t.atMeasure + 1}: salto de ${t.fromBpm}→${t.toBpm} BPM (+${t.delta}) tras ${t.length} compases — el doble de lo habitual (+${modeDelta.value} cada ${modeLen.value}). Parece un escalón de tempo olvidado a mitad de camino en BiaB (debería haber un tempo intermedio ~${t.fromBpm + modeDelta.value} BPM hacia el compás ${t.atMeasure - modeLen.value + 1}).` });
      } else if (lenBad && deltaBad) {
        issues.push({ severity: 'warn', message: `Compás ${t.atMeasure + 1}: salto de ${t.fromBpm}→${t.toBpm} BPM (+${t.delta}, esperado +${modeDelta.value}) tras ${t.length} compases (esperado cada ${modeLen.value}) — no encaja con el resto de la progresión.` });
      } else if (deltaBad) {
        issues.push({ severity: 'warn', message: `Compás ${t.atMeasure + 1}: salto de +${t.delta} BPM (${t.fromBpm}→${t.toBpm}) distinto del habitual +${modeDelta.value}, aunque llega en el momento esperado (cada ${modeLen.value} compases).` });
      } else if (lenBad) {
        issues.push({ severity: 'warn', message: `Compás ${t.atMeasure + 1}: el tempo cambia tras ${t.length} compases en vez de los ${modeLen.value} habituales (el salto de BPM, +${t.delta}, sí es el esperado).` });
      }
    });
  }

  if (establishedLen && trailingLength > modeLen.value * 1.5) {
    issues.push({ severity: 'info', message: `El último tramo (${segments[segments.length - 1].bpm} BPM) dura ${trailingLength} compases, bastante más que los ${modeLen.value} habituales — comprueba si falta un último cambio de tempo o es simplemente el cierre del tema.` });
  }

  return { segments, transitions, issues, note: null };
}

// Atajo: XML (string) → análisis completo.
function analyzeTempoXml(xmlText) {
  return analyzeTempoProgression(parseTempoByMeasure(xmlText));
}

module.exports = { parseTempoByMeasure, buildSegments, analyzeTempoProgression, analyzeTempoXml };
