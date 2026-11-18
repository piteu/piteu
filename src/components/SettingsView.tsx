import { useRef, useState } from 'react';
import { type Keyring, makeKeyring, openKeyring } from '../crypto';
import { type Backup, listEntries, makeBackup, restoreBackup, setAutoLock, setKeyring, wipeAll } from '../db';
import { dayKey, download, toMarkdown } from '../export';
import type { Settings } from '../types';

interface Props {
  dataKey: CryptoKey;
  ring: Keyring;
  settings: Settings;
  autoLock: number;
  onSettings: (s: Settings) => void;
  onAutoLock: (m: number) => void;
  onRing: (r: Keyring) => void;
  onLock: () => void;
}

export default function SettingsView(p: Props) {
  const [note, setNote] = useState('');
  const today = dayKey(Date.now());

  return (
    <div className="page">
      <h1>Settings</h1>
      {note && (
        <p className="note" role="status">
          {note}
        </p>
      )}

      <section className="card">
        <h2>You</h2>
        <label className="field">
          <span>Name</span>
          <input
            defaultValue={p.settings.name ?? ''}
            placeholder="Optional"
            onBlur={(e) => p.onSettings({ ...p.settings, name: e.target.value.trim() || undefined })}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={p.settings.nudges}
            onChange={(e) => p.onSettings({ ...p.settings, nudges: e.target.checked })}
          />
          <span>After a very short answer, gently ask for a little more (once per check-in)</span>
        </label>
      </section>

      <section className="card">
        <h2>Lock</h2>
        <Passphrase {...p} setNote={setNote} />
        {p.ring.mode === 'passphrase' && (
          <>
            <label className="field">
              <span>Lock automatically after</span>
              <select
                value={p.autoLock}
                onChange={async (e) => {
                  const v = Number(e.target.value);
                  await setAutoLock(v);
                  p.onAutoLock(v);
                }}
              >
                <option value={1}>1 minute</option>
                <option value={5}>5 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={60}>1 hour</option>
                <option value={0}>Never</option>
              </select>
            </label>
            <button className="secondary" onClick={p.onLock}>
              Lock now
            </button>
          </>
        )}
      </section>

      <section className="card">
        <h2>Backup &amp; export</h2>
        <p className="muted small">
          Your journal only lives on this device. If you lose the phone or clear the browser, it’s gone — so save a
          backup now and then (e.g. to iCloud Drive or Google Drive).
        </p>
        <button
          className="secondary"
          onClick={async () => {
            try {
              download(`piteu-backup-${today}.json`, JSON.stringify(await makeBackup()), 'application/json');
              setNote(
                p.ring.mode === 'passphrase'
                  ? 'Backup saved. It’s encrypted with your passphrase.'
                  : 'Backup saved. Note: without a passphrase, anyone with this file can read it.',
              );
            } catch (e) {
              setNote(String((e as Error).message ?? e));
            }
          }}
        >
          Save backup
        </button>
        <Restore dataKey={p.dataKey} setNote={setNote} />
        <button
          className="secondary"
          onClick={async () => {
            download(`piteu-journal-${today}.md`, toMarkdown(await listEntries(p.dataKey)), 'text/markdown');
            setNote('Exported as a readable text file. This one is NOT encrypted — keep it somewhere safe.');
          }}
        >
          Export as readable text
        </button>
      </section>

      <section className="card">
        <h2>Privacy</h2>
        <ul className="small plain">
          <li>Your entries are stored only on this device, encrypted. There is no account and no server.</li>
          <li>Nothing is tracked or sent anywhere. The app works offline.</li>
          <li>
            Using your keyboard’s microphone to dictate may send audio to Apple or Google, depending on your phone’s
            settings.
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>Need to talk to someone?</h2>
        <p className="small">
          If you’re in danger or thinking about harming yourself, call your local emergency number. You can find a free,
          confidential helpline in your country at{' '}
          <a href="https://findahelpline.com" target="_blank" rel="noreferrer">
            findahelpline.com
          </a>
          .
        </p>
      </section>

      <section className="card">
        <h2>Delete everything</h2>
        <Wipe />
      </section>

      <p className="muted small center-text">Piteu · version 0.1</p>
    </div>
  );
}

function Passphrase(p: Props & { setNote: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState('');
  const [n1, setN1] = useState('');
  const [n2, setN2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const has = p.ring.mode === 'passphrase';

  async function save(remove = false) {
    setErr('');
    setBusy(true);
    try {
      if (has && !(await openKeyring(p.ring, cur))) {
        setErr('Current passphrase is wrong.');
        return;
      }
      const ring = await makeKeyring(p.dataKey, remove ? null : n1);
      await setKeyring(ring);
      p.onRing(ring);
      setOpen(false);
      setCur(''), setN1(''), setN2('');
      p.setNote(remove ? 'Passphrase removed.' : has ? 'Passphrase changed.' : 'Passphrase set. Your journal is now locked.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <>
        <p className="small">
          {has ? '🔒 Your journal is locked with a passphrase.' : '🔓 No passphrase yet — anyone using this device can open your journal.'}
        </p>
        <button className="secondary" onClick={() => setOpen(true)}>
          {has ? 'Change passphrase' : 'Set a passphrase'}
        </button>
      </>
    );
  }

  const ok = n1.length >= 6 && n1 === n2 && (!has || cur);
  return (
    <div className="stack">
      {has && (
        <label className="field">
          <span>Current passphrase</span>
          <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
        </label>
      )}
      <label className="field">
        <span>New passphrase (6+ characters)</span>
        <input type="password" value={n1} onChange={(e) => setN1(e.target.value)} autoComplete="new-password" />
      </label>
      <label className="field">
        <span>Type it again</span>
        <input type="password" value={n2} onChange={(e) => setN2(e.target.value)} autoComplete="new-password" />
      </label>
      <p className="small warn">If you forget it, your entries can’t be recovered.</p>
      {err && <p className="warn">{err}</p>}
      <div className="row">
        <button className="primary" disabled={!ok || busy} onClick={() => save()}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button className="link" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {has && (
        <button className="link danger" disabled={!cur || busy} onClick={() => save(true)}>
          Remove passphrase instead
        </button>
      )}
    </div>
  );
}

function Restore({ dataKey, setNote }: { dataKey: CryptoKey; setNote: (s: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(b: Backup, passphrase?: string) {
    setBusy(true);
    try {
      const n = await restoreBackup(dataKey, b, passphrase);
      if (n === null) return setNote('That passphrase doesn’t open this backup.');
      setNote(`Restored ${n} ${n === 1 ? 'entry' : 'entries'}.`);
      setBackup(null);
      setPass('');
    } catch (e) {
      setNote(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            const b = JSON.parse(await f.text()) as Backup;
            if (b.keyring?.mode === 'passphrase') setBackup(b);
            else await run(b);
          } catch {
            setNote('That file isn’t a Piteu backup.');
          }
        }}
      />
      {!backup ? (
        <button className="secondary" onClick={() => fileRef.current?.click()}>
          Restore from backup
        </button>
      ) : (
        <div className="stack">
          <label className="field">
            <span>Passphrase used when this backup was made</span>
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
          </label>
          <div className="row">
            <button className="primary" disabled={!pass || busy} onClick={() => run(backup, pass)}>
              {busy ? 'Restoring…' : 'Restore'}
            </button>
            <button className="link" onClick={() => setBackup(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Wipe() {
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState('');
  if (step === 0)
    return (
      <button className="link danger" onClick={() => setStep(1)}>
        Delete all entries and settings…
      </button>
    );
  return (
    <div className="stack">
      <p className="small">
        This permanently deletes your whole journal from this device. Type <b>delete</b> to confirm.
      </p>
      <input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type delete to confirm" />
      <div className="row">
        <button
          className="danger-btn"
          disabled={typed.trim().toLowerCase() !== 'delete'}
          onClick={async () => {
            await wipeAll();
            location.reload();
          }}
        >
          Delete everything
        </button>
        <button className="link" onClick={() => setStep(0)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
