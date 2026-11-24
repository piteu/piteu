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
      <h2>Notificações</h2>

      {state === 'install' && (
        <p className="small">
          Para receberes notificações no iPhone, abre a Bruna pelo <b>ícone no ecrã principal</b> (não pelo Safari), e
          volta aqui. Precisas do iOS 16.4 ou mais recente.
        </p>
      )}
      {state === 'unsupported' && (
        <p className="small">Este navegador não consegue mostrar notificações. O lembrete no calendário, mais abaixo, funciona em todo o lado.</p>
      )}

      {state === 'ok' && (
        <>
          <p className="small">Escolhe do que a Bruna te lembra, e quando. As horas são as do teu fuso horário.</p>
          <div className="notif-list">
            {KIND_INFO.map((k) => (
              <label key={k.kind} className="notif-row">
                <span>
                  <span className="notif-label">{k.label}</span>
                  <span className="muted small"> · {k.when}</span>
                </span>
                <select value={at[k.kind] ?? 'off'} onChange={(e) => setHour(k.kind, e.target.value)}>
                  <option value="off">Desligado</option>
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
              {busy ? 'A ligar…' : 'Ligar notificações'}
            </button>
          ) : (
            <>
              <p className="small ok-line">
                ✓ Este telemóvel está pronto para notificações ({push.tz}).
              </p>
              {changed && (
                <p className="small warn">
                  Fizeste uma alteração — copia o código outra vez e atualiza-o no GitHub (passos 1–2), senão ficam as horas antigas.
                </p>
              )}
              <ol className="steps small">
                <li>
                  <button className="primary small" onClick={copy}>
                    {copied ? 'Copiado ✓' : 'Copiar o teu código'}
                  </button>{' '}
                  <button className="link small" onClick={() => setShowCode((s) => !s)}>
                    {showCode ? 'Esconder' : 'Mostrar'} código
                  </button>
                  {showCode && <textarea className="code" readOnly value={makeCode(push)} onFocus={(e) => e.target.select()} />}
                  <span className="muted"> Guarda-o só para ti: permite enviar notificações para este telemóvel.</span>
                </li>
                <li>
                  Abre{' '}
                  <a href={gh('/settings/secrets/actions/new')} target="_blank" rel="noreferrer">
                    GitHub → novo segredo
                  </a>
                  . No nome escreve <code>BRUNA_PUSH</code>, cola o código, e toca em <b>Add secret</b>.
                  <br />
                  <span className="muted">
                    Já o tinhas adicionado? Abre{' '}
                    <a href={gh('/settings/secrets/actions')} target="_blank" rel="noreferrer">
                      os teus segredos
                    </a>
                    , toca em ✏️ ao lado de BRUNA_PUSH, cola, e toca em <b>Update secret</b>.
                  </span>
                </li>
                <li>
                  Experimenta: abre{' '}
                  <a href={gh('/actions/workflows/notify.yml')} target="_blank" rel="noreferrer">
                    Send notifications
                  </a>{' '}
                  → <b>Run workflow</b> → <b>Run workflow</b>. Dentro de um ou dois minutos deves receber “As notificações
                  estão a funcionar! 🎉”.
                </li>
              </ol>
              <p className="muted small">
                Os lembretes podem chegar até cerca de 20 minutos depois da hora escolhida. Só contêm o texto do lembrete —
                nada do teu diário.
              </p>
              <div className="row">
                <button className="link small" disabled={busy} onClick={enable}>
                  Não estão a chegar? Voltar a ligar este telemóvel
                </button>
                <button
                  className="link small danger"
                  onClick={async () => {
                    await turnOff().catch(() => {});
                    const { push: _drop, ...rest } = settings;
                    void _drop;
                    onSettings(rest);
                    setChanged(false);
                    setNote('Notificações desligadas. Também podes apagar o segredo BRUNA_PUSH no GitHub.');
                  }}
                >
                  Desligar
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
