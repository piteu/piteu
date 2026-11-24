import { LOCALE } from '../locale';
import { useEffect, useMemo, useState } from 'react';
import { listEntries } from '../db';
import { dayKey, formatTime, moodFace } from '../export';
import { MOODS } from '../flows';
import { type Day, type Quiz, type Thing, dayDetails, makeQuiz, onThisDay, relativeDay, scoreQuiz, things } from '../memory';
import type { Entry } from '../types';
import { daySummary } from '../details';

type View = 'calendar' | 'last' | 'practice';

const longDate = (ts: number) =>
  new Date(ts).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
const shortDate = (ts: number) =>
  new Date(ts).toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
/** "na terça-feira, 17 de novembro" / "no sábado, 21 de novembro" (weekend days are masculine). */
const onDay = (ts: number) => `${[0, 6].includes(new Date(ts).getDay()) ? 'no' : 'na'} ${longDate(ts)}`;
const avgMood = (ms: number[]) => (ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : 0);

export default function Memory({ dataKey, initialView = 'calendar' }: { dataKey: CryptoKey; initialView?: View }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [view, setView] = useState<View>(initialView);
  const [openDay, setOpenDay] = useState<number | null>(null);

  useEffect(() => {
    listEntries(dataKey).then(setEntries);
  }, [dataKey]);

  if (!entries) return <div className="center muted">A abrir as tuas memórias…</div>;

  if (openDay !== null) {
    return <DayView day={dayDetails(entries, openDay)} onBack={() => setOpenDay(null)} />;
  }

  return (
    <div className="page memory">
      <h1>Memória</h1>
      <div className="segmented" role="tablist" aria-label="Vistas da memória">
        {(
          [
            ['calendar', 'Calendário'],
            ['last', 'Última vez…'],
            ['practice', 'Treino'],
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
  if (!day.entries.length) return <p className="muted small">Nada registado.</p>;
  return (
    <>
      {day.activities.length > 0 && <Chips items={day.activities} />}
      {day.people.length > 0 && <p className="small with">Com {day.people.join(', ')}</p>}
      {(day.details[0]?.text ?? day.notes[0]) && <p className="small quote">“{day.details[0]?.text ?? day.notes[0]}”</p>}
    </>
  );
}

function DayView({ day, onBack }: { day: Day; onBack: () => void }) {
  const mood = avgMood(day.moods);
  return (
    <div className="page">
      <button className="link back" onClick={onBack}>
        ← Memória
      </button>
      <h1>{longDate(day.ts)}</h1>
      <p className="muted">
        {relativeDay(day.ts)}
        {mood ? ` · ${moodFace(mood)} ${MOODS[mood - 1].label}` : ''}
      </p>

      {!day.entries.length && <p className="muted">Não registaste nada neste dia.</p>}

      {day.activities.length > 0 && (
        <section>
          <h2>O que fizeste</h2>
          <ItemList items={day.activities} day={day} />
        </section>
      )}
      {day.people.length > 0 && (
        <section>
          <h2>Com quem estiveste ou falaste</h2>
          <ItemList items={day.people} day={day} />
        </section>
      )}
      <TellSomeone day={day} />
      {day.notes.length > 0 && (
        <section>
          <h2>O que escreveste</h2>
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
                  · escrito {dayKey(e.createdAt) === dayKey(day.ts) ? `às ${formatTime(e.createdAt)}` : `em ${shortDate(e.createdAt)}`}
                </span>
              </li>
            ))}
          </ul>
          <p className="muted small">Lê as conversas completas no separador Diário.</p>
        </section>
      )}
    </div>
  );
}

function ItemList({ items, day }: { items: string[]; day: Day }) {
  return (
    <ul className="items">
      {items.map((it) => {
        const ds = day.details.filter((d) => d.item === it);
        return (
          <li key={it}>
            <span className="tag">{it}</span>
            {ds.map((d, i) => (
              <p key={i} className="item-detail">
                {d.text}
              </p>
            ))}
          </li>
        );
      })}
    </ul>
  );
}

/** A few plain lines about the day, to read out, copy or send to someone. */
function TellSomeone({ day }: { day: Day }) {
  const [done, setDone] = useState('');
  const mood = avgMood(day.moods);
  const text = daySummary({ ts: day.ts, activities: day.activities, people: day.people, details: day.details, mood: mood || undefined });
  if (!text) return null;
  const canShare = typeof navigator.share === 'function';
  return (
    <section className="card tell">
      <h2>Contar a alguém sobre este dia</h2>
      <p className="tell-text">{text}</p>
      <div className="row">
        {canShare && (
          <button
            className="primary small"
            onClick={() => navigator.share({ text }).catch(() => {})}
          >
            Partilhar…
          </button>
        )}
        <button
          className={canShare ? 'link small' : 'primary small'}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setDone('Copiado — cola numa mensagem.');
            } catch {
              setDone('Não foi possível copiar. Podes selecionar o texto e copiá-lo.');
            }
          }}
        >
          Copiar texto
        </button>
      </div>
      {done && <p className="muted small">{done}</p>}
      <p className="muted small">Só é partilhado se quiseres — nada é enviado automaticamente.</p>
    </section>
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
    new Date(2024, 0, 1 + i).toLocaleDateString(LOCALE, { weekday: 'narrow' }),
  );

  return (
    <>
      {memories.length > 0 && (
        <section>
          <h2>Neste dia</h2>
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
        <button className="link" onClick={() => setOffset((o) => o - 1)} aria-label="Mês anterior">
          ‹
        </button>
        <span>{first.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' })}</span>
        <button className="link" onClick={() => setOffset((o) => o + 1)} disabled={offset >= 0} aria-label="Mês seguinte">
          ›
        </button>
      </div>

      <div className="cal" role="grid" aria-label="Calendário">
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
              ? `${mood ? 'humor ' + MOODS[mood - 1].label.toLowerCase() + ', ' : ''}${logged} coisas registadas`
              : 'nada registado'
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
          <span className="cal-dot inline" /> coisas registadas
        </span>
      </div>
      <p className="muted small">Toca num dia para ver o que fizeste.</p>
    </>
  );
}

// ---------------------------------------------------------------------------

/** Average number of days between times something happened. */
const everyDays = (t: Thing) =>
  Math.max(1, Math.round((t.days[0] - t.days[t.days.length - 1]) / 86_400_000 / (t.days.length - 1)));

function LastTime({ entries, onOpen }: { entries: Entry[]; onOpen: (ts: number) => void }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'all' | Thing['kind']>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const all = useMemo(() => things(entries), [entries]);

  if (!all.length) {
    return (
      <p className="muted empty">
        Ainda não há nada para consultar. Usa o check-in <b>O que fiz</b> no separador Hoje, e vais poder ver quando foi a
        última vez que fizeste uma coisa ou estiveste com alguém.
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
        placeholder="Pesquisa, p. ex. “médico” ou um nome"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="chips filter">
        {(
          [
            ['all', 'Tudo'],
            ['activity', 'O que fiz'],
            ['person', 'Pessoas'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)} aria-pressed={kind === k}>
            {label}
          </button>
        ))}
      </div>
      {list.length === 0 && <p className="muted">Nada corresponde a “{q}”.</p>}
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
                    Última vez: <b>{relativeDay(t.last)}</b> · {shortDate(t.last)}
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
                  {t.days.length > 20 && <span className="muted small">e mais {t.days.length - 20}</span>}
                  {t.days.length > 1 && (
                    <p className="muted small gap">
                      Em média, de {everyDays(t)} em {everyDays(t)} dias.
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
          Mostrar todos ({list.length})
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
        <h2>Treino de memória</h2>
        <p>
          Escolho um dia das últimas semanas e pergunto-te o que fizeste. Toca no que te lembras, e depois vê o que
          registaste.
        </p>
        <p className="muted small">
          Tentar lembrar primeiro e só depois confirmar é uma das formas mais eficazes de fixar memórias. Um minuto por
          dia chega.
        </p>
        {none && (
          <p className="warn small">
            Primeiro preciso de mais alguns dias com coisas registadas. Usa o check-in <b>O que fiz</b> durante uns dias,
            e depois volta cá.
          </p>
        )}
        <button className="primary" onClick={next}>
          Começar
        </button>
      </section>
    );
  }

  const result = checked ? scoreQuiz(quiz, picked) : null;
  const mood = avgMood(quiz.day.moods);

  return (
    <section className="card practice">
      <h2>{relativeDay(quiz.day.ts)}</h2>
      <p className="practice-q">O que fizeste {onDay(quiz.day.ts)}?</p>
      {!checked && <p className="muted small">Toca em tudo o que te lembras — coisas que fizeste e pessoas com quem estiveste.</p>}

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
          const sr = { got: ' (lembraste-te)', missed: ' (fizeste isto)', wrong: ' (não foi nesse dia)', dim: '', '': '' }[state];
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
          Pista: {mood ? `o teu humor estava ${moodFace(mood)} ${MOODS[mood - 1].label.toLowerCase()}, e ` : ''}registaste{' '}
          {quiz.actual.length} coisas nesse dia.
          {(quiz.day.details[0]?.text ?? quiz.day.notes[0])
            ? ` Escreveste algo que começava por “${(quiz.day.details[0]?.text ?? quiz.day.notes[0]).split(/\s+/).slice(0, 3).join(' ')}…”`
            : ''}
        </p>
      )}

      {result && (
        <div className="practice-result">
          <p>
            <b>
              Lembraste-te de {result.remembered.length} de {quiz.actual.length}.
            </b>{' '}
            {result.remembered.length === quiz.actual.length
              ? 'De tudo — boa!'
              : result.remembered.length
                ? 'Boa memória. As marcadas com + são as que esqueceste.'
                : 'Não faz mal — é para isso mesmo que serve o treino. Olhar para isto agora ajuda a fixar.'}
            {result.wrong.length > 0 && ` As riscadas foram noutro dia.`}
          </p>
          {[...quiz.day.details.map((d) => `${d.item}: ${d.text}`), ...quiz.day.notes].slice(0, 3).map((n, i) => (
            <blockquote key={i} className="note-quote">
              {n}
            </blockquote>
          ))}
        </div>
      )}

      <div className="row">
        {!checked ? (
          <>
            <button className="primary" onClick={() => setChecked(true)}>
              {picked.length ? 'Confirmar' : 'Não me lembro — mostra-me'}
            </button>
            {!hint && (
              <button className="link" onClick={() => setHint(true)}>
                Dá-me uma pista
              </button>
            )}
          </>
        ) : (
          <>
            <button className="primary" onClick={next}>
              Outro dia
            </button>
            <button className="link" onClick={() => onOpen(quiz.day.ts)}>
              Ver o dia completo
            </button>
          </>
        )}
      </div>
    </section>
  );
}
