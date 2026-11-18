import { describe, it, expect } from 'vitest';
import { followupsFor, daySummary } from './details';
import { start, answer, skipFollowups } from './engine';

describe('follow-up questions', () => {
  it('asks about notable things first, and about people instead of "saw friends"', () => {
    const f = followupsFor(
      { answers: { activities: ['💼 Work', '👫 Saw friends', '🩺 Doctor / health', 'Climbing'], people: ['Rita'] } },
      5,
    );
    expect(f.map((x) => x.item)).toEqual(['🩺 Doctor / health', 'Climbing', 'Rita', '💼 Work']);
    expect(f[2].text).toContain('Rita');
  });

  it('never asks about resting, and ignores "No one"', () => {
    expect(followupsFor({ answers: { activities: ['😴 Rested'], people: ['No one'] } }, 3)).toEqual([]);
  });

  it('runs inside the "What I did" check-in and stores answers per item', () => {
    let o = start('log', {}, { day: 'Today' });
    o = answer(o.session, ['🚶 Walk', '🍳 Cooked']);
    o = answer(o.session, ['Rita']);
    expect(o.session.current?.about).toBe('Rita');
    o = answer(o.session, 'She told me about her new job');
    expect(o.session.current?.about).toBe('🚶 Walk');
    expect(o.said[0]).toContain('walk');
    o = answer(o.session, 'Along the river to the café');
    expect(o.session.current?.about).toBe('🍳 Cooked');
    o = answer(o.session, null);
    expect(o.session.done).toBe(true); // generic question skipped since follow-ups ran
    expect(o.session.answers['about:Rita']).toBe('She told me about her new job');
  });

  it('can stop the follow-ups early', () => {
    let o = start('log', {}, { day: 'Today' });
    o = answer(o.session, ['🚶 Walk', '💼 Work']);
    o = answer(o.session, null);
    expect(o.session.current?.about).toBe('🚶 Walk');
    o = skipFollowups(o.session);
    expect(o.session.done).toBe(true);
  });

  it('asks the generic question when nothing was tapped', () => {
    let o = start('log', {}, { day: 'Today' });
    o = answer(o.session, null);
    o = answer(o.session, null);
    expect(o.session.current?.id).toBe('details');
  });
});

describe('day summary', () => {
  it('reads like something you could tell someone', () => {
    const s = daySummary({
      ts: new Date(2026, 10, 17).getTime(),
      activities: ['🚶 Walk', '💼 Work', 'Climbing'],
      people: ['Rita', 'Ana', 'Tiago'],
      details: [
        { item: '🚶 Walk', text: 'Along the river' },
        { item: 'Rita', text: 'She told me about\nher new job' },
      ],
      mood: 3,
    });
    expect(s).toContain('What I did on Tuesday');
    expect(s).toContain('• Went for a walk: Along the river');
    expect(s).toContain('• Worked');
    expect(s).toContain('• Climbing');
    expect(s).toContain('• Saw or talked to Rita: She told me about her new job');
    expect(s).toContain('• Also saw or talked to Ana and Tiago');
    expect(s).toContain('Overall it was an okay day');
  });
  it('is empty when there is nothing to say', () => {
    expect(daySummary({ activities: [], people: ['No one'], details: [] })).toBe('');
  });
});
