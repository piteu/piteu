import { LOCALE } from './locale';
import { dayKey, writtenTexts } from './export';
import { NO_ONE, NOT_SURE } from './flows';
import { type Entry, entryTime } from './types';

export type Range = 'week' | 'month' | 'year';

export interface Bucket {
  start: number;
  end: number; // exclusive
  short: string; // axis label
  long: string; // readout label
  avg?: number; // average mood, 1–5
  n: number; // check-ins with a mood
  future: boolean;
}

export interface Period {
  range: Range;
  start: number;
  end: number; // exclusive
  label: string;
  buckets: Bucket[];
}

const DAY = 86_400_000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** offset 0 = the current week/month/year, -1 = the one before, etc. Weeks start on Monday. */
export function getPeriod(range: Range, offset = 0, now = new Date()): Period {
  const today = startOfDay(now);
  const buckets: Bucket[] = [];
  let start: Date, end: Date, label: string;

  const dayBucket = (d: Date, short: string, long: string): Bucket => {
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    return { start: d.getTime(), end: next.getTime(), short, long, n: 0, future: d > today };
  };

  if (range === 'week') {
    const dow = (today.getDay() + 6) % 7; // Monday = 0
    start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow + offset * 7);
    end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      buckets.push(
        dayBucket(
          d,
          d.toLocaleDateString(LOCALE, { weekday: 'narrow' }),
          d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'short' }),
        ),
      );
    }
    const last = new Date(end.getTime() - DAY);
    label =
      offset === 0
        ? 'Esta semana'
        : offset === -1
          ? 'Semana passada'
          : `${start.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })} – ${last.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  } else if (range === 'month') {
    start = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const days = Math.round((end.getTime() - start.getTime()) / DAY);
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), i + 1);
      buckets.push(
        dayBucket(d, String(i + 1), d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'short' })),
      );
    }
    label = start.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
  } else {
    start = new Date(today.getFullYear() + offset, 0, 1);
    end = new Date(start.getFullYear() + 1, 0, 1);
    for (let m = 0; m < 12; m++) {
      const s = new Date(start.getFullYear(), m, 1);
      const e = new Date(start.getFullYear(), m + 1, 1);
      buckets.push({
        start: s.getTime(),
        end: e.getTime(),
        short: s.toLocaleDateString(LOCALE, { month: 'narrow' }),
        long: s.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' }),
        n: 0,
        future: s > today,
      });
    }
    label = String(start.getFullYear());
  }
  return { range, start: start.getTime(), end: end.getTime(), label, buckets };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
export const wordsIn = (e: Entry) =>
  writtenTexts(e).reduce((n, t) => n + t.trim().split(/\s+/).filter(Boolean).length, 0);

export interface Summary {
  period: Period;
  checkins: number;
  daysJournaled: number;
  daysSoFar: number; // days in the period up to today
  avgMood?: number;
  prevAvgMood?: number;
  prevCheckins: number;
  words: number;
  buckets: Bucket[];
  feelings: { name: string; n: number }[];
  topics: { name: string; n: number; avg?: number }[];
  activities: { name: string; n: number; avg?: number }[];
  people: { name: string; n: number; avg?: number }[];
  weekdays: { label: string; avg?: number; n: number }[];
}

function inPeriod(entries: Entry[], p: { start: number; end: number }) {
  return entries.filter((e) => entryTime(e) >= p.start && entryTime(e) < p.end);
}

export function summarize(all: Entry[], range: Range, offset = 0, now = new Date()): Summary {
  const period = getPeriod(range, offset, now);
  const prev = getPeriod(range, offset - 1, now);
  const entries = inPeriod(all, period);
  const prevEntries = inPeriod(all, prev);
  const moods = (es: Entry[]) => es.filter((e) => e.mood).map((e) => e.mood!);

  const buckets = period.buckets.map((b) => {
    const m = moods(entries.filter((e) => entryTime(e) >= b.start && entryTime(e) < b.end));
    return { ...b, n: m.length, avg: avg(m) };
  });

  const count = (key: 'feelings' | 'topics' | 'activities' | 'people') => {
    const map = new Map<string, { n: number; moods: number[] }>();
    for (const e of entries)
      for (const t of e[key] ?? []) {
        if (t === NOT_SURE || t === NO_ONE) continue;
        const rec = map.get(t) ?? { n: 0, moods: [] };
        rec.n++;
        if (e.mood) rec.moods.push(e.mood);
        map.set(t, rec);
      }
    return [...map.entries()]
      .map(([name, r]) => ({ name, n: r.n, avg: avg(r.moods) }))
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  };

  // Mon..Sun
  const wd: number[][] = Array.from({ length: 7 }, () => []);
  for (const e of entries) if (e.mood) wd[(new Date(entryTime(e)).getDay() + 6) % 7].push(e.mood);
  const monday = new Date(2024, 0, 1); // a Monday
  const weekdays = wd.map((xs, i) => ({
    label: new Date(monday.getTime() + i * DAY).toLocaleDateString(LOCALE, { weekday: 'short' }),
    avg: avg(xs),
    n: xs.length,
  }));

  const todayEnd = startOfDay(now).getTime() + DAY;
  const daysSoFar = Math.max(0, Math.round((Math.min(period.end, todayEnd) - period.start) / DAY));

  return {
    period,
    checkins: entries.length,
    daysJournaled: new Set(entries.map((e) => dayKey(entryTime(e)))).size,
    daysSoFar,
    avgMood: avg(moods(entries)),
    prevAvgMood: avg(moods(prevEntries)),
    prevCheckins: prevEntries.length,
    words: entries.reduce((n, e) => n + wordsIn(e), 0),
    buckets,
    feelings: count('feelings').map(({ name, n }) => ({ name, n })),
    topics: count('topics'),
    activities: count('activities'),
    people: count('people'),
    weekdays,
  };
}

/** Days in a row with at least one entry, ending today (or yesterday, if today is still empty). */
export function currentStreak(all: Entry[], now = new Date()): number {
  const days = new Set(all.map((e) => dayKey(entryTime(e))));
  let d = startOfDay(now);
  if (!days.has(dayKey(d.getTime()))) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d.getTime()))) {
    n++;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  }
  return n;
}
