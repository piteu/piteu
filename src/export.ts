import { MOODS } from './flows';
import type { Entry } from './types';

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDay(ts: number): string {
  const today = dayKey(Date.now());
  const yesterday = dayKey(Date.now() - 86_400_000);
  const k = dayKey(ts);
  if (k === today) return 'Today';
  if (k === yesterday) return 'Yesterday';
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export const formatTime = (ts: number) => new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export const moodFace = (m?: number) => MOODS.find((x) => x.value === m)?.face ?? '';

/** The things you actually wrote in an entry (not mood taps or chip choices). */
export function writtenTexts(e: Entry): string[] {
  const tapped = new Set([e.feelings?.join(', '), e.topics?.join(', ')]);
  const moodLabels = new Set(MOODS.map((m) => `${m.face} ${m.label}`));
  return e.messages
    .filter((m) => m.from === 'me' && !tapped.has(m.text) && !moodLabels.has(m.text))
    .map((m) => m.text);
}

export function toMarkdown(entries: Entry[]): string {
  const lines = ['# My Piteu journal', ''];
  const sorted = [...entries].sort((a, b) => a.createdAt - b.createdAt);
  let lastDay = '';
  for (const e of sorted) {
    const day = dayKey(e.createdAt);
    if (day !== lastDay) {
      lines.push(`## ${new Date(e.createdAt).toLocaleDateString(undefined, { dateStyle: 'full' })}`, '');
      lastDay = day;
    }
    lines.push(`### ${formatTime(e.createdAt)} · ${e.flowTitle} ${moodFace(e.mood)}`.trimEnd(), '');
    for (const m of e.messages) {
      lines.push(m.from === 'app' ? `*${m.text}*` : m.text.split('\n').map((l) => `> ${l}`).join('\n'), '');
    }
  }
  return lines.join('\n');
}

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
