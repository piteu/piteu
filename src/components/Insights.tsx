import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { listEntries } from '../db';
import { MOODS } from '../flows';
import { type Bucket, type Range, currentStreak, summarize } from '../insights';
import type { Entry } from '../types';

const moodNear = (v: number) => MOODS[Math.min(4, Math.max(0, Math.round(v) - 1))];
const fmtMood = (v: number) => `${moodNear(v).face} ${moodNear(v).label}`;
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

// Portuguese needs different words around each range ("esta semana", "este mês").
const R = {
  week: { tab: 'Semana', this: 'esta semana', prevIn: 'na semana anterior', prevTo: 'à semana anterior', prev: 'Semana anterior', next: 'Semana seguinte' },
  month: { tab: 'Mês', this: 'este mês', prevIn: 'no mês anterior', prevTo: 'ao mês anterior', prev: 'Mês anterior', next: 'Mês seguinte' },
  year: { tab: 'Ano', this: 'este ano', prevIn: 'no ano anterior', prevTo: 'ao ano anterior', prev: 'Ano anterior', next: 'Ano seguinte' },
} as const;

export default function Insights({ dataKey }: { dataKey: CryptoKey }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [range, setRange] = useState<Range>('week');
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    listEntries(dataKey).then(setEntries);
  }, [dataKey]);

  const s = useMemo(() => (entries ? summarize(entries, range, offset) : null), [entries, range, offset]);
  const streak = useMemo(() => (entries ? currentStreak(entries) : 0), [entries]);

  if (!entries || !s) return <div className="center muted">A fazer as contas…</div>;

  const w = R[range];
  const checkDelta = s.checkins - s.prevCheckins;
  const moodDelta = s.avgMood !== undefined && s.prevAvgMood !== undefined ? s.avgMood - s.prevAvgMood : undefined;

  return (
    <div className="page insights">
      <h1>Resumo</h1>

      <div className="segmented" role="tablist" aria-label="Período">
        {(['week', 'month', 'year'] as Range[]).map((r) => (
          <button
            key={r}
            role="tab"
            aria-selected={range === r}
            className={range === r ? 'on' : ''}
            onClick={() => {
              setRange(r);
              setOffset(0);
            }}
          >
            {R[r].tab}
          </button>
        ))}
      </div>

      <div className="periodnav">
        <button className="link" onClick={() => setOffset((o) => o - 1)} aria-label={w.prev}>
          ‹
        </button>
        <span>{s.period.label}</span>
        <button className="link" onClick={() => setOffset((o) => o + 1)} disabled={offset >= 0} aria-label={w.next}>
          ›
        </button>
      </div>

      <div className="tiles">
        <Tile
          label="Check-ins"
          value={String(s.checkins)}
          delta={!s.prevCheckins ? undefined : checkDelta ? `${checkDelta > 0 ? '+' : '−'}${Math.abs(checkDelta)} face ${w.prevTo}` : `Igual ${w.prevTo}`}
        />
        <Tile label="Dias com registo" value={String(s.daysJournaled)} delta={`de ${plural(s.daysSoFar, 'dia')} até agora`} />
        <Tile
          label="Humor médio"
          value={s.avgMood !== undefined ? fmtMood(s.avgMood) : '—'}
          delta={
            moodDelta === undefined
              ? s.avgMood !== undefined
                ? `${s.avgMood.toFixed(1).replace('.', ',')} em 5`
                : 'Ainda sem humor registado'
              : Math.abs(moodDelta) < 0.25
                ? `Parecido ${w.prevTo}`
                : `${moodDelta > 0 ? '↑ Melhor' : '↓ Pior'} do que ${w.prevIn}`
          }
        />
        <Tile label="Dias seguidos" value={plural(streak, 'dia')} delta={streak ? 'Continua assim' : 'Começa hoje'} />
      </div>

      {s.checkins === 0 ? (
        <p className="muted empty">Sem check-ins {w.this}. Experimenta outro período com as setas acima.</p>
      ) : (
        <>
          <section className="card">
            <h2>Humor</h2>
            <MoodChart buckets={s.buckets} range={range} avg={s.avgMood} />
          </section>

          {s.feelings.length > 0 && (
            <section className="card">
              <h2>Sentimentos que escolheste mais</h2>
              <Bars rows={s.feelings.slice(0, 6).map((f) => ({ label: f.name, n: f.n }))} />
            </section>
          )}

          {s.topics.length > 0 && (
            <section className="card">
              <h2>Sobre o que foi</h2>
              <p className="muted small hint">Quantas vezes surgiu cada tema, e a carinha do teu humor habitual nessas alturas.</p>
              <Bars
                rows={s.topics.slice(0, 6).map((t) => ({
                  label: t.name,
                  n: t.n,
                  note: t.avg !== undefined ? moodNear(t.avg).face : undefined,
                  noteLabel: t.avg !== undefined ? `normalmente ${moodNear(t.avg).label.toLowerCase()}` : undefined,
                }))}
              />
            </section>
          )}

          {s.activities.length > 0 && (
            <section className="card">
              <h2>O que fizeste mais</h2>
              <p className="muted small hint">Com a carinha do teu humor habitual nesses dias.</p>
              <Bars
                rows={s.activities.slice(0, 6).map((t) => ({
                  label: t.name,
                  n: t.n,
                  note: t.avg !== undefined ? moodNear(t.avg).face : undefined,
                  noteLabel: t.avg !== undefined ? `normalmente ${moodNear(t.avg).label.toLowerCase()}` : undefined,
                }))}
              />
            </section>
          )}

          {s.people.length > 0 && (
            <section className="card">
              <h2>Com quem estiveste mais</h2>
              <Bars rows={s.people.slice(0, 6).map((t) => ({ label: t.name, n: t.n }))} />
            </section>
          )}

          {range !== 'week' && s.weekdays.filter((d) => d.n).length >= 3 && (
            <section className="card">
              <h2>Humor por dia da semana</h2>
              <Weekdays days={s.weekdays} />
            </section>
          )}

          {s.words > 0 && (
            <p className="muted small center-text">Escreveste {plural(s.words, 'palavra')} {w.this}.</p>
          )}
        </>
      )}
    </div>
  );
}

function Tile({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      {delta && <span className="tile-delta">{delta}</span>}
    </div>
  );
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(320);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function MoodChart({ buckets, range, avg }: { buckets: Bucket[]; range: Range; avg?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => setSel(null), [buckets]);

  const H = 176;
  const pad = { l: 30, r: 10, t: 10, b: 24 };
  const iw = Math.max(10, width - pad.l - pad.r);
  const ih = H - pad.t - pad.b;
  const band = iw / buckets.length;
  const x = (i: number) => pad.l + band * (i + 0.5);
  const y = (m: number) => pad.t + ih - ((m - 1) / 4) * ih;

  const pts = buckets.map((b, i) => ({ i, b })).filter((p) => p.b.avg !== undefined);
  const path = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.b.avg!).toFixed(1)}`).join('');
  const showLabel = (i: number) =>
    range !== 'month' || i === 0 || (i + 1) % 5 === 0;

  const pick = (clientX: number, rect: DOMRect) => {
    const i = Math.floor((clientX - rect.left - pad.l) / band);
    setSel(Math.max(0, Math.min(buckets.length - 1, i)));
  };

  const cur = sel !== null ? buckets[sel] : null;
  const readout = cur
    ? cur.avg !== undefined
      ? `${cur.long} · ${fmtMood(cur.avg)} · ${plural(cur.n, 'check-in')}`
      : `${cur.long} · ${cur.future ? 'Ainda não chegou' : 'Sem humor registado'}`
    : avg !== undefined
      ? `Média ${fmtMood(avg)} · toca no gráfico para ver detalhes`
      : 'Toca no gráfico para ver detalhes';

  return (
    <div ref={ref} className="moodchart">
      <p className="readout" aria-live="polite">
        {readout}
      </p>
      <svg width={width} height={H} role="img" aria-label="Humor ao longo do tempo">
        {MOODS.map((m) => (
          <g key={m.value}>
            <line x1={pad.l} x2={width - pad.r} y1={y(m.value)} y2={y(m.value)} className="grid" />
            <text x={pad.l - 8} y={y(m.value)} className="ytick" textAnchor="end" dominantBaseline="central">
              {m.face}
            </text>
          </g>
        ))}
        {buckets.map((b, i) =>
          showLabel(i) ? (
            <text key={i} x={x(i)} y={H - 6} className={`xtick ${b.future ? 'future' : ''}`} textAnchor="middle">
              {b.short}
            </text>
          ) : null,
        )}
        {cur && <line x1={x(sel!)} x2={x(sel!)} y1={pad.t} y2={pad.t + ih} className="crosshair" />}
        {pts.length > 1 && <path d={path} className="moodline" />}
        {pts.map((p) => (
          <circle key={p.i} cx={x(p.i)} cy={y(p.b.avg!)} r={p.i === sel ? 6 : 4} className="mooddot" />
        ))}
        <rect
          x={pad.l}
          y={0}
          width={iw}
          height={H}
          fill="transparent"
          tabIndex={0}
          aria-label="Gráfico do humor. Usa as setas para a esquerda e para a direita para ler cada ponto."
          onPointerDown={(e) => pick(e.clientX, e.currentTarget.ownerSVGElement!.getBoundingClientRect())}
          onPointerMove={(e) => e.pointerType === 'mouse' && pick(e.clientX, e.currentTarget.ownerSVGElement!.getBoundingClientRect())}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setSel(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') setSel((s) => Math.min(buckets.length - 1, (s ?? -1) + 1));
            if (e.key === 'ArrowLeft') setSel((s) => Math.max(0, (s ?? buckets.length) - 1));
          }}
          onBlur={() => setSel(null)}
          style={{ outline: 'none', touchAction: 'pan-y' }}
        />
      </svg>
      <details className="tableview">
        <summary>Ver como tabela</summary>
        <table>
          <thead>
            <tr>
              <th>{range === 'year' ? 'Mês' : 'Dia'}</th>
              <th>Humor</th>
              <th>Check-ins</th>
            </tr>
          </thead>
          <tbody>
            {buckets
              .filter((b) => b.n)
              .map((b) => (
                <tr key={b.start}>
                  <td>{b.long}</td>
                  <td>{fmtMood(b.avg!)} ({b.avg!.toFixed(1).replace('.', ',')})</td>
                  <td>{b.n}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function Bars({ rows }: { rows: { label: string; n: number; note?: string; noteLabel?: string }[] }) {
  const max = Math.max(...rows.map((r) => r.n), 1);
  return (
    <ul className="bars">
      {rows.map((r) => (
        <li key={r.label} aria-label={`${r.label}: ${plural(r.n, 'vez', 'vezes')}${r.noteLabel ? `, ${r.noteLabel}` : ''}`}>
          <span className="bar-label">{r.label}</span>
          <span className="bar-track">
            <span className="bar" style={{ width: `calc((100% - 4.5em) * ${r.n / max})` }} />
            <span className="bar-value">
              {r.n}× {r.note && <span className="bar-note">{r.note}</span>}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Weekdays({ days }: { days: { label: string; avg?: number; n: number }[] }) {
  return (
    <div className="weekdays">
      {days.map((d) => (
        <div
          key={d.label}
          className="wd"
          aria-label={d.avg !== undefined ? `${d.label}: ${fmtMood(d.avg)}, ${plural(d.n, 'check-in')}` : `${d.label}: sem dados`}
        >
          <span className="wd-col">
            {d.avg !== undefined && (
              <span className="wd-bar" style={{ height: `${(d.avg / 5) * 100}%` }}>
                <span className="wd-face">{moodNear(d.avg).face}</span>
              </span>
            )}
          </span>
          <span className="wd-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
