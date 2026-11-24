// Minimal offline cache. Pages: network first (so updates arrive), falling back
// to cache. Built assets have hashed names, so they're cached forever.
const CACHE = 'bruna-v3';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

// ---------- Notifications ----------
// Sent by the "Send notifications" GitHub job. They only carry fixed reminder text.

self.addEventListener('push', (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { body: e.data && e.data.text() };
  }
  const title = data.title || 'Bruna';
  e.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || 'O que fizeste hoje? 📝',
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: data.kind || 'bruna',
      data: { url: data.url || './' },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  const go = new URL(url).searchParams.get('go');
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.registration.scope));
      if (open) {
        // Bruna is already open: bring it to the front and tell it where to go.
        if (go) open.postMessage({ type: 'go', go });
        return open.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
