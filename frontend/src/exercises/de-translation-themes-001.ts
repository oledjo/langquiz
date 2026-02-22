import type { Exercise } from '../types/exercise'

interface SeedItem {
  en: string
  de: string
  wrong: [string, string, string]
}

interface ThemeSeed {
  topic: string
  subtopic: string
  group: 'grammar' | 'vocabulary'
  level: 'A1' | 'A2' | 'B1' | 'B2'
  items: [SeedItem, SeedItem, SeedItem, SeedItem]
}

const THEME_SEEDS: ThemeSeed[] = [
  {
    topic: 'articles',
    subtopic: 'definite-and-indefinite-articles',
    group: 'grammar',
    level: 'A1',
    items: [
      { en: 'I see the man.', de: 'Ich sehe den Mann.', wrong: ['Ich sehe der Mann.', 'Ich sehe dem Mann.', 'Ich sehe die Mann.'] },
      { en: 'The woman is at home.', de: 'Die Frau ist zu Hause.', wrong: ['Der Frau ist zu Hause.', 'Die Frau ist nach Hause.', 'Das Frau ist zu Hause.'] },
      { en: 'I give the child a book.', de: 'Ich gebe dem Kind ein Buch.', wrong: ['Ich gebe den Kind ein Buch.', 'Ich gebe das Kind ein Buch.', 'Ich gebe dem Kind einen Buch.'] },
      { en: 'We visit the friends.', de: 'Wir besuchen die Freunde.', wrong: ['Wir besuchen den Freunde.', 'Wir besuchen der Freunde.', 'Wir besuchen dem Freunde.'] },
    ],
  },
  {
    topic: 'adjective declension',
    subtopic: 'strong-weak-mixed',
    group: 'grammar',
    level: 'A2',
    items: [
      { en: 'The old man is sleeping.', de: 'Der alte Mann schläft.', wrong: ['Der alten Mann schläft.', 'Der alter Mann schläft.', 'Der altes Mann schläft.'] },
      { en: 'I see a new car.', de: 'Ich sehe ein neues Auto.', wrong: ['Ich sehe ein neuer Auto.', 'Ich sehe einen neues Auto.', 'Ich sehe ein neuen Auto.'] },
      { en: 'She helps the small child.', de: 'Sie hilft dem kleinen Kind.', wrong: ['Sie hilft dem kleine Kind.', 'Sie hilft den kleinen Kind.', 'Sie hilft dem kleiner Kind.'] },
      { en: 'Fresh bread tastes good.', de: 'Frisches Brot schmeckt gut.', wrong: ['Frischer Brot schmeckt gut.', 'Frischen Brot schmeckt gut.', 'Frischem Brot schmeckt gut.'] },
    ],
  },
  {
    topic: 'cases in context',
    subtopic: 'nominative-accusative-dative-genitive',
    group: 'grammar',
    level: 'B1',
    items: [
      { en: 'The dog bites the postman.', de: 'Der Hund beißt den Postboten.', wrong: ['Den Hund beißt der Postboten.', 'Der Hund beißt dem Postboten.', 'Der Hund beißt der Postboten.'] },
      { en: 'I am helping my brother.', de: 'Ich helfe meinem Bruder.', wrong: ['Ich helfe meinen Bruder.', 'Ich helfe mein Bruder.', 'Ich hilfe meinem Bruder.'] },
      { en: 'Because of the rain, we stay home.', de: 'Wegen des Regens bleiben wir zu Hause.', wrong: ['Wegen den Regen bleiben wir zu Hause.', 'Wegen der Regen bleiben wir zu Hause.', 'Wegen des Regen bleiben wir nach Hause.'] },
      { en: 'The teacher gives the student homework.', de: 'Der Lehrer gibt dem Schüler Hausaufgaben.', wrong: ['Der Lehrer gibt den Schüler Hausaufgaben.', 'Der Lehrer gibt der Schüler Hausaufgaben.', 'Der Lehrer gibt dem Schüler die Hausaufgabe.'] },
    ],
  },
  {
    topic: 'pronouns',
    subtopic: 'personal-and-possessive-pronouns',
    group: 'grammar',
    level: 'A1',
    items: [
      { en: 'She knows him.', de: 'Sie kennt ihn.', wrong: ['Sie kennt ihm.', 'Sie kennen ihn.', 'Sie kennt er.'] },
      { en: 'I give her the key.', de: 'Ich gebe ihr den Schlüssel.', wrong: ['Ich gebe sie den Schlüssel.', 'Ich gebe ihr der Schlüssel.', 'Ich gebe ihm den Schlüssel.'] },
      { en: 'They help us.', de: 'Sie helfen uns.', wrong: ['Sie helfen wir.', 'Sie hilft uns.', 'Sie helfen ihnen uns.'] },
      { en: 'Can you see me?', de: 'Kannst du mich sehen?', wrong: ['Kannst du mir sehen?', 'Kann du mich sehen?', 'Kannst du mich siehst?'] },
    ],
  },
  {
    topic: 'question words',
    subtopic: 'w-questions',
    group: 'grammar',
    level: 'A1',
    items: [
      { en: 'Where do you live?', de: 'Wo wohnst du?', wrong: ['Wo du wohnst?', 'Wohin wohnst du?', 'Wo wohnt du?'] },
      { en: 'When does the train leave?', de: 'Wann fährt der Zug ab?', wrong: ['Wann der Zug fährt ab?', 'Wenn fährt der Zug ab?', 'Wann fährt den Zug ab?'] },
      { en: 'Why are you late?', de: 'Warum bist du spät?', wrong: ['Warum du bist spät?', 'Wieso bist du späten?', 'Warum bist du zu spätet?'] },
      { en: 'How much does it cost?', de: 'Wie viel kostet es?', wrong: ['Wie viele kostet es?', 'Wie kostet viel es?', 'Wie viel kosten es?'] },
    ],
  },
  {
    topic: 'word order',
    subtopic: 'verb-second-and-inversion',
    group: 'grammar',
    level: 'A2',
    items: [
      { en: 'Today I am working at home.', de: 'Heute arbeite ich zu Hause.', wrong: ['Heute ich arbeite zu Hause.', 'Heute arbeite zu Hause ich.', 'Ich heute arbeite zu Hause.'] },
      { en: 'Tomorrow we are going to Berlin.', de: 'Morgen fahren wir nach Berlin.', wrong: ['Morgen wir fahren nach Berlin.', 'Wir fahren morgen nach Berlin gehen.', 'Morgen fahren nach Berlin wir.'] },
      { en: 'In the evening he watches TV.', de: 'Am Abend sieht er fern.', wrong: ['Am Abend er sieht fern.', 'Er am Abend sieht fern.', 'Am Abend sieht fern er.'] },
      { en: 'Because it rains, we stay inside.', de: 'Weil es regnet, bleiben wir drinnen.', wrong: ['Weil es regnet, wir bleiben drinnen.', 'Weil regnet es, bleiben wir drinnen.', 'Weil es regnet bleiben wir drin.'] },
    ],
  },
  {
    topic: 'separable prefixes',
    subtopic: 'trennbare-verben',
    group: 'grammar',
    level: 'A2',
    items: [
      { en: 'I wake up at seven.', de: 'Ich wache um sieben auf.', wrong: ['Ich aufwache um sieben.', 'Ich wache auf um sieben auf.', 'Ich wache um sieben an.'] },
      { en: 'She calls me back.', de: 'Sie ruft mich zurück.', wrong: ['Sie zurückruft mich.', 'Sie ruft zurück mich.', 'Sie ruft mich zurückt.'] },
      { en: 'We shop on Saturday.', de: 'Wir kaufen am Samstag ein.', wrong: ['Wir einkaufen am Samstag.', 'Wir kaufen ein am Samstag ein.', 'Wir kaufen am Samstag an.'] },
      { en: 'The train arrives at noon.', de: 'Der Zug kommt um zwölf an.', wrong: ['Der Zug ankommt um zwölf.', 'Der Zug kommt an um zwölf an.', 'Der Zug kommt um zwölf ein.'] },
    ],
  },
  {
    topic: 'modal verbs',
    subtopic: 'koennen-muessen-duerfen-wollen',
    group: 'grammar',
    level: 'A1',
    items: [
      { en: 'I can swim.', de: 'Ich kann schwimmen.', wrong: ['Ich kann schwimme.', 'Ich kannen schwimmen.', 'Ich konnte schwimmen.'] },
      { en: 'You must work today.', de: 'Du musst heute arbeiten.', wrong: ['Du musst heute arbeitest.', 'Du müssen heute arbeiten.', 'Du musst arbeiten heute bist.'] },
      { en: 'May I come in?', de: 'Darf ich reinkommen?', wrong: ['Darf ich reinkomme?', 'Kann ich reinkommen darf?', 'Darf mich reinkommen?'] },
      { en: 'We want to learn German.', de: 'Wir wollen Deutsch lernen.', wrong: ['Wir wollen lernen Deutsch.', 'Wir will Deutsch lernen.', 'Wir wollen Deutsch zu lernen.'] },
    ],
  },
  {
    topic: 'tenses',
    subtopic: 'praesens-perfekt-praeteritum-futur',
    group: 'grammar',
    level: 'A2',
    items: [
      { en: 'I have finished my homework.', de: 'Ich habe meine Hausaufgaben gemacht.', wrong: ['Ich bin meine Hausaufgaben gemacht.', 'Ich habe meine Hausaufgaben machen.', 'Ich habe gemacht meine Hausaufgaben.'] },
      { en: 'Yesterday he went to school.', de: 'Gestern ging er zur Schule.', wrong: ['Gestern geht er zur Schule.', 'Gestern er ging zur Schule.', 'Gestern ist er zur Schule gehen.'] },
      { en: 'Tomorrow they will travel.', de: 'Morgen werden sie reisen.', wrong: ['Morgen sie werden reisen.', 'Morgen werden sie gereist.', 'Morgen reisen sie werden.'] },
      { en: 'She has lived here for two years.', de: 'Sie wohnt seit zwei Jahren hier.', wrong: ['Sie hat seit zwei Jahren hier gewohnt.', 'Sie wohnt hier seit zwei Jahre.', 'Sie lebtet seit zwei Jahren hier.'] },
    ],
  },
  {
    topic: 'verb-preposition pairs',
    subtopic: 'rektion',
    group: 'grammar',
    level: 'B1',
    items: [
      { en: 'I am waiting for the bus.', de: 'Ich warte auf den Bus.', wrong: ['Ich warte für den Bus.', 'Ich warte an den Bus.', 'Ich warte auf dem Bus.'] },
      { en: 'He is interested in music.', de: 'Er interessiert sich für Musik.', wrong: ['Er interessiert sich an Musik.', 'Er ist interessiert für Musik.', 'Er interessiert ihn für Musik.'] },
      { en: 'We are talking about the exam.', de: 'Wir sprechen über die Prüfung.', wrong: ['Wir sprechen auf die Prüfung.', 'Wir sprechen von die Prüfung.', 'Wir reden über der Prüfung.'] },
      { en: 'She thinks about her future.', de: 'Sie denkt an ihre Zukunft.', wrong: ['Sie denkt über ihre Zukunft.', 'Sie denkt auf ihre Zukunft.', 'Sie denkt an ihrer Zukunft.'] },
    ],
  },
  {
    topic: 'two-way prepositions',
    subtopic: 'wechselpraepositionen',
    group: 'grammar',
    level: 'B1',
    items: [
      { en: 'The book is on the table.', de: 'Das Buch liegt auf dem Tisch.', wrong: ['Das Buch liegt auf den Tisch.', 'Das Buch liegt in dem Tisch.', 'Das Buch liegt auf der Tisch.'] },
      { en: 'I put the book on the table.', de: 'Ich lege das Buch auf den Tisch.', wrong: ['Ich lege das Buch auf dem Tisch.', 'Ich stelle das Buch auf dem Tisch.', 'Ich lege den Buch auf den Tisch.'] },
      { en: 'He is in the kitchen.', de: 'Er ist in der Küche.', wrong: ['Er ist in die Küche.', 'Er ist an der Küche.', 'Er ist im Küche.'] },
      { en: 'She goes into the kitchen.', de: 'Sie geht in die Küche.', wrong: ['Sie geht in der Küche.', 'Sie geht in dem Küche.', 'Sie geht zu die Küche.'] },
    ],
  },
  {
    topic: 'infinitive with zu',
    subtopic: 'zu-infinitiv',
    group: 'grammar',
    level: 'B1',
    items: [
      { en: 'I forgot to call you.', de: 'Ich habe vergessen, dich anzurufen.', wrong: ['Ich habe vergessen, dich zu anrufen.', 'Ich vergesse, dich anzurufen habe.', 'Ich habe vergessen, dich angerufen.'] },
      { en: 'He tries to come on time.', de: 'Er versucht, pünktlich zu kommen.', wrong: ['Er versucht, pünktlich kommen.', 'Er versucht zu kommt pünktlich.', 'Er versucht, pünktlich gekommen.'] },
      { en: 'We plan to travel.', de: 'Wir planen zu reisen.', wrong: ['Wir planen reisen.', 'Wir planen zu reisen wir.', 'Wir planen gereist zu werden.'] },
      { en: 'She has no time to cook.', de: 'Sie hat keine Zeit zu kochen.', wrong: ['Sie hat keine Zeit kochen.', 'Sie hat keine Zeit zum kochen zu.', 'Sie hat kein Zeit zu kochen.'] },
    ],
  },
  {
    topic: 'subordinate clauses',
    subtopic: 'weil-dass-wenn-obwohl',
    group: 'grammar',
    level: 'B1',
    items: [
      { en: 'I stay home because I am sick.', de: 'Ich bleibe zu Hause, weil ich krank bin.', wrong: ['Ich bleibe zu Hause, weil ich bin krank.', 'Weil ich krank bin, ich bleibe zu Hause.', 'Ich bleibe zu Hause weil krank ich bin.'] },
      { en: 'I know that he is right.', de: 'Ich weiß, dass er recht hat.', wrong: ['Ich weiß, dass er hat recht.', 'Ich weiß dass recht er hat.', 'Ich weiß, das er recht hat.'] },
      { en: 'If it is sunny, we go out.', de: 'Wenn es sonnig ist, gehen wir raus.', wrong: ['Wenn es ist sonnig, gehen wir raus.', 'Wenn es sonnig ist, wir gehen raus.', 'Wenn sonnig es ist, gehen wir raus.'] },
      { en: 'Although it is late, she is working.', de: 'Obwohl es spät ist, arbeitet sie.', wrong: ['Obwohl es ist spät, arbeitet sie.', 'Obwohl es spät ist, sie arbeitet.', 'Obwohl spät es ist, arbeitet sie.'] },
    ],
  },
  {
    topic: 'konjunktiv ii',
    subtopic: 'polite-and-hypothetical',
    group: 'grammar',
    level: 'B1',
    items: [
      { en: 'I would like a coffee.', de: 'Ich hätte gern einen Kaffee.', wrong: ['Ich habe gern einen Kaffee.', 'Ich würde gern ein Kaffee.', 'Ich hatte gern einen Kaffee.'] },
      { en: 'Could you help me?', de: 'Könntest du mir helfen?', wrong: ['Kannst du mir helfen könnte?', 'Könntest du mich helfen?', 'Konnte du mir helfen?'] },
      { en: 'If I had time, I would travel.', de: 'Wenn ich Zeit hätte, würde ich reisen.', wrong: ['Wenn ich Zeit habe, würde ich reisen.', 'Wenn ich Zeit hätte, ich würde reisen.', 'Wenn ich Zeit hätte, würde ich gereist.'] },
      { en: 'I would buy a house.', de: 'Ich würde ein Haus kaufen.', wrong: ['Ich wurde ein Haus kaufen.', 'Ich würde ein Haus kaufe.', 'Ich würde kaufen ein Haus.'] },
    ],
  },
  {
    topic: 'comparison forms',
    subtopic: 'komparativ-superlativ',
    group: 'grammar',
    level: 'A2',
    items: [
      { en: 'My car is faster than yours.', de: 'Mein Auto ist schneller als deins.', wrong: ['Mein Auto ist mehr schnell als deins.', 'Mein Auto ist schneller wie deins.', 'Mein Auto ist schnellster als deins.'] },
      { en: 'This task is as easy as that one.', de: 'Diese Aufgabe ist so einfach wie die da.', wrong: ['Diese Aufgabe ist so einfach als die da.', 'Diese Aufgabe ist wie einfach so die da.', 'Diese Aufgabe ist einfacher wie die da.'] },
      { en: 'She is the best in the class.', de: 'Sie ist die Beste in der Klasse.', wrong: ['Sie ist die besser in der Klasse.', 'Sie ist am besten in die Klasse.', 'Sie ist das Beste in der Klasse.'] },
      { en: 'Today is better than yesterday.', de: 'Heute ist besser als gestern.', wrong: ['Heute ist guter als gestern.', 'Heute ist besser wie gestern.', 'Heute besser ist als gestern.'] },
    ],
  },
  {
    topic: 'passive voice',
    subtopic: 'vorgangspassiv',
    group: 'grammar',
    level: 'B1',
    items: [
      { en: 'The letter is written.', de: 'Der Brief wird geschrieben.', wrong: ['Der Brief ist geschrieben wird.', 'Der Brief wird schreiben.', 'Der Brief wurde geschrieben ist.'] },
      { en: 'The house was built in 1990.', de: 'Das Haus wurde 1990 gebaut.', wrong: ['Das Haus ist 1990 gebaut.', 'Das Haus wurde gebaut in 1990 ist.', 'Das Haus wird 1990 gebaut.'] },
      { en: 'The door is being opened.', de: 'Die Tür wird geöffnet.', wrong: ['Die Tür ist geöffnet wird.', 'Die Tür wird öffnen.', 'Die Tür wurde geöffnet.'] },
      { en: 'The problem can be solved.', de: 'Das Problem kann gelöst werden.', wrong: ['Das Problem kann lösen werden.', 'Das Problem wird können gelöst.', 'Das Problem kann gelöst wird.'] },
    ],
  },
  {
    topic: 'reflexive verbs',
    subtopic: 'sich-verben',
    group: 'grammar',
    level: 'A2',
    items: [
      { en: 'I remember your name.', de: 'Ich erinnere mich an deinen Namen.', wrong: ['Ich erinnere an deinen Namen mich.', 'Ich erinnere mich auf deinen Namen.', 'Ich erinnere deinen Namen mich.'] },
      { en: 'He is getting dressed.', de: 'Er zieht sich an.', wrong: ['Er zieht an sich.', 'Er zieht ihm an.', 'Er sich zieht an.'] },
      { en: 'We are meeting at six.', de: 'Wir treffen uns um sechs.', wrong: ['Wir treffen sich um sechs.', 'Wir uns treffen um sechs.', 'Wir treffen uns in sechs.'] },
      { en: 'She is interested in art.', de: 'Sie interessiert sich für Kunst.', wrong: ['Sie interessiert für Kunst sich.', 'Sie interessiert sich an Kunst.', 'Sie sich interessiert für Kunst.'] },
    ],
  },
  {
    topic: 'word formation',
    subtopic: 'prefixes-and-suffixes',
    group: 'grammar',
    level: 'B1',
    items: [
      { en: 'He is a teacher.', de: 'Er ist Lehrer.', wrong: ['Er ist lehren.', 'Er ist Lehr.', 'Er ist die Lehrer.'] },
      { en: 'She is friendly.', de: 'Sie ist freundlich.', wrong: ['Sie ist Freundlichkeit.', 'Sie ist freund.', 'Sie ist freundlichet.'] },
      { en: 'The invitation is ready.', de: 'Die Einladung ist fertig.', wrong: ['Die Einladen ist fertig.', 'Die Einladung ist fertigen.', 'Der Einladung ist fertig.'] },
      { en: 'We need a solution.', de: 'Wir brauchen eine Lösung.', wrong: ['Wir brauchen einen Lösung.', 'Wir brauchen lösen.', 'Wir brauchen eine Losung.'] },
    ],
  },
  {
    topic: 'vocabulary daily life',
    subtopic: 'everyday-phrases',
    group: 'vocabulary',
    level: 'A1',
    items: [
      { en: 'I need bread and milk.', de: 'Ich brauche Brot und Milch.', wrong: ['Ich brauche Brote und Milch.', 'Ich brauchen Brot und Milch.', 'Ich brauche Brot und die Milch.'] },
      { en: 'Where is the nearest pharmacy?', de: 'Wo ist die nächste Apotheke?', wrong: ['Wo ist der nächste Apotheke?', 'Wo ist die näher Apotheke?', 'Wo die nächste Apotheke ist?'] },
      { en: 'I take the bus to work.', de: 'Ich fahre mit dem Bus zur Arbeit.', wrong: ['Ich nehme den Bus zu Arbeit fahre.', 'Ich fahre mit den Bus zur Arbeit.', 'Ich fahre mit dem Bus zu der Arbeit gehen.'] },
      { en: 'Can I pay by card?', de: 'Kann ich mit Karte bezahlen?', wrong: ['Kann ich mit der Karte zu bezahlen?', 'Kann ich bei Karte bezahlen?', 'Kann ich zahlen mit Karte?'] },
    ],
  },
  {
    topic: 'exam phrases',
    subtopic: 'telc-goethe-speaking-writing',
    group: 'vocabulary',
    level: 'B1',
    items: [
      { en: 'Could you repeat the question, please?', de: 'Könnten Sie die Frage bitte wiederholen?', wrong: ['Können Sie die Frage bitte wiederholt?', 'Könnten Sie bitte die Frage wiederholen Sie?', 'Könnten Sie bitte wiederholen die Frage?'] },
      { en: 'I do not understand this task.', de: 'Ich verstehe diese Aufgabe nicht.', wrong: ['Ich nicht verstehe diese Aufgabe.', 'Ich verstehe nicht diese Aufgabe.', 'Ich verstehe diese Aufgabe kein.'] },
      { en: 'In my opinion, this is important.', de: 'Meiner Meinung nach ist das wichtig.', wrong: ['In meiner Meinung ist das wichtig.', 'Meiner Meinung ist nach das wichtig.', 'Nach meiner Meinung das ist wichtig.'] },
      { en: 'Thank you for your attention.', de: 'Vielen Dank für Ihre Aufmerksamkeit.', wrong: ['Danke viel für Ihre Aufmerksamkeit.', 'Vielen Dank zu Ihre Aufmerksamkeit.', 'Vielen Dank für dein Aufmerksamkeit.'] },
    ],
  },
]

const LEVEL_TO_DIFFICULTY: Record<ThemeSeed['level'], 1 | 2 | 3 | 4 | 5> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
}

function rotate<T>(arr: T[], shift: number): T[] {
  const len = arr.length
  const normalized = ((shift % len) + len) % len
  return arr.slice(normalized).concat(arr.slice(0, normalized))
}

function difficultyFor(level: ThemeSeed['level'], variant: number): 1 | 2 | 3 | 4 | 5 {
  const base = LEVEL_TO_DIFFICULTY[level]
  const delta = variant >= 3 ? 1 : 0
  return Math.min(5, base + delta) as 1 | 2 | 3 | 4 | 5
}

const selectionPrompts = [
  'Choose the correct German translation.',
  'Pick the best German sentence.',
  'Select the natural German translation.',
]

const freeTypePrompts = [
  'Type the German translation.',
  'Write this sentence in German.',
]

function buildExercises(): Exercise[] {
  const output: Exercise[] = []

  THEME_SEEDS.forEach((theme) => {
    theme.items.forEach((item, itemIndex) => {
      for (let variant = 0; variant < 5; variant += 1) {
        const id = `de-${theme.topic.replace(/[^a-z0-9]+/gi, '-')}-${itemIndex + 1}-${variant + 1}`
        const difficulty = difficultyFor(theme.level, variant)
        const tags = [
          'translation',
          'en-to-de',
          theme.group,
          theme.level.toLowerCase(),
          theme.topic.replace(/\s+/g, '-').toLowerCase(),
        ]

        if (variant % 2 === 0) {
          const rotated = rotate([item.de, ...item.wrong], variant)
          const answer = rotated.indexOf(item.de)
          output.push({
            id,
            type: 'selection',
            topic: theme.topic,
            subtopic: theme.subtopic,
            language: 'de',
            group: theme.group,
            level: theme.level,
            difficulty,
            prompt: selectionPrompts[variant % selectionPrompts.length],
            context: item.en,
            options: rotated,
            answer,
            explanation: `Correct German translation: ${item.de}`,
            tags,
          })
          continue
        }

        output.push({
          id,
          type: 'free-type',
          topic: theme.topic,
          subtopic: theme.subtopic,
          language: 'de',
          group: theme.group,
          level: theme.level,
          difficulty,
          prompt: freeTypePrompts[variant % freeTypePrompts.length],
          context: item.en,
          answers: [item.de],
          caseSensitive: false,
          explanation: `Correct German translation: ${item.de}`,
          tags,
        })
      }
    })
  })

  return output
}

const exercises: Exercise[] = buildExercises()

export default exercises
