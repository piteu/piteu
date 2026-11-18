import { useCallback, useEffect, useRef, useState } from 'react';
import { type Keyring, openKeyring } from './crypto';
import { getAutoLock, getKeyring, getSettings, saveSettings } from './db';
import type { Settings } from './types';
import { DEFAULT_SETTINGS } from './types';
import Setup from './components/Setup';
import Lock from './components/Lock';
import Chat from './components/Chat';
import Journal from './components/Journal';
import SettingsView from './components/SettingsView';
import Insights from './components/Insights';

type Phase = 'loading' | 'setup' | 'locked' | 'ready';
type Tab = 'today' | 'journal' | 'insights' | 'settings';

export default function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [ring, setRing] = useState<Keyring | null>(null);
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tab, setTab] = useState<Tab>('today');
  const [autoLock, setAutoLockState] = useState(DEFAULT_SETTINGS.autoLockMinutes);

  const load = useCallback(async () => {
    const r = (await getKeyring()) ?? null;
    setRing(r);
    setAutoLockState(await getAutoLock());
    if (!r) return setPhase('setup');
    if (r.mode === 'none') {
      const k = await openKeyring(r);
      if (k) return unlocked(k);
    }
    setPhase('locked');
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function unlocked(k: CryptoKey) {
    setKey(k);
    setSettings(await getSettings(k));
    setPhase('ready');
  }

  const lock = useCallback(() => {
    setKey(null);
    setPhase('locked');
    setTab('today');
  }, []);

  // Auto-lock after being in the background (or idle) for a while.
  const lastActive = useRef(Date.now());
  useEffect(() => {
    if (phase !== 'ready' || ring?.mode !== 'passphrase' || !autoLock) return;
    const ms = autoLock * 60_000;
    const touch = () => (lastActive.current = Date.now());
    const check = () => {
      if (Date.now() - lastActive.current > ms) lock();
    };
    const onVis = () => (document.visibilityState === 'visible' ? check() : touch());
    const events = ['pointerdown', 'keydown', 'scroll'];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    document.addEventListener('visibilitychange', onVis);
    const t = setInterval(check, 15_000);
    touch();
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(t);
    };
  }, [phase, ring, autoLock, lock]);

  async function updateSettings(s: Settings) {
    setSettings(s);
    if (key) await saveSettings(key, s);
  }

  if (phase === 'loading') return <div className="center muted">…</div>;
  if (phase === 'setup')
    return (
      <Setup
        onDone={async (k) => {
          setRing((await getKeyring()) ?? null);
          unlocked(k);
        }}
      />
    );
  if (phase === 'locked' && ring) return <Lock ring={ring} onUnlock={unlocked} />;
  if (!key) return null;

  return (
    <div className="app">
      <main className="main">
        {/* Chat stays mounted so a check-in in progress isn't lost when switching tabs. */}
        <div hidden={tab !== 'today'} className="tabpane">
          <Chat dataKey={key} settings={settings} />
        </div>
        {tab === 'journal' && <Journal dataKey={key} />}
        {tab === 'insights' && <Insights dataKey={key} />}
        {tab === 'settings' && (
          <SettingsView
            dataKey={key}
            ring={ring!}
            settings={settings}
            autoLock={autoLock}
            onSettings={updateSettings}
            onAutoLock={setAutoLockState}
            onRing={setRing}
            onLock={lock}
          />
        )}
      </main>
      <nav className="tabs" aria-label="Sections">
        <TabButton active={tab === 'today'} onClick={() => setTab('today')} icon="💬" label="Today" />
        <TabButton active={tab === 'journal'} onClick={() => setTab('journal')} icon="📖" label="Journal" />
        <TabButton active={tab === 'insights'} onClick={() => setTab('insights')} icon="📈" label="Insights" />
        <TabButton active={tab === 'settings'} onClick={() => setTab('settings')} icon="⚙️" label="Settings" />
      </nav>
    </div>
  );
}

function TabButton(p: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button className={`tab ${p.active ? 'active' : ''}`} onClick={p.onClick} aria-current={p.active ? 'page' : undefined}>
      <span aria-hidden>{p.icon}</span>
      <span>{p.label}</span>
    </button>
  );
}
