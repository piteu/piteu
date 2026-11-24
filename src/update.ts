// Noticing a newer Bruna. Phones (especially iPhone home-screen apps) can keep showing an
// old copy, so each time Bruna opens or comes back to the front it asks the server which
// version is current. Your entries are never affected by updating.

export async function newerVersionAvailable(): Promise<boolean> {
  if (import.meta.env.DEV) return false;
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return false;
    const { v } = (await res.json()) as { v?: string };
    return !!v && v !== __APP_VERSION__;
  } catch {
    return false; // offline: keep using this version
  }
}

/** Fetch the new version and restart the app with it. */
export async function applyUpdate(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
    // Drop cached pages so the reload can only get the new one.
    if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
  } catch {
    /* reload anyway */
  }
  location.reload();
}
