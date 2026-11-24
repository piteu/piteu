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
        <h1>Olá, sou a Bruna.</h1>
        <p>
          Um diário privado que funciona como uma conversa. Faço-te perguntas curtas — podes tocar, escrever umas
          palavras, ou saltar. Não é preciso escrever textos longos.
        </p>
        <p className="muted small">
          Tudo fica neste dispositivo. Sem conta, sem servidor, sem rastreio.
        </p>
        <label className="field">
          <span>Como queres que te chame? (opcional)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="O teu nome" autoComplete="given-name" />
        </label>
        <button className="primary" onClick={() => setStep('lock')}>
          Continuar
        </button>
      </div>
    );
  }

  const tooShort = p1.length > 0 && p1.length < 6;
  const mismatch = p2.length > 0 && p1 !== p2;
  const canSet = p1.length >= 6 && p1 === p2 && understood && !busy;

  return (
    <div className="page narrow setup">
      <h1>Tranca o teu diário</h1>
      <p>
        Com uma palavra-passe, os teus registos ficam cifrados. Mesmo alguém com o teu telemóvel desbloqueado não os
        consegue ler sem ela.
      </p>
      <label className="field">
        <span>Palavra-passe</span>
        <input type="password" value={p1} onChange={(e) => setP1(e.target.value)} autoComplete="new-password" />
        {tooShort && <small className="warn">Pelo menos 6 caracteres. Uma frase curta é o mais fácil de lembrar.</small>}
      </label>
      <label className="field">
        <span>Escreve outra vez</span>
        <input type="password" value={p2} onChange={(e) => setP2(e.target.value)} autoComplete="new-password" />
        {mismatch && <small className="warn">Ainda não são iguais.</small>}
      </label>
      <label className="check">
        <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
        <span>
          Percebo que <b>se me esquecer da palavra-passe, os meus registos não podem ser recuperados</b> — por ninguém.
        </span>
      </label>
      {err && <p className="warn">{err}</p>}
      <button className="primary" disabled={!canSet} onClick={() => finish(p1)}>
        {busy ? 'A preparar…' : 'Trancar com palavra-passe'}
      </button>
      <button className="link" disabled={busy} onClick={() => finish(null)}>
        Saltar por agora (podes definir uma mais tarde nas Definições)
      </button>
    </div>
  );
}
