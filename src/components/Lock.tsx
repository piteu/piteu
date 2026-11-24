import { useState } from 'react';
import { type Keyring, openKeyring } from '../crypto';

export default function Lock({ ring, onUnlock }: { ring: Keyring; onUnlock: (k: CryptoKey) => void }) {
  const [p, setP] = useState('');
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!p) return;
    setBusy(true);
    setWrong(false);
    const k = await openKeyring(ring, p);
    setBusy(false);
    if (k) onUnlock(k);
    else setWrong(true);
  }

  return (
    <form className="page narrow lock" onSubmit={submit}>
      <div className="logo" aria-hidden>🔒</div>
      <h1>Olá de novo</h1>
      <label className="field">
        <span>Palavra-passe</span>
        <input
          type="password"
          value={p}
          onChange={(e) => setP(e.target.value)}
          autoFocus
          autoComplete="current-password"
        />
      </label>
      {wrong && <p className="warn">Não é essa. Tenta outra vez.</p>}
      <button className="primary" disabled={busy || !p}>
        {busy ? 'A desbloquear…' : 'Desbloquear'}
      </button>
    </form>
  );
}
