import { describe, it, expect } from 'vitest';
import { generateDataKey, makeKeyring, openKeyring, seal, unseal } from './crypto';

describe('crypto', () => {
  it('encrypts and decrypts with a passphrase-protected key', async () => {
    const key = await generateDataKey();
    const ring = await makeKeyring(key, 'correct horse');
    expect(ring.mode).toBe('passphrase');
    const sealed = await seal(key, { hello: 'world' });
    expect(sealed.data).not.toContain('world');

    const reopened = await openKeyring(ring, 'correct horse');
    expect(reopened).not.toBeNull();
    expect(await unseal(reopened!, sealed)).toEqual({ hello: 'world' });
    expect(await openKeyring(ring, 'wrong')).toBeNull();
  }, 20_000);

  it('works without a passphrase', async () => {
    const key = await generateDataKey();
    const ring = await makeKeyring(key, null);
    const k2 = await openKeyring(ring);
    expect(await unseal(k2!, await seal(key, [1, 2]))).toEqual([1, 2]);
  });
});
