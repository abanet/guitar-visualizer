/*
 * Reglas de traducción de títulos y descripciones ya publicados (usado por localize-english.js).
 * Idiomas (Alberto 11-04: inglés y "meter los 4 ya"): en, pt (Brasil), fr, it, de.
 * Las descripciones del canal salen de plantillas: se traduce LÍNEA A LÍNEA con reglas regex que capturan
 * tonalidades, formas, tempos… Cada regla da su texto en los 5 idiomas. Si una línea no casa con ninguna regla,
 * el vídeo no se toca. Notas siempre con letras E/A/C# en TODOS los idiomas (decisión de Alberto: nada de Mi/La,
 * ni H alemana).
 */
const IDIOMAS = ['en', 'pt', 'fr', 'it', 'de'];
const K = '[A-G](?:#|b)?';                      // nota
const SEQ = '[A-G#b\\- ,]+';                    // secuencia de notas "G-Bb-C, Bb-C-D"
const R = (src) => new RegExp('^' + src + '$');

// Vocabulario por idioma
const V = {
  minorT: { en: 'Minor', pt: 'Menor', fr: 'mineure', it: 'minore', de: 'Moll' },
  majorT: { en: 'Major', pt: 'Maior', fr: 'majeure', it: 'maggiore', de: 'Dur' },
  minor: { en: 'minor', pt: 'menor', fr: 'mineure', it: 'minore', de: 'Moll' },
  major: { en: 'major', pt: 'maior', fr: 'majeure', it: 'maggiore', de: 'Dur' },
};
const q = (x, l, t) => V[(x === 'menor' ? 'minor' : 'major') + (t ? 'T' : '')][l];
// "Forma C" / "Forma C cerrada" (título o texto)
const forma = (f, c, l) => ({
  en: `${c ? 'Closed ' : ''}${f} Shape`, pt: `Forma ${f}${c ? ' fechada' : ''}`, fr: `Forme ${f}${c ? ' fermée' : ''}`,
  it: `Forma ${f}${c ? ' chiusa' : ''}`, de: `${c ? 'geschlossene ' : ''}${f}-Form`,
}[l]);
const formaTxt = (f, c, l) => (l === 'en' ? `${c ? 'closed ' : ''}${f} Shape` : forma(f, c, l));
// "Pentatónica de D menor" en cada idioma
const penta = (k, m, l, t) => ({
  en: `${k} ${q(m, l, t)} Pentatonic`, pt: `Pentatônica ${q(m, l, t)} de ${k}`, fr: `Pentatonique ${q(m, l, t)} de ${k}`,
  it: `Pentatonica ${q(m, l, t)} di ${k}`, de: `${k}-${q(m, l, t)}-Pentatonik`,
}[l]);
const pentaTxt = (k, m, l) => ({
  en: `The ${k} ${q(m, l)} pentatonic`, pt: `A pentatônica ${q(m, l)} de ${k}`, fr: `La pentatonique ${q(m, l)} de ${k}`,
  it: `La pentatonica ${q(m, l)} di ${k}`, de: `Die ${k}-${q(m, l)}-Pentatonik`,
}[l]);
const grupos = (n, l) => ({ en: `in Groups of ${n} Notes`, pt: `em grupos de ${n} notas`, fr: `en groupes de ${n} notes`, it: `a gruppi di ${n} note`, de: `in ${n}er-Gruppen` }[l]);
const gruposTxt = (n, l) => ({ en: `in groups of ${n} notes`, pt: `em grupos de ${n} notas`, fr: `en groupes de ${n} notes`, it: `a gruppi di ${n} note`, de: `in ${n}er-Gruppen` }[l]);
const saltando = (l, t) => ({ en: t ? 'Skipping a Note' : 'skipping a note', pt: 'pulando uma nota', fr: 'en sautant une note', it: 'saltando una nota', de: 'mit übersprungener Note' }[l]);

const TITULOS = [   // [regex, (match, …grupos, idioma) => texto]
  // ── Patrones de pentatónica (catalog-patrones-penta.js) ──
  [R(`Pentatónica de (${K}) (menor|mayor) en grupos de (\\d) notas \\| Forma ([CAGED])( cerrada)? \\(CAGED\\) \\| (\\d+)–(\\d+) bpm`),
    (l, k, m, n, f, c, a, b) => `${penta(k, m, l, true)} ${grupos(n, l)} | ${forma(f, c, l)} (CAGED) | ${a}–${b} bpm`],
  [R(`Pentatónica de (${K}) (menor|mayor) saltando una nota \\| Forma ([CAGED])( cerrada)? \\(CAGED\\) \\| (\\d+)–(\\d+) bpm`),
    (l, k, m, f, c, a, b) => `${penta(k, m, l, true)} ${saltando(l, true)} | ${forma(f, c, l)} (CAGED) | ${a}–${b} bpm`],
];

const T = (o) => (l) => o[l];   // texto fijo por idioma
const LINEAS = [    // [regex, (idioma, …grupos) => texto] — la regex debe casar con la LÍNEA ENTERA
  // ── comunes a las series progresivas ──
  [R('⏱️ Elige tu tempo'), T({ en: '⏱️ Choose your tempo', pt: '⏱️ Escolha seu andamento', fr: '⏱️ Choisis ton tempo', it: '⏱️ Scegli il tuo tempo', de: '⏱️ Wähle dein Tempo' })],
  [R('🎯 Cómo practicarlo'), T({ en: '🎯 How to practise it', pt: '🎯 Como praticar', fr: '🎯 Comment le travailler', it: '🎯 Come esercitarti', de: '🎯 So übst du es' })],
  [R('1\\. Empieza desde el principio y toca encima\\. Las primeras vueltas son lentas a propósito: úsalas para memorizar el recorrido\\.'), T({
    en: '1. Start from the beginning and play along. The first laps are slow on purpose: use them to memorise the route.',
    pt: '1. Comece do início e toque junto. As primeiras voltas são lentas de propósito: use-as para memorizar o percurso.',
    fr: '1. Commence depuis le début et joue par-dessus. Les premiers tours sont lents exprès : profites-en pour mémoriser le parcours.',
    it: '1. Parti dall’inizio e suona sopra. I primi giri sono lenti apposta: usali per memorizzare il percorso.',
    de: '1. Fang von vorne an und spiel mit. Die ersten Runden sind absichtlich langsam: nutze sie, um dir den Weg einzuprägen.' })],
  [R('2\\. Cuando una vuelta se te resista, vuelve a su capítulo y repítela antes de seguir\\.'), T({
    en: '2. When a lap gives you trouble, go back to its chapter and repeat it before moving on.',
    pt: '2. Quando uma volta ficar difícil, volte ao capítulo dela e repita antes de seguir.',
    fr: '2. Quand un tour te résiste, reviens à son chapitre et répète-le avant de continuer.',
    it: '2. Quando un giro ti mette in difficoltà, torna al suo capitolo e ripetilo prima di andare avanti.',
    de: '2. Wenn eine Runde nicht klappt, spring zu ihrem Kapitel zurück und wiederhole sie, bevor du weitermachst.' })],
  [R('3\\. La próxima vez empieza un par de tempos más arriba\\.'), T({
    en: '3. Next time, start a couple of tempos higher.', pt: '3. Na próxima vez, comece alguns andamentos acima.',
    fr: '3. La prochaine fois, commence quelques tempos plus haut.', it: '3. La prossima volta parti un paio di tempi più in alto.',
    de: '3. Beim nächsten Mal fängst du ein paar Tempostufen höher an.' })],
  [R('(\\d)\\. Cuando lo tengas en esta forma, pasa a la siguiente: las 5 formas juntas cubren todo el mástil\\.'), (l, n) => ({
    en: `${n}. Once you have it in this shape, move on to the next one: the 5 shapes together cover the whole neck.`,
    pt: `${n}. Quando dominar esta forma, passe para a próxima: as 5 formas juntas cobrem o braço inteiro.`,
    fr: `${n}. Quand tu la maîtrises dans cette forme, passe à la suivante : les 5 formes réunies couvrent tout le manche.`,
    it: `${n}. Quando l’hai in questa forma, passa alla successiva: le 5 forme insieme coprono tutto il manico.`,
    de: `${n}. Wenn du es in dieser Form beherrschst, nimm die nächste: Die 5 Formen zusammen decken das ganze Griffbrett ab.` }[l])],
  [R('🔒 Versión cerrada: la misma Forma ([CAGED]), (\\d+) trastes más arriba y sin cuerdas al aire\\.'), (l, f, n) => ({
    en: `🔒 Closed version: the same ${f} Shape, ${n} frets higher and with no open strings.`,
    pt: `🔒 Versão fechada: a mesma Forma ${f}, ${n} casas acima e sem cordas soltas.`,
    fr: `🔒 Version fermée : la même Forme ${f}, ${n} cases plus haut et sans cordes à vide.`,
    it: `🔒 Versione chiusa: la stessa Forma ${f}, ${n} tasti più in alto e senza corde a vuoto.`,
    de: `🔒 Geschlossene Version: dieselbe ${f}-Form, ${n} Bünde höher und ohne Leersaiten.` }[l])],
  // ── Patrones de pentatónica ──
  [R('Cada vuelta recorre la caja entera: sale de la tónica más grave, sube hasta arriba, baja hasta la nota más grave y vuelve a la tónica\\. Arriba tienes las cinco notas con su intervalo, a la derecha el metrónomo y abajo la escalera de tempos, para saber siempre por dónde vas\\.'), T({
    en: 'Each lap covers the whole box: it starts from the lowest root, climbs to the top, comes down to the lowest note and returns to the root. At the top you have the five notes with their intervals, the metronome on the right and the tempo ladder at the bottom, so you always know where you are.',
    pt: 'Cada volta percorre a caixa inteira: sai da tônica mais grave, sobe até o topo, desce até a nota mais grave e volta à tônica. Em cima você tem as cinco notas com seus intervalos, à direita o metrônomo e embaixo a escada de andamentos, para saber sempre onde está.',
    fr: 'Chaque tour parcourt toute la boîte : il part de la tonique la plus grave, monte tout en haut, redescend jusqu’à la note la plus grave et revient à la tonique. En haut tu as les cinq notes avec leur intervalle, à droite le métronome et en bas l’échelle des tempos, pour toujours savoir où tu en es.',
    it: 'Ogni giro percorre tutto il box: parte dalla tonica più grave, sale fino in cima, scende fino alla nota più grave e torna alla tonica. In alto hai le cinque note con il loro intervallo, a destra il metronomo e in basso la scala dei tempi, così sai sempre a che punto sei.',
    de: 'Jede Runde durchläuft die ganze Box: vom tiefsten Grundton nach oben, hinunter bis zum tiefsten Ton und zurück zum Grundton. Oben siehst du die fünf Töne mit ihren Intervallen, rechts das Metronom und unten die Tempoleiter, damit du immer weißt, wo du bist.' })],
  [R('#guitarra #pentatonica #CAGED #técnica #velocidad #ejerciciosdeguitarra'), T({
    en: '#guitar #pentatonic #CAGED #technique #speed #guitarexercises', pt: '#guitarra #pentatonica #CAGED #tecnica #velocidade #exerciciosdeguitarra',
    fr: '#guitare #pentatonique #CAGED #technique #vitesse #exercicesdeguitare', it: '#chitarra #pentatonica #CAGED #tecnica #velocita #eserciziperchitarra',
    de: '#gitarre #pentatonik #CAGED #technik #speed #gitarrenuebungen' })],
  [R('📚 Toda la serie en grupos de (\\d) notas: (\\S+)'), (l, n, u) => ({
    en: `📚 The whole series in groups of ${n} notes: ${u}`, pt: `📚 A série completa em grupos de ${n} notas: ${u}`, fr: `📚 Toute la série en groupes de ${n} notes : ${u}`,
    it: `📚 Tutta la serie a gruppi di ${n} note: ${u}`, de: `📚 Die ganze Reihe in ${n}er-Gruppen: ${u}` }[l])],
  [R('📚 Toda la serie saltando una nota: (\\S+)'), (l, u) => ({
    en: `📚 The whole skipping-a-note series: ${u}`, pt: `📚 A série completa pulando uma nota: ${u}`, fr: `📚 Toute la série en sautant une note : ${u}`,
    it: `📚 Tutta la serie saltando una nota: ${u}`, de: `📚 Die ganze Reihe mit übersprungener Note: ${u}` }[l])],
  [R(`La pentatónica de (${K}) (menor|mayor) \\(([^)]+)\\) (?:en grupos de (\\d) notas|saltando una nota) en la Forma ([CAGED])( cerrada)? del sistema CAGED, con una base rítmica que empieza a (\\d+) bpm y sube (\\d+) bpm en cada vuelta hasta (\\d+)\\.`),
    (l, k, m, notas, n, f, c, a, p, b) => {
      const ej = n ? gruposTxt(n, l) : saltando(l);
      return {
        en: `${pentaTxt(k, m, l)} (${notas}) ${ej} in the ${formaTxt(f, c, l)} of the CAGED system, over a backing track that starts at ${a} bpm and goes up ${p} bpm every lap up to ${b}.`,
        pt: `${pentaTxt(k, m, l)} (${notas}) ${ej} na ${formaTxt(f, c, l)} do sistema CAGED, com uma base rítmica que começa em ${a} bpm e sobe ${p} bpm a cada volta até ${b}.`,
        fr: `${pentaTxt(k, m, l)} (${notas}) ${ej} dans la ${formaTxt(f, c, l)} du système CAGED, sur une base rythmique qui commence à ${a} bpm et monte de ${p} bpm à chaque tour jusqu’à ${b}.`,
        it: `${pentaTxt(k, m, l)} (${notas}) ${ej} nella ${formaTxt(f, c, l)} del sistema CAGED, con una base ritmica che parte da ${a} bpm e sale di ${p} bpm a ogni giro fino a ${b}.`,
        de: `${pentaTxt(k, m, l)} (${notas}) ${ej} in der ${formaTxt(f, c, l)} des CAGED-Systems, über einem Backing Track, der bei ${a} bpm beginnt und mit jeder Runde um ${p} bpm bis ${b} steigt.`,
      }[l];
    }],
  [R(`La pentatónica en grupos de tres notas seguidas: (${SEQ})… Un grupo por pulso, en tresillos\\. Es la secuencia más usada para ganar soltura y velocidad dentro de la caja\\.`), (l, s) => ({
    en: `The pentatonic in groups of three consecutive notes: ${s}… One group per beat, in triplets. It is the most widely used sequence for building fluency and speed within the box.`,
    pt: `A pentatônica em grupos de três notas seguidas: ${s}… Um grupo por tempo, em tercinas. É a sequência mais usada para ganhar fluência e velocidade dentro da caixa.`,
    fr: `La pentatonique en groupes de trois notes consécutives : ${s}… Un groupe par temps, en triolets. C’est la séquence la plus utilisée pour gagner en aisance et en vitesse dans la boîte.`,
    it: `La pentatonica a gruppi di tre note consecutive: ${s}… Un gruppo per movimento, in terzine. È la sequenza più usata per acquisire scioltezza e velocità dentro il box.`,
    de: `Die Pentatonik in Gruppen von drei aufeinanderfolgenden Tönen: ${s}… Eine Gruppe pro Schlag, in Triolen. Die meistgenutzte Sequenz für Geläufigkeit und Tempo innerhalb der Box.` }[l])],
  [R(`La pentatónica en grupos de cuatro notas seguidas: (${SEQ})… Un grupo por pulso, en semicorcheas\\. La secuencia clásica para trabajar la velocidad y la púa alterna\\.`), (l, s) => ({
    en: `The pentatonic in groups of four consecutive notes: ${s}… One group per beat, in sixteenth notes. The classic sequence for working on speed and alternate picking.`,
    pt: `A pentatônica em grupos de quatro notas seguidas: ${s}… Um grupo por tempo, em semicolcheias. A sequência clássica para trabalhar velocidade e palhetada alternada.`,
    fr: `La pentatonique en groupes de quatre notes consécutives : ${s}… Un groupe par temps, en doubles croches. La séquence classique pour travailler la vitesse et l’aller-retour au médiator.`,
    it: `La pentatonica a gruppi di quattro note consecutive: ${s}… Un gruppo per movimento, in semicrome. La sequenza classica per lavorare sulla velocità e sulla pennata alternata.`,
    de: `Die Pentatonik in Gruppen von vier aufeinanderfolgenden Tönen: ${s}… Eine Gruppe pro Schlag, in Sechzehnteln. Die klassische Sequenz für Tempo und Wechselschlag.` }[l])],
  [R(`La pentatónica saltando una nota: cada nota seguida de la que está dos notas por encima \\((${SEQ})…\\)\\. Casi todo son cuartas y alguna tercera: rompe el recorrido lineal y suena mucho más melódico\\. Dos notas por pulso, en corcheas\\.`), (l, s) => ({
    en: `The pentatonic skipping a note: each note followed by the one two notes above (${s}…). It is almost all fourths with the odd third: it breaks the linear route and sounds much more melodic. Two notes per beat, in eighth notes.`,
    pt: `A pentatônica pulando uma nota: cada nota seguida da que está duas notas acima (${s}…). Quase tudo são quartas e alguma terça: quebra o percurso linear e soa muito mais melódico. Duas notas por tempo, em colcheias.`,
    fr: `La pentatonique en sautant une note : chaque note suivie de celle qui se trouve deux notes plus haut (${s}…). Presque que des quartes et quelques tierces : ça casse le parcours linéaire et sonne bien plus mélodique. Deux notes par temps, en croches.`,
    it: `La pentatonica saltando una nota: ogni nota seguita da quella due note più in alto (${s}…). Quasi tutte quarte e qualche terza: rompe il percorso lineare e suona molto più melodico. Due note per movimento, in crome.`,
    de: `Die Pentatonik mit übersprungener Note: Auf jeden Ton folgt der, der zwei Töne höher liegt (${s}…). Fast nur Quarten und ab und zu eine Terz: Das bricht den linearen Weg auf und klingt viel melodischer. Zwei Töne pro Schlag, in Achteln.` }[l])],
];

// Líneas que se copian tal cual (tempos, enlaces, vacías).
const IGUAL = [/^\s*$/, /^\d+:\d{2}(:\d{2})? .*\d+ ?bpm\s*$/i, /^https?:\/\/\S+$/];

function aplicar(reglas, s, l) {
  for (const [re, fn] of reglas) { const m = s.match(re); if (m) return fn(l, ...m.slice(1)); }
  return null;
}
function traducirTitulo(t, l = 'en') { return aplicar(TITULOS, t, l); }
function traducirDescripcion(d, l = 'en') {
  const faltan = [], out = [];
  for (const line of String(d || '').split('\n')) {
    if (IGUAL.some((re) => re.test(line))) { out.push(line); continue; }
    const r = aplicar(LINEAS, line, l);
    if (r == null) { faltan.push(line); out.push(line); } else out.push(r);
  }
  return { texto: out.join('\n'), faltan };
}
module.exports = { IDIOMAS, traducirTitulo, traducirDescripcion };
