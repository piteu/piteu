// Decides which notifications are due right now. No dependencies, so it can be unit-tested.

/** The reminders Bruna can send. `url` is relative to the app's address. */
export const KINDS = {
  evening: {
    title: 'Bruna',
    bodies: ['What did you do today? 📝', 'How was today? A few taps is enough.', 'Time to look back on today 🌙'],
    url: './?go=evening',
  },
  morning: {
    title: 'Good morning ☀️',
    bodies: ['Anything to add about yesterday? It only takes a few taps.'],
    url: './?go=yesterday',
  },
  weekly: {
    title: 'Look back at your week 📅',
    bodies: ['See what you did and who you saw this week.'],
    url: './?go=week',
  },
  practice: {
    title: '1-minute memory practice 🧠',
    bodies: ['Can you remember what you did a few days ago?'],
    url: './?go=practice',
  },
  test: {
    title: 'Bruna',
    bodies: ['Notifications are working! 🎉'],
    url: './',
  },
};

/** Which days each reminder is sent on (0 = Sunday). */
const DAYS = {
  evening: [0, 1, 2, 3, 4, 5, 6],
  morning: [0, 1, 2, 3, 4, 5, 6],
  weekly: [0],
  practice: [2, 4, 6], // Tue, Thu, Sat
};

/** Local weekday (0–6) and hour (0–23) at `now` in a time zone. */
export function localTime(now, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: 'numeric', hourCycle: 'h23' })
    .formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { weekday, hour: Number(get('hour')) % 24 };
}

/**
 * The reminders due at `now`.
 * @param {{ tz: string, at: Record<string, number | null> }} config  e.g. { tz: 'Europe/Lisbon', at: { evening: 21, weekly: 18 } }
 */
export function due(config, now = new Date()) {
  const { weekday, hour } = localTime(now, config.tz || 'UTC');
  return Object.entries(config.at || {})
    .filter(([kind, h]) => kind in DAYS && typeof h === 'number' && h === hour && DAYS[kind].includes(weekday))
    .map(([kind]) => kind);
}

/** The notification to send for a reminder, varying the wording by day. */
export function message(kind, now = new Date()) {
  const k = KINDS[kind];
  const day = Math.floor(now.getTime() / 86_400_000);
  return { kind, title: k.title, body: k.bodies[day % k.bodies.length], url: k.url };
}

/** Decode the code that Bruna shows in Settings → Notifications. */
export function decodeCode(code) {
  const json = JSON.parse(Buffer.from(code.trim(), 'base64').toString('utf8'));
  if (json.v !== 1 || !json.sub?.endpoint || !json.vapid?.privateKey) throw new Error('This is not a Bruna notification code.');
  return json;
}
