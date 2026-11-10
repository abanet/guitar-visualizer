#!/usr/bin/env node
/*
 * Textos (6 idiomas) de los dos vídeos de "Cromática a octavas" (11-06) → plan para catalog-plan-api.js.
 * Lista: al principio de "Localiza las notas en el mástil" (Alberto 11-06). Feed: los dos.
 * 11-06: el 💡 dice "cuando llegues a TU velocidad máxima" (Alberto: "si llegas a 160 eres un superguitarra").
 * Uso: node scripts/catalog-cromatica.js [--print es|en|…]   → scripts/.catalog-cromatica-plan.json
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const TR = 'https://www.youtube.com/@TodoRitmos', ROCK = 'https://www.youtube.com/playlist?list=PLZGvgaVgkRGA';
const CAP = ['0:00 40 bpm', '1:00 45 bpm', '1:53 50 bpm', '2:41 55 bpm', '3:24 60 bpm', '4:04 65 bpm', '4:41 70 bpm', '5:16 75 bpm', '5:48 80 bpm', '6:18 85 bpm', '6:46 90 bpm', '7:13 95 bpm', '7:38 100 bpm', '8:02 105 bpm', '8:25 110 bpm', '8:47 115 bpm', '9:07 120 bpm', '9:27 130 bpm', '9:46 140 bpm', '10:03 150 bpm', '10:19 160 bpm'];   // calculados: 1 compás de entrada, 36 pulsos por vuelta y 1 compás de cuenta antes de cada tempo nuevo

const V = {
  abierta: { stem: 'Cromatica_a_octavas_40-160bpm', fecha: null   /* 11-06: Alberto la quiere ya, para practicarla */,
    es: { t: 'Escala cromática a octavas con cuerdas al aire | De 40 a 160 bpm', pos: 'con cuerdas al aire (trastes 0 a 4), de E a G# y vuelta',
      extra: '¿Ya te sale? Hay una versión sin cuerdas al aire que puedes llevar a cualquier traste: la tienes en la misma lista.' },
    en: { t: 'Chromatic Scale in Octaves with Open Strings | 40 to 160 bpm', pos: 'with open strings (frets 0 to 4), from E up to G# and back',
      extra: 'Got it? There is a version with no open strings that you can move to any fret: it is in the same playlist.' },
    pt: { t: 'Escala cromática em oitavas com cordas soltas | De 40 a 160 bpm', pos: 'com cordas soltas (casas 0 a 4), de E até G# e de volta',
      extra: 'Já está saindo? Tem uma versão sem cordas soltas que você pode levar para qualquer casa: está na mesma playlist.' },
    fr: { t: 'Gamme chromatique en octaves avec cordes à vide | De 40 à 160 bpm', pos: 'avec cordes à vide (cases 0 à 4), de E à G# et retour',
      extra: 'Ça sort ? Il existe une version sans cordes à vide que tu peux déplacer sur n’importe quelle case : elle est dans la même playlist.' },
    it: { t: 'Scala cromatica in ottave con corde a vuoto | Da 40 a 160 bpm', pos: 'con corde a vuoto (tasti da 0 a 4), da E a G# e ritorno',
      extra: 'Ti viene? C’è una versione senza corde a vuoto che puoi spostare su qualsiasi tasto: è nella stessa playlist.' },
    de: { t: 'Chromatische Tonleiter in Oktaven mit Leersaiten | 40 bis 160 bpm', pos: 'mit Leersaiten (Bünde 0 bis 4), von E bis G# und zurück',
      extra: 'Sitzt es? Es gibt eine Version ohne Leersaiten, die du in jeden Bund verschieben kannst: Sie ist in derselben Playlist.' } },
  cerrada: { stem: 'Cromatica_a_octavas_cerrada_40-160bpm', fecha: '2026-11-07T18:00:00Z'   /* 11-07 a las 19:00 de España */,
    es: { t: 'Escala cromática a octavas sin cuerdas al aire | Muévela por el mástil | De 40 a 160 bpm', pos: 'sin cuerdas al aire, de A (traste 5 de la 6ª cuerda) a C# y vuelta, entre los trastes 5 y 9',
      extra: 'Al no usar cuerdas al aire, la forma se mueve a cualquier traste: empieza en el 3 y suena desde G, en el 8 desde C… Cuando la domines aquí, pruébala en otras zonas del mástil.' },
    en: { t: 'Chromatic Scale in Octaves, No Open Strings | Move It Around the Neck | 40 to 160 bpm', pos: 'with no open strings, from A (5th fret, 6th string) up to C# and back, between frets 5 and 9',
      extra: 'With no open strings, the shape moves to any fret: start on the 3rd and it begins on G, on the 8th on C… Once you own it here, try it elsewhere on the neck.' },
    pt: { t: 'Escala cromática em oitavas sem cordas soltas | Leve pelo braço | De 40 a 160 bpm', pos: 'sem cordas soltas, de A (casa 5 da 6ª corda) até C# e de volta, entre as casas 5 e 9',
      extra: 'Sem cordas soltas, a forma vai para qualquer casa: comece na 3 e ela começa em G, na 8 em C… Quando dominar aqui, experimente em outras regiões do braço.' },
    fr: { t: 'Gamme chromatique en octaves sans cordes à vide | Déplace-la sur le manche | De 40 à 160 bpm', pos: 'sans cordes à vide, de A (5e case, 6e corde) à C# et retour, entre les cases 5 et 9',
      extra: 'Sans cordes à vide, la forme se déplace sur n’importe quelle case : commence à la 3e et elle part de G, à la 8e de C… Quand tu la maîtrises ici, essaie-la ailleurs sur le manche.' },
    it: { t: 'Scala cromatica in ottave senza corde a vuoto | Spostala sul manico | Da 40 a 160 bpm', pos: 'senza corde a vuoto, da A (5° tasto, 6ª corda) a C# e ritorno, tra i tasti 5 e 9',
      extra: 'Senza corde a vuoto, la forma si sposta su qualsiasi tasto: parti dal 3° e inizia da G, dall’8° da C… Quando la padroneggi qui, provala in altre zone del manico.' },
    de: { t: 'Chromatische Tonleiter in Oktaven ohne Leersaiten | Verschiebbar | 40 bis 160 bpm', pos: 'ohne Leersaiten, von A (5. Bund, 6. Saite) bis C# und zurück, zwischen Bund 5 und 9',
      extra: 'Ohne Leersaiten lässt sich die Form in jeden Bund verschieben: im 3. Bund beginnt sie auf G, im 8. auf C… Wenn sie hier sitzt, probier sie woanders auf dem Griffbrett.' } },
};
const T = {
  es: (p, x) => `La escala cromática tocada en octavas: cada nota seguida de la misma nota una octava más aguda, dos cuerdas más arriba. ${p.pos[0].toUpperCase() + p.pos.slice(1)}, en corcheas, sobre una base que empieza a 40 bpm y sube de 5 en 5 hasta 120 y de 10 en 10 hasta 160. Entre un tempo y el siguiente hay un compás de respiro con cuenta atrás.

Es un ejercicio de los que impresionan, pero sobre todo enseña tres cosas: a encontrar cualquier nota en su octava (siempre dos cuerdas más arriba y dos trastes más allá, y tres al cruzar la 2ª cuerda), el salto de cuerda limpio y la escala cromática completa, nota a nota.

👀 Qué ves en pantalla
• Arriba, la escala cromática con la nota que suena iluminada (y el enarmónico de cada sostenido debajo).
• En el mástil, la nota que suena se ilumina; mientras suena la primera nota del par, su octava ya aparece marcada.
• Las notas de la escala de C, algo más intensas que las alteradas.
• Abajo, la tablatura con el tiempo marcado en cada corchea.

⏱️ Tempos
${CAP.join('\n')}

🎯 Cómo practicarlo
1. Empieza a 40 aunque te parezca lento: es para que la octava se te quede en la mano.
2. Di el nombre de cada nota mientras la tocas.
3. Si un tempo se te escapa, vuelve a su capítulo y repítelo.
4. ${x}

💡 Lo importante aquí es aprender el patrón. Cuando llegues a tu velocidad máxima y quieras seguir subiendo poco a poco, pásate a TodoRitmos: sus ritmos progresivos van aumentando el tempo poco a poco para que ganes velocidad y precisión con bases de verdad.
🎸 Ritmos de rock (fijos y progresivos): ${ROCK}
🥁 Canal TodoRitmos: ${TR}

📋 Más ejercicios para localizar notas en el mástil: (enlace de la lista)

#guitarra #escalacromatica #octavas #técnica #ejerciciosdeguitarra`,
  en: (p, x) => `The chromatic scale played in octaves: each note followed by the same note an octave higher, two strings up. ${p.pos[0].toUpperCase() + p.pos.slice(1)}, in 8th notes, over a backing track that starts at 40 bpm and goes up in steps of 5 to 120 and steps of 10 to 160. Between one tempo and the next there is a bar to breathe, with a countdown.

It's one of those exercises that impress, but above all it teaches three things: finding any note in its octave (always two strings up and two frets over, three when you cross the 2nd string), clean string skipping, and the whole chromatic scale, note by note.

👀 What you see on screen
• At the top, the chromatic scale with the note being played lit up (and each sharp's enharmonic below).
• On the neck, the note being played lights up; while the first note of the pair sounds, its octave is already marked.
• The notes of the C scale, slightly brighter than the altered ones.
• At the bottom, the tab with the time marked on every 8th note.

⏱️ Tempos
${CAP.join('\n')}

🎯 How to practise it
1. Start at 40 even if it feels slow: it's so the octave settles into your hand.
2. Say each note's name as you play it.
3. If a tempo gets away from you, go back to its chapter and repeat it.
4. ${x}

💡 What matters here is learning the pattern. When you hit your top speed and want to keep pushing it little by little, switch to TodoRitmos: its progressive rhythms raise the tempo gradually so you build speed and precision over real grooves.
🎸 Rock rhythms (fixed and progressive): ${ROCK}
🥁 TodoRitmos channel: ${TR}

📋 More exercises to find notes on the neck: (enlace de la lista)

#guitar #chromaticscale #octaves #technique #guitarexercises`,
  pt: (p, x) => `A escala cromática tocada em oitavas: cada nota seguida da mesma nota uma oitava acima, duas cordas acima. ${p.pos[0].toUpperCase() + p.pos.slice(1)}, em colcheias, sobre uma base que começa em 40 bpm e sobe de 5 em 5 até 120 e de 10 em 10 até 160. Entre um andamento e o seguinte há um compasso para respirar, com contagem regressiva.

É um daqueles exercícios que impressionam, mas acima de tudo ensina três coisas: encontrar qualquer nota na sua oitava (sempre duas cordas acima e duas casas adiante, três ao cruzar a 2ª corda), o salto de corda limpo e a escala cromática completa, nota a nota.

👀 O que você vê na tela
• Em cima, a escala cromática com a nota que soa iluminada (e o enarmônico de cada sustenido embaixo).
• No braço, a nota que soa se ilumina; enquanto soa a primeira nota do par, a oitava já aparece marcada.
• As notas da escala de C, um pouco mais intensas que as alteradas.
• Embaixo, a tablatura com o tempo marcado em cada colcheia.

⏱️ Andamentos
${CAP.join('\n')}

🎯 Como praticar
1. Comece em 40 mesmo que pareça lento: é para a oitava ficar na mão.
2. Diga o nome de cada nota enquanto toca.
3. Se um andamento escapar, volte ao capítulo dele e repita.
4. ${x}

💡 O importante aqui é aprender o padrão. Quando chegar à sua velocidade máxima e quiser continuar subindo aos poucos, passe para o TodoRitmos: os ritmos progressivos do canal aumentam o andamento pouco a pouco para você ganhar velocidade e precisão com bases de verdade.
🎸 Ritmos de rock (fixos e progressivos): ${ROCK}
🥁 Canal TodoRitmos: ${TR}

📋 Mais exercícios para localizar notas no braço: (enlace de la lista)

#guitarra #escalacromatica #oitavas #técnica #exercíciosdeguitarra`,
  fr: (p, x) => `La gamme chromatique jouée en octaves : chaque note suivie de la même note une octave plus haut, deux cordes au-dessus. ${p.pos[0].toUpperCase() + p.pos.slice(1)}, en croches, sur une base qui commence à 40 bpm et monte de 5 en 5 jusqu’à 120 puis de 10 en 10 jusqu’à 160. Entre deux tempos, une mesure pour respirer, avec un compte à rebours.

C’est un de ces exercices qui impressionnent, mais surtout il apprend trois choses : trouver n’importe quelle note à l’octave (toujours deux cordes au-dessus et deux cases plus loin, trois en passant la 2e corde), le saut de corde propre et la gamme chromatique complète, note par note.

👀 Ce que tu vois à l’écran
• En haut, la gamme chromatique avec la note jouée allumée (et l’enharmonique de chaque dièse en dessous).
• Sur le manche, la note jouée s’allume ; pendant la première note de la paire, son octave est déjà marquée.
• Les notes de la gamme de C, un peu plus intenses que les altérées.
• En bas, la tablature avec le temps marqué sur chaque croche.

⏱️ Tempos
${CAP.join('\n')}

🎯 Comment s’entraîner
1. Commence à 40 même si ça te paraît lent : c’est pour que l’octave s’installe dans la main.
2. Dis le nom de chaque note en la jouant.
3. Si un tempo t’échappe, reviens à son chapitre et répète-le.
4. ${x}

💡 L’important ici, c’est d’apprendre le motif. Quand tu atteins ta vitesse maximale et que tu veux continuer à monter petit à petit, passe sur TodoRitmos : ses rythmes progressifs augmentent le tempo peu à peu pour gagner en vitesse et en précision sur de vrais grooves.
🎸 Rythmes rock (fixes et progressifs) : ${ROCK}
🥁 Chaîne TodoRitmos : ${TR}

📋 Plus d’exercices pour trouver les notes sur le manche : (enlace de la lista)

#guitare #gammechromatique #octaves #technique #exercicesdeguitare`,
  it: (p, x) => `La scala cromatica suonata in ottave: ogni nota seguita dalla stessa nota un’ottava sopra, due corde più in alto. ${p.pos[0].toUpperCase() + p.pos.slice(1)}, in crome, su una base che parte da 40 bpm e sale di 5 in 5 fino a 120 e di 10 in 10 fino a 160. Tra un tempo e l’altro c’è una battuta di respiro con il conto alla rovescia.

È uno di quegli esercizi che fanno colpo, ma soprattutto insegna tre cose: trovare qualsiasi nota alla sua ottava (sempre due corde sopra e due tasti più in là, tre quando si passa la 2ª corda), il salto di corda pulito e la scala cromatica completa, nota per nota.

👀 Cosa vedi sullo schermo
• In alto, la scala cromatica con la nota che suona illuminata (e l’enarmonico di ogni diesis sotto).
• Sul manico, la nota che suona si illumina; mentre suona la prima nota della coppia, la sua ottava è già segnata.
• Le note della scala di C, un po’ più intense di quelle alterate.
• In basso, l’intavolatura con il tempo segnato su ogni croma.

⏱️ Tempi
${CAP.join('\n')}

🎯 Come esercitarti
1. Parti da 40 anche se ti sembra lento: serve a far entrare l’ottava nella mano.
2. Di’ il nome di ogni nota mentre la suoni.
3. Se un tempo ti sfugge, torna al suo capitolo e ripetilo.
4. ${x}

💡 Qui l’importante è imparare il pattern. Quando arrivi alla tua velocità massima e vuoi continuare a salire poco a poco, passa a TodoRitmos: i suoi ritmi progressivi aumentano il tempo gradualmente per guadagnare velocità e precisione su basi vere.
🎸 Ritmi rock (fissi e progressivi): ${ROCK}
🥁 Canale TodoRitmos: ${TR}

📋 Altri esercizi per trovare le note sul manico: (enlace de la lista)

#chitarra #scalacromatica #ottave #tecnica #eserciziperchitarra`,
  de: (p, x) => `Die chromatische Tonleiter in Oktaven: Jeder Ton wird von demselben Ton eine Oktave höher gefolgt, zwei Saiten weiter oben. ${p.pos[0].toUpperCase() + p.pos.slice(1)}, in Achteln, über einem Backing Track, der bei 40 bpm beginnt und in 5er-Schritten bis 120 und in 10er-Schritten bis 160 steigt. Zwischen zwei Tempi gibt es einen Takt zum Durchatmen, mit Countdown.

Eine Übung, die Eindruck macht, aber vor allem drei Dinge lehrt: jeden Ton in seiner Oktave finden (immer zwei Saiten höher und zwei Bünde weiter, drei beim Wechsel über die 2. Saite), sauberes Saitenspringen und die komplette chromatische Tonleiter, Ton für Ton.

👀 Was du im Video siehst
• Oben die chromatische Tonleiter mit dem klingenden Ton hervorgehoben (und darunter die enharmonische Schreibweise jedes Kreuzes).
• Auf dem Griffbrett leuchtet der klingende Ton auf; während der erste Ton des Paares klingt, ist seine Oktave schon markiert.
• Die Töne der C-Dur-Tonleiter etwas kräftiger als die alterierten.
• Unten die Tabulatur mit dem Takt auf jeder Achtel markiert.

⏱️ Tempi
${CAP.join('\n')}

🎯 So übst du
1. Fang bei 40 an, auch wenn es langsam wirkt: So setzt sich die Oktave in der Hand fest.
2. Sag den Namen jedes Tons, während du ihn spielst.
3. Wenn dir ein Tempo entgleitet, geh zu seinem Kapitel zurück und wiederhole es.
4. ${x}

💡 Worum es hier geht: das Muster lernen. Wenn du dein Höchsttempo erreicht hast und es Schritt für Schritt steigern willst, wechsle zu TodoRitmos: Die progressiven Rhythmen werden nach und nach schneller, damit du Tempo und Präzision mit echten Grooves aufbaust.
🎸 Rock-Rhythmen (fest und progressiv): ${ROCK}
🥁 Kanal TodoRitmos: ${TR}

📋 Mehr Übungen, um Töne auf dem Griffbrett zu finden: (enlace de la lista)

#gitarre #chromatischetonleiter #oktaven #technik #gitarrenübungen`,
};
const plan = Object.values(V).map((v) => ({
  stem: v.stem, file: path.join(os.homedir(), 'Downloads/_SUBIR_BanetMasa_Cromatica', v.stem + '.mp4'),
  thumb: path.join(os.homedir(), 'guitar-visualizer-assets/miniaturas-cromatica', v.stem + '.jpg'),
  title: v.es.t, description: T.es(v.es, v.es.extra),
  localizations: Object.fromEntries(['en', 'pt', 'fr', 'it', 'de'].map((l) => [l, { title: v[l].t, description: T[l](v[l], v[l].extra) }])),
  tags: ['guitarra', 'escala cromática', 'octavas', 'cromática a octavas', 'técnica de guitarra', 'salto de cuerda', 'localizar notas', 'notas en el mástil',
    'ejercicios de guitarra', 'backing track', '40-160 bpm', 'calentamiento', 'guitar', 'chromatic scale', 'octaves', 'guitar exercise'],
  listas: ['Localiza las notas en el mástil'], publishAtUTC: v.fecha, feed: true }));
for (const p of plan) for (const t of [p.title, ...Object.values(p.localizations).map((x) => x.title)]) if (t.length > 100) console.error('título largo', t.length, t);
const a = process.argv.indexOf('--print');
if (a > 0) { const l = process.argv[a + 1]; for (const p of plan) { const x = l === 'es' ? p : p.localizations[l]; console.log(`${x.title}\n\n${x.description}\n\n=========\n`); } }
fs.writeFileSync(path.join(__dirname, '.catalog-cromatica-plan.json'), JSON.stringify(plan, null, 1));
console.log(`${plan.length} vídeos en el plan`);
