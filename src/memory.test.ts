import { describe, it, expect } from 'vitest';
import { things, known, dayDetails, yesterdayMissing, onThisDay, makeQuiz, scoreQuiz, relativeDay } from './memory';
import { reminderIcs } from './export';
import type { Entry } from './types';

const NOW = new Date(2026, 10, 18, 20, 0); // Wed 18 Nov 2026
const at = (d: number, m = 10, y = 2026, h = 21) => new Date(y, m, d, h).getTime();

function e(ts: number, extra: Partial<Entry> = {}): Entry {
  return { id: String(Math.random()), createdAt: ts, updatedAt: ts, flowId: 'log', flowTitle: 'What I did', messages: [], ...extra };
}

const entries: Entry[] = [
  e(at(17), { activities: ['🚶 Walk', '💼 Work'], people: ['Rita'], notes: ['Lunch at the Thai place'] }),
  e(at(18, 10, 2026, 9), { aboutAt: at(16, 10, 2026, 12), activities: ['🍳 Cooked'], people: ['No one'] }), // filled in later
  e(at(11), { activities: ['🚶 Walk'], people: ['Rita', 'Ana'], mood: 4 }),
  e(at(18, 9), { activities: ['🩺 Doctor / health'] }), // a month ago
];

describe('memory', () => {
  it('knows when you last did something or saw someone', () => {
    const t = things(entries);
    const walk = t.find((x) => x.label === '🚶 Walk')!;
    expect(walk.days).toHaveLength(2);
    expect(walk.last).toBe(at(17));
    const rita = t.find((x) => x.label === 'Rita')!;
    expect(rita.kind).toBe('person');
    expect(t.find((x) => x.label === 'No one')).toBeUndefined();
  });

  it('files entries under the day they are about', () => {
    const d = dayDetails(entries, at(16, 10, 2026, 8));
    expect(d.activities).toEqual(['🍳 Cooked']);
    expect(d.people).toEqual([]);
  });

  it('suggests filling in yesterday only when it is missing', () => {
    expect(yesterdayMissing(entries, NOW.getTime())).toBe(false); // 17th has a log
    expect(yesterdayMissing(entries, at(20))).toBe(true);
  });

  it('known lists most-used activities first', () => {
    const k = known(entries);
    expect(k.activities[0]).toBe('🚶 Walk');
    expect(k.people).toEqual(['Rita', 'Ana']);
  });

  it('finds memories from a week and a month ago', () => {
    const m = onThisDay(entries, NOW);
    expect(m.map((x) => x.label)).toEqual(['A week ago', 'A month ago']);
  });

  it('makes a fair quiz and scores it', () => {
    const q = makeQuiz(entries, NOW.getTime(), () => 0.1)!;
    expect(q).not.toBeNull();
    for (const a of q.actual) expect(q.options).toContain(a);
    expect(q.options.length).toBeGreaterThan(q.actual.length);
    const s = scoreQuiz(q, [q.actual[0], q.options.find((o) => !q.actual.includes(o))!]);
    expect(s.remembered).toHaveLength(1);
    expect(s.missed).toHaveLength(q.actual.length - 1);
    expect(s.wrong).toHaveLength(1);
  });

  it('has no quiz without enough logs', () => {
    expect(makeQuiz([e(at(17), { activities: ['🚶 Walk'] })], NOW.getTime())).toBeNull();
  });

  it('describes days in plain words', () => {
    expect(relativeDay(at(18), NOW.getTime())).toBe('Today');
    expect(relativeDay(at(17), NOW.getTime())).toBe('Yesterday');
    expect(relativeDay(at(11), NOW.getTime())).toBe('7 days ago');
    expect(relativeDay(at(18, 9), NOW.getTime())).toBe('4 weeks ago');
    expect(relativeDay(at(18, 6), NOW.getTime())).toBe('4 months ago');
  });

  it('makes a valid daily reminder', () => {
    const ics = reminderIcs(21, 5, 'https://example.org/piteu/', NOW);
    expect(ics).toContain('DTSTART:20261118T210500');
    expect(ics).toContain('RRULE:FREQ=DAILY');
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
  });
});
