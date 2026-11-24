import { useCallback, useEffect, useRef, useState } from 'react';
import { type Keyring, openKeyring } from './crypto';
import { getAutoLock, getKeyring, getSettings, saveSettings } from './db';
import type { Settings } from './types';
import { DEFAULT_SETTINGS } from './types';
import Setup from './components/Setup';
import Lock from './components/Lock';
import Chat, { type ChatRequest } from './components/Chat';
import { type Answers, DAY } from './flows';
import Journal from './components/Journal';
import SettingsView from './components/SettingsView';
import Insights from './components/Insights';
import Memory, { type MemoryView } from './components/Memory';
import Home, { type Go as HomeGo } from './components/Home';
import { applyUpdate, newerVersionAvailable } from './update';

type Phase = 'loading' | 'setup' | 'locked' | 'ready';
/** Where a tapped notification wants to go (see public/sw.js and scripts/notify). */
type Go = 'evening' | 'yesterday' | 'week' | 'practice';

function readGo(): Go | null {
  const g = new URLSearchParams(location.search).get('go');
  if (g) history.replaceState(null, '', location.pathname); // don't repeat it on reload
  return g === 'evening' || g === 'yesterday' || g === 'week' || g === 'practice' ? g : null;
}
type Tab = 'home' | 'journal' | 'memory' | 'insights' | 'settings';

export default function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [ring, setRing] = useState<Keyring | null>(null);
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tab, setTab] = useState<Tab>('home');
  const [autoLock, setAutoLockState] = useState(DEFAULT_SETTINGS.autoLockMinutes);
  const [go, setGo] = useState<Go | null>(readGo);
  const [updateReady, setUpdateReady] = useState(false);

  // Look for a newer Bruna when the app opens and whenever it comes back to the front.
  useEffect(() => {
    const check = () => newerVersionAvailable().then((yes) => yes && setUpdateReady(true));
    check();
    const onVis = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  const [chatRequest, setChatRequest] = useState<ChatRequest | null>(null);
  // Writing happens on its own full screen, separate from the main page.
  const [writing, setWriting] = useState(false);
  const startWriting = (flow: string, preset?: Answers, intro?: string) => {
    setChatRequest({ flow, preset, intro, n: Date.now() });
    setWriting(true);
  };
  const openFromHome = (where: HomeGo) => {
    if (where === 'insights') return setTab('insights');
    setMemoryOpen({ view: where === 'week' ? 'week' : 'calendar', n: Date.now() });
    setTab('memory');
  };
  const [memoryOpen, setMemoryOpen] = useState<{ view: MemoryView; n: number }>({ view: 'calendar', n: 0 });

  // A notification tapped while Bruna is already open.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'go') setGo(e.data.go);
    };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg);
  }, []);

  // Act on it once unlocked.
  useEffect(() => {
    if (phase !== 'ready' || !go) return;
    const n = Date.now();
    if (go === 'evening') {
      startWriting('evening');
    } else if (go === 'yesterday') {
      startWriting('log', { day: DAY.yesterday }, 'Vamos preencher o dia de ontem.');
    } else if (go === 'week') {
      setMemoryOpen({ view: 'week', n });
      setTab('memory');
    } else if (go === 'practice') {
      setMemoryOpen({ view: 'practice', n });
      setTab('memory');
    }
    setGo(null);
  }, [phase, go]);

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
    setWriting(false);
    setTab('home');
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
      {updateReady && (
        <div className="update-bar" role="status">
          <span>Há uma versão nova da Bruna.</span>
          <button className="primary small" onClick={applyUpdate}>
            Atualizar
          </button>
        </div>
      )}
      {writing && (
        <main className="main writing">
          <Chat
            dataKey={key}
            settings={settings}
            request={chatRequest}
            onClose={() => {
              setWriting(false);
              setTab('home');
            }}
          />
        </main>
      )}
      {!writing && (
      <>
      <main className="main">
        {tab === 'home' && <Home dataKey={key} name={settings.name} onStart={startWriting} onGo={openFromHome} />}
        {tab === 'journal' && <Journal dataKey={key} />}
        {tab === 'memory' && <Memory key={memoryOpen.n} dataKey={key} initialView={memoryOpen.view} />}
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
      <nav className="tabs" aria-label="Secções">
        <TabButton active={tab === 'home'} onClick={() => setTab('home')} icon="🏠" label="Início" />
        <TabButton active={tab === 'journal'} onClick={() => setTab('journal')} icon="📖" label="Diário" />
        <TabButton active={tab === 'memory'} onClick={() => setTab('memory')} icon="🧠" label="Memória" />
        <TabButton active={tab === 'insights'} onClick={() => setTab('insights')} icon="📈" label="Resumo" />
        <TabButton active={tab === 'settings'} onClick={() => setTab('settings')} icon="⚙️" label="Definições" />
      </nav>
      </>
      )}
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
