import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { type AnswerValue, type Session, answer, displayAnswer, start } from '../engine';
import { FLOWS, MOODS, flowById, suggestedFlowId } from '../flows';
import { saveEntry } from '../db';
import type { Entry, Message, Mood, Settings } from '../types';

function greeting(name?: string) {
  const h = new Date().getHours();
  const part = h < 5 ? 'Hi' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return `${part}${name ? `, ${name}` : ''}. What would you like to do?`;
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
const msg = (from: Message['from'], text: string): Message => ({ from, text, at: Date.now() });

export default function Chat({ dataKey, settings }: { dataKey: CryptoKey; settings: Settings }) {
  const opts = { name: settings.name, nudges: settings.nudges };
  const [msgs, setMsgs] = useState<Message[]>(() => [msg('app', greeting(settings.name))]);
  const [session, setSession] = useState<Session | null>(null);
  const [entryMeta, setEntryMeta] = useState<{ id: string; createdAt: number; from: number } | null>(null);
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [easierShown, setEasierShown] = useState(false);
  const [saveErr, setSaveErr] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const current = session?.current ?? null;
  const idle = !session || session.done;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs, current]);

  // Grow the text box with its content.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }, [text]);

  function begin(flowId: string, firstText?: string) {
    const out = start(flowId, opts);
    const base = [...msgs];
    const meta = { id: uid(), createdAt: Date.now(), from: base.length };
    const next = [...base, ...out.said.map((t) => msg('app', t))];
    setEntryMeta(meta);
    setPicked([]);
    setEasierShown(false);
    if (firstText !== undefined) {
      reply(out.session, next, meta, firstText);
    } else {
      setSession(out.session);
      setMsgs(next);
    }
  }

  function reply(s: Session, base: Message[], meta: NonNullable<typeof entryMeta>, value: AnswerValue) {
    const p = s.current!;
    const shown = displayAnswer(p, value);
    const out = answer(s, value, opts);
    const next = [...base, ...(shown ? [msg('me', shown)] : []), ...out.said.map((t) => msg('app', t))];
    if (out.session.done) next.push(msg('app', 'Anything else? You can start another below, or come back any time.'));
    setSession(out.session);
    setMsgs(next);
    setText('');
    setPicked([]);
    setEasierShown(false);
    persist(out.session, next.slice(meta.from), meta);
  }

  async function persist(s: Session, messages: Message[], meta: NonNullable<typeof entryMeta>) {
    const answered = Object.values(s.answers).some((v) => v !== undefined && !(Array.isArray(v) && !v.length));
    if (!answered) return; // nothing worth saving yet
    const flow = flowById(s.flowId);
    const a = s.answers;
    const entry: Entry = {
      id: meta.id,
      createdAt: meta.createdAt,
      updatedAt: Date.now(),
      flowId: flow.id,
      flowTitle: flow.title,
      mood: typeof a.mood === 'number' ? (a.mood as Mood) : undefined,
      feelings: Array.isArray(a.feelings) ? a.feelings : undefined,
      topics: Array.isArray(a.topics) ? a.topics : undefined,
      // Drop the closing "Anything else?" line from the saved entry.
      messages: messages.filter((m) => !(m.from === 'app' && m.text.startsWith('Anything else?'))),
    };
    try {
      await saveEntry(dataKey, entry);
      setSaveErr(false);
    } catch {
      setSaveErr(true);
    }
  }

  function send(value: AnswerValue) {
    if (!session || !entryMeta) return;
    reply(session, msgs, entryMeta, value);
  }

  function submitText() {
    const t = text.trim();
    if (!t) return;
    if (idle) begin('free', t);
    else send(t);
  }

  function applyStarter(s: string) {
    const clean = s.replace(/…$/, ' ');
    setText((t) => (t.trim() ? `${t.trimEnd()} ${clean}` : clean));
    inputRef.current?.focus();
  }

  function askEasier() {
    if (!current?.easier) return;
    setMsgs((m) => [...m, msg('app', `Let’s try it another way: ${current.easier}`)]);
    setEasierShown(true);
  }

  function stop() {
    setMsgs((m) => [...m, msg('app', 'No problem — what you wrote so far is saved.')]);
    setSession(null);
  }

  const suggested = suggestedFlowId();
  const flowsOrdered = [...FLOWS].sort((a, b) => (a.id === suggested ? -1 : b.id === suggested ? 1 : 0));

  return (
    <div className="chat">
      <div className="messages" role="log" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`bubble from-${m.from}`}>
            {m.text}
          </div>
        ))}

        {idle && (
          <div className="flows">
            {flowsOrdered.map((f) => (
              <button key={f.id} className="flow-card" onClick={() => begin(f.id)}>
                <span className="flow-title">
                  {f.title}
                  {f.id === suggested && <span className="badge">Suggested</span>}
                </span>
                <span className="flow-blurb">
                  {f.blurb} · ~{f.minutes} min
                </span>
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {saveErr && <div className="savebar warn">Couldn’t save just now. Your words are still here — try again in a moment.</div>}

      <div className="composer">
        {current?.kind === 'mood' && (
          <div className="moods" role="group" aria-label="Mood">
            {MOODS.map((m) => (
              <button key={m.value} className="mood" onClick={() => send(m.value)}>
                <span className="face" aria-hidden>{m.face}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        )}

        {current?.kind === 'choice' && (
          <div className="chips" role="group">
            {current.options!.map((o) => {
              const on = picked.includes(o);
              return (
                <button
                  key={o}
                  className={`chip ${on ? 'on' : ''}`}
                  aria-pressed={current.multi ? on : undefined}
                  onClick={() =>
                    current.multi ? setPicked((p) => (on ? p.filter((x) => x !== o) : [...p, o])) : send(o)
                  }
                >
                  {o}
                </button>
              );
            })}
          </div>
        )}

        {current?.kind === 'write' && !current.isNudge && current.starters && !text && (
          <div className="chips starters" aria-label="Sentence starters">
            {current.starters.map((s) => (
              <button key={s} className="chip ghost" onClick={() => applyStarter(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        {current && (
          <div className="actions">
            {current.kind === 'choice' && current.multi && (
              <button className="primary small" onClick={() => send(picked.length ? picked : null)}>
                {picked.length ? 'Done' : 'Skip'}
              </button>
            )}
            {current.kind === 'write' && current.easier && !easierShown && (
              <button className="link small" onClick={askEasier}>
                Ask me differently
              </button>
            )}
            {!(current.kind === 'choice' && current.multi) && (
              <button className="link small" onClick={() => send(null)}>
                Skip
              </button>
            )}
            <button className="link small" onClick={stop}>
              Stop here
            </button>
          </div>
        )}

        {(idle || current?.kind === 'write') && (
          <div className="inputrow">
            <textarea
              ref={inputRef}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitText();
              }}
              placeholder={idle ? 'Or just start typing…' : 'A few words is fine…'}
              aria-label="Your answer"
            />
            <button className="send" onClick={submitText} disabled={!text.trim()} aria-label="Send">
              ↑
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
