import { LOCALE } from '../locale';
import { useEffect, useMemo, useState } from 'react';
import { deleteEntry, listEntries } from '../db';
import { dayKey, formatDay, formatTime, moodFace, writtenTexts } from '../export';
import { type Entry, entryTime } from '../types';

export default function Journal({ dataKey }: { dataKey: CryptoKey }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Entry | null>(null);

  useEffect(() => {
    listEntries(dataKey).then((es) => setEntries(es.sort((a, b) => entryTime(b) - entryTime(a))));
  }, [dataKey]);

  const filtered = useMemo(() => {
    if (!entries) return [];
    const s = q.trim().toLowerCase();
    if (!s) return entries;
    return entries.filter((e) =>
      [e.flowTitle, ...(e.feelings ?? []), ...(e.topics ?? []), ...(e.activities ?? []), ...(e.people ?? []), ...e.messages.map((m) => m.text)]
        .join(' ')
        .toLowerCase()
        .includes(s),
    );
  }, [entries, q]);

  const groups = useMemo(() => {
    const out: { day: string; label: string; items: Entry[] }[] = [];
    for (const e of filtered) {
      const k = dayKey(entryTime(e));
      if (out.length && out[out.length - 1].day === k) out[out.length - 1].items.push(e);
      else out.push({ day: k, label: formatDay(entryTime(e)), items: [e] });
    }
    return out;
  }, [filtered]);

  if (open) {
    return (
      <EntryView
        entry={open}
        onBack={() => setOpen(null)}
        onDelete={async () => {
          await deleteEntry(open.id);
          setEntries((list) => list?.filter((x) => x.id !== open.id) ?? null);
          setOpen(null);
        }}
      />
    );
  }

  if (!entries) return <div className="center muted">A abrir o teu diário…</div>;

  return (
    <div className="page">
      <h1>Diário</h1>
      <MoodStrip entries={entries} />
      {entries.length > 0 && (
        <input className="search" type="search" placeholder="Pesquisar nos teus registos" value={q} onChange={(e) => setQ(e.target.value)} />
      )}
      {entries.length === 0 && <p className="muted">Ainda não há nada. Os teus check-ins vão aparecer aqui.</p>}
      {entries.length > 0 && groups.length === 0 && <p className="muted">Nenhum registo corresponde a “{q}”.</p>}
      {groups.map((g) => (
        <section key={g.day} className="day">
          <h2>{g.label}</h2>
          {g.items.map((e) => {
            const preview = entryPreview(e);
            return (
              <button key={e.id} className="entry-row" onClick={() => setOpen(e)}>
                <span className="entry-mood" aria-hidden>{moodFace(e.mood) || '📝'}</span>
                <span className="entry-main">
                  <span className="entry-title">
                    {e.flowTitle} <span className="muted">· {formatTime(e.createdAt)}</span>
                  </span>
                  <span className="entry-preview">{preview}</span>
                </span>
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}

/** Mood over the last 14 days: one dot per day (average if several check-ins). */
function MoodStrip({ entries }: { entries: Entry[] }) {
  const days = useMemo(() => {
    const byDay = new Map<string, number[]>();
    for (const e of entries) if (e.mood) {
      const k = dayKey(entryTime(e));
      byDay.set(k, [...(byDay.get(k) ?? []), e.mood]);
    }
    const out = [];
    for (let i = 13; i >= 0; i--) {
      const ts = Date.now() - i * 86_400_000;
      const v = byDay.get(dayKey(ts));
      const avg = v ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : undefined;
      out.push({ ts, avg });
    }
    return out;
  }, [entries]);

  if (!entries.some((e) => e.mood)) return null;
  return (
    <div className="moodstrip" aria-label="Humor nas últimas duas semanas">
      {days.map((d) => (
        <div key={d.ts} className="moodday" title={new Date(d.ts).toLocaleDateString(LOCALE)}>
          <span className={`dot m${d.avg ?? 0}`}>{d.avg ? moodFace(d.avg) : ''}</span>
          <span className="dow">{new Date(d.ts).toLocaleDateString(LOCALE, { weekday: 'narrow' })}</span>
        </div>
      ))}
    </div>
  );
}

function EntryView({ entry, onBack, onDelete }: { entry: Entry; onBack: () => void; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="page">
      <button className="link back" onClick={onBack}>
        ← Diário
      </button>
      <h1>
        {entry.flowTitle} {moodFace(entry.mood)}
      </h1>
      <p className="muted">
        {formatDay(entry.createdAt)} · {formatTime(entry.createdAt)}
      </p>
      {entry.aboutAt && <p className="muted small">Sobre {formatDay(entry.aboutAt).toLowerCase()}, escrito mais tarde.</p>}
      {(entry.feelings?.length || entry.topics?.length || entry.activities?.length || entry.people?.length) ? (
        <div className="tags">
          {[...(entry.activities ?? []), ...(entry.people ?? []), ...(entry.feelings ?? []), ...(entry.topics ?? [])].map((t) => (
            <span key={t} className="tag">{t}</span>
          ))}
        </div>
      ) : null}
      <div className="transcript">
        {entry.messages.map((m, i) => (
          <div key={i} className={`bubble from-${m.from}`}>
            {m.text}
          </div>
        ))}
      </div>
      {!confirm ? (
        <button className="link danger" onClick={() => setConfirm(true)}>
          Apagar este registo
        </button>
      ) : (
        <div className="confirm">
          <span>Apagar de vez?</span>
          <button className="danger-btn" onClick={onDelete}>Apagar</button>
          <button className="link" onClick={() => setConfirm(false)}>Cancelar</button>
        </div>
      )}
    </div>
  );
}

function entryPreview(e: Entry): string {
  const written = writtenTexts(e);
  if (written.length) return [...written].sort((a, b) => b.length - a.length)[0];
  return [...(e.feelings ?? []), ...(e.topics ?? [])].join(', ');
}
