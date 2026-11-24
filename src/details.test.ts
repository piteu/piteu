import { describe, it, expect } from 'vitest';
import { followupsFor, daySummary } from './details';
import { start, answer, skipFollowups } from './engine';

describe('follow-up questions', () => {
  it('asks about notable things first, and about people instead of "saw friends"', () => {
    const f = followupsFor(
      { answers: { activities: ['💼 Trabalho', '👫 Estive com amigos', '🩺 Médico / saúde', 'Climbing'], people: ['Rita'] } },
      5,
    );
    expect(f.map((x) => x.item)).toEqual(['🩺 Médico / saúde', 'Climbing', 'Rita', '💼 Trabalho']);
    expect(f[2].text).toContain('Rita');
  });

  it('never asks about resting, and ignores "No one"', () => {
    expect(followupsFor({ answers: { activities: ['😴 Descansei'], people: ['Ninguém'] } }, 3)).toEqual([]);
  });

  it('runs inside the "What I did" check-in and stores answers per item', () => {
    let o = start('log', {}, { day: 'Hoje' });
    o = answer(o.session, ['🚶 Caminhada', '🍳 Cozinhei']);
    o = answer(o.session, ['Rita']);
    expect(o.session.current?.about).toBe('Rita');
    o = answer(o.session, 'She told me about her new job');
    expect(o.session.current?.about).toBe('🚶 Caminhada');
    expect(o.said[0]).toContain('caminhada');
    o = answer(o.session, 'Along the river to the café');
    expect(o.session.current?.about).toBe('🍳 Cozinhei');
    o = answer(o.session, null);
    expect(o.session.done).toBe(true); // generic question skipped since follow-ups ran
    expect(o.session.answers['about:Rita']).toBe('She told me about her new job');
  });

  it('can stop the follow-ups early', () => {
    let o = start('log', {}, { day: 'Hoje' });
    o = answer(o.session, ['🚶 Caminhada', '💼 Trabalho']);
    o = answer(o.session, null);
    expect(o.session.current?.about).toBe('🚶 Caminhada');
    o = skipFollowups(o.session);
    expect(o.session.done).toBe(true);
  });

  it('asks the generic question when nothing was tapped', () => {
    let o = start('log', {}, { day: 'Hoje' });
    o = answer(o.session, null);
    o = answer(o.session, null);
    expect(o.session.current?.id).toBe('details');
  });
});

describe('day summary', () => {
  it('reads like something you could tell someone', () => {
    const s = daySummary({
      ts: new Date(2026, 10, 17).getTime(),
      activities: ['🚶 Caminhada', '💼 Trabalho', 'Climbing'],
      people: ['Rita', 'Ana', 'Tiago'],
      details: [
        { item: '🚶 Caminhada', text: 'Along the river' },
        { item: 'Rita', text: 'She told me about\nher new job' },
      ],
      mood: 3,
    });
    expect(s.split('\n')[0]).toBe('Terça-feira, 17 de novembro — o que fiz:');
    expect(s).toContain('• Fui dar uma caminhada: Along the river');
    expect(s).toContain('• Trabalhei');
    expect(s).toContain('• Climbing');
    expect(s).toContain('• Estive ou falei com Rita: She told me about her new job');
    expect(s).toContain('• Também estive ou falei com Ana e Tiago');
    expect(s).toContain('No geral, foi um dia mais ou menos');
  });
  it('is empty when there is nothing to say', () => {
    expect(daySummary({ activities: [], people: ['Ninguém'], details: [] })).toBe('');
  });
});
