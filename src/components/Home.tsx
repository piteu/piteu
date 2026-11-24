import { useMemo } from 'react';
import { DAY, FLOWS, flowById } from '../flows';
import { dayKey, moodFace } from '../export';
import { currentStreak } from '../insights';
import { LOCALE } from '../locale';
import { onThisDay } from '../memory';
import { type Entry, entryTime } from '../types';
import type { Answers } from '../flows';

const DAY_MS = 86_400_000;

function greeting(name?: string) {
  const h = new Date().getHours();
  const part = h < 5 ? 'Olá' : h < 12 ? 'Bom dia' : h < 20 ? 'Boa tarde' : 'Boa noite';
  return `${part}${name ? `, ${name}` : ''}`;
}

/** Compact grid of check-ins: icon, name, time. Also used after a check-in ends. */
export function FlowGrid({ onStart, exclude }: { onStart: (id: string) => void; exclude?: string }) {
  return (
    <div className="flow-grid">
      {FLOWS.filter((f) => f.id !== exclude).map((f) => (
        <button key={f.id} className="flow-tile" onClick={() => onStart(f.id)} aria-label={`${f.title}, cerca de ${f.minutes} min`}>
          <span className="tile-icon" aria-hidden>
            {f.icon}
          </span>
          <span className="tile-name">{f.short}</span>
        </button>
      ))}
    </div>
  );
}

export default function Home({
  name,
  entries,
  suggested,
  showYesterday,
  onStart,
  onGo,
}: {
  name?: string;
  entries: Entry[];
  suggested: string;
  showYesterday: boolean;
  onStart: (id: string, preset?: Answers, intro?: string) => void;
  onGo: (tab: 'memory' | 'insights') => void;
}) {
  const now = Date.now();
  const hero = flowById(suggested);
  const date = new Date().toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });

  const { streak, today, week, memory } = useMemo(() => {
    const todayKey = dayKey(now);
    const week = Array.from({ length: 7 }, (_, i) => {
      const ts = now - (6 - i) * DAY_MS;
      const k = dayKey(ts);
      const moods = entries.filter((e) => e.mood && dayKey(entryTime(e)) === k).map((e) => e.mood!);
      const any = entries.some((e) => dayKey(entryTime(e)) === k);
      const avg = moods.length ? Math.round(moods.reduce((a, b) => a + b, 0) / moods.length) : 0;
      return { ts, avg, any, letter: new Date(ts).toLocaleDateString(LOCALE, { weekday: 'narrow' }) };
    });
    return {
      streak: currentStreak(entries),
      today: entries.filter((e) => dayKey(entryTime(e)) === todayKey).length,
      week,
      memory: onThisDay(entries)[0],
    };
  }, [entries]);

  const memoryText = memory
    ? [...memory.day.activities.slice(0, 3), ...memory.day.people.slice(0, 2)].join(', ') ||
      memory.day.details[0]?.text ||
      memory.day.notes[0] ||
      ''
    : '';

  return (
    <div className="home">
      <header className="home-head">
        <p className="home-date">{date}</p>
        <h1>{greeting(name)}</h1>
      </header>

      <section className="home-card" aria-label="Os teus últimos dias">
        <div className="home-stats">
          <span className="stat">
            <span aria-hidden>🔥</span> {streak ? <><b>{streak}</b> {streak === 1 ? 'dia seguido' : 'dias seguidos'}</> : 'Começa hoje'}
          </span>
          <span className="stat">
            {today ? <><span aria-hidden>✓</span> <b>{today}</b> {today === 1 ? 'registo hoje' : 'registos hoje'}</> : 'Ainda nada hoje'}
          </span>
        </div>
        <button className="week-dots" onClick={() => onGo('insights')} aria-label="Ver o resumo da semana">
          {week.map((d) => (
            <span key={d.ts} className="wd">
              <span className={`dot m${d.avg} ${d.any ? 'has' : ''}`}>{d.avg ? moodFace(d.avg) : ''}</span>
              <span className="dow">{d.letter}</span>
            </span>
          ))}
        </button>
      </section>

      {showYesterday && (
        <button className="home-alert" onClick={() => onStart('log', { day: DAY.yesterday }, 'Vamos preencher o dia de ontem.')}>
          <span aria-hidden>🕘</span>
          <span className="alert-text">Ainda não registaste ontem</span>
          <b>Preencher</b>
        </button>
      )}

      <button className="home-hero" onClick={() => onStart(hero.id)}>
        <span className="hero-icon" aria-hidden>
          {hero.icon}
        </span>
        <span className="hero-main">
          <span className="hero-kicker">Sugerido para agora</span>
          <span className="hero-title">{hero.title}</span>
          <span className="hero-sub">
            {hero.blurb} · ~{hero.minutes} min
          </span>
        </span>
        <span className="hero-arrow" aria-hidden>
          ›
        </span>
      </button>

      <h2 className="home-h2">Outros check-ins</h2>
      <FlowGrid onStart={(id) => onStart(id)} exclude={hero.id} />

      {memory && memoryText && (
        <button className="home-memory" onClick={() => onGo('memory')}>
          <span aria-hidden>🗓️</span>
          <span className="memory-line">
            <b>{memory.label}</b> · {memoryText}
          </span>
          <span className="hero-arrow" aria-hidden>
            ›
          </span>
        </button>
      )}
    </div>
  );
}
