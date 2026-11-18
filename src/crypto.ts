// All encryption happens on the device using the browser's built-in Web Crypto API.
//
// Design: every entry is encrypted with one random "data key" (AES-GCM 256).
// - With a passphrase: the data key is itself encrypted ("wrapped") with a key
//   derived from the passphrase (PBKDF2-SHA256). Without the passphrase, entries
//   cannot be read — by anyone.
// - Without a passphrase: the data key is stored as-is next to the entries.
//   Entries are still not plain text on disk, but anyone with the device can open them.
// Changing the passphrase only re-wraps the data key; entries are untouched.

export const PBKDF2_ITERATIONS = 600_000;

export type Keyring =
  | { mode: 'none'; rawKey: string }
  | { mode: 'passphrase'; salt: string; iv: string; wrapped: string; iterations: number };

export interface Sealed {
  iv: string;
  data: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

export async function generateDataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

async function importDataKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}

async function deriveKek(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase.normalize('NFC')), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function makeKeyring(dataKey: CryptoKey, passphrase: string | null): Promise<Keyring> {
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', dataKey));
  if (!passphrase) return { mode: 'none', rawKey: toB64(raw) };
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const kek = await deriveKek(passphrase, salt, PBKDF2_ITERATIONS);
  const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, raw);
  return {
    mode: 'passphrase',
    salt: toB64(salt),
    iv: toB64(iv),
    wrapped: toB64(wrapped),
    iterations: PBKDF2_ITERATIONS,
  };
}

/** Returns the data key, or null if the passphrase is wrong. */
export async function openKeyring(ring: Keyring, passphrase?: string): Promise<CryptoKey | null> {
  if (ring.mode === 'none') return importDataKey(fromB64(ring.rawKey));
  if (!passphrase) return null;
  try {
    const kek = await deriveKek(passphrase, fromB64(ring.salt), ring.iterations);
    const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(ring.iv) }, kek, fromB64(ring.wrapped));
    return importDataKey(new Uint8Array(raw));
  } catch {
    return null;
  }
}

export async function seal(key: CryptoKey, value: unknown): Promise<Sealed> {
  const iv = randomBytes(12);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)));
  return { iv: toB64(iv), data: toB64(data) };
}

export async function unseal<T>(key: CryptoKey, sealed: Sealed): Promise<T> {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(sealed.iv) }, key, fromB64(sealed.data));
  return JSON.parse(dec.decode(plain)) as T;
}
