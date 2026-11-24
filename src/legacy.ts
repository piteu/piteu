import { ACTIVITIES, flowById, NO_ONE } from './flows';
import type { Entry } from './types';

// Bruna used to be in English. Entries written then store English labels
// ("🚶 Walk", "Stressed"). They're translated when read, so old and new entries
// count together everywhere (Memory, Insights, search). Your own words aren't touched.

const OLD_ACTIVITIES = [
  '💼 Work', '📚 Study', '🏃 Exercise', '🚶 Walk', '🍳 Cooked', '🍽️ Ate out', '🛒 Shopping',
  '🧹 Chores', '🧾 Errands', '👫 Saw friends', '👨‍👩‍👧 Family time', '📞 Called someone', '❤️ Date',
  '🩺 Doctor / health', '🎨 Hobby', '📖 Read', '📺 Watched something', '🎮 Games', '🚌 Travelled',
  '🎉 Went out', '😴 Rested',
];
const ACTIVITY = new Map(OLD_ACTIVITIES.map((a, i) => [a, ACTIVITIES[i]]));

const FEELING = new Map(Object.entries({
  Stressed: 'Stress', Anxious: 'Ansiedade', Sad: 'Tristeza', Tired: 'Cansaço', Frustrated: 'Frustração',
  Overwhelmed: 'Sobrecarga', Lonely: 'Solidão', Angry: 'Raiva', Hurt: 'Mágoa', Worried: 'Preocupação',
  Disappointed: 'Desilusão', Numb: 'Vazio', Fine: 'Normal', Calm: 'Calma', Bored: 'Tédio', Restless: 'Inquietação',
  Distracted: 'Distração', Unsure: 'Dúvida', Meh: 'Assim-assim', Happy: 'Alegria', Grateful: 'Gratidão',
  Proud: 'Orgulho', Excited: 'Entusiasmo', Relaxed: 'Descontração', Loved: 'Carinho', Hopeful: 'Esperança',
  Energised: 'Energia', Content: 'Satisfação',
}));

const TOPIC = new Map(Object.entries({
  Work: 'Trabalho', Study: 'Estudos', Family: 'Família', Friends: 'Amigos', Partner: 'Relação', Health: 'Saúde',
  Sleep: 'Sono', Money: 'Dinheiro', Home: 'Casa', Myself: 'Eu', 'The news': 'Notícias', 'Not sure': 'Não sei',
}));

const map = (xs: string[] | undefined, m: Map<string, string>) => xs?.map((x) => m.get(x) ?? x);

export function migrateEntry(e: Entry): Entry {
  return {
    ...e,
    flowTitle: flowById(e.flowId).title,
    activities: map(e.activities, ACTIVITY),
    people: e.people?.map((p) => (p === 'No one' ? NO_ONE : p)),
    feelings: map(e.feelings, FEELING),
    topics: map(e.topics, TOPIC),
    details: e.details?.map((d) => ({ ...d, item: ACTIVITY.get(d.item) ?? d.item })),
  };
}
