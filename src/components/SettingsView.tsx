import { useRef, useState } from 'react';
import { type Keyring, makeKeyring, openKeyring } from '../crypto';
import { type Backup, listEntries, makeBackup, restoreBackup, setAutoLock, setKeyring, wipeAll } from '../db';
import { dayKey, download, reminderIcs, toMarkdown } from '../export';
import type { Settings } from '../types';
import Notifications from './Notifications';

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
      <h1>Definições</h1>
      {note && (
        <p className="note" role="status">
          {note}
        </p>
      )}

      <section className="card">
        <h2>Tu</h2>
        <label className="field">
          <span>Nome</span>
          <input
            defaultValue={p.settings.name ?? ''}
            placeholder="Opcional"
            onBlur={(e) => p.onSettings({ ...p.settings, name: e.target.value.trim() || undefined })}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={p.settings.nudges}
            onChange={(e) => p.onSettings({ ...p.settings, nudges: e.target.checked })}
          />
          <span>Depois de uma resposta muito curta, pedir com calma um pouco mais (uma vez por check-in)</span>
        </label>
      </section>

      <Notifications settings={p.settings} onSettings={p.onSettings} />

      <Reminder setNote={setNote} />

      <section className="card">
        <h2>Bloqueio</h2>
        <Passphrase {...p} setNote={setNote} />
        {p.ring.mode === 'passphrase' && (
          <>
            <label className="field">
              <span>Bloquear automaticamente ao fim de</span>
              <select
                value={p.autoLock}
                onChange={async (e) => {
                  const v = Number(e.target.value);
                  await setAutoLock(v);
                  p.onAutoLock(v);
                }}
              >
                <option value={1}>1 minuto</option>
                <option value={5}>5 minutos</option>
                <option value={15}>15 minutos</option>
                <option value={60}>1 hora</option>
                <option value={0}>Nunca</option>
              </select>
            </label>
            <button className="secondary" onClick={p.onLock}>
              Bloquear agora
            </button>
          </>
        )}
      </section>

      <section className="card">
        <h2>Cópia de segurança e exportação</h2>
        <p className="muted small">
          O teu diário só existe neste dispositivo. Se perderes o telemóvel ou limpares os dados do navegador, perde-se —
          por isso guarda uma cópia de segurança de vez em quando (p. ex. no iCloud Drive ou no Google Drive).
        </p>
        <button
          className="secondary"
          onClick={async () => {
            try {
              download(`bruna-copia-${today}.json`, JSON.stringify(await makeBackup()), 'application/json');
              setNote(
                p.ring.mode === 'passphrase'
                  ? 'Cópia guardada. Está cifrada com a tua palavra-passe.'
                  : 'Cópia guardada. Atenção: sem palavra-passe, qualquer pessoa com este ficheiro o consegue ler.',
              );
            } catch (e) {
              setNote(String((e as Error).message ?? e));
            }
          }}
        >
          Guardar cópia de segurança
        </button>
        <Restore dataKey={p.dataKey} setNote={setNote} />
        <button
          className="secondary"
          onClick={async () => {
            download(`bruna-diario-${today}.md`, toMarkdown(await listEntries(p.dataKey)), 'text/markdown');
            setNote('Exportado como ficheiro de texto legível. Este NÃO está cifrado — guarda-o num sítio seguro.');
          }}
        >
          Exportar como texto legível
        </button>
      </section>

      <section className="card">
        <h2>Privacidade</h2>
        <ul className="small plain">
          <li>Os teus registos ficam guardados só neste dispositivo, cifrados. Não há conta nem servidor.</li>
          <li>Nada é rastreado nem enviado para lado nenhum. A app funciona sem internet.</li>
          <li>
            Ditar (com o botão 🎤 da Bruna ou o do teclado) envia o áudio para o serviço de voz do telemóvel — Apple ou
            Google — que o transforma em texto. Só o texto fica guardado, e só neste dispositivo.
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>Precisas de falar com alguém?</h2>
        <p className="small">
          Se estiveres em perigo ou a pensar fazer-te mal, liga para o <b>112</b>. Em Portugal, a linha <b>SNS 24</b>{' '}
          (<a href="tel:808242424">808 24 24 24</a>) tem aconselhamento psicológico. Noutros países, encontras uma linha
          de apoio gratuita e confidencial em{' '}
          <a href="https://findahelpline.com" target="_blank" rel="noreferrer">
            findahelpline.com
          </a>
          .
        </p>
      </section>

      <section className="card">
        <h2>Apagar tudo</h2>
        <Wipe />
      </section>

      <p className="muted small center-text">Bruna · versão 0.2</p>
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
        setErr('A palavra-passe atual está errada.');
        return;
      }
      const ring = await makeKeyring(p.dataKey, remove ? null : n1);
      await setKeyring(ring);
      p.onRing(ring);
      setOpen(false);
      setCur(''), setN1(''), setN2('');
      p.setNote(remove ? 'Palavra-passe removida.' : has ? 'Palavra-passe alterada.' : 'Palavra-passe definida. O teu diário está agora trancado.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <>
        <p className="small">
          {has ? '🔒 O teu diário está trancado com palavra-passe.' : '🔓 Ainda sem palavra-passe — quem usar este dispositivo consegue abrir o teu diário.'}
        </p>
        <button className="secondary" onClick={() => setOpen(true)}>
          {has ? 'Mudar a palavra-passe' : 'Definir uma palavra-passe'}
        </button>
      </>
    );
  }

  const ok = n1.length >= 6 && n1 === n2 && (!has || cur);
  return (
    <div className="stack">
      {has && (
        <label className="field">
          <span>Palavra-passe atual</span>
          <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
        </label>
      )}
      <label className="field">
        <span>Nova palavra-passe (6 ou mais caracteres)</span>
        <input type="password" value={n1} onChange={(e) => setN1(e.target.value)} autoComplete="new-password" />
      </label>
      <label className="field">
        <span>Escreve outra vez</span>
        <input type="password" value={n2} onChange={(e) => setN2(e.target.value)} autoComplete="new-password" />
      </label>
      <p className="small warn">Se te esqueceres dela, os teus registos não podem ser recuperados.</p>
      {err && <p className="warn">{err}</p>}
      <div className="row">
        <button className="primary" disabled={!ok || busy} onClick={() => save()}>
          {busy ? 'A guardar…' : 'Guardar'}
        </button>
        <button className="link" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
      {has && (
        <button className="link danger" disabled={!cur || busy} onClick={() => save(true)}>
          Remover a palavra-passe
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
      if (n === null) return setNote('Essa palavra-passe não abre esta cópia de segurança.');
      setNote(`${n === 1 ? 'Recuperado 1 registo' : `Recuperados ${n} registos`}.`);
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
            setNote('Esse ficheiro não é uma cópia de segurança da Bruna.');
          }
        }}
      />
      {!backup ? (
        <button className="secondary" onClick={() => fileRef.current?.click()}>
          Recuperar de uma cópia de segurança
        </button>
      ) : (
        <div className="stack">
          <label className="field">
            <span>Palavra-passe usada quando esta cópia foi feita</span>
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
          </label>
          <div className="row">
            <button className="primary" disabled={!pass || busy} onClick={() => run(backup, pass)}>
              {busy ? 'A recuperar…' : 'Recuperar'}
            </button>
            <button className="link" onClick={() => setBackup(null)}>
              Cancelar
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
        Apagar todos os registos e definições…
      </button>
    );
  return (
    <div className="stack">
      <p className="small">
        Isto apaga de vez todo o teu diário deste dispositivo. Escreve <b>apagar</b> para confirmar.
      </p>
      <input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Escreve apagar para confirmar" />
      <div className="row">
        <button
          className="danger-btn"
          disabled={typed.trim().toLowerCase() !== 'apagar'}
          onClick={async () => {
            await wipeAll();
            location.reload();
          }}
        >
          Apagar tudo
        </button>
        <button className="link" onClick={() => setStep(0)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Reminder({ setNote }: { setNote: (s: string) => void }) {
  const [time, setTime] = useState('21:00');
  return (
    <section className="card">
      <h2>Lembrete no calendário</h2>
      <p className="small">
        Uma alternativa às notificações: um lembrete diário no calendário do telemóvel. Abre um ficheiro que o telemóvel
        propõe adicionar ao Calendário.
      </p>
      <label className="field">
        <span>Lembrar-me todos os dias às</span>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </label>
      <button
        className="secondary"
        onClick={() => {
          const [h, m] = time.split(':').map(Number);
          const url = location.href.split('#')[0];
          download('bruna-lembrete-diario.ics', reminderIcs(h || 21, m || 0, url), 'text/calendar');
          setNote('Ficheiro do lembrete criado. Abre-o e escolhe “Adicionar ao Calendário”. O lembrete só diz “Bruna: o que fizeste hoje?” — nada do teu diário.');
        }}
      >
        Adicionar lembrete ao calendário
      </button>
    </section>
  );
}
