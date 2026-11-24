import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { type AnswerValue, type Session, answer, displayAnswer, skipFollowups, start } from '../engine';
import { daySummary } from '../details';
import { type Answers, DAY, MOODS, NO_ONE, flowById, suggestedFlowId } from '../flows';
import { listEntries, saveEntry } from '../db';
import { known, yesterdayMissing } from '../memory';
import Home, { FlowGrid } from './Home';
import type { Entry, Message, Mood, Settings } from '../types';


const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
const END_PROMPT = 'Mais alguma coisa? Podes começar outro abaixo, ou voltar quando quiseres.';
const msg = (from: Message['from'], text: string): Message => ({ from, text, at: Date.now() });

/** Ask the chat to start a check-in, e.g. from a tapped notification. `n` makes each request unique. */
export interface ChatRequest {
  flow: string;
  preset?: Answers;
  intro?: string;
  n: number;
}

export default function Chat({
  dataKey,
  settings,
  active,
  request,
  onGo,
}: {
  dataKey: CryptoKey;
  settings: Settings;
  active: boolean;
  request?: ChatRequest | null;
  onGo: (tab: 'memory' | 'week' | 'insights') => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const handled = useRef(0);
  const opts = { name: settings.name, nudges: settings.nudges, known: known(entries) };
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [entryMeta, setEntryMeta] = useState<{ id: string; createdAt: number; from: number } | null>(null);
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [easierShown, setEasierShown] = useState(false);
  const [saveErr, setSaveErr] = useState(false);
  const [extra, setExtra] = useState<string[]>([]); // options you added yourself to the current question
  const [adding, setAdding] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);

  const current = session?.current ?? null;
  const idle = !session || session.done;

  // Refresh what we know from past entries whenever this tab is shown.
  useEffect(() => {
    if (active)
      listEntries(dataKey)
        .then(setEntries)
        .catch(() => {})
        .finally(() => setLoaded(true));
  }, [active, dataKey]);

  // Start a requested check-in once past entries are loaded (so your people and activities are there),
  // unless one is already in progress.
  useEffect(() => {
    if (!request || !loaded || handled.current === request.n) return;
    handled.current = request.n;
    if (session && !session.done) return;
    begin(request.flow, undefined, request.preset, request.intro);
  }, [request, loaded]);

  // In a conversation, follow the latest message; on the main page, stay at the top.
  const showingHome = (!session || session.done) && msgs.length === 0;
  useEffect(() => {
    if (showingHome) logRef.current?.scrollTo({ top: 0 });
    else endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs, current, showingHome]);

  // Grow the text box with its content.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }, [text]);

  function resetInputs() {
    setPicked([]);
    setEasierShown(false);
    setExtra([]);
    setAdding('');
    setAddOpen(false);
  }

  function begin(flowId: string, firstText?: string, preset?: Answers, intro?: string) {
    const out = start(flowId, opts, preset);
    const base = [...msgs, ...(intro ? [msg('app', intro)] : [])];
    const meta = { id: uid(), createdAt: Date.now(), from: base.length };
    const next = [...base, ...out.said.map((t) => msg('app', t))];
    setEntryMeta(meta);
    resetInputs();
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
    finish(answer(s, value, opts), [...base, ...(shown ? [msg('me', shown)] : [])], meta);
  }

  function finish(out: ReturnType<typeof answer>, base: Message[], meta: NonNullable<typeof entryMeta>) {
    const next = [...base, ...out.said.map((t) => msg('app', t))];
    if (out.session.done) {
      const summary = daySummary(factsOf(out.session));
      if (summary) {
        next.push(msg('app', 'Aqui está o teu dia em poucas linhas — dá jeito se quiseres contar a alguém. Voltas a encontrá-lo em Memória.'));
        next.push(msg('app', summary));
      }
      next.push(msg('app', END_PROMPT));
    }
    setSession(out.session);
    setMsgs(next);
    setText('');
    resetInputs();
    persist(out.session, next.slice(meta.from), meta);
  }

  function factsOf(s: Session) {
    const a = s.answers;
    const list = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
    return {
      activities: list(a.activities),
      people: list(a.people).filter((x) => x !== NO_ONE),
      details: Object.entries(a)
        .filter(([k, v]) => k.startsWith('about:') && typeof v === 'string' && v.trim())
        .map(([k, v]) => ({ item: k.slice(6), text: v as string })),
      mood: typeof a.mood === 'number' ? a.mood : undefined,
    };
  }

  async function persist(s: Session, messages: Message[], meta: NonNullable<typeof entryMeta>) {
    const answered = Object.values(s.answers).some((v) => v !== undefined && !(Array.isArray(v) && !v.length));
    if (!answered) return; // nothing worth saving yet
    const flow = flowById(s.flowId);
    const a = s.answers;
    const list = (v: unknown) => (Array.isArray(v) && v.length ? (v as string[]) : undefined);
    const writeIds = new Set(flow.steps.flatMap((st) => (st.kind === 'write' ? [st.id] : [])));
    const notes = [...writeIds].map((id) => a[id]).filter((v): v is string => typeof v === 'string' && !!v.trim());

    // Which day is this about? (Filling in yesterday, or an evening check-in after midnight.)
    const made = new Date(meta.createdAt);
    const back = a.day === DAY.yesterday ? 1 : a.day === DAY.before ? 2 : flow.id === 'evening' && made.getHours() < 4 ? 1 : 0;
    const aboutAt = back
      ? new Date(made.getFullYear(), made.getMonth(), made.getDate() - back, a.day ? 12 : 23).getTime()
      : undefined;

    const entry: Entry = {
      id: meta.id,
      createdAt: meta.createdAt,
      updatedAt: Date.now(),
      flowId: flow.id,
      flowTitle: flow.title,
      mood: typeof a.mood === 'number' ? (a.mood as Mood) : undefined,
      feelings: Array.isArray(a.feelings) ? a.feelings : undefined,
      topics: Array.isArray(a.topics) ? a.topics : undefined,
      activities: list(a.activities),
      people: list((list(a.people) ?? []).filter((x) => x !== NO_ONE)),
      notes,
      details: factsOf(s).details,
      aboutAt,
      // Drop the closing "Anything else?" line from the saved entry.
      messages: messages.filter((m) => !(m.from === 'app' && m.text === END_PROMPT)),
    };
    try {
      await saveEntry(dataKey, entry);
      setEntries((es) => [entry, ...es.filter((x) => x.id !== entry.id)]);
      setSaveErr(false);
    } catch {
      setSaveErr(true);
    }
  }

  function toggle(o: string) {
    setPicked((p) => {
      if (p.includes(o)) return p.filter((x) => x !== o);
      // "No one" can't be combined with names.
      if (o === NO_ONE) return [o];
      return [...p.filter((x) => x !== NO_ONE), o];
    });
  }

  function addOwn() {
    let v = adding.trim().replace(/\s+/g, ' ');
    if (!v || !current) return;
    // Names typed all in lowercase get capitals: "joana silva" → "Joana Silva".
    if (current.id === 'people' && v === v.toLowerCase()) v = v.replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
    // Reuse the existing spelling if it's already an option (e.g. "rita" → "Rita").
    const match = [...extra, ...(current.options ?? [])].find((o) => o.toLowerCase() === v.toLowerCase());
    const val = match ?? v;
    if (!match) setExtra((x) => [...x, val]);
    if (current.multi) setPicked((p) => (p.includes(val) ? p : [...p.filter((x) => x !== NO_ONE), val]));
    else send(val);
    setAdding('');
    setAddOpen(false);
    // Show the new chip (it's added at the top of the list).
    requestAnimationFrame(() => chipsRef.current?.scrollTo({ top: 0, behavior: 'smooth' }));
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
    setMsgs((m) => [...m, msg('app', `Vamos tentar de outra forma: ${current.easier}`)]);
    setEasierShown(true);
  }

  function stop() {
    setMsgs((m) => [...m, msg('app', 'Não faz mal — o que escreveste até aqui ficou guardado.')]);
    setSession(null);
  }

  const suggested = suggestedFlowId();
  const showYesterday = entries.length > 0 && yesterdayMissing(entries);
  const onHome = idle && msgs.length === 0;

  return (
    <div className="chat">
      <div className="messages" role="log" aria-live="polite" ref={logRef}>
        {msgs.map((m, i) => (
          <div key={i} className={`bubble from-${m.from}`}>
            {m.text}
          </div>
        ))}

        {onHome && (
          <Home
            name={settings.name}
            entries={entries}
            suggested={suggested}
            showYesterday={showYesterday}
            onStart={(id, preset, intro) => begin(id, undefined, preset, intro)}
            onGo={onGo}
          />
        )}

        {idle && !onHome && (
          <div className="after">
            <FlowGrid onStart={(id) => begin(id)} />
            <button className="link small back-home" onClick={() => setMsgs([])}>
              ← Voltar ao início
            </button>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {saveErr && <div className="savebar warn">Não foi possível guardar agora. As tuas palavras continuam aqui — tenta daqui a pouco.</div>}

      <div className="composer">
        {current?.kind === 'mood' && (
          <div className="moods" role="group" aria-label="Humor">
            {MOODS.map((m) => (
              <button key={m.value} className="mood" onClick={() => send(m.value)}>
                <span className="face" aria-hidden>{m.face}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        )}

        {current?.kind === 'choice' && (
          <div className="chips choice" role="group" ref={chipsRef}>
            {[...extra, ...current.options!.filter((o) => !extra.includes(o))].map((o) => {
              const on = picked.includes(o);
              return (
                <button
                  key={o}
                  className={`chip ${on ? 'on' : ''}`}
                  aria-pressed={current.multi ? on : undefined}
                  onClick={() => (current.multi ? toggle(o) : send(o))}
                >
                  {o}
                </button>
              );
            })}
            {current.other && !addOpen && (
              <button className="chip ghost" onClick={() => setAddOpen(true)}>
                + {current.other}
              </button>
            )}
          </div>
        )}

        {current?.kind === 'choice' && addOpen && (
          <form
            className="inputrow"
            onSubmit={(e) => {
              e.preventDefault();
              addOwn();
            }}
          >
            <input
              autoFocus
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              placeholder={current.id === 'people' ? 'O nome' : 'p. ex. Escalada'}
              autoCapitalize={current.id === 'people' ? 'words' : 'sentences'}
              aria-label={current.other}
              maxLength={40}
            />
            <button className="primary small" disabled={!adding.trim()}>
              Acrescentar
            </button>
          </form>
        )}

        {current?.kind === 'write' && !current.isNudge && current.starters && !text && (
          <div className="chips starters" aria-label="Inícios de frase">
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
                {picked.length ? 'Feito' : 'Saltar'}
              </button>
            )}
            {current.kind === 'write' && current.easier && !easierShown && (
              <button className="link small" onClick={askEasier}>
                Pergunta de outra forma
              </button>
            )}
            {!(current.kind === 'choice' && current.multi) && (
              <button className="link small" onClick={() => send(null)}>
                Saltar
              </button>
            )}
            {current.about && (
              <button
                className="link small"
                onClick={() => {
                  if (!session || !entryMeta) return;
                  finish(skipFollowups(session, opts), msgs, entryMeta);
                }}
              >
                Chega de perguntas
              </button>
            )}
            <button className="link small" onClick={stop}>
              Parar aqui
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
              placeholder={idle ? 'Ou começa simplesmente a escrever…' : 'Bastam umas palavras…'}
              aria-label="A tua resposta"
            />
            <button className="send" onClick={submitText} disabled={!text.trim()} aria-label="Enviar">
              ↑
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
