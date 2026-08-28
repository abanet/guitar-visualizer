#!/usr/bin/env node
/*
 * Comprueba que la progresión de tempo de uno o varios MusicXML de BiaB es coherente (mismo
 * mapa de tempo que usa el módulo Ritmo — ver scripts/lib/tempo-progression.js): detecta saltos
 * de BPM o periodos entre saltos que no encajan con el patrón del resto del tema, típicos de un
 * escalón de tempo olvidado al montar el Tempo Track en BiaB.
 *
 * No genera ningún vídeo ni necesita el audio — solo lee el XML. Pensado para revisar los
 * ficheros ANTES de lanzar una tanda con render-rhythm-video.js --xml-dir.
 *
 * Uso:
 *   node scripts/check-tempo-xml.js --xml tema.xml
 *   node scripts/check-tempo-xml.js --dir ./mis-ritmos/rock-progresivo   (revisa todos los .xml de la carpeta)
 */
const fs = require('fs');
const path = require('path');
const { parseTempoByMeasure, analyzeTempoProgression } = require('./lib/tempo-progression');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) { out[key] = true; }
      else { out[key] = next; i++; }
    }
  }
  return out;
}

function checkOne(xmlPath) {
  const xmlText = fs.readFileSync(xmlPath, 'utf8');
  const temposByMeasure = parseTempoByMeasure(xmlText);
  const { issues, note } = analyzeTempoProgression(temposByMeasure);
  const name = path.basename(xmlPath);
  if (note) { console.log(`${name}: ${note}`); return { warnings: 0 }; }
  if (!issues.length) { console.log(`✓ ${name}: progresión de tempo coherente.`); return { warnings: 0 }; }
  console.log(`${name}:`);
  let warnings = 0;
  issues.forEach((i) => {
    console.log(`  ${i.severity === 'warn' ? '⚠' : 'ℹ'} ${i.message}`);
    if (i.severity === 'warn') warnings++;
  });
  return { warnings };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.xml && !args.dir) {
    console.error('Uso: node scripts/check-tempo-xml.js --xml <archivo.xml>');
    console.error('  o: node scripts/check-tempo-xml.js --dir <carpeta-con-xmls>');
    process.exit(1);
  }
  const xmlPaths = args.xml
    ? [path.resolve(args.xml)]
    : fs.readdirSync(path.resolve(args.dir)).filter((f) => /\.xml$/i.test(f)).sort().map((f) => path.join(path.resolve(args.dir), f));

  if (!xmlPaths.length) { console.error('No se encontró ningún .xml.'); process.exit(1); }

  let totalWarnings = 0;
  for (const p of xmlPaths) {
    if (!fs.existsSync(p)) { console.error(`No existe: ${p}`); continue; }
    const { warnings } = checkOne(p);
    totalWarnings += warnings;
  }
  if (xmlPaths.length > 1) console.log(`\n${totalWarnings ? '⚠' : '✓'} ${totalWarnings} aviso(s) en ${xmlPaths.length} XML(s).`);
  process.exitCode = totalWarnings ? 1 : 0;
}

main();
