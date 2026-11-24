import type { Mood } from './types';

// ---------------------------------------------------------------------------
// The guided conversations.
//
// Principles, for people who find writing hard:
//  1. Tap before you type: mood + feeling words first, so something is
//     captured even if you write nothing.
//  2. Small, concrete questions ("what happened just before?") instead of big
//     abstract ones ("how was your day?").
//  3. Sentence starters you can tap and finish.
//  4. "Ask me differently" gives an easier version of any question.
//  5. Every question can be skipped. One short gentle nudge per session at most.
//  6. Naming feelings, noticing what went well and why, and talking to yourself
//     like a friend are well-studied, helpful journaling habits; the flows lean
//     on those.
// ---------------------------------------------------------------------------

export type Answers = Record<string, string | string[] | number | undefined>;
export interface Ctx {
  answers: Answers;
  name?: string;
  /** Activities and people from your past entries, most used first. */
  known?: { activities: string[]; people: string[] };
}
type T = string | ((c: Ctx) => string);
type L = string[] | ((c: Ctx) => string[]);
type When = (c: Ctx) => boolean;

export type Step =
  | { kind: 'say'; text: T; when?: When }
  | { kind: 'mood'; id: string; text: T; when?: When }
  | { kind: 'choice'; id: string; text: T; options: L; multi?: boolean; other?: string; when?: When }
  | { kind: 'write'; id: string; text: T; starters?: L; easier?: T; nudge?: T; when?: When }
  /** Specific questions about the activities and people you just tapped (see details.ts). */
  | { kind: 'followups'; max: number; when?: When };

export interface Flow {
  id: string;
  title: string;
  /** Name on the small tiles of the main page. */
  short: string;
  icon: string;
  blurb: string;
  minutes: number;
  steps: Step[];
}

export const MOODS: { value: Mood; face: string; label: string; day: string; week: string }[] = [
  { value: 1, face: '😣', label: 'Péssimo', day: 'péssimo', week: 'péssima' },
  { value: 2, face: '😕', label: 'Em baixo', day: 'difícil', week: 'difícil' },
  { value: 3, face: '😐', label: 'Mais ou menos', day: 'mais ou menos', week: 'mais ou menos' },
  { value: 4, face: '🙂', label: 'Bem', day: 'bom', week: 'boa' },
  { value: 5, face: '😄', label: 'Ótimo', day: 'ótimo', week: 'ótima' },
];

export const moodOf = (c: Ctx) => (c.answers.mood as Mood | undefined) ?? 3;
const low = (c: Ctx) => moodOf(c) <= 2;
const high = (c: Ctx) => moodOf(c) >= 4;
const mid = (c: Ctx) => moodOf(c) === 3;
const first = (c: Ctx, id: string) => {
  const v = c.answers[id];
  return Array.isArray(v) && v.length ? v[0].toLowerCase() : undefined;
};
const comma = (c: Ctx) => (c.name ? `, ${c.name}` : '');

// Feelings are nouns ("Ansiedade", not "Ansioso/a"), so nothing depends on gender.
export const LOW_FEELINGS = [
  'Stress', 'Ansiedade', 'Tristeza', 'Cansaço', 'Frustração', 'Sobrecarga',
  'Solidão', 'Raiva', 'Mágoa', 'Preocupação', 'Desilusão', 'Vazio',
];
export const MID_FEELINGS = ['Normal', 'Cansaço', 'Calma', 'Tédio', 'Inquietação', 'Distração', 'Dúvida', 'Assim-assim'];
export const HIGH_FEELINGS = [
  'Alegria', 'Calma', 'Gratidão', 'Orgulho', 'Entusiasmo', 'Descontração',
  'Carinho', 'Esperança', 'Energia', 'Satisfação',
];
export const NOT_SURE = 'Não sei';
export const TOPICS = [
  'Trabalho', 'Estudos', 'Família', 'Amigos', 'Relação', 'Saúde',
  'Sono', 'Dinheiro', 'Casa', 'Eu', 'Notícias', NOT_SURE,
];

// Emoji make these quicker to recognise at a glance.
export const ACTIVITIES = [
  '💼 Trabalho', '📚 Estudo', '🏃 Exercício', '🚶 Caminhada', '🍳 Cozinhei', '🍽️ Comi fora', '🛒 Compras',
  '🧹 Tarefas de casa', '🧾 Recados', '👫 Estive com amigos', '👨‍👩‍👧 Família', '📞 Liguei a alguém', '❤️ Encontro',
  '🩺 Médico / saúde', '🎨 Hobby', '📖 Li', '📺 Série / filme', '🎮 Jogos', '🚌 Viagem',
  '🎉 Saí', '😴 Descansei',
];
export const NO_ONE = 'Ninguém';

/** Answers to "Which day is this about?" */
export const DAY = { today: 'Hoje', yesterday: 'Ontem', before: 'Anteontem' } as const;

/** Your own activities first (most used), then the rest of the defaults. */
export const activityOptions = (c: Ctx) => [...new Set([...(c.known?.activities ?? []), ...ACTIVITIES])];
export const peopleOptions = (c: Ctx) => [...(c.known?.people ?? []).slice(0, 15), NO_ONE];

const dayWord = (c: Ctx) => {
  const d = c.answers.day;
  return d === DAY.yesterday ? 'ontem' : d === DAY.before ? 'nesse dia' : 'hoje';
};

const activitySteps: Step[] = [
  {
    kind: 'choice', id: 'activities', multi: true, other: 'Acrescentar outra coisa',
    text: (c) => `O que fizeste ${dayWord(c)}? Toca em tudo o que se aplica.`,
    options: activityOptions,
  },
  {
    kind: 'choice', id: 'people', multi: true, other: 'Acrescentar um nome',
    text: (c) =>
      c.known?.people.length
        ? 'Com quem estiveste ou falaste?'
        : 'Com quem estiveste ou falaste? Acrescenta os nomes — da próxima vez já cá estão para tocar.',
    options: peopleOptions,
  },
];

const feelingsFor = (c: Ctx) => (low(c) ? LOW_FEELINGS : high(c) ? HIGH_FEELINGS : MID_FEELINGS);

// ---------------------------------------------------------------------------

const quick: Flow = {
  id: 'quick',
  short: 'Rápido',
  title: 'Check-in rápido',
  icon: '⚡',
  blurb: 'Quase só tocar. Bom para qualquer altura.',
  minutes: 1,
  steps: [
    { kind: 'mood', id: 'mood', text: 'Como te estás a sentir agora?' },
    { kind: 'choice', id: 'feelings', multi: true, text: 'Que palavras descrevem melhor o que sentes? Escolhe as que quiseres.', options: feelingsFor },
    { kind: 'choice', id: 'topics', multi: true, text: 'Tem mais a ver com quê?', options: TOPICS },

    // Low mood: understand it, then one small helpful step.
    {
      kind: 'write', id: 'what', when: low,
      text: (c) => (first(c, 'feelings') ? `O que aconteceu para sentires ${first(c, 'feelings')}?` : 'O que te tem pesado?'),
      starters: ['Começou quando…', 'Não paro de pensar em…', 'O mais difícil é…'],
      easier: 'Se tivesses de resumir numa frase, o que dirias?',
      nudge: 'Consegues dizer um pouco mais? O que aconteceu, ou o que te passou pela cabeça?',
    },
    {
      kind: 'write', id: 'help', when: low,
      text: 'Qual é uma pequena coisa que podia ajudar, nem que seja um bocadinho?',
      starters: ['Podia…', 'Ajudava falar com…', 'Hoje à noite vou…'],
      easier: 'O que é que costuma fazer-te sentir nem que seja 1% melhor?',
    },

    // Okay mood
    {
      kind: 'write', id: 'what', when: mid,
      text: 'O que te tem andado na cabeça hoje?',
      starters: ['Tenho pensado sobretudo em…', 'Hoje…', 'Reparei que…'],
      easier: 'Diz-me uma coisa que fizeste hoje.',
      nudge: 'E como te sentiste com isso?',
    },
    {
      kind: 'write', id: 'next', when: mid,
      text: 'Há alguma coisa para breve de que estejas à espera com vontade?',
      starters: ['Mal posso esperar por…', 'Em breve quero…', 'Nem por isso, mas…'],
    },

    // Good mood: savour it, and notice your part in it.
    {
      kind: 'write', id: 'what', when: high,
      text: (c) => (first(c, 'feelings') ? `Que bom! O que te fez sentir ${first(c, 'feelings')}?` : 'Que bom! O que fez disto um bom momento?'),
      starters: ['Foi quando…', 'Fico feliz por…', 'O melhor foi…'],
      easier: 'Qual é um bom momento de que te queres lembrar?',
      nudge: 'Conta-me um pouco mais — onde estavas, quem estava contigo?',
    },
    {
      kind: 'write', id: 'agency', when: high,
      text: 'Fizeste alguma coisa que ajudou a que isso acontecesse?',
      starters: ['Decidi…', 'Arranjei tempo para…', 'Falei com…'],
    },

    {
      kind: 'say',
      text: (c) =>
        low(c)
          ? `Obrigada por escreveres isto${comma(c)}. Falar com sinceridade sobre um dia difícil não é fácil. Trata-te com carinho.`
          : high(c)
            ? 'Adoro. Ficou guardado — para recordares num dia mais difícil.'
            : 'Obrigada pelo check-in. O dia de hoje ficou guardado.',
    },
    {
      kind: 'say',
      when: (c) => moodOf(c) === 1,
      text: 'Se as coisas estiverem mesmo pesadas, falar com alguém de confiança pode ajudar. Tens linhas de apoio nas Definições, a qualquer hora.',
    },
  ],
};

const evening: Flow = {
  id: 'evening',
  short: 'Fim do dia',
  title: 'Fim do dia',
  icon: '🌙',
  blurb: 'Fecha o dia com algumas perguntas curtas.',
  minutes: 3,
  steps: [
    { kind: 'mood', id: 'mood', text: 'No geral, como foi o dia?' },
    ...activitySteps,
    { kind: 'followups', max: 2 },
    {
      kind: 'write', id: 'title',
      text: 'Se o dia de hoje tivesse um título, qual seria?',
      starters: ['O dia em que…', 'Mais um dia de…', 'Finalmente…'],
      easier: 'Escolhe uma palavra para o dia de hoje.',
    },
    {
      kind: 'write', id: 'good',
      text: 'Qual é uma coisa que correu bem hoje? Pequenas coisas também contam.',
      starters: ['Gostei de…', 'Foi bom quando…', 'Consegui…'],
      easier: 'Houve algum momento, mesmo curto, em que te sentiste bem?',
      nudge: 'O que o tornou bom?',
    },
    {
      kind: 'write', id: 'why',
      text: 'Porque achas que correu bem?',
      starters: ['Porque eu…', 'Porque alguém…', 'Ajudou o facto de…'],
    },
    { kind: 'choice', id: 'hard', text: 'Houve algum momento difícil hoje?', options: ['Sim', 'Nem por isso'] },
    {
      kind: 'write', id: 'hardWhat', when: (c) => c.answers.hard === 'Sim',
      text: 'O que aconteceu?',
      starters: ['Foi quando…', 'Senti… porque…', 'Alguém…'],
      easier: 'Onde estavas quando aconteceu, e quem estava contigo?',
      nudge: 'Como te fez sentir?',
    },
    {
      kind: 'write', id: 'hardHow', when: (c) => c.answers.hard === 'Sim',
      text: 'Como lidaste com isso — ou como gostavas de lidar da próxima vez?',
      starters: ['Lidei com isso…', 'Da próxima vez…', 'Gostava de ter…'],
    },
    {
      kind: 'write', id: 'tomorrow',
      text: 'O que gostavas de fazer amanhã?',
      starters: ['Amanhã quero…', 'Vou arranjar tempo para…', 'Preciso de…'],
    },
    { kind: 'say', text: (c) => `O dia de hoje está fechado. Dorme bem${comma(c)}.` },
  ],
};

const mind: Flow = {
  id: 'mind',
  short: 'Na cabeça',
  title: 'Tenho uma coisa na cabeça',
  icon: '💭',
  blurb: 'Desenrolar uma preocupação ou algo que te chateou.',
  minutes: 4,
  steps: [
    {
      kind: 'write', id: 'what',
      text: 'O que tens na cabeça? Bastam umas palavras.',
      starters: ['Preocupa-me…', 'Não consigo parar de pensar em…', 'O que me chateia é…'],
      easier: 'É sobre quem, ou sobre o quê?',
      nudge: 'Qual é a parte que te incomoda mais?',
    },
    { kind: 'choice', id: 'feelings', multi: true, text: 'Que sentimentos vêm com isso?', options: LOW_FEELINGS },
    { kind: 'choice', id: 'before', text: 'Quão forte é agora?', options: ['Um pouco', 'Bastante', 'Muito forte'] },
    {
      kind: 'write', id: 'fear',
      text: 'Qual é o pior que tens medo que aconteça?',
      starters: ['Tenho medo que…', 'E se…'],
      easier: 'O que esperas que não aconteça?',
    },
    {
      kind: 'write', id: 'likely',
      text: 'E, sendo realista, o que é mais provável que aconteça?',
      starters: ['Provavelmente…', 'O mais certo é…', 'Sinceramente não sei, mas…'],
    },
    {
      kind: 'write', id: 'friend',
      text: 'Se um amigo próximo te contasse isto, o que lhe dirias?',
      starters: ['Dizia-lhe…', 'Lembrava-lhe que…', 'Dizia que faz sentido porque…'],
      easier: 'O que diria agora alguém que gosta de ti?',
    },
    { kind: 'choice', id: 'control', text: 'Podes fazer alguma coisa em relação a isto?', options: ['Sim', 'Um pouco', 'Nem por isso'] },
    {
      kind: 'write', id: 'step', when: (c) => c.answers.control === 'Sim' || c.answers.control === 'Um pouco',
      text: 'Qual é um primeiro passo pequeno?',
      starters: ['Primeiro, podia…', 'Vou perguntar a…', 'Hoje posso…'],
    },
    {
      kind: 'write', id: 'letgo', when: (c) => c.answers.control === 'Nem por isso',
      text: 'O que te ajudaria a pôr isto de lado por agora?',
      starters: ['Podia…', 'Talvez ajude…', 'Por agora vou…'],
      easier: 'Que coisa calma podias fazer na próxima hora?',
    },
    { kind: 'choice', id: 'after', text: 'E agora, quão forte é o sentimento?', options: ['Mais leve', 'Igual', 'Mais forte'] },
    {
      kind: 'say',
      text: (c) =>
        c.answers.after === 'Mais leve'
          ? 'Ainda bem. Tirar as coisas da cabeça e pô-las por escrito costuma ajudar.'
          : c.answers.after === 'Mais forte'
            ? 'Não faz mal — às vezes olhar de perto para uma coisa agita-a antes de assentar. Trata-te com cuidado, e pensa em falar com alguém de confiança. Tens linhas de apoio nas Definições.'
            : 'Obrigada por teres pensado nisto. Mesmo que ainda não pareça diferente, agora está escrito — não tens de guardar tudo na cabeça.',
    },
  ],
};

const gratitude: Flow = {
  id: 'gratitude',
  short: '3 coisas boas',
  title: 'Três coisas boas',
  icon: '🌱',
  blurb: 'Três coisas rápidas que te deixaram contente.',
  minutes: 1,
  steps: [
    {
      kind: 'write', id: 'g1',
      text: 'Diz uma coisa que te deixou contente hoje. Tudo conta — um café, uma música, uma pessoa.',
      starters: ['Fico contente por…', 'Gostei de…', 'Sinto gratidão por…'],
      easier: 'Que coisa pequena te faria falta se desaparecesse?',
    },
    { kind: 'write', id: 'g2', text: 'E uma segunda?', starters: ['Também…', 'Alguém que…', 'Gostei de…'] },
    { kind: 'write', id: 'g3', text: 'Mais uma?', starters: ['E…', 'Uma coisa sobre mim:', 'Uma coisa que vi:'] },
    { kind: 'say', text: 'Três coisas boas, guardadas. Nos dias difíceis ajuda voltar a listas como esta.' },
  ],
};

// Prompts for "Just write" — one is picked per day so it feels fresh.
export const PROMPTS = [
  'Se o dia de hoje tivesse um título, qual seria?',
  'O que te tirou energia hoje? E o que te deu energia?',
  'Descreve um pequeno momento de hoje: o que viste, ouviste ou cheiraste?',
  'Quem fez a diferença na tua semana, e como?',
  'O que tens andado a adiar? O que torna isso difícil?',
  'De que te orgulhas, mesmo que ninguém tenha reparado?',
  'Do que precisas mais neste momento? E de menos?',
  'O que faria de amanhã um bom dia?',
  'O que dirias a quem eras há um ano?',
  'O que te preocupa — e qual é a probabilidade real disso?',
  'Escreve sobre um sítio onde te sentes à vontade.',
  'O que aprendeste recentemente?',
  'O que te fez rir ou sorrir ultimamente?',
  'Que conversa não te sai da cabeça? O que dirias agora?',
  'Do que estás à espera com vontade?',
  'O que tem ocupado mais os teus pensamentos esta semana?',
];

export function promptOfTheDay(d = new Date()): string {
  const day = Math.floor(d.getTime() / 86_400_000);
  return PROMPTS[day % PROMPTS.length];
}

const free: Flow = {
  id: 'free',
  short: 'Escrever',
  title: 'Só escrever',
  icon: '✍️',
  blurb: 'Escreve o que quiseres, com uma pergunta se te apetecer.',
  minutes: 2,
  steps: [
    {
      kind: 'write', id: 'text',
      text: () => `Escreve o que te estiver na cabeça. Ou experimenta a pergunta de hoje: “${promptOfTheDay()}”`,
      starters: ['Agora mesmo…', 'Hoje…', 'Tenho pensado em…'],
      easier: () => PROMPTS[(PROMPTS.indexOf(promptOfTheDay()) + 1) % PROMPTS.length],
      nudge: 'Queres acrescentar um pouco mais? Como te fez sentir?',
    },
    {
      kind: 'write', id: 'more',
      text: 'Mais alguma coisa que queiras acrescentar?',
      starters: ['Também…', 'Só mais uma coisa…'],
    },
    { kind: 'say', text: 'Guardado.' },
  ],
};

const log: Flow = {
  id: 'log',
  short: 'O que fiz',
  title: 'O que fiz',
  icon: '📝',
  blurb: 'Toca no que fizeste e com quem estiveste, para poderes consultar mais tarde.',
  minutes: 1,
  steps: [
    { kind: 'choice', id: 'day', text: 'Este registo é sobre que dia?', options: [DAY.today, DAY.yesterday, DAY.before], when: (c) => !c.answers.day },
    ...activitySteps,
    { kind: 'followups', max: 3 },
    {
      kind: 'write', id: 'details',
      when: (c) => !c.answers.followups, // only if there were no specific questions
      text: 'Há alguma coisa de que te queiras lembrar? O que comeste, de que falaste, algo engraçado…',
      starters: ['Quero lembrar-me de…', 'Falámos sobre…', 'O mais engraçado foi…', 'Comi…'],
      easier: (c) => `Vamos por partes. Qual é a primeira coisa de que te lembras de ter feito ${dayWord(c)}?`,
      nudge: 'Onde estavas, e o que aconteceu a seguir?',
    },
    { kind: 'say', text: 'Guardado. Podes encontrar isto mais tarde em Memória — por exemplo em “Quando foi a última vez…”.' },
  ],
};

export const FLOWS: Flow[] = [quick, log, evening, mind, gratitude, free];
export const flowById = (id: string) => FLOWS.find((f) => f.id === id) ?? quick;

/** Suggest a flow based on time of day. */
export function suggestedFlowId(d = new Date()): string {
  const h = d.getHours();
  return h >= 19 || h < 3 ? 'evening' : 'quick';
}
