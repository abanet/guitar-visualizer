/*
 * Traducciones (en/pt/fr/it/de) de los textos de catalog-patrones-nuevos.js. Desde el 11-04 todo vídeo nuevo sale con
 * título y descripción en los 5 idiomas (Alberto: "y meter los 4 ya?"). Notas siempre en inglés (A, C#, Eb), también en
 * alemán (nada de H ni de Mi/La). Misma estructura que el español; los capítulos y los enlaces no se traducen.
 */
const ESC = {
  PentatonicaMenor: { en: (K) => `${K} Minor Pentatonic`, pt: (K) => `Pentatônica de ${K} menor`, fr: (K) => `Pentatonique de ${K} mineure`, it: (K) => `Pentatonica di ${K} minore`, de: (K) => `${K}-Moll-Pentatonik` },
  PentatonicaMayor: { en: (K) => `${K} Major Pentatonic`, pt: (K) => `Pentatônica de ${K} maior`, fr: (K) => `Pentatonique de ${K} majeure`, it: (K) => `Pentatonica di ${K} maggiore`, de: (K) => `${K}-Dur-Pentatonik` },
  EscalaBlues: { en: (K) => `${K} Minor Blues Scale`, pt: (K) => `Escala blues de ${K} menor`, fr: (K) => `Gamme blues de ${K} mineure`, it: (K) => `Scala blues di ${K} minore`, de: (K) => `${K}-Moll-Bluestonleiter` },
  EscalaBluesMayor: { en: (K) => `${K} Major Blues Scale`, pt: (K) => `Escala blues de ${K} maior`, fr: (K) => `Gamme blues de ${K} majeure`, it: (K) => `Scala blues di ${K} maggiore`, de: (K) => `${K}-Dur-Bluestonleiter` },
};
const COMO = {
  GruposDe5: { en: 'in Groups of 5', pt: 'em grupos de 5 notas', fr: 'en groupes de 5 notes', it: 'a gruppi di 5 note', de: 'in 5er-Gruppen' },
  GruposDe3Semicorcheas: { en: 'in 16th-Note Groups of 3', pt: 'em grupos de 3 em semicolcheias', fr: 'en groupes de 3 en doubles croches', it: 'a gruppi di 3 in semicrome', de: 'in 3er-Gruppen in Sechzehnteln' },
  RepeticionDeNota: { en: 'with Repeated Notes', pt: 'repetindo nota', fr: 'avec note répétée', it: 'con nota ripetuta', de: 'mit Tonwiederholung' },
  Bordadura: { en: 'with Neighbor Notes', pt: 'com bordadura', fr: 'avec broderie', it: 'con nota di volta', de: 'mit Wechselnoten' },
  BlueNoteDePaso: { en: 'with the Passing Blue Note', pt: 'com a blue note de passagem', fr: 'avec la blue note de passage', it: 'con la blue note di passaggio', de: 'mit Blue Note als Durchgangston' },
};
const FORMA = {
  en: (f, c) => `${c ? 'Closed ' : ''}${f} Shape`, pt: (f, c) => `Forma ${f}${c ? ' fechada' : ''}`, fr: (f, c) => `Forme ${f}${c ? ' fermée' : ''}`,
  it: (f, c) => `Forma ${f}${c ? ' chiusa' : ''}`, de: (f, c) => `${c ? 'geschlossene ' : ''}${f}-Form`,
};
const g = (n, ...i) => i.map((x) => n[x % n.length]).join('-');
const QUE = {
  GruposDe5: {
    en: (n) => `Groups of five consecutive notes (${g(n, 0, 1, 2, 3, 4)}, ${g(n, 1, 2, 3, 4, 5)}…) played as 16th notes, that is, four notes per beat. Since each group has five notes, every group starts at a different point of the beat and the accent keeps rotating: it sounds like a cascade and breaks the squareness of groups of 4. A favourite rock and fusion device for playing fast without sounding like a scale.`,
    pt: (n) => `Grupos de cinco notas seguidas (${g(n, 0, 1, 2, 3, 4)}, ${g(n, 1, 2, 3, 4, 5)}…) tocados em semicolcheias, ou seja, quatro notas por tempo. Como o grupo tem cinco notas, cada um começa em um ponto diferente do tempo e o acento vai girando: soa como uma cascata e quebra a quadratura dos grupos de 4. Um recurso muito do rock e do fusion para tocar rápido sem soar como escala.`,
    fr: (n) => `Des groupes de cinq notes conjointes (${g(n, 0, 1, 2, 3, 4)}, ${g(n, 1, 2, 3, 4, 5)}…) joués en doubles croches, soit quatre notes par temps. Comme le groupe compte cinq notes, chacun commence à un endroit différent du temps et l'accent tourne : ça sonne comme une cascade et ça casse la carrure des groupes de 4. Un procédé très rock et fusion pour jouer vite sans sonner comme une gamme.`,
    it: (n) => `Gruppi di cinque note consecutive (${g(n, 0, 1, 2, 3, 4)}, ${g(n, 1, 2, 3, 4, 5)}…) suonati in semicrome, cioè quattro note per movimento. Dato che il gruppo ha cinque note, ognuno inizia in un punto diverso del movimento e l'accento ruota: suona come una cascata e rompe la quadratura dei gruppi di 4. Un espediente tipico del rock e della fusion per suonare veloce senza sembrare una scala.`,
    de: (n) => `Gruppen aus fünf aufeinanderfolgenden Tönen (${g(n, 0, 1, 2, 3, 4)}, ${g(n, 1, 2, 3, 4, 5)}…) in Sechzehnteln, also vier Töne pro Schlag. Weil jede Gruppe fünf Töne hat, beginnt sie jedes Mal an einer anderen Stelle im Schlag und der Akzent wandert: Das klingt wie eine Kaskade und bricht das Gleichmaß der 4er-Gruppen. Ein beliebtes Mittel in Rock und Fusion, um schnell zu spielen, ohne nach Tonleiter zu klingen.`,
  },
  GruposDe3Semicorcheas: {
    en: (n) => `The usual groups of three notes (${g(n, 0, 1, 2)}, ${g(n, 1, 2, 3)}…), but as 16th notes instead of triplets: four notes per beat. The group of 3 keeps shifting against the beat (three against four) and the accent falls on a different note each time. Harder than it looks: it forces you to count instead of just following the pattern.`,
    pt: (n) => `Os grupos de três notas de sempre (${g(n, 0, 1, 2)}, ${g(n, 1, 2, 3)}…), mas em semicolcheias em vez de tercinas: quatro notas por tempo. O grupo de 3 vai se deslocando em relação ao tempo (três contra quatro) e o acento cai cada vez em uma nota diferente. Mais difícil do que parece: obriga você a contar em vez de se deixar levar pelo padrão.`,
    fr: (n) => `Les groupes de trois notes habituels (${g(n, 0, 1, 2)}, ${g(n, 1, 2, 3)}…), mais en doubles croches au lieu de triolets : quatre notes par temps. Le groupe de 3 se décale par rapport au temps (trois contre quatre) et l'accent tombe à chaque fois sur une note différente. Plus difficile qu'il n'y paraît : il t'oblige à compter au lieu de te laisser porter par le motif.`,
    it: (n) => `I soliti gruppi di tre note (${g(n, 0, 1, 2)}, ${g(n, 1, 2, 3)}…), ma in semicrome invece che in terzine: quattro note per movimento. Il gruppo di 3 si sposta rispetto al movimento (tre contro quattro) e l'accento cade ogni volta su una nota diversa. Più difficile di quanto sembri: ti obbliga a contare invece di lasciarti portare dal pattern.`,
    de: (n) => `Die bekannten Dreiergruppen (${g(n, 0, 1, 2)}, ${g(n, 1, 2, 3)}…), aber in Sechzehnteln statt Triolen: vier Töne pro Schlag. Die 3er-Gruppe verschiebt sich gegen den Schlag (drei gegen vier) und der Akzent fällt jedes Mal auf einen anderen Ton. Schwerer, als es aussieht: Du musst zählen, statt dich vom Muster tragen zu lassen.`,
  },
  RepeticionDeNota: {
    en: (n) => `Each group starts by repeating its first note: ${g(n, 0, 0, 1, 2)}, ${g(n, 1, 1, 2, 3)}… As 16th notes, four notes per beat. The repeated note works your picking on a single string and your time control, and it's a very common move in fast solos.`,
    pt: (n) => `Cada grupo começa repetindo a sua primeira nota: ${g(n, 0, 0, 1, 2)}, ${g(n, 1, 1, 2, 3)}… Em semicolcheias, quatro notas por tempo. A nota repetida trabalha a palhetada na mesma corda e o controle do tempo, e é um gesto muito típico em solos rápidos.`,
    fr: (n) => `Chaque groupe commence en répétant sa première note : ${g(n, 0, 0, 1, 2)}, ${g(n, 1, 1, 2, 3)}… En doubles croches, quatre notes par temps. La note répétée travaille le médiator sur une même corde et la maîtrise du tempo, et c'est un geste très courant dans les solos rapides.`,
    it: (n) => `Ogni gruppo inizia ripetendo la sua prima nota: ${g(n, 0, 0, 1, 2)}, ${g(n, 1, 1, 2, 3)}… In semicrome, quattro note per movimento. La nota ripetuta allena il plettro sulla stessa corda e il controllo del tempo, ed è un gesto tipicissimo negli assoli veloci.`,
    de: (n) => `Jede Gruppe beginnt mit der Wiederholung ihres ersten Tons: ${g(n, 0, 0, 1, 2)}, ${g(n, 1, 1, 2, 3)}… In Sechzehnteln, vier Töne pro Schlag. Der wiederholte Ton trainiert den Anschlag auf einer Saite und das Timing und ist eine typische Figur in schnellen Soli.`,
  },
  Bordadura: {
    en: (n) => `Neighbor notes: from each note you go to the next one and come back (${g(n, 0, 1, 0)}, ${g(n, 1, 2, 1)}…), one group per beat as triplets. It's the most classic ornament there is: it circles the main note and gives it movement without leaving it. Great for working on legato and clean playing between two strings.`,
    pt: (n) => `Bordadura: de cada nota você vai à seguinte e volta (${g(n, 0, 1, 0)}, ${g(n, 1, 2, 1)}…), um grupo por tempo em tercinas. É o ornamento mais clássico que há: rodeia a nota principal e dá movimento a ela sem se afastar. Muito útil para trabalhar o ligado e a limpeza entre duas cordas.`,
    fr: (n) => `Broderie : de chaque note tu vas à la suivante et tu reviens (${g(n, 0, 1, 0)}, ${g(n, 1, 2, 1)}…), un groupe par temps en triolets. C'est l'ornement le plus classique qui soit : il entoure la note principale et lui donne du mouvement sans s'en éloigner. Très utile pour travailler le legato et la propreté entre deux cordes.`,
    it: (n) => `Nota di volta: da ogni nota vai alla successiva e torni (${g(n, 0, 1, 0)}, ${g(n, 1, 2, 1)}…), un gruppo per movimento in terzine. È l'abbellimento più classico che ci sia: gira intorno alla nota principale e le dà movimento senza allontanarsene. Utilissimo per lavorare il legato e la pulizia tra due corde.`,
    de: (n) => `Wechselnoten: Von jedem Ton gehst du zum nächsten und wieder zurück (${g(n, 0, 1, 0)}, ${g(n, 1, 2, 1)}…), eine Gruppe pro Schlag in Triolen. Die klassischste Verzierung überhaupt: Sie umspielt den Hauptton und bringt Bewegung, ohne sich von ihm zu entfernen. Sehr gut für Legato und sauberes Spiel zwischen zwei Saiten.`,
  },
  BlueNoteDePaso: {
    en: (n, men) => men
      ? `The blues scale played straight through as 8th notes, with the blue note (${n[3]}, the b5) always passing between the 4th (${n[2]}) and the 5th (${n[4]}). It's placed to land on the offbeat: that's how it sounds in the blues, a note that passes and adds tension, not one to rest on. On screen you'll see it in purple.`
      : `The major blues scale played straight through as 8th notes, with the blue note (${n[2]}, the b3) always passing between the 2nd (${n[1]}) and the 3rd (${n[3]}). It's placed to land on the offbeat and resolve to the major 3rd: the sound of major blues, country and southern rock. On screen you'll see it in purple.`,
    pt: (n, men) => men
      ? `A escala blues seguida, em colcheias, com a blue note (${n[3]}, a b5) sempre de passagem entre a 4ª (${n[2]}) e a 5ª (${n[4]}). Está colocada para cair no contratempo: é assim que soa no blues, uma nota que passa e cria tensão, não uma nota para parar. Na tela, você a verá em violeta.`
      : `A escala blues maior seguida, em colcheias, com a blue note (${n[2]}, a b3) sempre de passagem entre a 2ª (${n[1]}) e a 3ª (${n[3]}). Está colocada para cair no contratempo, resolvendo na 3ª maior: é o som do blues maior, do country e do southern rock. Na tela, você a verá em violeta.`,
    fr: (n, men) => men
      ? `La gamme blues jouée d'un trait, en croches, avec la blue note (${n[3]}, la b5) toujours de passage entre la 4te (${n[2]}) et la 5te (${n[4]}). Elle est placée pour tomber à contretemps : c'est comme ça qu'elle sonne dans le blues, une note qui passe et crée de la tension, pas une note où s'arrêter. À l'écran, tu la verras en violet.`
      : `La gamme blues majeure jouée d'un trait, en croches, avec la blue note (${n[2]}, la b3) toujours de passage entre la 2de (${n[1]}) et la 3ce (${n[3]}). Elle est placée pour tomber à contretemps et se résoudre sur la tierce majeure : le son du blues majeur, de la country et du southern rock. À l'écran, tu la verras en violet.`,
    it: (n, men) => men
      ? `La scala blues suonata di seguito, in crome, con la blue note (${n[3]}, la b5) sempre di passaggio tra la 4ª (${n[2]}) e la 5ª (${n[4]}). È collocata per cadere in levare: è così che suona nel blues, una nota che passa e crea tensione, non una nota su cui fermarsi. Sullo schermo la vedrai in viola.`
      : `La scala blues maggiore suonata di seguito, in crome, con la blue note (${n[2]}, la b3) sempre di passaggio tra la 2ª (${n[1]}) e la 3ª (${n[3]}). È collocata per cadere in levare e risolvere sulla 3ª maggiore: il suono del blues maggiore, del country e del southern rock. Sullo schermo la vedrai in viola.`,
    de: (n, men) => men
      ? `Die Bluestonleiter durchgehend in Achteln, mit der Blue Note (${n[3]}, die b5) immer als Durchgangston zwischen Quarte (${n[2]}) und Quinte (${n[4]}). Sie fällt bewusst auf die Offbeats: So klingt sie im Blues, als Ton, der vorbeizieht und Spannung erzeugt, nicht als Ton zum Stehenbleiben. Im Video siehst du sie in Violett.`
      : `Die Dur-Bluestonleiter durchgehend in Achteln, mit der Blue Note (${n[2]}, die b3) immer als Durchgangston zwischen Sekunde (${n[1]}) und großer Terz (${n[3]}). Sie fällt bewusst auf die Offbeats und löst sich in die große Terz auf: der Sound von Dur-Blues, Country und Southern Rock. Im Video siehst du sie in Violett.`,
  },
};
// Frases fijas: intro(nombre, notas, como, forma, t0, t1), vuelta, cerrada(f), tempo, practica (4), tip, rock, canal, serie(como).
const FIJO = {
  en: {
    intro: (N, n, como, F, t0, t1) => `${N} (${n}) ${como.toLowerCase()} in the ${F} of the CAGED system, over a backing track that starts at ${t0} bpm and speeds up every lap up to ${t1}: in steps of 5 up to 100 and steps of 10 after that.`,
    vuelta: 'Each lap covers the whole box: it starts on the lowest root, goes all the way up, comes down to the lowest note and back to the root. At the top you have the notes with their intervals, on the right the metronome and at the bottom the tempo ladder, so you always know where you are.',
    cerrada: (f) => `🔒 Closed version: the same ${f} Shape, 12 frets higher and with no open strings.`,
    tempo: '⏱️ Pick your tempo', practica: '🎯 How to practise it',
    pasos: ['Start from the beginning and play along. The first laps are slow on purpose: use them to memorise the route.', 'When a lap gives you trouble, go back to its chapter and repeat it before moving on.', 'Next time, start a couple of tempos higher.', 'Once you have it in this shape, move on to the next: the 5 shapes together cover the whole neck.'],
    tip: "💡 What matters here is learning the pattern: getting it to flow without thinking, in all 5 shapes. When you hit your top speed and want to keep pushing it little by little, switch to TodoRitmos: its progressive rhythms (rock, funk, shuffle, reggae…) raise the tempo gradually so you build speed and precision over real grooves.",
    rock: '🎸 Rock rhythms (fixed and progressive):', canal: '🥁 TodoRitmos channel:', serie: (c) => `📚 The whole series ${c.toLowerCase()}:`,
    hashtags: '#guitar #CAGED #technique #speed #guitarexercises',
  },
  pt: {   // português do Brasil, com "você", como scripts/lib/traduccion-en.js
    intro: (N, n, como, F, t0, t1) => `${N} (${n}) ${como} na ${F} do sistema CAGED, com uma base rítmica que começa em ${t0} bpm e sobe a cada volta até ${t1}: de 5 em 5 até 100 e de 10 em 10 a partir daí.`,
    vuelta: 'Cada volta percorre a caixa inteira: sai da tônica mais grave, sobe até o topo, desce até a nota mais grave e volta à tônica. Em cima você tem as notas com seus intervalos, à direita o metrônomo e embaixo a escada de andamentos, para saber sempre onde está.',
    cerrada: (f) => `🔒 Versão fechada: a mesma Forma ${f}, 12 casas acima e sem cordas soltas.`,
    tempo: '⏱️ Escolha seu andamento', practica: '🎯 Como praticar',
    pasos: ['Comece do início e toque junto. As primeiras voltas são lentas de propósito: use-as para memorizar o percurso.', 'Quando uma volta ficar difícil, volte ao capítulo dela e repita antes de seguir.', 'Na próxima vez, comece alguns andamentos acima.', 'Quando dominar esta forma, passe para a seguinte: as 5 formas juntas cobrem o braço inteiro.'],
    tip: "💡 O importante aqui é aprender o padrão: que ele saia sozinho, sem pensar, nas 5 formas. Quando chegar à sua velocidade máxima e quiser continuar subindo aos poucos, passe para o TodoRitmos: os ritmos progressivos do canal (rock, funk, shuffle, reggae…) aumentam o andamento pouco a pouco para você ganhar velocidade e precisão com bases de verdade.",
    rock: '🎸 Ritmos de rock (fixos e progressivos):', canal: '🥁 Canal TodoRitmos:', serie: (c) => `📚 A série completa ${c}:`,
    hashtags: '#guitarra #CAGED #técnica #velocidade #exercíciosdeguitarra',
  },
  fr: {
    intro: (N, n, como, F, t0, t1) => `${N} (${n}) ${como} dans la ${F} du système CAGED, sur une base rythmique qui commence à ${t0} bpm et accélère à chaque tour jusqu'à ${t1} : de 5 en 5 jusqu'à 100, puis de 10 en 10.`,
    vuelta: "Chaque tour parcourt toute la position : il part de la tonique la plus grave, monte jusqu'en haut, redescend jusqu'à la note la plus grave et revient à la tonique. En haut, tu as les notes avec leur intervalle, à droite le métronome et en bas l'échelle de tempos, pour toujours savoir où tu en es.",
    cerrada: (f) => `🔒 Version fermée : la même Forme ${f}, 12 cases plus haut et sans cordes à vide.`,
    tempo: '⏱️ Choisis ton tempo', practica: "🎯 Comment s'entraîner",
    pasos: ['Commence depuis le début et joue par-dessus. Les premiers tours sont lents exprès : profites-en pour mémoriser le parcours.', 'Quand un tour te résiste, reviens à son chapitre et répète-le avant de continuer.', 'La prochaine fois, commence deux tempos plus haut.', 'Quand tu le maîtrises dans cette forme, passe à la suivante : les 5 formes ensemble couvrent tout le manche.'],
    tip: "💡 L'important ici, c'est d'apprendre le motif : qu'il sorte tout seul, sans réfléchir, dans les 5 formes. Quand tu atteins ta vitesse maximale et que tu veux continuer à monter petit à petit, passe sur TodoRitmos : ses rythmes progressifs (rock, funk, shuffle, reggae…) augmentent le tempo peu à peu pour gagner en vitesse et en précision sur de vrais grooves.",
    rock: '🎸 Rythmes rock (fixes et progressifs) :', canal: '🥁 Chaîne TodoRitmos :', serie: (c) => `📚 Toute la série ${c} :`,
    hashtags: '#guitare #CAGED #technique #vitesse #exercicesdeguitare',
  },
  it: {
    intro: (N, n, como, F, t0, t1) => `${N} (${n}) ${como} nella ${F} del sistema CAGED, con una base ritmica che parte da ${t0} bpm e accelera a ogni giro fino a ${t1}: di 5 in 5 fino a 100 e di 10 in 10 da lì in poi.`,
    vuelta: 'Ogni giro percorre tutta la posizione: parte dalla tonica più grave, sale fino in cima, scende fino alla nota più grave e torna alla tonica. In alto hai le note con il loro intervallo, a destra il metronomo e in basso la scala dei tempi, per sapere sempre a che punto sei.',
    cerrada: (f) => `🔒 Versione chiusa: la stessa Forma ${f}, 12 tasti più in alto e senza corde a vuoto.`,
    tempo: '⏱️ Scegli il tuo tempo', practica: '🎯 Come esercitarti',
    pasos: ["Parti dall'inizio e suona sopra. I primi giri sono lenti apposta: usali per memorizzare il percorso.", 'Quando un giro ti mette in difficoltà, torna al suo capitolo e ripetilo prima di andare avanti.', 'La prossima volta parti un paio di tempi più in alto.', 'Quando lo hai in questa forma, passa alla successiva: le 5 forme insieme coprono tutto il manico.'],
    tip: "💡 Qui l'importante è imparare il pattern: che venga da solo, senza pensarci, in tutte e 5 le forme. Quando arrivi alla tua velocità massima e vuoi continuare a salire poco a poco, passa a TodoRitmos: i suoi ritmi progressivi (rock, funk, shuffle, reggae…) aumentano il tempo gradualmente per guadagnare velocità e precisione su basi vere.",
    rock: '🎸 Ritmi rock (fissi e progressivi):', canal: '🥁 Canale TodoRitmos:', serie: (c) => `📚 Tutta la serie ${c}:`,
    hashtags: '#chitarra #CAGED #tecnica #velocità #eserciziperchitarra',
  },
  de: {
    intro: (N, n, como, F, t0, t1) => `${N} (${n}) ${como} in der ${F} des CAGED-Systems, mit einem Backing Track, der bei ${t0} bpm beginnt und mit jeder Runde schneller wird, bis ${t1}: bis 100 in 5er-Schritten, danach in 10er-Schritten.`,
    vuelta: 'Jede Runde geht durch die ganze Box: vom tiefsten Grundton ganz nach oben, hinunter bis zum tiefsten Ton und zurück zum Grundton. Oben siehst du die Töne mit ihren Intervallen, rechts das Metronom und unten die Tempoleiter, damit du immer weißt, wo du bist.',
    cerrada: (f) => `🔒 Geschlossene Version: dieselbe ${f}-Form, 12 Bünde höher und ohne Leersaiten.`,
    tempo: '⏱️ Wähle dein Tempo', practica: '🎯 So übst du',
    pasos: ['Fang von vorne an und spiel mit. Die ersten Runden sind absichtlich langsam: Nutze sie, um den Weg einzuprägen.', 'Wenn eine Runde hakt, geh zu ihrem Kapitel zurück und wiederhole sie, bevor du weitermachst.', 'Beim nächsten Mal fängst du ein paar Tempi höher an.', 'Sitzt es in dieser Form, nimm dir die nächste vor: Die 5 Formen zusammen decken das ganze Griffbrett ab.'],
    tip: "💡 Worum es hier geht: das Muster lernen, bis es von allein läuft, ohne nachzudenken, in allen 5 Formen. Wenn du dein Höchsttempo erreicht hast und es Schritt für Schritt steigern willst, wechsle zu TodoRitmos: Die progressiven Rhythmen (Rock, Funk, Shuffle, Reggae…) werden nach und nach schneller, damit du Tempo und Präzision mit echten Grooves aufbaust.",
    rock: '🎸 Rock-Rhythmen (fest und progressiv):', canal: '🥁 Kanal TodoRitmos:', serie: (c) => `📚 Die ganze Serie ${c}:`,
    hashtags: '#gitarre #CAGED #technik #tempo #gitarrenübungen',
  },
};
const IDIOMAS = ['en', 'pt', 'fr', 'it', 'de'];

// datos: { esc, ej, K, notas[], f, c, t0, t1, caps, rock, canal, serieUrl }
function traducir(l, d) {
  const T = FIJO[l], N = ESC[d.esc][l](d.K), como = COMO[d.ej][l], F = FORMA[l](d.f, d.c);
  const title = `${N} ${como} | ${F} (CAGED) | ${d.t0}–${d.t1} bpm`;
  const formaIntro = l === 'de' && d.c ? `geschlossenen ${d.f}-Form` : F;  // de: "in der geschlossenen E-Form" (dativo)
  const description = `${T.intro(N, d.notas.join(' '), como, formaIntro, d.t0, d.t1)}

${QUE[d.ej][l](d.notas, d.esc === 'EscalaBlues')}

${T.vuelta}${d.c ? `

${T.cerrada(d.f)}` : ''}

${T.tempo}
${d.caps}

${T.practica}
${T.pasos.map((p, i) => `${i + 1}. ${p}`).join('\n')}

${T.tip}
${T.rock} ${d.rock}
${T.canal} ${d.canal}

${T.serie(como)} ${d.serieUrl}

${T.hashtags}`;
  return { title, description };
}
module.exports = { IDIOMAS, traducir };
