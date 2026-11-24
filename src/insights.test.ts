import { describe, it, expect } from 'vitest';
import { getPeriod, summarize, currentStreak } from './insights';
import type { Entry, Mood } from './types';

const NOW = new Date(2026, 10, 18, 20, 0); // Wed 18 Nov 2026, evening

function entry(y: number, m: number, d: number, mood?: Mood, extra: Partial<Entry> = {}): Entry {
  const t = new Date(y, m, d, 12).getTime();
  return {
    id: `${y}-${m}-${d}-${Math.random()}`, createdAt: t, updatedAt: t, flowId: 'quick', flowTitle: 'Quick check-in',
    mood, messages: [], ...extra,
  };
}

describe('periods', () => {
  it('weeks start on Monday', () => {
    const p = getPeriod('week', 0, NOW);
    expect(new Date(p.start).getDay()).toBe(1);
    expect(new Date(p.start).getDate()).toBe(16);
    expect(p.buckets).toHaveLength(7);
    expect(p.buckets[2].future).toBe(false); // Wed = today
    expect(p.buckets[3].future).toBe(true);
    expect(p.label).toBe('Esta semana');
  });
  it('months have one bucket per day; years one per month', () => {
    expect(getPeriod('month', 0, NOW).buckets).toHaveLength(30);
    expect(getPeriod('month', -9, NOW).buckets).toHaveLength(28); // Feb 2026
    expect(getPeriod('year', 0, NOW).buckets).toHaveLength(12);
    expect(getPeriod('year', -1, NOW).label).toBe('2025');
  });
});

describe('summarize', () => {
  const entries = [
    entry(2026, 10, 16, 2, { topics: ['Work'], feelings: ['Stressed', 'Tired'] }),
    entry(2026, 10, 16, 4, { topics: ['Friends'], feelings: ['Happy'] }),
    entry(2026, 10, 17, 2, { topics: ['Work', 'Sleep'], feelings: ['Tired'] }),
    entry(2026, 10, 18, undefined, {
      messages: [{ from: 'me', text: 'lunch with Rita was lovely', at: 0 }],
    }),
    entry(2026, 10, 10, 5), // last week
  ];

  it('counts this week', () => {
    const s = summarize(entries, 'week', 0, NOW);
    expect(s.checkins).toBe(4);
    expect(s.daysJournaled).toBe(3);
    expect(s.daysSoFar).toBe(3);
    expect(s.avgMood).toBeCloseTo(8 / 3);
    expect(s.prevAvgMood).toBe(5);
    expect(s.words).toBe(5);
    expect(s.buckets[0]).toMatchObject({ n: 2, avg: 3 });
    expect(s.buckets[2].n).toBe(0);
  });

  it('ranks feelings and links topics to mood', () => {
    const s = summarize(entries, 'week', 0, NOW);
    expect(s.feelings[0]).toEqual({ name: 'Tired', n: 2 });
    expect(s.topics[0]).toEqual({ name: 'Work', n: 2, avg: 2 });
  });

  it('averages by weekday', () => {
    const s = summarize(entries, 'month', 0, NOW);
    expect(s.weekdays[0]).toMatchObject({ n: 2, avg: 3 }); // Mondays
  });
});

describe('streak', () => {
  it('counts consecutive days, allowing today to be empty', () => {
    const es = [entry(2026, 10, 15), entry(2026, 10, 16), entry(2026, 10, 17)];
    expect(currentStreak(es, NOW)).toBe(3);
    expect(currentStreak([...es, entry(2026, 10, 18)], NOW)).toBe(4);
    expect(currentStreak([entry(2026, 10, 14)], NOW)).toBe(0);
  });
});
