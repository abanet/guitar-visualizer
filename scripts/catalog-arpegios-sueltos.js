#!/usr/bin/env node
/*
 * Plan de catalogación de los ARPEGIOS SUELTOS: una triada (mayor/menor, 24) o una tetrada (7, m7, maj7, m7b5, 48)
 * por todo el mástil, en las 5 formas CAGED seguidas (C → A → G → E → D, 8 compases cada una, y otra vuelta a C y A),
 * sobre una base de BiaB de un solo acorde a 90 bpm. Vídeos de ~/guitar-visualizer-assets/arpegios-sueltos/lote*.sh
 * (formato aprobado por Alberto el 11-06; visto bueno a las dos series el 11-08).
 * Miniaturas: generate-arpegios-sueltos-thumbnails.py (plantillas elegidas el 11-08).
 *
 * NO llama a la API: deja el plan para catalog-plan-api.js (título, descripción, 5 idiomas más, etiquetas, listas,
 * fecha y casilla del feed). Listas: las de ARPEGIOS SUELTOS "Arpegios de triadas" y "Arpegios de tetradas" (Alberto,
 * 11-06: los de recorrer la escala van en las listas "… en la escala").
 * Calendario: una tonalidad al día por el círculo de quintas; triadas a --hora-triadas, tetradas a --hora-tetradas.
 * Feed: solo el primero de cada bloque (la triada mayor y el 7 de cada tonalidad), ver feedback-series-feed-muestra.
 *
 * Uso: node scripts/catalog-arpegios-sueltos.js --inicio 2026-11-20 [--hora-triadas 15:00] [--hora-tetradas 15:30]
 *        [--out scripts/.catalog-arpegios-sueltos-plan.json] [--print <stem>]
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const a = {};
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith('--')) { const n = process.argv[i + 1]; if (n === undefined || n.startsWith('--')) a[k.slice(2)] = true; else { a[k.slice(2)] = n; i++; } } }

const HOME = os.homedir();
const VID = path.join(HOME, 'guitar-visualizer-assets/arpegios-sueltos');
const MIN = path.join(HOME, 'guitar-visualizer-assets/miniaturas-arpegios-sueltos');
const ORDEN = ['C', 'G', 'D', 'A', 'E', 'B', 'Fs', 'Db', 'Ab', 'Eb', 'Bb', 'F'];   // círculo de quintas
const IDIOMAS = ['es', 'en', 'pt', 'fr', 'it', 'de'];

// Notas como las pinta la app (sin dobles alteraciones ni Cb/Fb/E#), igual que en la miniatura.
const LETRAS = 'CDEFGAB';
const NAT = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SIMPLE = { Bbb: 'A', Ebb: 'D', Abb: 'G', Dbb: 'C', Gbb: 'F', Cb: 'B', Fb: 'E', 'E#': 'F', 'B#': 'C' };
const nota = (r, pasos, semis) => {
  const l = LETRAS[(LETRAS.indexOf(r[0]) + pasos) % 7];
  const pc = (NAT[r[0]] + (r.includes('#') ? 1 : 0) - (r.includes('b') ? 1 : 0) + 12) % 12;
  let d = ((pc + semis) - NAT[l] + 24) % 12; if (d > 6) d -= 12;
  const n = l + (d > 0 ? '#'.repeat(d) : 'b'.repeat(-d));
  return SIMPLE[n] || n;
};

// Calidades: estructura (pasos de letra, semitonos), intervalos y nombre en cada idioma.
const Q = {
  '': { serie: 'triadas', est: [[2, 4], [4, 7]], int: '1 · 3 · 5',
    nom: { es: 'mayor', en: 'major', pt: 'maior', fr: 'majeur', it: 'maggiore', de: 'Dur' } },
  m: { serie: 'triadas', est: [[2, 3], [4, 7]], int: '1 · b3 · 5',
    nom: { es: 'menor', en: 'minor', pt: 'menor', fr: 'mineur', it: 'minore', de: 'Moll' } },
  7: { serie: 'tetradas', est: [[2, 4], [4, 7], [6, 10]], int: '1 · 3 · 5 · b7',
    nom: { es: 'séptima de dominante', en: 'dominant 7th', pt: 'sétima dominante', fr: 'septième de dominante', it: 'settima di dominante', de: 'Dominantseptakkord' } },
  m7: { serie: 'tetradas', est: [[2, 3], [4, 7], [6, 10]], int: '1 · b3 · 5 · b7',
    nom: { es: 'menor séptima', en: 'minor 7th', pt: 'menor com sétima', fr: 'mineur septième', it: 'minore settima', de: 'Moll-Septakkord' } },
  maj7: { serie: 'tetradas', est: [[2, 4], [4, 7], [6, 11]], int: '1 · 3 · 5 · 7',
    nom: { es: 'séptima mayor', en: 'major 7th', pt: 'sétima maior', fr: 'septième majeure', it: 'settima maggiore', de: 'Major-Septakkord' } },
  m7b5: { serie: 'tetradas', est: [[2, 3], [4, 6], [6, 10]], int: '1 · b3 · b5 · b7',
    nom: { es: 'semidisminuido', en: 'half-diminished', pt: 'meio-diminuto', fr: 'demi-diminué', it: 'semidiminuito', de: 'halbvermindert' } },
};
const ORDEN_Q = { triadas: ['', 'm'], tetradas: ['7', 'm7', 'maj7', 'm7b5'] };
const LISTA = { triadas: 'Arpegios de triadas', tetradas: 'Arpegios de tetradas' };

// Capítulos: 2 compases de cuenta (5,3 s) y 8 compases por forma a 90 bpm (21,3 s); al final, otra vuelta a C y A.
const CAP = {
  es: ['0:00 Forma C', '0:27 Forma A', '0:48 Forma G', '1:09 Forma E', '1:31 Forma D', '1:52 Otra vuelta: Forma C y Forma A'],
  en: ['0:00 C shape', '0:27 A shape', '0:48 G shape', '1:09 E shape', '1:31 D shape', '1:52 One more time: C and A shapes'],
  pt: ['0:00 Forma C', '0:27 Forma A', '0:48 Forma G', '1:09 Forma E', '1:31 Forma D', '1:52 Mais uma volta: formas C e A'],
  fr: ['0:00 Forme C', '0:27 Forme A', '0:48 Forme G', '1:09 Forme E', '1:31 Forme D', '1:52 Encore un tour : formes C et A'],
  it: ['0:00 Forma C', '0:27 Forma A', '0:48 Forma G', '1:09 Forma E', '1:31 Forma D', '1:52 Un altro giro: forme C e A'],
  de: ['0:00 C-Form', '0:27 A-Form', '0:48 G-Form', '1:09 E-Form', '1:31 D-Form', '1:52 Noch eine Runde: C- und A-Form'],
};

function textos(L, x) {
  const { acorde, nombre, notas, int, serie } = x;   // acorde: "C mayor" / "Cm7"; nombre: "C mayor" / "Cm7 (menor séptima)"
  const n = serie === 'triadas' ? 3 : 4;
  const T = {
    es: {
      title: `Arpegio de ${acorde} por todo el mástil | Las 5 formas CAGED a 90 bpm`,
      d: [
        `El arpegio de ${nombre} en las 5 formas del sistema CAGED, una detrás de otra, de la cejuela al traste 12: forma C, A, G, E y D, 8 compases cada una, sobre una base que solo toca ese acorde a 90 bpm.`,
        `Notas: ${notas} (${int}). Son solo ${n}, pero repartidas por todo el mástil: cuando las tienes en las cinco formas, el acorde deja de ser una posición y se convierte en un mapa.`,
        `👀 Qué ves en pantalla\n• En el mástil, todas las notas del arpegio en fantasma, de la cejuela al traste 12.\n• Encendida, la forma que toca en cada momento; la tónica siempre en rojo.\n• Cada nota lleva su intervalo, para que sepas qué función cumple en el acorde.\n• Arriba, el acorde que suena y el metrónomo.`,
        `⏱️ Formas\n${CAP.es.join('\n')}`,
        `🎯 Cómo practicarlo\n1. Primera pasada: solo mira y escucha cómo una forma enlaza con la siguiente.\n2. Toca el arpegio de cada forma subiendo y bajando, sin perder el pulso.\n3. Di en voz alta el intervalo de la nota que tocas (1, 3, 5…).\n4. Cuando las cinco te salgan, repite el vídeo: la segunda vez el mástil ya se ve de otra manera.`,
        `📋 Todos los arpegios de esta serie: (enlace de la lista)`,
        `#guitarra #arpegios #caged #${serie} #ejerciciosdeguitarra`,
      ],
    },
    en: {
      title: `${acorde} Arpeggio All Over the Neck | The 5 CAGED Shapes at 90 bpm`,
      d: [
        `The ${nombre} arpeggio in the 5 shapes of the CAGED system, one after another, from the nut to the 12th fret: C, A, G, E and D shapes, 8 bars each, over a backing track that only plays that chord at 90 bpm.`,
        `Notes: ${notas} (${int}). Only ${n} notes, but spread across the whole neck: once you have them in all five shapes, the chord stops being a position and becomes a map.`,
        `👀 What you see on screen\n• On the neck, every note of the arpeggio as a ghost, from the nut to the 12th fret.\n• Lit up, the shape being played at each moment; the root is always red.\n• Each note shows its interval, so you know its role in the chord.\n• At the top, the chord that is sounding and the metronome.`,
        `⏱️ Shapes\n${CAP.en.join('\n')}`,
        `🎯 How to practice it\n1. First time through: just watch and listen to how one shape connects to the next.\n2. Play the arpeggio of each shape up and down, without losing the pulse.\n3. Say out loud the interval of the note you are playing (1, 3, 5…).\n4. When all five come out, play the video again: the second time the neck already looks different.`,
        `📋 All the arpeggios in this series: (enlace de la lista)`,
        `#guitar #arpeggios #caged #guitarexercises`,
      ],
    },
    pt: {
      title: `Arpejo de ${acorde} por todo o braço | As 5 formas CAGED a 90 bpm`,
      d: [
        `O arpejo de ${nombre} nas 5 formas do sistema CAGED, uma atrás da outra, da pestana à casa 12: formas C, A, G, E e D, 8 compassos cada uma, sobre uma base que só toca esse acorde a 90 bpm.`,
        `Notas: ${notas} (${int}). São só ${n}, mas espalhadas por todo o braço: quando as tens nas cinco formas, o acorde deixa de ser uma posição e passa a ser um mapa.`,
        `👀 O que vês no ecrã\n• No braço, todas as notas do arpejo em fantasma, da pestana à casa 12.\n• Acesa, a forma que se toca em cada momento; a tónica sempre a vermelho.\n• Cada nota mostra o seu intervalo, para saberes que função tem no acorde.\n• Em cima, o acorde que soa e o metrónomo.`,
        `⏱️ Formas\n${CAP.pt.join('\n')}`,
        `🎯 Como praticar\n1. Primeira passagem: só observa e ouve como uma forma liga à seguinte.\n2. Toca o arpejo de cada forma a subir e a descer, sem perder o pulso.\n3. Diz em voz alta o intervalo da nota que tocas (1, 3, 5…).\n4. Quando as cinco te saírem, repete o vídeo: à segunda vez o braço já se vê de outra maneira.`,
        `📋 Todos os arpejos desta série: (enlace de la lista)`,
        `#guitarra #arpejos #caged #exerciciosdeguitarra`,
      ],
    },
    fr: {
      title: `Arpège de ${acorde} sur tout le manche | Les 5 formes CAGED à 90 bpm`,
      d: [
        `L'arpège de ${nombre} dans les 5 formes du système CAGED, l'une après l'autre, du sillet à la case 12 : formes C, A, G, E et D, 8 mesures chacune, sur une base qui ne joue que cet accord à 90 bpm.`,
        `Notes : ${notas} (${int}). Seulement ${n} notes, mais réparties sur tout le manche : quand tu les as dans les cinq formes, l'accord n'est plus une position, il devient une carte.`,
        `👀 Ce que tu vois à l'écran\n• Sur le manche, toutes les notes de l'arpège en fantôme, du sillet à la case 12.\n• Allumée, la forme jouée à chaque instant ; la fondamentale toujours en rouge.\n• Chaque note affiche son intervalle, pour savoir quel rôle elle joue dans l'accord.\n• En haut, l'accord qui sonne et le métronome.`,
        `⏱️ Formes\n${CAP.fr.join('\n')}`,
        `🎯 Comment le travailler\n1. Premier passage : regarde et écoute comment une forme s'enchaîne à la suivante.\n2. Joue l'arpège de chaque forme en montant et en descendant, sans perdre la pulsation.\n3. Dis à voix haute l'intervalle de la note que tu joues (1, 3, 5…).\n4. Quand les cinq sortent, relance la vidéo : la deuxième fois, le manche se voit déjà autrement.`,
        `📋 Tous les arpèges de cette série : (enlace de la lista)`,
        `#guitare #arpeges #caged #exercicesdeguitare`,
      ],
    },
    it: {
      title: `Arpeggio di ${acorde} su tutto il manico | Le 5 forme CAGED a 90 bpm`,
      d: [
        `L'arpeggio di ${nombre} nelle 5 forme del sistema CAGED, una dopo l'altra, dal capotasto al 12° tasto: forme C, A, G, E e D, 8 battute ciascuna, su una base che suona solo quell'accordo a 90 bpm.`,
        `Note: ${notas} (${int}). Sono solo ${n}, ma sparse su tutto il manico: quando le hai in tutte e cinque le forme, l'accordo smette di essere una posizione e diventa una mappa.`,
        `👀 Cosa vedi sullo schermo\n• Sul manico, tutte le note dell'arpeggio in trasparenza, dal capotasto al 12° tasto.\n• Accesa, la forma che si suona in ogni momento; la tonica sempre in rosso.\n• Ogni nota mostra il suo intervallo, così sai che funzione ha nell'accordo.\n• In alto, l'accordo che suona e il metronomo.`,
        `⏱️ Forme\n${CAP.it.join('\n')}`,
        `🎯 Come esercitarti\n1. Primo passaggio: guarda e ascolta come una forma si collega alla successiva.\n2. Suona l'arpeggio di ogni forma salendo e scendendo, senza perdere il tempo.\n3. Di' ad alta voce l'intervallo della nota che suoni (1, 3, 5…).\n4. Quando ti vengono tutte e cinque, riguarda il video: la seconda volta il manico si vede già in un altro modo.`,
        `📋 Tutti gli arpeggi di questa serie: (enlace de la lista)`,
        `#chitarra #arpeggi #caged #eserciziperchitarra`,
      ],
    },
    de: {
      title: `${acorde}-Arpeggio über das ganze Griffbrett | Die 5 CAGED-Formen bei 90 bpm`,
      d: [
        `Das Arpeggio ${nombre} in den 5 Formen des CAGED-Systems, eine nach der anderen, vom Sattel bis zum 12. Bund: C-, A-, G-, E- und D-Form, je 8 Takte, über einem Backing Track, der nur diesen Akkord bei 90 bpm spielt.`,
        `Töne: ${notas} (${int}). Nur ${n} Töne, aber über das ganze Griffbrett verteilt: Wenn du sie in allen fünf Formen kennst, ist der Akkord keine Position mehr, sondern eine Landkarte.`,
        `👀 Was du auf dem Bildschirm siehst\n• Auf dem Griffbrett alle Töne des Arpeggios als Geisternoten, vom Sattel bis zum 12. Bund.\n• Hervorgehoben die Form, die gerade gespielt wird; der Grundton immer in Rot.\n• Jeder Ton zeigt sein Intervall, damit du weißt, welche Rolle er im Akkord spielt.\n• Oben der klingende Akkord und das Metronom.`,
        `⏱️ Formen\n${CAP.de.join('\n')}`,
        `🎯 So übst du es\n1. Erster Durchgang: nur schauen und hören, wie eine Form in die nächste übergeht.\n2. Spiel das Arpeggio jeder Form auf und ab, ohne den Puls zu verlieren.\n3. Sag laut das Intervall des Tons, den du spielst (1, 3, 5…).\n4. Wenn alle fünf sitzen, spiel das Video noch einmal: Beim zweiten Mal sieht das Griffbrett schon anders aus.`,
        `📋 Alle Arpeggios dieser Serie: (enlace de la lista)`,
        `#gitarre #arpeggios #caged #gitarrenübungen`,
      ],
    },
  };
  return { title: T[L].title, description: T[L].d.join('\n\n') };
}

function entrada(serie, K, q) {
  const raiz = K.replace('s', '#');
  const stem = serie === 'triadas' ? `ArpegioTriada-${K}${q}_5formas_sincronizado` : `ArpegioTetrada-${K}${q}_5formas_sincronizado`;
  const file = path.join(VID, serie, stem + '.mp4');
  const notas = [raiz, ...Q[q].est.map(([p, s]) => nota(raiz, p, s))].join(' · ');
  const por = {};
  for (const L of IDIOMAS) {
    const acorde = serie === 'triadas' ? (L === 'de' ? `${raiz}-${Q[q].nom.de}` : `${raiz} ${Q[q].nom[L]}`) : raiz + q;
    const nombre = serie === 'triadas' ? acorde : `${raiz + q} (${Q[q].nom[L]})`;
    por[L] = textos(L, { acorde, nombre, notas, int: Q[q].int, serie });
  }
  const tags = ['guitarra', 'arpegios', 'arpegio', `arpegio de ${serie === 'triadas' ? raiz + ' ' + Q[q].nom.es : raiz + q}`, 'caged', 'sistema caged',
    'las 5 formas', 'todo el mástil', serie, 'backing track', '90 bpm', 'ejercicios de guitarra',
    'guitar', 'arpeggios', `${raiz}${q === '' ? ' major' : q === 'm' ? ' minor' : q} arpeggio`, 'caged system', 'guitar exercise'];
  return { stem, file, thumb: path.join(MIN, stem + '.jpg'), serie, K, q,
    title: por.es.title, description: por.es.description,
    localizations: Object.fromEntries(IDIOMAS.filter((L) => L !== 'es').map((L) => [L, por[L]])),
    tags, listas: [LISTA[serie]] };
}

function main() {
  if (!a.inicio) { console.error('Falta --inicio AAAA-MM-DD'); process.exit(1); }
  const hora = { triadas: a['hora-triadas'] || '15:00', tetradas: a['hora-tetradas'] || '15:30' };
  const plan = [];
  ORDEN.forEach((K, dia) => {
    const fecha = new Date(a.inicio + 'T00:00:00Z'); fecha.setUTCDate(fecha.getUTCDate() + dia);
    for (const serie of ['triadas', 'tetradas']) {
      ORDEN_Q[serie].forEach((q, i) => {
        const e = entrada(serie, K, q);
        if (!fs.existsSync(e.file)) console.error('  ⚠ falta el vídeo', e.file);
        if (!fs.existsSync(e.thumb)) console.error('  ⚠ falta la miniatura', e.thumb);
        e.publishAtUTC = `${fecha.toISOString().slice(0, 10)}T${hora[serie]}:00Z`;
        e.feed = i === 0;
        plan.push(e);
      });
    }
  });
  if (a.print) { const e = plan.find((x) => x.stem.includes(a.print)); console.log(JSON.stringify(e, null, 1)); return; }
  const out = path.resolve(a.out || path.join(__dirname, '.catalog-arpegios-sueltos-plan.json'));
  fs.writeFileSync(out, JSON.stringify(plan, null, 1));
  console.log(`${plan.length} entradas → ${out}`);
  console.log(`  ${plan[0].publishAtUTC} → ${plan[plan.length - 1].publishAtUTC}; feed en ${plan.filter((e) => e.feed).length}`);
}
main();
