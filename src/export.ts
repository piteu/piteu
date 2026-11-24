import { LOCALE } from './locale';
import { MOODS } from './flows';
import { type Entry, entryTime } from './types';

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDay(ts: number): string {
  const today = dayKey(Date.now());
  const yesterday = dayKey(Date.now() - 86_400_000);
  const k = dayKey(ts);
  if (k === today) return 'Hoje';
  if (k === yesterday) return 'Ontem';
  return new Date(ts).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export const formatTime = (ts: number) => new Date(ts).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });

export const moodFace = (m?: number) => MOODS.find((x) => x.value === m)?.face ?? '';

/** The things you actually wrote in an entry (not mood taps or chip choices). */
export function writtenTexts(e: Entry): string[] {
  if (e.notes) return [...(e.details ?? []).map((d) => d.text), ...e.notes];
  // Older entries: work it out from the conversation.
  const tapped = new Set([e.feelings?.join(', '), e.topics?.join(', ')]);
  const moodLabels = new Set(MOODS.map((m) => `${m.face} ${m.label}`));
  return e.messages
    .filter((m) => m.from === 'me' && !tapped.has(m.text) && !moodLabels.has(m.text))
    .map((m) => m.text);
}

export function toMarkdown(entries: Entry[]): string {
  const lines = ['# O meu diário da Bruna', ''];
  const sorted = [...entries].sort((a, b) => entryTime(a) - entryTime(b));
  let lastDay = '';
  for (const e of sorted) {
    const day = dayKey(entryTime(e));
    if (day !== lastDay) {
      lines.push(`## ${new Date(entryTime(e)).toLocaleDateString(LOCALE, { dateStyle: 'full' })}`, '');
      lastDay = day;
    }
    lines.push(`### ${formatTime(e.createdAt)} · ${e.flowTitle} ${moodFace(e.mood)}`.trimEnd(), '');
    if (e.activities?.length) lines.push(`**Fiz:** ${e.activities.join(', ')}  `);
    for (const d of e.details ?? []) lines.push(`- *${d.item}:* ${d.text.replace(/\n+/g, ' ')}`);
    if (e.people?.length) lines.push(`**Com:** ${e.people.join(', ')}  `);
    if (e.activities?.length || e.people?.length) lines.push('');
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

/**
 * A repeating daily calendar event, so your phone's own calendar reminds you to log your day.
 * No server needed. The event text is generic; it contains nothing from your journal.
 */
export function reminderIcs(hour: number, minute: number, url: string, now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
  const local = `${start.getFullYear()}${pad(start.getMonth() + 1)}${pad(start.getDate())}T${pad(hour)}${pad(minute)}00`;
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const uid = `bruna-reminder-${hour}${pad(minute)}@bruna.local`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bruna//Daily reminder//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${local}`, // floating time: always this time of day, wherever you are
    'DURATION:PT5M',
    'RRULE:FREQ=DAILY',
    'SUMMARY:Bruna: o que fizeste hoje?',
    'DESCRIPTION:Tira um minuto para registar o teu dia na Bruna.',
    `URL:${url}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:O que fizeste hoje? Regista na Bruna.',
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
