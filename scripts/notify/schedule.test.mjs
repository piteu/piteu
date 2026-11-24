import { describe, it, expect } from 'vitest';
import { due, localTime, message, decodeCode } from './schedule.mjs';

const cfg = { tz: 'Europe/Lisbon', at: { evening: 21, morning: null, weekly: 18, practice: 20 } };

describe('notification schedule', () => {
  it('sends the evening reminder at 21:00 local time, in winter and summer', () => {
    // Lisbon is UTC+0 in winter, UTC+1 in summer.
    expect(due(cfg, new Date('2026-11-24T21:07:00Z'))).toEqual(['evening']);
    expect(due(cfg, new Date('2026-07-14T20:07:00Z'))).toEqual(['evening']);
    expect(due(cfg, new Date('2026-07-14T21:07:00Z'))).toEqual([]);
  });

  it('works across time zones', () => {
    const ny = { tz: 'America/New_York', at: { evening: 21 } };
    expect(due(ny, new Date('2026-11-25T02:07:00Z'))).toEqual(['evening']); // 21:07 in New York
    expect(localTime(new Date('2026-11-25T02:07:00Z'), 'America/New_York')).toEqual({ weekday: 2, hour: 21 });
  });

  it('sends the weekly look-back only on Sundays, and practice on Tue/Thu/Sat', () => {
    expect(due(cfg, new Date('2026-11-29T18:07:00Z'))).toEqual(['weekly']); // Sunday
    expect(due(cfg, new Date('2026-11-28T18:07:00Z'))).toEqual([]); // Saturday
    expect(due(cfg, new Date('2026-11-24T20:07:00Z'))).toEqual(['practice']); // Tuesday
    expect(due(cfg, new Date('2026-11-25T20:07:00Z'))).toEqual([]); // Wednesday
  });

  it('sends nothing for reminders that are off', () => {
    expect(due({ tz: 'UTC', at: { morning: null } }, new Date('2026-11-24T09:07:00Z'))).toEqual([]);
  });

  it('builds messages that open the right place', () => {
    expect(message('evening').url).toBe('./?go=evening');
    expect(message('morning').url).toBe('./?go=yesterday');
    expect(message('test').body).toContain('a funcionar');
  });

  it('reads the code made by the app, and rejects anything else', () => {
    const code = Buffer.from(JSON.stringify({ v: 1, tz: 'UTC', at: {}, sub: { endpoint: 'https://x' }, vapid: { publicKey: 'a', privateKey: 'b' } })).toString('base64');
    expect(decodeCode(code).tz).toBe('UTC');
    expect(() => decodeCode(Buffer.from('{"v":2}').toString('base64'))).toThrow();
  });
});
