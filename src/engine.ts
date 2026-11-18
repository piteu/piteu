import { type Answers, type Ctx, type Step, flowById, MOODS } from './flows';
import { followupsFor } from './details';

/** The question currently waiting for an answer, with all text resolved. */
export interface Prompt {
  kind: 'mood' | 'choice' | 'write';
  id: string;
  stepIndex: number;
  text: string;
  options?: string[];
  multi?: boolean;
  other?: string; // label for "add your own"
  starters?: string[];
  easier?: string;
  isNudge?: boolean;
  /** Set on follow-up questions: the activity or person being asked about. */
  about?: string;
}

export interface Session {
  flowId: string;
  next: number; // index of the next step to look at
  answers: Answers;
  nudged: boolean; // at most one nudge per session
  current: Prompt | null;
  done: boolean;
  /** Follow-up questions still to ask. */
  queue: Prompt[];
}

export interface Opts {
  name?: string;
  nudges?: boolean;
  known?: Ctx['known'];
}

export interface Out {
  session: Session;
  /** New messages from the app, in order. */
  said: string[];
}

const resolve = <V>(v: V | ((c: Ctx) => V), c: Ctx): V => (typeof v === 'function' ? (v as (c: Ctx) => V)(c) : v);

export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function toPrompt(step: Step, i: number, c: Ctx): Prompt {
  switch (step.kind) {
    case 'mood':
      return { kind: 'mood', id: step.id, stepIndex: i, text: resolve(step.text, c) };
    case 'choice':
      return {
        kind: 'choice', id: step.id, stepIndex: i, text: resolve(step.text, c),
        options: resolve(step.options, c), multi: step.multi, other: step.other,
      };
    case 'write':
      return {
        kind: 'write', id: step.id, stepIndex: i, text: resolve(step.text, c),
        starters: step.starters ? resolve(step.starters, c) : undefined,
        easier: step.easier ? resolve(step.easier, c) : undefined,
      };
    default:
      throw new Error('not interactive');
  }
}

function advance(s: Session, opts: Opts, said: string[]): Out {
  if (s.queue.length) {
    const [p, ...rest] = s.queue;
    said.push(p.text);
    return { session: { ...s, current: p, queue: rest }, said };
  }
  const flow = flowById(s.flowId);
  const c: Ctx = { answers: s.answers, name: opts.name, known: opts.known };
  for (let i = s.next; i < flow.steps.length; i++) {
    const step = flow.steps[i];
    if (step.when && !step.when(c)) continue;
    if (step.kind === 'say') {
      said.push(resolve(step.text, c));
      continue;
    }
    if (step.kind === 'followups') {
      const qs: Prompt[] = followupsFor(c, step.max).map((f) => ({
        kind: 'write', id: `about:${f.item}`, stepIndex: i, text: f.text, starters: f.starters, easier: f.easier, about: f.item,
      }));
      if (!qs.length) continue;
      // Remember what was asked about, so later steps can tell follow-ups happened.
      const answers = { ...s.answers, followups: qs.map((q) => q.about!) };
      return advance({ ...s, answers, next: i + 1, queue: qs }, opts, said);
    }
    const p = toPrompt(step, i, c);
    said.push(p.text);
    return { session: { ...s, next: i + 1, current: p }, said };
  }
  return { session: { ...s, next: flow.steps.length, current: null, done: true }, said };
}

export function start(flowId: string, opts: Opts = {}, preset: Answers = {}): Out {
  const s: Session = { flowId, next: 0, answers: { ...preset }, nudged: false, current: null, done: false, queue: [] };
  return advance(s, opts, []);
}

export type AnswerValue = string | string[] | number | null; // null = skipped

export function answer(s: Session, value: AnswerValue, opts: Opts = {}): Out {
  const p = s.current;
  if (!p) return { session: s, said: [] };
  const answers = { ...s.answers };

  if (p.isNudge) {
    if (typeof value === 'string' && value.trim()) {
      const prev = answers[p.id];
      answers[p.id] = typeof prev === 'string' && prev ? `${prev}\n${value}` : value;
    }
    return advance({ ...s, answers, current: null }, opts, []);
  }

  answers[p.id] = value === null ? undefined : value;
  const step = flowById(s.flowId).steps[p.stepIndex];

  // One gentle "tell me a bit more" after a very short written answer.
  if (
    opts.nudges !== false && !s.nudged && step.kind === 'write' && step.nudge &&
    typeof value === 'string' && value.trim() && wordCount(value) <= 3
  ) {
    const text = resolve(step.nudge, { answers, name: opts.name, known: opts.known });
    const nudge: Prompt = { kind: 'write', id: p.id, stepIndex: p.stepIndex, text, isNudge: true };
    return { session: { ...s, answers, nudged: true, current: nudge }, said: [text] };
  }

  return advance({ ...s, answers, current: null }, opts, []);
}

/** Skip the remaining follow-up questions and carry on with the check-in. */
export function skipFollowups(s: Session, opts: Opts = {}): Out {
  return advance({ ...s, queue: [], current: null }, opts, []);
}

/** What the user's answer looks like as a chat bubble. */
export function displayAnswer(p: Prompt, value: AnswerValue): string | null {
  if (value === null || value === undefined) return null;
  if (p.kind === 'mood') {
    const m = MOODS.find((x) => x.value === value);
    return m ? `${m.face} ${m.label}` : String(value);
  }
  if (Array.isArray(value)) return value.length ? value.join(', ') : null;
  return String(value);
}
