import { ACTIVITIES, type Ctx, MOODS, NO_ONE } from './flows';
import { LOCALE } from './locale';

// ---------------------------------------------------------------------------
// Follow-up questions about the specific things you did, and turning your
// answers into a few plain sentences you can use to tell someone about your day.
// ---------------------------------------------------------------------------

export interface Followup {
  item: string; // the activity or person it's about
  text: string;
  starters: string[];
  easier?: string;
}

type Q = Omit<Followup, 'item'>;

const BANK: Record<string, Q> = {
  '💼 Trabalho': {
    text: 'Trabalhaste — em que é que trabalhaste?',
    starters: ['Trabalhei em…', 'Tive uma reunião sobre…', 'Terminei…', 'Foi um dia cheio porque…'],
    easier: 'O trabalho foi agitado, calmo, ou algures no meio?',
  },
  '📚 Estudo': {
    text: 'O que estudaste ou aprendeste?',
    starters: ['Estudei…', 'Aprendi que…', 'Tive dificuldade com…'],
  },
  '🏃 Exercício': {
    text: 'Que exercício fizeste, e como te sentiste?',
    starters: ['Fui a…', 'Fiz…', 'O corpo sentiu-se…'],
  },
  '🚶 Caminhada': {
    text: 'Foste dar uma caminhada — por onde foste?',
    starters: ['Caminhei até…', 'Andei por…', 'Pelo caminho vi…'],
    easier: 'Foste a algum sítio em especial, ou só dar uma volta?',
  },
  '🍳 Cozinhei': {
    text: 'O que cozinhaste?',
    starters: ['Fiz…', 'Ficou…', 'Experimentei…'],
  },
  '🍽️ Comi fora': {
    text: 'Onde comeste, e o que comeste?',
    starters: ['Fomos a…', 'Comi…', 'A comida estava…'],
  },
  '🛒 Compras': {
    text: 'O que compraste, e onde?',
    starters: ['Comprei…', 'Em…', 'Andava à procura de…'],
  },
  '🧹 Tarefas de casa': {
    text: 'O que conseguiste fazer em casa?',
    starters: ['Limpei…', 'Finalmente…', 'Tratei da…'],
  },
  '🧾 Recados': {
    text: 'Que recados trataste?',
    starters: ['Fui a…', 'Resolvi…', 'Fui buscar…'],
  },
  '👫 Estive com amigos': {
    text: 'Com que amigos estiveste, e o que fizeram juntos?',
    starters: ['Estive com…', 'Fomos…', 'Falámos sobre…'],
  },
  '👨‍👩‍👧 Família': {
    text: 'O que fizeste com a tua família?',
    starters: ['Fomos…', 'Passei tempo com…', 'Falámos sobre…'],
  },
  '📞 Liguei a alguém': {
    text: 'A quem ligaste, e de que falaram?',
    starters: ['Liguei a…', 'Falámos sobre…', 'Contou-me que…'],
  },
  '❤️ Encontro': {
    text: 'Onde foi o encontro, e o que fizeram?',
    starters: ['Fomos a…', 'Nós…', 'O melhor foi…'],
  },
  '🩺 Médico / saúde': {
    text: 'Era uma consulta de quê? O que te disseram?',
    starters: ['Era por causa de…', 'Disseram-me que…', 'O próximo passo é…', 'Tenho de…'],
    easier: 'Com quem foi — médico, dentista, outra pessoa?',
  },
  '🎨 Hobby': {
    text: 'O que fizeste no teu hobby?',
    starters: ['Trabalhei em…', 'Fiz…', 'Pratiquei…'],
  },
  '📖 Li': {
    text: 'O que leste?',
    starters: ['Li…', 'Era sobre…', 'Gostei da parte em que…'],
  },
  '📺 Série / filme': {
    text: 'O que viste? Era bom?',
    starters: ['Vi…', 'Era sobre…', 'Achei…'],
  },
  '🎮 Jogos': {
    text: 'A que jogaste?',
    starters: ['Joguei…', 'Com…', 'Consegui…'],
  },
  '🚌 Viagem': {
    text: 'Para onde foste, e porquê?',
    starters: ['Fui a…', 'Para visitar…', 'A viagem foi…'],
  },
  '🎉 Saí': {
    text: 'Onde foste, e com quem?',
    starters: ['Fomos a…', 'Fui com…', 'O melhor foi…'],
  },
};

// Most worth asking about first: things that are easy to forget and useful to tell people.
const NOTABLE = new Set([
  '🩺 Médico / saúde', '❤️ Encontro', '🎉 Saí', '🚌 Viagem', '🍽️ Comi fora',
  '👨‍👩‍👧 Família', '👫 Estive com amigos', '📞 Liguei a alguém',
]);
const NO_FOLLOWUP = new Set(['😴 Descansei']);
// Covered by the person questions when names were picked.
const COVERED_BY_PEOPLE = new Set(['👫 Estive com amigos', '📞 Liguei a alguém']);

const personQ = (p: string): Q => ({
  text: `Estiveste ou falaste com ${p} — de que falaram, ou o que fizeram juntos?`,
  starters: ['Falámos sobre…', `${p} contou-me…`, 'Fomos…', 'Contei-lhe…'],
  easier: `Onde estiveste com ${p}, ou como falaram (chamada, mensagem)?`,
});

const customQ = (a: string): Q => ({
  text: `Fala-me de “${a}” — como foi?`,
  starters: ['Eu…', 'Foi…', 'O melhor foi…'],
  easier: `Onde foi, e com quem?`,
});

/** Pick the most useful follow-up questions for what you tapped. */
export function followupsFor(c: Ctx, max: number): Followup[] {
  const acts = (Array.isArray(c.answers.activities) ? c.answers.activities : []) as string[];
  const people = ((Array.isArray(c.answers.people) ? c.answers.people : []) as string[]).filter((p) => p !== NO_ONE);

  const custom = acts.filter((a) => !ACTIVITIES.includes(a));
  const notable = acts.filter((a) => NOTABLE.has(a) && !(people.length && COVERED_BY_PEOPLE.has(a)));
  const rest = acts.filter((a) => ACTIVITIES.includes(a) && !NOTABLE.has(a) && !NO_FOLLOWUP.has(a));

  const ordered: Followup[] = [
    ...notable.map((a) => ({ item: a, ...BANK[a] })),
    ...custom.map((a) => ({ item: a, ...customQ(a) })),
    ...people.map((p) => ({ item: p, ...personQ(p) })),
    ...rest.map((a) => ({ item: a, ...BANK[a] })),
  ];
  return ordered.slice(0, max);
}

// ---------- "Tell someone about my day" ----------

export const PHRASE: Record<string, string> = {
  '💼 Trabalho': 'Trabalhei', '📚 Estudo': 'Estudei', '🏃 Exercício': 'Fiz exercício', '🚶 Caminhada': 'Fui dar uma caminhada',
  '🍳 Cozinhei': 'Cozinhei', '🍽️ Comi fora': 'Comi fora', '🛒 Compras': 'Fui às compras', '🧹 Tarefas de casa': 'Fiz tarefas de casa',
  '🧾 Recados': 'Tratei de recados', '👫 Estive com amigos': 'Estive com amigos', '👨‍👩‍👧 Família': 'Estive com a família',
  '📞 Liguei a alguém': 'Liguei a alguém', '❤️ Encontro': 'Tive um encontro', '🩺 Médico / saúde': 'Tive uma consulta',
  '🎨 Hobby': 'Dediquei-me ao meu hobby', '📖 Li': 'Li', '📺 Série / filme': 'Vi uma série ou um filme', '🎮 Jogos': 'Joguei',
  '🚌 Viagem': 'Viajei', '🎉 Saí': 'Saí', '😴 Descansei': 'Descansei',
};

export interface DayFacts {
  ts?: number;
  activities: string[];
  people: string[];
  details: { item: string; text: string }[];
  mood?: number;
}

export const oneLine = (s: string) => s.trim().replace(/\s*\n+\s*/g, ' ');
export const joinNames = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`);
export const stripEmoji = (s: string) => s.replace(/^[\p{Extended_Pictographic}‍️\s]+/u, '');

/** A few plain sentences about the day — something you can read out or send to someone. */
export function daySummary(f: DayFacts): string {
  const detail = (item: string) => f.details.filter((d) => d.item === item).map((d) => oneLine(d.text)).join(' ');
  const lines: string[] = [];
  for (const a of f.activities) {
    const phrase = PHRASE[a] ?? stripEmoji(a);
    const d = detail(a);
    lines.push(`• ${phrase}${d ? `: ${d}` : ''}`);
  }
  const people = f.people.filter((p) => p !== NO_ONE);
  const withDetail = people.filter((p) => detail(p));
  const without = people.filter((p) => !detail(p));
  for (const p of withDetail) lines.push(`• Estive ou falei com ${p}: ${detail(p)}`);
  if (without.length) lines.push(`• ${withDetail.length ? 'Também estive' : 'Estive'} ou falei com ${joinNames(without)}`);
  if (!lines.length) return '';

  const date = f.ts ? new Date(f.ts).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  const head = date ? `${date.charAt(0).toUpperCase() + date.slice(1)} — o que fiz:` : 'O que fiz:';
  const mood = f.mood ? MOODS[Math.min(4, Math.max(0, Math.round(f.mood) - 1))] : undefined;
  return [head, ...lines, ...(mood ? [`No geral, foi um dia ${mood.day} ${mood.face}`] : [])].join('\n');
}
