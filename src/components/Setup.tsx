import { useState } from 'react';
import { generateDataKey, makeKeyring } from '../crypto';
import { saveSettings, setKeyring } from '../db';
import { DEFAULT_SETTINGS } from '../types';

export default function Setup({ onDone }: { onDone: (key: CryptoKey) => void }) {
  const [step, setStep] = useState<'hello' | 'lock'>('hello');
  const [name, setName] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function finish(passphrase: string | null) {
    setBusy(true);
    try {
      const key = await generateDataKey();
      await setKeyring(await makeKeyring(key, passphrase));
      await saveSettings(key, { ...DEFAULT_SETTINGS, name: name.trim() || undefined });
      onDone(key);
    } catch (e) {
      setErr(String(e));
      setBusy(false);
    }
  }

  if (step === 'hello') {
    return (
      <div className="page narrow setup">
        <div className="logo" aria-hidden>💬</div>
        <h1>Hi, I’m Piteu.</h1>
        <p>
          A private journal that works like a chat. I’ll ask you short questions — you can tap, write a few words, or
          skip. No essays needed.
        </p>
        <p className="muted small">
          Everything stays on this device. No account, no server, no tracking.
        </p>
        <label className="field">
          <span>What should I call you? (optional)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="given-name" />
        </label>
        <button className="primary" onClick={() => setStep('lock')}>
          Continue
        </button>
      </div>
    );
  }

  const tooShort = p1.length > 0 && p1.length < 6;
  const mismatch = p2.length > 0 && p1 !== p2;
  const canSet = p1.length >= 6 && p1 === p2 && understood && !busy;

  return (
    <div className="page narrow setup">
      <h1>Lock your journal</h1>
      <p>
        With a passphrase, your entries are encrypted. Even someone holding your unlocked phone can’t read them without
        it.
      </p>
      <label className="field">
        <span>Passphrase</span>
        <input type="password" value={p1} onChange={(e) => setP1(e.target.value)} autoComplete="new-password" />
        {tooShort && <small className="warn">At least 6 characters. A short sentence is easiest to remember.</small>}
      </label>
      <label className="field">
        <span>Type it again</span>
        <input type="password" value={p2} onChange={(e) => setP2(e.target.value)} autoComplete="new-password" />
        {mismatch && <small className="warn">These don’t match yet.</small>}
      </label>
      <label className="check">
        <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
        <span>
          I understand that <b>if I forget my passphrase, my entries can’t be recovered</b> — by anyone.
        </span>
      </label>
      {err && <p className="warn">{err}</p>}
      <button className="primary" disabled={!canSet} onClick={() => finish(p1)}>
        {busy ? 'Setting up…' : 'Lock with passphrase'}
      </button>
      <button className="link" disabled={busy} onClick={() => finish(null)}>
        Skip for now (you can add one later in Settings)
      </button>
    </div>
  );
}
