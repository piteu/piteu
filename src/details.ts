import { ACTIVITIES, type Ctx, MOODS, NO_ONE } from './flows';

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
  '💼 Work': {
    text: 'You worked — what did you work on?',
    starters: ['I worked on…', 'I had a meeting about…', 'I finished…', 'It was busy because…'],
    easier: 'Was work busy, calm, or somewhere in between?',
  },
  '📚 Study': {
    text: 'What did you study or learn?',
    starters: ['I studied…', 'I learned that…', 'I struggled with…'],
  },
  '🏃 Exercise': {
    text: 'What exercise did you do, and how did it feel?',
    starters: ['I went to…', 'I did…', 'My body felt…'],
  },
  '🚶 Walk': {
    text: 'You went for a walk — where did you go?',
    starters: ['I walked to…', 'Around…', 'On the way I saw…'],
    easier: 'Did you walk somewhere specific, or just around?',
  },
  '🍳 Cooked': {
    text: 'What did you cook?',
    starters: ['I made…', 'It turned out…', 'I tried…'],
  },
  '🍽️ Ate out': {
    text: 'Where did you eat, and what did you have?',
    starters: ['We went to…', 'I had…', 'The food was…'],
  },
  '🛒 Shopping': {
    text: 'What did you buy, and where?',
    starters: ['I bought…', 'At…', 'I was looking for…'],
  },
  '🧹 Chores': {
    text: 'What did you get done at home?',
    starters: ['I cleaned…', 'I finally…', 'I did the…'],
  },
  '🧾 Errands': {
    text: 'What errands did you run?',
    starters: ['I went to…', 'I sorted out…', 'I picked up…'],
  },
  '👫 Saw friends': {
    text: 'Which friends did you see, and what did you do together?',
    starters: ['I saw…', 'We…', 'We talked about…'],
  },
  '👨‍👩‍👧 Family time': {
    text: 'What did you do with your family?',
    starters: ['We…', 'I spent time with…', 'We talked about…'],
  },
  '📞 Called someone': {
    text: 'Who did you call, and what did you talk about?',
    starters: ['I called…', 'We talked about…', 'They told me…'],
  },
  '❤️ Date': {
    text: 'Where did you go on your date, and what did you do?',
    starters: ['We went to…', 'We…', 'The best part was…'],
  },
  '🩺 Doctor / health': {
    text: 'What was the appointment for? What did they say?',
    starters: ['It was for…', 'They said…', 'The next step is…', 'I need to…'],
    easier: 'Who did you see — a doctor, dentist, someone else?',
  },
  '🎨 Hobby': {
    text: 'What did you do for your hobby?',
    starters: ['I worked on…', 'I made…', 'I practised…'],
  },
  '📖 Read': {
    text: 'What did you read?',
    starters: ['I read…', 'It was about…', 'I liked the part where…'],
  },
  '📺 Watched something': {
    text: 'What did you watch? Was it good?',
    starters: ['I watched…', 'It was about…', 'It was…'],
  },
  '🎮 Games': {
    text: 'What did you play?',
    starters: ['I played…', 'With…', 'I managed to…'],
  },
  '🚌 Travelled': {
    text: 'Where did you go, and why?',
    starters: ['I went to…', 'To visit…', 'The trip was…'],
  },
  '🎉 Went out': {
    text: 'Where did you go, and who with?',
    starters: ['We went to…', 'I went with…', 'The best part was…'],
  },
};

// Most worth asking about first: things that are easy to forget and useful to tell people.
const NOTABLE = new Set([
  '🩺 Doctor / health', '❤️ Date', '🎉 Went out', '🚌 Travelled', '🍽️ Ate out',
  '👨‍👩‍👧 Family time', '👫 Saw friends', '📞 Called someone',
]);
const NO_FOLLOWUP = new Set(['😴 Rested']);
// Covered by the person questions when names were picked.
const COVERED_BY_PEOPLE = new Set(['👫 Saw friends', '📞 Called someone']);

const personQ = (p: string): Q => ({
  text: `You saw or talked to ${p} — what did you talk about, or do together?`,
  starters: ['We talked about…', `${p} told me…`, 'We…', 'I told them…'],
  easier: `Where did you see ${p}, or how did you talk (call, message)?`,
});

const customQ = (a: string): Q => ({
  text: `Tell me about ${a.toLowerCase()} — what happened?`,
  starters: ['I…', 'It was…', 'The best part was…'],
  easier: `Where did you do ${a.toLowerCase()}, and who with?`,
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

const PHRASE: Record<string, string> = {
  '💼 Work': 'Worked', '📚 Study': 'Studied', '🏃 Exercise': 'Exercised', '🚶 Walk': 'Went for a walk',
  '🍳 Cooked': 'Cooked', '🍽️ Ate out': 'Ate out', '🛒 Shopping': 'Went shopping', '🧹 Chores': 'Did chores at home',
  '🧾 Errands': 'Ran errands', '👫 Saw friends': 'Saw friends', '👨‍👩‍👧 Family time': 'Spent time with family',
  '📞 Called someone': 'Called someone', '❤️ Date': 'Went on a date', '🩺 Doctor / health': 'Had a health appointment',
  '🎨 Hobby': 'Did my hobby', '📖 Read': 'Read', '📺 Watched something': 'Watched something', '🎮 Games': 'Played games',
  '🚌 Travelled': 'Travelled', '🎉 Went out': 'Went out', '😴 Rested': 'Rested',
};

export interface DayFacts {
  ts?: number;
  activities: string[];
  people: string[];
  details: { item: string; text: string }[];
  mood?: number;
}

const oneLine = (s: string) => s.trim().replace(/\s*\n+\s*/g, ' ');
const joinNames = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** A few plain sentences about the day — something you can read out or send to someone. */
export function daySummary(f: DayFacts): string {
  const detail = (item: string) => f.details.filter((d) => d.item === item).map((d) => oneLine(d.text)).join(' ');
  const lines: string[] = [];
  for (const a of f.activities) {
    const phrase = PHRASE[a] ?? a.charAt(0).toUpperCase() + a.slice(1);
    const d = detail(a);
    lines.push(`• ${phrase}${d ? `: ${d}` : ''}`);
  }
  const people = f.people.filter((p) => p !== NO_ONE);
  const withDetail = people.filter((p) => detail(p));
  const without = people.filter((p) => !detail(p));
  for (const p of withDetail) lines.push(`• Saw or talked to ${p}: ${detail(p)}`);
  if (without.length) lines.push(`• ${withDetail.length ? 'Also saw' : 'Saw'} or talked to ${joinNames(without)}`);
  if (!lines.length) return '';

  const head = f.ts
    ? `What I did on ${new Date(f.ts).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}:`
    : 'What I did:';
  const mood = f.mood ? MOODS[Math.min(4, Math.max(0, Math.round(f.mood) - 1))] : undefined;
  const article = mood && /^[aeiou]/i.test(mood.label) ? 'an' : 'a';
  return [head, ...lines, ...(mood ? [`Overall it was ${article} ${mood.label.toLowerCase()} day ${mood.face}`] : [])].join('\n');
}
