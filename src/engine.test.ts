import { describe, it, expect } from 'vitest';
import { start, answer, displayAnswer } from './engine';
import { FLOWS } from './flows';

describe('engine', () => {
  it('quick check-in branches on low mood and nudges once', () => {
    let o = start('quick', { name: 'Ana' });
    expect(o.session.current?.kind).toBe('mood');
    o = answer(o.session, 2);
    expect(o.session.current?.options).toContain('Ansiedade');
    o = answer(o.session, ['Ansiedade']);
    o = answer(o.session, ['Trabalho']);
    expect(o.said[0]).toBe('O que aconteceu para sentires ansiedade?');
    o = answer(o.session, 'uma reunião');
    expect(o.session.current?.isNudge).toBe(true);
    o = answer(o.session, 'o meu chefe criticou o meu trabalho à frente de todos');
    expect(o.session.answers.what).toBe('uma reunião\no meu chefe criticou o meu trabalho à frente de todos');
    o = answer(o.session, 'ok', { name: 'Ana' }); // short again — but no second nudge
    expect(o.session.current).toBeNull();
    expect(o.session.done).toBe(true);
    expect(o.said.join(' ')).toContain('Ana');
  });

  it('good mood asks about what made it good', () => {
    let o = start('quick');
    o = answer(o.session, 5);
    expect(o.session.current?.options).toContain('Alegria');
    o = answer(o.session, null);
    o = answer(o.session, null);
    expect(o.said[0]).toMatch(/^Que bom!/);
  });

  it('skips nudges when disabled', () => {
    let o = start('free');
    o = answer(o.session, 'hi', { nudges: false });
    expect(o.session.current?.id).toBe('more');
  });

  it('evening flow only asks about the hard moment when there was one', () => {
    let o = start('evening');
    o = answer(o.session, 3);
    o = answer(o.session, null); // activities
    o = answer(o.session, null); // people
    o = answer(o.session, null);
    o = answer(o.session, null);
    o = answer(o.session, null);
    o = answer(o.session, 'Nem por isso');
    expect(o.session.current?.id).toBe('tomorrow');
  });

  it('every flow can be completed by skipping everything', () => {
    for (const f of FLOWS) {
      let o = start(f.id);
      let guard = 0;
      while (!o.session.done && guard++ < 50) {
        const p = o.session.current!;
        o = answer(o.session, p.kind === 'choice' && !p.multi ? p.options![0] : null);
      }
      expect(o.session.done).toBe(true);
    }
  });

  it('formats answers', () => {
    expect(displayAnswer({ kind: 'mood', id: 'mood', stepIndex: 0, text: '' }, 4)).toBe('🙂 Bem');
    expect(displayAnswer({ kind: 'choice', id: 'x', stepIndex: 0, text: '' }, ['A', 'B'])).toBe('A, B');
  });
});

describe('what I did', () => {
  it('offers your own activities and people, and skips the day question when preset', () => {
    const known = { activities: ['Climbing'], people: ['Rita'] };
    let o = start('log', { known }, { day: 'Ontem' });
    expect(o.session.current?.id).toBe('activities');
    expect(o.said[0]).toContain('ontem');
    expect(o.session.current?.options?.[0]).toBe('Climbing');
    expect(o.session.current?.other).toBeTruthy();
    o = answer(o.session, ['Climbing'], { known });
    expect(o.session.current?.options).toEqual(['Rita', 'Ninguém']);
  });
  it('asks which day when not preset', () => {
    expect(start('log').session.current?.id).toBe('day');
  });
});
