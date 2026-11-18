import { dayKey, writtenTexts } from './export';
import { ACTIVITIES, NO_ONE } from './flows';
import { type Entry, entryTime } from './types';

const DAY = 86_400_000;

const startOfDay = (ts: number) => {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** Whole calendar days between two moments (b later than a). */
export const daysBetween = (a: number, b: number) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);

export function relativeDay(ts: number, now = Date.now()): string {
  const n = daysBetween(ts, now);
  if (n <= 0) return 'Today';
  if (n === 1) return 'Yesterday';
  if (n < 14) return `${n} days ago`;
  if (n < 60) return `${Math.round(n / 7)} weeks ago`;
  if (n < 365) return `${Math.round(n / 30)} months ago`;
  const y = Math.round(n / 365);
  return y === 1 ? 'A year ago' : `${y} years ago`;
}

const people = (e: Entry) => (e.people ?? []).filter((p) => p !== NO_ONE);

export interface Thing {
  label: string;
  kind: 'activity' | 'person';
  last: number;
  /** One timestamp per day it happened, newest first. */
  days: number[];
}

/** Everything you've logged, with when it last happened — newest first. */
export function things(entries: Entry[]): Thing[] {
  const map = new Map<string, Thing>();
  const add = (label: string, kind: Thing['kind'], ts: number) => {
    const k = `${kind}:${label}`;
    const t = map.get(k) ?? { label, kind, last: 0, days: [] };
    if (!t.days.some((d) => dayKey(d) === dayKey(ts))) t.days.push(ts);
    t.last = Math.max(t.last, ts);
    map.set(k, t);
  };
  for (const e of entries) {
    const ts = entryTime(e);
    for (const a of e.activities ?? []) add(a, 'activity', ts);
    for (const p of people(e)) add(p, 'person', ts);
  }
  return [...map.values()]
    .map((t) => ({ ...t, days: t.days.sort((a, b) => b - a) }))
    .sort((a, b) => b.last - a.last || a.label.localeCompare(b.label));
}

/** Your own activities (most used first) and people (most recent first), for one-tap answers. */
export function known(entries: Entry[]): { activities: string[]; people: string[] } {
  const all = things(entries);
  return {
    activities: all.filter((t) => t.kind === 'activity').sort((a, b) => b.days.length - a.days.length).map((t) => t.label),
    people: all.filter((t) => t.kind === 'person').map((t) => t.label),
  };
}

export interface Day {
  ts: number;
  entries: Entry[];
  moods: number[];
  activities: string[];
  people: string[];
  /** Answers about specific activities/people. */
  details: { item: string; text: string }[];
  /** Other things you wrote. */
  notes: string[];
}

export function dayDetails(entries: Entry[], ts: number): Day {
  const k = dayKey(ts);
  const es = entries.filter((e) => dayKey(entryTime(e)) === k).sort((a, b) => entryTime(a) - entryTime(b));
  return {
    ts: startOfDay(ts),
    entries: es,
    moods: es.filter((e) => e.mood).map((e) => e.mood!),
    activities: [...new Set(es.flatMap((e) => e.activities ?? []))],
    people: [...new Set(es.flatMap(people))],
    details: es.flatMap((e) => e.details ?? []),
    notes: es.flatMap((e) => e.notes ?? writtenTexts(e)),
  };
}

export const hasDayLog = (d: Day) => d.activities.length > 0 || d.people.length > 0;

/** True if nothing about what you did yesterday has been logged. */
export function yesterdayMissing(entries: Entry[], now = Date.now()): boolean {
  return !hasDayLog(dayDetails(entries, now - DAY));
}

export function onThisDay(entries: Entry[], now = new Date()): { label: string; day: Day }[] {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const targets = [
    { label: 'A week ago', ts: new Date(y, m, d - 7, 12).getTime() },
    { label: 'A month ago', ts: new Date(y, m - 1, d, 12).getTime() },
    { label: 'A year ago', ts: new Date(y - 1, m, d, 12).getTime() },
  ];
  return targets
    .map((t) => ({ label: t.label, day: dayDetails(entries, t.ts) }))
    .filter((t) => t.day.entries.length > 0);
}

// ---------- Memory practice ----------

export interface Quiz {
  day: Day;
  actual: string[];
  options: string[];
}

/**
 * Pick a day from 1–30 days ago that has at least two things logged, mostly from the last
 * week (recent days are the ones worth strengthening). Distractors come from your own
 * logs so they are plausible.
 */
export function makeQuiz(entries: Entry[], now = Date.now(), rnd = Math.random, avoid?: number): Quiz | null {
  const days = new Map<string, Day>();
  for (const e of entries) {
    const n = daysBetween(entryTime(e), now);
    if (n < 1 || n > 30) continue;
    const k = dayKey(entryTime(e));
    if (!days.has(k)) days.set(k, dayDetails(entries, entryTime(e)));
  }
  let candidates = [...days.values()].filter((d) => d.activities.length + d.people.length >= 2);
  if (avoid !== undefined && candidates.length > 1) candidates = candidates.filter((d) => d.ts !== startOfDay(avoid));
  if (!candidates.length) return null;
  const recent = candidates.filter((d) => daysBetween(d.ts, now) <= 7);
  const pool = recent.length && rnd() < 0.7 ? recent : candidates;
  const day = pool[Math.floor(rnd() * pool.length)];

  const actual = [...day.activities, ...day.people];
  const mine = things(entries).map((t) => t.label);
  const others = [...new Set([...mine, ...ACTIVITIES])].filter((x) => !actual.includes(x));
  shuffle(others, rnd);
  const nDistract = Math.min(others.length, Math.max(3, Math.min(actual.length, 6)));
  const options = shuffle([...actual, ...others.slice(0, nDistract)], rnd);
  return { day, actual, options };
}

export function scoreQuiz(q: Quiz, picked: string[]) {
  const remembered = q.actual.filter((x) => picked.includes(x));
  const missed = q.actual.filter((x) => !picked.includes(x));
  const wrong = picked.filter((x) => !q.actual.includes(x));
  return { remembered, missed, wrong };
}

function shuffle<T>(a: T[], rnd: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
