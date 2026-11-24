import { PHRASE, joinNames, oneLine, stripEmoji } from './details';
import { MOODS, NO_ONE } from './flows';
import { LOCALE } from './locale';
import { type Day, dayDetails } from './memory';
import type { Entry } from './types';

// ---------------------------------------------------------------------------
// Weekly recap: what you did, who you saw, how the week felt, and a few lines
// you can use to tell someone about your week. Weeks run Monday–Sunday.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

export interface Recap {
  start: number; // Monday 00:00
  end: number; // next Monday 00:00
  label: string; // "17 a 23 de novembro"
  days: Day[]; // Monday … Sunday
  daysLogged: number;
  avgMood?: number;
  bestDay?: Day;
  activities: { name: string; n: number }[];
  people: { name: string; n: number }[];
  highlights: { day: Day; text: string; item?: string }[];
}

export function weekStart(offset = 0, now = new Date()): Date {
  const dow = (now.getDay() + 6) % 7; // Monday = 0
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + offset * 7);
}

/**
 * Which week to show first: early in the week (Mon–Wed) the new week has barely started,
 * so last week is the interesting one.
 */
export function defaultWeekOffset(now = new Date()): number {
  const dow = (now.getDay() + 6) % 7;
  return dow <= 2 ? -1 : 0;
}

function weekLabel(start: Date): string {
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString(LOCALE, o);
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()} a ${fmt(end, { day: 'numeric', month: 'long' })}`
    : `${fmt(start, { day: 'numeric', month: 'long' })} a ${fmt(end, { day: 'numeric', month: 'long' })}`;
}

const count = (xs: string[]) => {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
};

export function weekRecap(entries: Entry[], offset = 0, now = new Date()): Recap {
  const start = weekStart(offset, now);
  const days = Array.from({ length: 7 }, (_, i) =>
    dayDetails(entries, new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12).getTime()),
  );
  const logged = days.filter((d) => d.entries.length);
  const moods = days.flatMap((d) => d.moods);
  const dayAvg = (d: Day) => (d.moods.length ? d.moods.reduce((a, b) => a + b, 0) / d.moods.length : 0);
  const best = logged.filter((d) => d.moods.length).sort((a, b) => dayAvg(b) - dayAvg(a))[0];

  // Highlights: answers about specific things first (the most telling), then other writing.
  // Longer ones first, at most one per day so the week is represented.
  const candidates = days.flatMap((day) => [
    ...day.details.map((d) => ({ day, text: oneLine(d.text), item: d.item })),
    ...day.notes.map((t) => ({ day, text: oneLine(t) })),
  ]);
  const highlights: Recap['highlights'] = [];
  const usedDays = new Set<number>();
  const usedTexts = new Set<string>();
  for (const c of candidates.filter((c) => c.text.split(/\s+/).length >= 3).sort((a, b) => b.text.length - a.text.length)) {
    const key = c.text.toLowerCase();
    if (usedDays.has(c.day.ts) || usedTexts.has(key)) continue; // one per day, no repeats
    usedDays.add(c.day.ts);
    usedTexts.add(key);
    highlights.push(c);
    if (highlights.length === 3) break;
  }
  highlights.sort((a, b) => a.day.ts - b.day.ts);

  return {
    start: start.getTime(),
    end: start.getTime() + 7 * DAY_MS,
    label: weekLabel(start),
    days,
    daysLogged: logged.length,
    avgMood: moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : undefined,
    bestDay: best && dayAvg(best) >= 4 ? best : undefined,
    // Counted once per day: "walked on 3 days", not "logged a walk 5 times".
    activities: count(days.flatMap((d) => d.activities)),
    people: count(days.flatMap((d) => d.people.filter((p) => p !== NO_ONE))),
    highlights,
  };
}

const times = (n: number) => (n === 1 ? '' : n === 2 ? ' (2 dias)' : ` (${n} dias)`);

/** A few plain lines about the week — to read out, copy or send to someone. */
export function weekSummary(r: Recap): string {
  if (!r.daysLogged) return '';
  const lines = [`A minha semana (${r.label}):`];
  for (const a of r.activities.slice(0, 6)) lines.push(`• ${PHRASE[a.name] ?? stripEmoji(a.name)}${times(a.n)}`);
  if (r.people.length) {
    const names = r.people.slice(0, 6).map((p) => (p.n > 1 ? `${p.name} (${p.n}×)` : p.name));
    lines.push(`• Estive ou falei com ${joinNames(names)}`);
  }
  for (const h of r.highlights) {
    const day = new Date(h.day.ts).toLocaleDateString(LOCALE, { weekday: 'long' });
    lines.push(`• ${day.charAt(0).toUpperCase() + day.slice(1)}: ${h.text}`);
  }
  if (r.avgMood !== undefined) {
    const m = MOODS[Math.min(4, Math.max(0, Math.round(r.avgMood) - 1))];
    lines.push(`No geral, foi uma semana ${m.week} ${m.face}`);
  }
  return lines.join('\n');
}
