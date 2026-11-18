import { useEffect, useMemo, useState } from 'react';
import { listEntries } from '../db';
import { dayKey, formatTime, moodFace } from '../export';
import { MOODS } from '../flows';
import { type Day, type Quiz, type Thing, dayDetails, makeQuiz, onThisDay, relativeDay, scoreQuiz, things } from '../memory';
import type { Entry } from '../types';

type View = 'calendar' | 'last' | 'practice';

const longDate = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const shortDate = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const avgMood = (ms: number[]) => (ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : 0);

export default function Memory({ dataKey }: { dataKey: CryptoKey }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [view, setView] = useState<View>('calendar');
  const [openDay, setOpenDay] = useState<number | null>(null);

  useEffect(() => {
    listEntries(dataKey).then(setEntries);
  }, [dataKey]);

  if (!entries) return <div className="center muted">Opening your memories…</div>;

  if (openDay !== null) {
    return <DayView day={dayDetails(entries, openDay)} onBack={() => setOpenDay(null)} />;
  }

  return (
    <div className="page memory">
      <h1>Memory</h1>
      <div className="segmented" role="tablist" aria-label="Memory views">
        {(
          [
            ['calendar', 'Calendar'],
            ['last', 'When did I last…'],
            ['practice', 'Practice'],
          ] as [View, string][]
        ).map(([v, label]) => (
          <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
            {label}
          </button>
        ))}
      </div>

      {view === 'calendar' && <CalendarView entries={entries} onOpen={setOpenDay} />}
      {view === 'last' && <LastTime entries={entries} onOpen={setOpenDay} />}
      {view === 'practice' && <Practice entries={entries} onOpen={setOpenDay} />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Chips({ items, className = '' }: { items: string[]; className?: string }) {
  return (
    <div className={`tags ${className}`}>
      {items.map((t) => (
        <span key={t} className="tag">
          {t}
        </span>
      ))}
    </div>
  );
}

function DaySummary({ day }: { day: Day }) {
  if (!day.entries.length) return <p className="muted small">Nothing logged.</p>;
  return (
    <>
      {day.activities.length > 0 && <Chips items={day.activities} />}
      {day.people.length > 0 && <p className="small with">With {day.people.join(', ')}</p>}
      {!day.activities.length && !day.people.length && day.notes[0] && <p className="small quote">“{day.notes[0]}”</p>}
    </>
  );
}

function DayView({ day, onBack }: { day: Day; onBack: () => void }) {
  const mood = avgMood(day.moods);
  return (
    <div className="page">
      <button className="link back" onClick={onBack}>
        ← Memory
      </button>
      <h1>{longDate(day.ts)}</h1>
      <p className="muted">
        {relativeDay(day.ts)}
        {mood ? ` · ${moodFace(mood)} ${MOODS[mood - 1].label}` : ''}
      </p>

      {!day.entries.length && <p className="muted">Nothing was logged on this day.</p>}

      {day.activities.length > 0 && (
        <section>
          <h2>What you did</h2>
          <Chips items={day.activities} />
        </section>
      )}
      {day.people.length > 0 && (
        <section>
          <h2>Who you saw or talked to</h2>
          <Chips items={day.people} />
        </section>
      )}
      {day.notes.length > 0 && (
        <section>
          <h2>What you wrote</h2>
          {day.notes.map((n, i) => (
            <blockquote key={i} className="note-quote">
              {n}
            </blockquote>
          ))}
        </section>
      )}
      {day.entries.length > 0 && (
        <section>
          <h2>Check-ins</h2>
          <ul className="small plain">
            {day.entries.map((e) => (
              <li key={e.id}>
                {moodFace(e.mood)} {e.flowTitle}
                <span className="muted">
                  {' '}
                  · written {dayKey(e.createdAt) === dayKey(day.ts) ? `at ${formatTime(e.createdAt)}` : `on ${shortDate(e.createdAt)}`}
                </span>
              </li>
            ))}
          </ul>
          <p className="muted small">Read the full conversations in the Journal tab.</p>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function CalendarView({ entries, onOpen }: { entries: Entry[]; onOpen: (ts: number) => void }) {
  const [offset, setOffset] = useState(0);
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday first
  const todayKey = dayKey(Date.now());
  const memories = useMemo(() => onThisDay(entries), [entries]);

  const cells = useMemo(() => {
    const out: { ts: number; day: Day }[] = [];
    for (let d = 1; d <= daysIn; d++) {
      const ts = new Date(first.getFullYear(), first.getMonth(), d, 12).getTime();
      out.push({ ts, day: dayDetails(entries, ts) });
    }
    return out;
  }, [entries, offset]);

  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: 'narrow' }),
  );

  return (
    <>
      {memories.length > 0 && (
        <section>
          <h2>On this day</h2>
          {memories.map((m) => (
            <button key={m.label} className="memory-card" onClick={() => onOpen(m.day.ts)}>
              <span className="memory-when">
                {m.label} <span className="muted">· {shortDate(m.day.ts)}</span>
                {avgMood(m.day.moods) ? <span aria-hidden> {moodFace(avgMood(m.day.moods))}</span> : null}
              </span>
              <DaySummary day={m.day} />
            </button>
          ))}
        </section>
      )}

      <div className="periodnav">
        <button className="link" onClick={() => setOffset((o) => o - 1)} aria-label="Previous month">
          ‹
        </button>
        <span>{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
        <button className="link" onClick={() => setOffset((o) => o + 1)} disabled={offset >= 0} aria-label="Next month">
          ›
        </button>
      </div>

      <div className="cal" role="grid" aria-label="Calendar">
        {weekdays.map((w, i) => (
          <span key={i} className="cal-head" aria-hidden>
            {w}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {cells.map(({ ts, day }, i) => {
          const mood = avgMood(day.moods);
          const logged = day.activities.length + day.people.length;
          const future = ts > Date.now() && dayKey(ts) !== todayKey;
          const label = `${longDate(ts)}: ${
            day.entries.length
              ? `${mood ? MOODS[mood - 1].label + ' mood, ' : ''}${logged} things logged`
              : 'nothing logged'
          }`;
          return (
            <button
              key={ts}
              className={`cal-day m${mood} ${dayKey(ts) === todayKey ? 'today' : ''} ${day.entries.length ? 'has' : ''}`}
              disabled={future}
              onClick={() => onOpen(ts)}
              aria-label={label}
            >
              <span>{i + 1}</span>
              {logged > 0 && <span className="cal-dot" aria-hidden />}
            </button>
          );
        })}
      </div>
      <div className="cal-legend small muted" aria-hidden>
        {MOODS.map((m) => (
          <span key={m.value}>
            <span className={`swatch m${m.value}`} /> {m.face}
          </span>
        ))}
        <span>
          <span className="cal-dot inline" /> things logged
        </span>
      </div>
      <p className="muted small">Tap a day to see what you did.</p>
    </>
  );
}

// ---------------------------------------------------------------------------

function LastTime({ entries, onOpen }: { entries: Entry[]; onOpen: (ts: number) => void }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'all' | Thing['kind']>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const all = useMemo(() => things(entries), [entries]);

  if (!all.length) {
    return (
      <p className="muted empty">
        Nothing to look up yet. Use the <b>What I did</b> check-in on the Today tab, and you’ll be able to see when you last
        did something or saw someone.
      </p>
    );
  }

  const s = q.trim().toLowerCase();
  const list = all.filter((t) => (kind === 'all' || t.kind === kind) && (!s || t.label.toLowerCase().includes(s)));
  const shown = showAll || s ? list : list.slice(0, 12);

  return (
    <>
      <input
        className="search"
        type="search"
        placeholder="Search, e.g. “dentist” or a name"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="chips filter">
        {(
          [
            ['all', 'Everything'],
            ['activity', 'Things I did'],
            ['person', 'People'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)} aria-pressed={kind === k}>
            {label}
          </button>
        ))}
      </div>
      {list.length === 0 && <p className="muted">Nothing matches “{q}”.</p>}
      <ul className="last-list">
        {shown.map((t) => {
          const k = `${t.kind}:${t.label}`;
          const isOpen = open === k;
          return (
            <li key={k}>
              <button className="last-row" onClick={() => setOpen(isOpen ? null : k)} aria-expanded={isOpen}>
                <span className="last-main">
                  <span className="last-label">
                    {t.kind === 'person' ? '👤 ' : ''}
                    {t.label}
                  </span>
                  <span className="last-when">
                    Last: <b>{relativeDay(t.last)}</b> · {shortDate(t.last)}
                  </span>
                </span>
                <span className="last-count">{t.days.length}×</span>
              </button>
              {isOpen && (
                <div className="last-days">
                  {t.days.slice(0, 20).map((d) => (
                    <button key={d} className="chip" onClick={() => onOpen(d)}>
                      {shortDate(d)}
                    </button>
                  ))}
                  {t.days.length > 20 && <span className="muted small">and {t.days.length - 20} more</span>}
                  {t.days.length > 1 && (
                    <p className="muted small gap">
                      About every {Math.max(1, Math.round((t.days[0] - t.days[t.days.length - 1]) / 86_400_000 / (t.days.length - 1)))} days
                      on average.
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!showAll && !s && list.length > 12 && (
        <button className="secondary" onClick={() => setShowAll(true)}>
          Show all {list.length}
        </button>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function Practice({ entries, onOpen }: { entries: Entry[]; onOpen: (ts: number) => void }) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [hint, setHint] = useState(false);
  const [none, setNone] = useState(false);

  function next() {
    const q = makeQuiz(entries, Date.now(), Math.random, quiz?.day.ts);
    setQuiz(q);
    setNone(!q);
    setPicked([]);
    setChecked(false);
    setHint(false);
  }

  if (!quiz) {
    return (
      <section className="card practice-intro">
        <h2>Memory practice</h2>
        <p>
          I’ll pick a day from the last few weeks and ask what you did. Tap what you remember, then see what you
          logged.
        </p>
        <p className="muted small">
          Trying to remember first, then checking, is one of the most reliable ways to make memories stick. A minute a
          day is plenty.
        </p>
        {none && (
          <p className="warn small">
            I need a few more days with things logged first. Use the <b>What I did</b> check-in for a couple of days,
            then come back.
          </p>
        )}
        <button className="primary" onClick={next}>
          Start
        </button>
      </section>
    );
  }

  const result = checked ? scoreQuiz(quiz, picked) : null;
  const mood = avgMood(quiz.day.moods);

  return (
    <section className="card practice">
      <h2>{relativeDay(quiz.day.ts)}</h2>
      <p className="practice-q">What did you do on {longDate(quiz.day.ts)}?</p>
      {!checked && <p className="muted small">Tap everything you remember — things you did and people you saw.</p>}

      <div className="chips">
        {quiz.options.map((o) => {
          const on = picked.includes(o);
          let state = '';
          if (result) {
            state = result.remembered.includes(o)
              ? 'got'
              : result.missed.includes(o)
                ? 'missed'
                : result.wrong.includes(o)
                  ? 'wrong'
                  : 'dim';
          }
          const sr = { got: ' (you remembered)', missed: ' (you did this)', wrong: ' (not that day)', dim: '', '': '' }[state];
          return (
            <button
              key={o}
              className={`chip ${!checked && on ? 'on' : ''} ${state}`}
              aria-pressed={!checked ? on : undefined}
              disabled={checked}
              onClick={() => setPicked((p) => (on ? p.filter((x) => x !== o) : [...p, o]))}
            >
              {state === 'got' ? '✓ ' : state === 'missed' ? '+ ' : ''}
              {o}
              <span className="sr-only">{sr}</span>
            </button>
          );
        })}
      </div>

      {!checked && hint && (
        <p className="small hint-text">
          Hint: {mood ? `your mood was ${moodFace(mood)} ${MOODS[mood - 1].label.toLowerCase()}, and ` : ''}you logged{' '}
          {quiz.actual.length} things that day.
          {quiz.day.notes[0] ? ` You wrote something starting “${quiz.day.notes[0].split(/\s+/).slice(0, 3).join(' ')}…”` : ''}
        </p>
      )}

      {result && (
        <div className="practice-result">
          <p>
            <b>
              You remembered {result.remembered.length} of {quiz.actual.length}.
            </b>{' '}
            {result.remembered.length === quiz.actual.length
              ? 'All of it — nice.'
              : result.remembered.length
                ? 'Good recall. The ones marked + are what you forgot.'
                : 'That’s okay — that’s exactly why you’re practising. Looking at it now helps it stick.'}
            {result.wrong.length > 0 && ` Crossed-out ones were a different day.`}
          </p>
          {quiz.day.notes.length > 0 && <blockquote className="note-quote">{quiz.day.notes[0]}</blockquote>}
        </div>
      )}

      <div className="row">
        {!checked ? (
          <>
            <button className="primary" onClick={() => setChecked(true)}>
              {picked.length ? 'Check' : 'I don’t remember — show me'}
            </button>
            {!hint && (
              <button className="link" onClick={() => setHint(true)}>
                Give me a hint
              </button>
            )}
          </>
        ) : (
          <>
            <button className="primary" onClick={next}>
              Another day
            </button>
            <button className="link" onClick={() => onOpen(quiz.day.ts)}>
              See the whole day
            </button>
          </>
        )}
      </div>
    </section>
  );
}
