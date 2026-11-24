import { useEffect, useMemo, useState } from 'react';
import { listEntries } from '../db';
import { DAY, FLOWS, MOODS, flowById, suggestedFlowId } from '../flows';
import { dayKey, moodFace } from '../export';
import { currentStreak } from '../insights';
import { LOCALE } from '../locale';
import { onThisDay, yesterdayMissing } from '../memory';
import { weekRecap } from '../recap';
import { type Entry, entryTime } from '../types';
import type { Answers } from '../flows';

// The main page: a dashboard to look at. Writing happens on its own screen (Chat).

const DAY_MS = 86_400_000;

function greeting(name?: string) {
  const h = new Date().getHours();
  const part = h < 5 ? 'Olá' : h < 12 ? 'Bom dia' : h < 20 ? 'Boa tarde' : 'Boa noite';
  return `${part}${name ? `, ${name}` : ''}`;
}

const moodNear = (v: number) => MOODS[Math.min(4, Math.max(0, Math.round(v) - 1))];
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);

/** Compact grid of check-ins: icon and short name. Also used after a check-in ends. */
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

export type Go = 'memory' | 'week' | 'insights';

export default function Home({
  dataKey,
  name,
  onStart,
  onGo,
}: {
  dataKey: CryptoKey;
  name?: string;
  onStart: (id: string, preset?: Answers, intro?: string) => void;
  onGo: (where: Go) => void;
}) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  useEffect(() => {
    listEntries(dataKey).then(setEntries).catch(() => setEntries([]));
  }, [dataKey]);

  const now = Date.now();
  const data = useMemo(() => {
    const es = entries ?? [];
    const lastDays = (n: number) =>
      Array.from({ length: n }, (_, i) => {
        const ts = now - (n - 1 - i) * DAY_MS;
        const k = dayKey(ts);
        const of = es.filter((e) => dayKey(entryTime(e)) === k);
        return { ts, any: of.length > 0, mood: avg(of.filter((e) => e.mood).map((e) => e.mood!)) };
      });
    const week = lastDays(7);
    const month = lastDays(30);
    const weekEntries = es.filter((e) => entryTime(e) > now - 7 * DAY_MS);
    // Counted once per day.
    const tally = (pick: (e: Entry) => string[] | undefined) => {
      const m = new Map<string, Set<string>>();
      for (const e of weekEntries) for (const x of pick(e) ?? []) m.set(x, (m.get(x) ?? new Set()).add(dayKey(entryTime(e))));
      return [...m.entries()].map(([name, days]) => ({ name, n: days.size })).sort((a, b) => b.n - a.n).slice(0, 4);
    };
    const dow = new Date(now).getDay();
    return {
      streak: currentStreak(es),
      daysThisWeek: week.filter((d) => d.any).length,
      weekMood: avg(week.filter((d) => d.mood).map((d) => d.mood!)),
      week,
      month,
      did: tally((e) => e.activities),
      saw: tally((e) => e.people),
      memory: onThisDay(es)[0],
      showYesterday: es.length > 0 && yesterdayMissing(es),
      // On Sundays and Mondays, offer the weekly recap if there's something in it.
      weekReady: (dow === 0 || dow === 1) && weekRecap(es, dow === 1 ? -1 : 0).daysLogged >= 2,
    };
  }, [entries]);

  if (!entries) return <div className="center muted">…</div>;

  const hero = flowById(suggestedFlowId());
  const date = new Date().toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
  const mood = data.weekMood !== undefined ? moodNear(data.weekMood) : undefined;
  const memoryText = data.memory
    ? [...data.memory.day.activities.slice(0, 3), ...data.memory.day.people.slice(0, 2)].join(', ') ||
      data.memory.day.details[0]?.text ||
      data.memory.day.notes[0] ||
      ''
    : '';

  return (
    <div className="page dash">
      <header className="home-head">
        <p className="home-date">{date}</p>
        <h1>{greeting(name)}</h1>
      </header>

      {/* This week in numbers */}
      <section className="dash-card" aria-label="Os últimos 7 dias">
        <div className="dash-metrics">
          <div className="metric">
            <span className="metric-value">
              <span aria-hidden>🔥</span> {data.streak}
            </span>
            <span className="metric-label">{data.streak === 1 ? 'dia seguido' : 'dias seguidos'}</span>
          </div>
          <div className="metric">
            <span className="metric-value">
              {data.daysThisWeek}
              <span className="metric-of">/7</span>
            </span>
            <span className="metric-label">dias com registo</span>
          </div>
          <div className="metric">
            <span className="metric-value">{mood ? mood.face : '—'}</span>
            <span className="metric-label">{mood ? `humor ${mood.label.toLowerCase()}` : 'sem humor ainda'}</span>
          </div>
        </div>
        <button className="week-dots" onClick={() => onGo('insights')} aria-label="Ver o resumo">
          {data.week.map((d) => {
            const m = d.mood ? Math.round(d.mood) : 0;
            return (
              <span key={d.ts} className="wd">
                <span className={`dot m${m} ${d.any ? 'has' : ''}`}>{m ? moodFace(m) : ''}</span>
                <span className="dow">{new Date(d.ts).toLocaleDateString(LOCALE, { weekday: 'narrow' })}</span>
              </span>
            );
          })}
        </button>
      </section>

      {data.showYesterday && (
        <button className="home-alert" onClick={() => onStart('log', { day: DAY.yesterday }, 'Vamos preencher o dia de ontem.')}>
          <span aria-hidden>🕘</span>
          <span className="alert-text">Ainda não registaste ontem</span>
          <b>Preencher</b>
        </button>
      )}

      {data.weekReady && (
        <button className="home-week" onClick={() => onGo('week')}>
          <span className="hero-icon" aria-hidden>
            📅
          </span>
          <span className="hero-main">
            <span className="hero-title">A tua semana está pronta</span>
            <span className="hero-sub">O que fizeste, com quem estiveste, e um resumo para contares a alguém.</span>
          </span>
          <span className="hero-arrow" aria-hidden>
            ›
          </span>
        </button>
      )}

      {/* Writing */}
      <h2 className="home-h2">Escrever</h2>
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
      <FlowGrid onStart={(id) => onStart(id)} exclude={hero.id} />

      {/* What you did and who you saw */}
      {(data.did.length > 0 || data.saw.length > 0) && (
        <section className="dash-card">
          <h2>Nos últimos 7 dias</h2>
          {data.did.length > 0 && (
            <div className="tags">
              {data.did.map((a) => (
                <span key={a.name} className="tag">
                  {a.name}
                  {a.n > 1 && <b className="tag-n"> ×{a.n}</b>}
                </span>
              ))}
            </div>
          )}
          {data.saw.length > 0 && (
            <div className="tags">
              {data.saw.map((p) => (
                <span key={p.name} className="tag">
                  👤 {p.name}
                  {p.n > 1 && <b className="tag-n"> ×{p.n}</b>}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Mood over the last 30 days */}
      <MoodSpark days={data.month} onOpen={() => onGo('insights')} />

      {data.memory && memoryText && (
        <button className="home-memory" onClick={() => onGo('memory')}>
          <span aria-hidden>🗓️</span>
          <span className="memory-line">
            <b>{data.memory.label}</b> · {memoryText}
          </span>
          <span className="hero-arrow" aria-hidden>
            ›
          </span>
        </button>
      )}

      {entries.length === 0 && (
        <p className="muted small center-text">
          Os teus números aparecem aqui depois dos primeiros check-ins. Começa pelo cartão laranja.
        </p>
      )}
    </div>
  );
}

/** A small line of your mood over the last 30 days. Tap to open Resumo. */
function MoodSpark({ days, onOpen }: { days: { ts: number; mood?: number }[]; onOpen: () => void }) {
  const pts = days.map((d, i) => ({ i, m: d.mood })).filter((p): p is { i: number; m: number } => p.m !== undefined);
  if (pts.length < 2) return null;
  const W = 300;
  const H = 64;
  const x = (i: number) => 4 + (i / (days.length - 1)) * (W - 8);
  const y = (m: number) => 6 + ((5 - m) / 4) * (H - 12);
  const path = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.m).toFixed(1)}`).join('');
  const average = moodNear(pts.reduce((a, p) => a + p.m, 0) / pts.length);
  return (
    <button className="dash-card spark" onClick={onOpen} aria-label={`Humor nos últimos 30 dias: em média ${average.label.toLowerCase()}. Abrir o resumo.`}>
      <span className="spark-head">
        <span className="spark-title">Humor nos últimos 30 dias</span>
        <span className="spark-avg">média {average.face}</span>
      </span>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="spark-svg" aria-hidden>
        <line x1="0" x2={W} y1={y(3)} y2={y(3)} className="grid" vectorEffect="non-scaling-stroke" />
        <path d={path} className="moodline" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="spark-foot muted small">
        <span>há 30 dias</span>
        <span>hoje</span>
      </span>
    </button>
  );
}
