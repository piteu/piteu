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
  blurb: string;
  minutes: number;
  steps: Step[];
}

export const MOODS: { value: Mood; face: string; label: string }[] = [
  { value: 1, face: '😣', label: 'Awful' },
  { value: 2, face: '😕', label: 'Low' },
  { value: 3, face: '😐', label: 'Okay' },
  { value: 4, face: '🙂', label: 'Good' },
  { value: 5, face: '😄', label: 'Great' },
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

export const LOW_FEELINGS = [
  'Stressed', 'Anxious', 'Sad', 'Tired', 'Frustrated', 'Overwhelmed',
  'Lonely', 'Angry', 'Hurt', 'Worried', 'Disappointed', 'Numb',
];
export const MID_FEELINGS = ['Fine', 'Tired', 'Calm', 'Bored', 'Restless', 'Distracted', 'Unsure', 'Meh'];
export const HIGH_FEELINGS = [
  'Happy', 'Calm', 'Grateful', 'Proud', 'Excited', 'Relaxed',
  'Loved', 'Hopeful', 'Energised', 'Content',
];
export const TOPICS = [
  'Work', 'Study', 'Family', 'Friends', 'Partner', 'Health',
  'Sleep', 'Money', 'Home', 'Myself', 'The news', 'Not sure',
];

// Emoji make these quicker to recognise at a glance.
export const ACTIVITIES = [
  '💼 Work', '📚 Study', '🏃 Exercise', '🚶 Walk', '🍳 Cooked', '🍽️ Ate out', '🛒 Shopping',
  '🧹 Chores', '🧾 Errands', '👫 Saw friends', '👨‍👩‍👧 Family time', '📞 Called someone', '❤️ Date',
  '🩺 Doctor / health', '🎨 Hobby', '📖 Read', '📺 Watched something', '🎮 Games', '🚌 Travelled',
  '🎉 Went out', '😴 Rested',
];
export const NO_ONE = 'No one';

/** Your own activities first (most used), then the rest of the defaults. */
export const activityOptions = (c: Ctx) => [...new Set([...(c.known?.activities ?? []), ...ACTIVITIES])];
export const peopleOptions = (c: Ctx) => [...(c.known?.people ?? []).slice(0, 15), NO_ONE];

const dayWord = (c: Ctx) => {
  const d = c.answers.day;
  return d === 'Yesterday' ? 'yesterday' : d === '2 days ago' ? 'that day' : 'today';
};

const activitySteps: Step[] = [
  {
    kind: 'choice', id: 'activities', multi: true, other: 'Add something else',
    text: (c) => `What did you do ${dayWord(c)}? Tap everything that fits.`,
    options: activityOptions,
  },
  {
    kind: 'choice', id: 'people', multi: true, other: 'Add a name',
    text: (c) => (c.known?.people.length ? `Who did you see or talk to?` : 'Who did you see or talk to? Add their names — next time they’ll be here to tap.'),
    options: peopleOptions,
  },
];

const feelingsFor = (c: Ctx) => (low(c) ? LOW_FEELINGS : high(c) ? HIGH_FEELINGS : MID_FEELINGS);

// ---------------------------------------------------------------------------

const quick: Flow = {
  id: 'quick',
  title: 'Quick check-in',
  blurb: 'Mostly tapping. Good for any time.',
  minutes: 1,
  steps: [
    { kind: 'mood', id: 'mood', text: 'How are you feeling right now?' },
    { kind: 'choice', id: 'feelings', multi: true, text: 'Which words fit best? Pick as many as you like.', options: feelingsFor },
    { kind: 'choice', id: 'topics', multi: true, text: "What's it mostly about?", options: TOPICS },

    // Low mood: understand it, then one small helpful step.
    {
      kind: 'write', id: 'what', when: low,
      text: (c) => (first(c, 'feelings') ? `What happened that left you feeling ${first(c, 'feelings')}?` : "What's been weighing on you?"),
      starters: ['It started when…', 'I keep thinking about…', 'The hardest part is…'],
      easier: 'If you had to sum it up in one sentence, what would it be?',
      nudge: 'Can you say a little more? What happened, or what went through your head?',
    },
    {
      kind: 'write', id: 'help', when: low,
      text: "What's one small thing that could help, even a little?",
      starters: ['I could…', 'It would help to talk to…', 'Tonight I’ll…'],
      easier: 'What usually makes you feel even 1% better?',
    },

    // Okay mood
    {
      kind: 'write', id: 'what', when: mid,
      text: "What's been on your mind today?",
      starters: ['Mostly I’ve been thinking about…', 'Today I…', 'I noticed that…'],
      easier: "What's one thing you did today?",
      nudge: 'How did that feel?',
    },
    {
      kind: 'write', id: 'next', when: mid,
      text: 'Anything coming up that you’re looking forward to?',
      starters: ['I’m looking forward to…', 'Soon I want to…', 'Not really, but…'],
    },

    // Good mood: savour it, and notice your part in it.
    {
      kind: 'write', id: 'what', when: high,
      text: (c) => (first(c, 'feelings') ? `Nice! What's making you feel ${first(c, 'feelings')}?` : 'Nice! What made it a good one?'),
      starters: ['It was when…', 'I’m glad that…', 'The best part was…'],
      easier: "What's one good moment you'd like to remember?",
      nudge: 'Tell me a bit more — where were you, who was there?',
    },
    {
      kind: 'write', id: 'agency', when: high,
      text: 'Did you do anything that helped make it happen?',
      starters: ['I decided to…', 'I made time for…', 'I reached out to…'],
    },

    {
      kind: 'say',
      text: (c) =>
        low(c)
          ? `Thank you for writing that down${comma(c)}. Being honest about a hard day takes something. Go easy on yourself.`
          : high(c)
            ? 'Love that. It’s saved — something to look back on during a harder day.'
            : 'Thanks for checking in. That’s today saved.',
    },
    {
      kind: 'say',
      when: (c) => moodOf(c) === 1,
      text: 'If things feel really heavy, talking to someone you trust can help. There are support lines in Settings, any time.',
    },
  ],
};

const evening: Flow = {
  id: 'evening',
  title: 'End of day',
  blurb: 'Wrap up today in a few short questions.',
  minutes: 3,
  steps: [
    { kind: 'mood', id: 'mood', text: 'How was today, overall?' },
    ...activitySteps,
    { kind: 'followups', max: 2 },
    {
      kind: 'write', id: 'title',
      text: 'If today had a title, what would it be?',
      starters: ['The day I…', 'Just another…', 'Finally…'],
      easier: 'Pick one word for today.',
    },
    {
      kind: 'write', id: 'good',
      text: "What's one thing that went well today? Tiny things count.",
      starters: ['I enjoyed…', 'It was nice when…', 'I managed to…'],
      easier: 'Was there a moment, even a short one, that felt okay?',
      nudge: 'What made it good?',
    },
    {
      kind: 'write', id: 'why',
      text: 'Why do you think it went well?',
      starters: ['Because I…', 'Because someone…', 'It helped that…'],
    },
    { kind: 'choice', id: 'hard', text: 'Was there a hard moment today?', options: ['Yes', 'Not really'] },
    {
      kind: 'write', id: 'hardWhat', when: (c) => c.answers.hard === 'Yes',
      text: 'What happened?',
      starters: ['It was when…', 'I felt… because…', 'Someone…'],
      easier: 'Where were you when it happened, and who was there?',
      nudge: 'How did it make you feel?',
    },
    {
      kind: 'write', id: 'hardHow', when: (c) => c.answers.hard === 'Yes',
      text: 'How did you handle it — or how would you like to next time?',
      starters: ['I handled it by…', 'Next time I’d…', 'I wish I had…'],
    },
    {
      kind: 'write', id: 'tomorrow',
      text: "What's one thing you'd like to do tomorrow?",
      starters: ['Tomorrow I want to…', 'I’ll make time for…', 'I need to…'],
    },
    { kind: 'say', text: (c) => `That’s today wrapped up. Sleep well${comma(c)}.` },
  ],
};

const mind: Flow = {
  id: 'mind',
  title: "Something's on my mind",
  blurb: 'Untangle a worry or something that upset you.',
  minutes: 4,
  steps: [
    {
      kind: 'write', id: 'what',
      text: "What's on your mind? A few words is enough.",
      starters: ['I’m worried about…', 'I can’t stop thinking about…', 'I’m upset because…'],
      easier: 'Who or what is it about?',
      nudge: "What's the part that bothers you most?",
    },
    { kind: 'choice', id: 'feelings', multi: true, text: 'Which feelings come with it?', options: LOW_FEELINGS },
    { kind: 'choice', id: 'before', text: 'How strong is it right now?', options: ['A little', 'Quite a lot', 'Very strong'] },
    {
      kind: 'write', id: 'fear',
      text: "What's the worst you're afraid might happen?",
      starters: ['I’m scared that…', 'What if…'],
      easier: 'What are you hoping won’t happen?',
    },
    {
      kind: 'write', id: 'likely',
      text: 'And realistically, what’s most likely to happen?',
      starters: ['Probably…', 'Most likely…', 'Honestly, I don’t know, but…'],
    },
    {
      kind: 'write', id: 'friend',
      text: 'If a close friend told you this, what would you say to them?',
      starters: ['I’d tell them…', 'I’d remind them that…', 'I’d say it makes sense because…'],
      easier: 'What would someone who cares about you say right now?',
    },
    { kind: 'choice', id: 'control', text: 'Can you do anything about it?', options: ['Yes', 'A bit', 'Not really'] },
    {
      kind: 'write', id: 'step', when: (c) => c.answers.control === 'Yes' || c.answers.control === 'A bit',
      text: "What's one small first step?",
      starters: ['First, I could…', 'I’ll ask…', 'Today I can…'],
    },
    {
      kind: 'write', id: 'letgo', when: (c) => c.answers.control === 'Not really',
      text: 'What would help you put it down for now?',
      starters: ['I could…', 'It might help to…', 'For now I’ll…'],
      easier: 'What is something calming you could do in the next hour?',
    },
    { kind: 'choice', id: 'after', text: 'How strong is the feeling now?', options: ['Lighter', 'About the same', 'Stronger'] },
    {
      kind: 'say',
      text: (c) =>
        c.answers.after === 'Lighter'
          ? 'Good. Getting it out of your head and onto the page often does that.'
          : c.answers.after === 'Stronger'
            ? 'That’s okay — sometimes looking at something closely stirs it up before it settles. Be gentle with yourself, and consider talking to someone you trust. Support lines are in Settings.'
            : 'Thanks for working through it. Even when it doesn’t feel different yet, it’s written down now — you don’t have to hold all of it in your head.',
    },
  ],
};

const gratitude: Flow = {
  id: 'gratitude',
  title: 'Three good things',
  blurb: 'Three quick things you’re glad about.',
  minutes: 1,
  steps: [
    {
      kind: 'write', id: 'g1',
      text: 'Name one thing you’re glad about today. Anything counts — a coffee, a song, a person.',
      starters: ['I’m glad that…', 'I enjoyed…', 'I’m thankful for…'],
      easier: 'What’s something small that you’d miss if it was gone?',
    },
    { kind: 'write', id: 'g2', text: 'And a second one?', starters: ['Also…', 'Someone who…', 'I liked…'] },
    { kind: 'write', id: 'g3', text: 'One more?', starters: ['And…', 'Something about me:', 'Something I saw:'] },
    { kind: 'say', text: 'Three good things, saved. On hard days it helps to look back at lists like this.' },
  ],
};

// Prompts for "Just write" — one is picked per day so it feels fresh.
export const PROMPTS = [
  'If today had a title, what would it be?',
  'What drained your energy today? What gave you energy?',
  'Describe one small moment from today: what did you see, hear or smell?',
  'Who made a difference to your week, and how?',
  'What’s something you’ve been putting off? What makes it hard?',
  'What’s one thing you’re proud of, even if nobody noticed?',
  'What do you need more of right now? And less of?',
  'What would make tomorrow a good day?',
  'What’s something you’d tell yourself from a year ago?',
  'What are you worried about — and how likely is it really?',
  'Write about a place where you feel at ease.',
  'What’s something you learned recently?',
  'What made you laugh or smile lately?',
  'What’s a conversation you keep replaying? What would you say now?',
  'What are you looking forward to?',
  'What’s been taking up most of your thinking this week?',
];

export function promptOfTheDay(d = new Date()): string {
  const day = Math.floor(d.getTime() / 86_400_000);
  return PROMPTS[day % PROMPTS.length];
}

const free: Flow = {
  id: 'free',
  title: 'Just write',
  blurb: 'Write whatever you like, with a prompt if you want one.',
  minutes: 2,
  steps: [
    {
      kind: 'write', id: 'text',
      text: () => `Write whatever's on your mind. Or try today’s question: “${promptOfTheDay()}”`,
      starters: ['Right now I…', 'Today…', 'I’ve been thinking about…'],
      easier: () => PROMPTS[(PROMPTS.indexOf(promptOfTheDay()) + 1) % PROMPTS.length],
      nudge: 'Want to add a bit more? How did that make you feel?',
    },
    {
      kind: 'write', id: 'more',
      text: 'Anything else you want to add?',
      starters: ['Also…', 'One more thing…'],
    },
    { kind: 'say', text: 'Saved.' },
  ],
};

const log: Flow = {
  id: 'log',
  title: 'What I did',
  blurb: 'Tap what you did and who you saw, so you can look it up later.',
  minutes: 1,
  steps: [
    { kind: 'choice', id: 'day', text: 'Which day is this about?', options: ['Today', 'Yesterday', '2 days ago'], when: (c) => !c.answers.day },
    ...activitySteps,
    { kind: 'followups', max: 3 },
    {
      kind: 'write', id: 'details',
      when: (c) => !c.answers.followups, // only if there were no specific questions
      text: 'Anything you’d like to remember about it? What you ate, what you talked about, something funny…',
      starters: ['I want to remember…', 'We talked about…', 'The funniest part was…', 'I ate…'],
      easier: (c) => `Let’s walk through it. What’s the first thing you remember doing ${dayWord(c)}?`,
      nudge: 'Where were you, and what happened next?',
    },
    { kind: 'say', text: 'Saved. You can find it later in Memory — for example under “When did I last…”.' },
  ],
};

export const FLOWS: Flow[] = [quick, log, evening, mind, gratitude, free];
export const flowById = (id: string) => FLOWS.find((f) => f.id === id) ?? quick;

/** Suggest a flow based on time of day. */
export function suggestedFlowId(d = new Date()): string {
  const h = d.getHours();
  return h >= 19 || h < 3 ? 'evening' : 'quick';
}
