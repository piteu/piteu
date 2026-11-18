import { openDB, type IDBPDatabase } from 'idb';
import { type Keyring, type Sealed, seal, unseal, openKeyring } from './crypto';
import type { Entry, Settings } from './types';
import { DEFAULT_SETTINGS } from './types';

// Everything lives in this browser's IndexedDB, on this device only.
// Only the entry id and a timestamp are stored unencrypted (needed for sorting).

interface StoredEntry {
  id: string;
  createdAt: number;
  sealed: Sealed;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB('bruna', 1, {
      upgrade(d) {
        d.createObjectStore('meta');
        const s = d.createObjectStore('entries', { keyPath: 'id' });
        s.createIndex('createdAt', 'createdAt');
      },
    });
  }
  return dbPromise;
}

export async function getKeyring(): Promise<Keyring | undefined> {
  return (await db()).get('meta', 'keyring');
}

export async function setKeyring(ring: Keyring): Promise<void> {
  await (await db()).put('meta', ring, 'keyring');
}

export async function getSettings(key: CryptoKey): Promise<Settings> {
  const sealed: Sealed | undefined = await (await db()).get('meta', 'settings');
  if (!sealed) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...(await unseal<Settings>(key, sealed)) };
}

export async function saveSettings(key: CryptoKey, s: Settings): Promise<void> {
  await (await db()).put('meta', await seal(key, s), 'settings');
}

/** Auto-lock time is needed before unlocking, so it is kept unencrypted (it's not sensitive). */
export async function getAutoLock(): Promise<number> {
  return ((await (await db()).get('meta', 'autoLockMinutes')) as number | undefined) ?? DEFAULT_SETTINGS.autoLockMinutes;
}
export async function setAutoLock(min: number): Promise<void> {
  await (await db()).put('meta', min, 'autoLockMinutes');
}

export async function saveEntry(key: CryptoKey, e: Entry): Promise<void> {
  const rec: StoredEntry = { id: e.id, createdAt: e.createdAt, sealed: await seal(key, e) };
  await (await db()).put('entries', rec);
}

export async function deleteEntry(id: string): Promise<void> {
  await (await db()).delete('entries', id);
}

export async function listEntries(key: CryptoKey): Promise<Entry[]> {
  const recs: StoredEntry[] = await (await db()).getAllFromIndex('entries', 'createdAt');
  const out: Entry[] = [];
  for (const r of recs) {
    try {
      out.push(await unseal<Entry>(key, r.sealed));
    } catch {
      // Unreadable record (e.g. from a different key) — skip rather than crash.
    }
  }
  return out.reverse(); // newest first
}

export async function wipeAll(): Promise<void> {
  const d = await db();
  await d.clear('entries');
  await d.clear('meta');
}

// ---------- Backups ----------

export interface Backup {
  app: 'bruna';
  version: 1;
  exportedAt: number;
  keyring: Keyring;
  entries: StoredEntry[];
}

export async function makeBackup(): Promise<Backup> {
  const d = await db();
  const keyring = await getKeyring();
  if (!keyring) throw new Error('No data yet');
  return { app: 'bruna', version: 1, exportedAt: Date.now(), keyring, entries: await d.getAll('entries') };
}

/**
 * Restores entries from a backup into the current journal (merging by id).
 * Returns the number of entries imported, or null if the passphrase was wrong.
 */
export async function restoreBackup(key: CryptoKey, backup: Backup, passphrase?: string): Promise<number | null> {
  if (backup.app !== 'bruna' || backup.version !== 1) throw new Error('This is not a Bruna backup file.');
  const backupKey = await openKeyring(backup.keyring, passphrase);
  if (!backupKey) return null;
  let n = 0;
  for (const rec of backup.entries) {
    try {
      const e = await unseal<Entry>(backupKey, rec.sealed);
      await saveEntry(key, e);
      n++;
    } catch {
      /* skip unreadable */
    }
  }
  return n;
}
