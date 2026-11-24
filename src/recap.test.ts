import { describe, it, expect } from 'vitest';
import { weekRecap, weekSummary, weekStart, defaultWeekOffset } from './recap';
import type { Entry, Mood } from './types';

const NOW = new Date(2026, 10, 24, 20, 0); // Tuesday 24 Nov 2026
const at = (d: number, h = 21) => new Date(2026, 10, d, h).getTime();
function e(ts: number, extra: Partial<Entry> = {}): Entry {
  return { id: String(Math.random()), createdAt: ts, updatedAt: ts, flowId: 'evening', flowTitle: 'Fim do dia', messages: [], ...extra };
}

// Week of Mon 16 – Sun 22 November
const entries: Entry[] = [
  e(at(16), { mood: 2 as Mood, activities: ['💼 Trabalho', '🚶 Caminhada'], people: ['Rita'],
    details: [{ item: '🚶 Caminhada', text: 'Até ao jardim da Estrela' }] }),
  e(at(16, 8), { activities: ['🚶 Caminhada'] }), // same day again: counted once
  e(at(18), { mood: 3 as Mood, activities: ['💼 Trabalho'], people: ['Rita', 'Tiago'], notes: ['Reunião longa mas correu bem'] }),
  e(at(21), { mood: 5 as Mood, activities: ['🍳 Cozinhei'], people: ['Mãe'],
    details: [{ item: 'Mãe', text: 'Almoço em casa dela, falámos das férias' }] }),
  e(at(23), { mood: 1 as Mood, activities: ['💼 Trabalho'] }), // next week
];

describe('weekly recap', () => {
  it('weeks run Monday to Sunday', () => {
    expect(weekStart(0, NOW).getDate()).toBe(23);
    expect(weekStart(-1, NOW).getDate()).toBe(16);
  });

  it('opens last week early in the week, this week later on', () => {
    expect(defaultWeekOffset(NOW)).toBe(-1); // Tuesday
    expect(defaultWeekOffset(new Date(2026, 10, 27))).toBe(0); // Friday
  });

  it('sums up the week', () => {
    const r = weekRecap(entries, -1, NOW);
    expect(r.label).toBe('16 a 22 de novembro');
    expect(r.daysLogged).toBe(3);
    expect(r.activities[0]).toEqual({ name: '💼 Trabalho', n: 2 });
    expect(r.activities.find((a) => a.name === '🚶 Caminhada')!.n).toBe(1); // once per day
    expect(r.people[0]).toEqual({ name: 'Rita', n: 2 });
    expect(r.avgMood).toBeCloseTo(10 / 3);
    expect(new Date(r.bestDay!.ts).getDate()).toBe(21);
    expect(r.highlights.map((h) => new Date(h.day.ts).getDate())).toEqual([16, 18, 21]);
  });

  it('reads like something you could tell someone', () => {
    const s = weekSummary(weekRecap(entries, -1, NOW));
    expect(s.split('\n')[0]).toBe('A minha semana (16 a 22 de novembro):');
    expect(s).toContain('• Trabalhei (2 dias)');
    expect(s).toContain('• Fui dar uma caminhada\n');
    expect(s).toContain('• Estive ou falei com Rita (2×), Mãe e Tiago');
    expect(s).toContain('• Sábado: Almoço em casa dela, falámos das férias');
    expect(s).toContain('No geral, foi uma semana mais ou menos');
  });

  it('never repeats the same highlight', () => {
    const same = [16, 17, 18].map((d) => e(at(d), { notes: ['Dentista: está tudo bem'] }));
    expect(weekRecap(same, -1, NOW).highlights).toHaveLength(1);
  });

  it('is empty for a week with nothing logged', () => {
    expect(weekSummary(weekRecap(entries, -3, NOW))).toBe('');
  });

  it('spans months in the label', () => {
    expect(weekRecap([], 0, new Date(2026, 10, 30)).label).toBe('30 de novembro a 6 de dezembro');
  });
});
