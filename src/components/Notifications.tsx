import { useState } from 'react';
import { DEFAULT_AT, KIND_INFO, type Kind, githubRepo, makeCode, support, turnOff, turnOn } from '../notify';
import type { Settings } from '../types';

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 … 23:00
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

export default function Notifications({ settings, onSettings }: { settings: Settings; onSettings: (s: Settings) => void }) {
  const push = settings.push;
  const [at, setAt] = useState<Record<Kind, number | null>>(push?.at ?? DEFAULT_AT);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [changed, setChanged] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [note, setNote] = useState('');
  const state = support();
  const repo = githubRepo();
  const gh = (path: string) => (repo ? `https://github.com/${repo}${path}` : 'https://github.com');

  async function enable() {
    setErr('');
    setNote('');
    setBusy(true);
    try {
      const p = await turnOn(at, push);
      onSettings({ ...settings, push: p });
      setChanged(!!push); // reconnecting gives a new code
      setCopied(false);
    } catch (e) {
      setErr((e as Error).message || String(e));
    } finally {
      setBusy(false);
    }
  }

  function setHour(kind: Kind, v: string) {
    const next = { ...at, [kind]: v === 'off' ? null : Number(v) };
    setAt(next);
    if (push) {
      onSettings({ ...settings, push: { ...push, at: next } });
      setChanged(true);
      setCopied(false);
    }
  }

  async function copy() {
    if (!push) return;
    try {
      await navigator.clipboard.writeText(makeCode(push));
      setCopied(true);
    } catch {
      setShowCode(true);
    }
  }

  return (
    <section className="card notifications">
      <h2>Notifications</h2>

      {state === 'install' && (
        <p className="small">
          To get notifications on iPhone, open Bruna from its <b>home-screen icon</b> (not from Safari), then come back
          here. You need iOS 16.4 or newer.
        </p>
      )}
      {state === 'unsupported' && (
        <p className="small">This browser can’t show notifications. The calendar reminder below works everywhere.</p>
      )}

      {state === 'ok' && (
        <>
          <p className="small">Choose what Bruna reminds you about, and when. Times are in your time zone.</p>
          <div className="notif-list">
            {KIND_INFO.map((k) => (
              <label key={k.kind} className="notif-row">
                <span>
                  <span className="notif-label">{k.label}</span>
                  <span className="muted small"> · {k.when}</span>
                </span>
                <select value={at[k.kind] ?? 'off'} onChange={(e) => setHour(k.kind, e.target.value)}>
                  <option value="off">Off</option>
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {hh(h)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {!push ? (
            <button className="primary block" disabled={busy} onClick={enable}>
              {busy ? 'Turning on…' : 'Turn on notifications'}
            </button>
          ) : (
            <>
              <p className="small ok-line">
                ✓ This phone is set up for notifications ({push.tz}).
              </p>
              {changed && (
                <p className="small warn">
                  You made a change — copy the code again and update it on GitHub (steps 1–2), or the old times stay.
                </p>
              )}
              <ol className="steps small">
                <li>
                  <button className="primary small" onClick={copy}>
                    {copied ? 'Copied ✓' : 'Copy your code'}
                  </button>{' '}
                  <button className="link small" onClick={() => setShowCode((s) => !s)}>
                    {showCode ? 'Hide' : 'Show'} code
                  </button>
                  {showCode && <textarea className="code" readOnly value={makeCode(push)} onFocus={(e) => e.target.select()} />}
                  <span className="muted"> Keep it private: it lets someone send notifications to this phone.</span>
                </li>
                <li>
                  Open{' '}
                  <a href={gh('/settings/secrets/actions/new')} target="_blank" rel="noreferrer">
                    GitHub → New secret
                  </a>
                  . Name it <code>BRUNA_PUSH</code>, paste the code, and tap <b>Add secret</b>.
                  <br />
                  <span className="muted">
                    Already added it before? Open{' '}
                    <a href={gh('/settings/secrets/actions')} target="_blank" rel="noreferrer">
                      your secrets
                    </a>
                    , tap ✏️ next to BRUNA_PUSH, paste, and <b>Update secret</b>.
                  </span>
                </li>
                <li>
                  Test it: open{' '}
                  <a href={gh('/actions/workflows/notify.yml')} target="_blank" rel="noreferrer">
                    Send notifications
                  </a>{' '}
                  → <b>Run workflow</b> → <b>Run workflow</b>. Within a minute or two you should get “Notifications are
                  working! 🎉”.
                </li>
              </ol>
              <p className="muted small">
                Reminders can arrive up to about 20 minutes after the hour you chose. They only contain the reminder text —
                nothing from your journal.
              </p>
              <div className="row">
                <button className="link small" disabled={busy} onClick={enable}>
                  Not getting them? Reconnect this phone
                </button>
                <button
                  className="link small danger"
                  onClick={async () => {
                    await turnOff().catch(() => {});
                    const { push: _drop, ...rest } = settings;
                    void _drop;
                    onSettings(rest);
                    setChanged(false);
                    setNote('Notifications turned off. You can also delete the BRUNA_PUSH secret on GitHub.');
                  }}
                >
                  Turn off
                </button>
              </div>
            </>
          )}
          {err && <p className="small warn">{err}</p>}
          {note && <p className="small muted">{note}</p>}
        </>
      )}
    </section>
  );
}
