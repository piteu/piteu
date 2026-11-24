// Notifications ("push") for Bruna.
//
// A web app can't schedule its own notifications, so a small GitHub job
// (.github/workflows/notify.yml) checks every hour and sends whichever reminder is due.
// To do that it needs a "code" made here: this phone's push address plus a key pair
// that proves the notifications come from you. The code goes into a GitHub secret.
// Notifications only ever contain fixed reminder text — never anything from your journal.

export type Kind = 'evening' | 'morning' | 'weekly' | 'practice';

export interface PushSettings {
  at: Record<Kind, number | null>; // hour of the day, or null = off
  tz: string;
  vapid: { publicKey: string; privateKey: string };
  sub: PushSubscriptionJSON;
}

export const DEFAULT_AT: Record<Kind, number | null> = { evening: 21, morning: null, weekly: 18, practice: null };

export const KIND_INFO: { kind: Kind; label: string; when: string }[] = [
  { kind: 'evening', label: 'Evening check-in', when: 'every day' },
  { kind: 'morning', label: '“Anything to add about yesterday?”', when: 'every morning' },
  { kind: 'weekly', label: 'Look back at your week', when: 'Sundays' },
  { kind: 'practice', label: 'Memory practice', when: 'Tue, Thu and Sat' },
];

const b64u = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64u = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

/** Running as the installed home-screen app (needed for notifications on iPhone). */
export const isInstalled = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);

export function support(): 'ok' | 'install' | 'unsupported' {
  const has = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (has) return 'ok';
  if (isIOS() && !isInstalled()) return 'install';
  return 'unsupported';
}

/**
 * Ask permission and subscribe this phone. Must be called straight from a tap
 * (iPhone only shows the permission prompt in response to one).
 */
export async function turnOn(at: Record<Kind, number | null>, existing?: PushSettings): Promise<PushSettings> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked for Bruna. Allow them in your phone’s Settings → Notifications → Bruna, then try again.'
        : 'Notifications weren’t allowed.',
    );
  }
  const reg = await navigator.serviceWorker.ready;

  let vapid = existing?.vapid;
  if (!vapid) {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
    vapid = { publicKey: b64u(await crypto.subtle.exportKey('raw', pair.publicKey)), privateKey: jwk.d! };
  }

  let sub = await reg.pushManager.getSubscription();
  // A subscription made with different keys can't be reused.
  if (sub && b64u(sub.options.applicationServerKey ?? new ArrayBuffer(0)) !== vapid.publicKey) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64u(vapid.publicKey) });

  return { at, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', vapid, sub: sub.toJSON() };
}

export async function turnOff(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  await sub?.unsubscribe();
}

/** The code to paste into the BRUNA_PUSH secret on GitHub. */
export function makeCode(p: PushSettings): string {
  const json = JSON.stringify({
    v: 1,
    app: location.origin + location.pathname.replace(/[^/]*$/, ''),
    tz: p.tz,
    at: p.at,
    sub: { endpoint: p.sub.endpoint, keys: p.sub.keys },
    vapid: p.vapid,
  });
  return btoa(unescape(encodeURIComponent(json)));
}

/** "piteu/piteu" from https://piteu.github.io/piteu/ — to link to the right GitHub pages. */
export function githubRepo(): string | null {
  const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
  if (!m) return null;
  const first = location.pathname.split('/').filter(Boolean)[0];
  return `${m[1]}/${first ?? `${m[1]}.github.io`}`;
}
