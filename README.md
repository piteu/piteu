# Piteu — a private journal that feels like a chat

Piteu asks you short, kind questions and you answer by tapping, writing a few words, or skipping.
It's built for people who find writing hard.

## How it helps you write
- **Tap first.** Every check-in starts with a mood tap and feeling words, so something is saved even if you type nothing.
- **Small, concrete questions.** "What happened that left you feeling stressed?" rather than "How was your day?"
- **Sentence starters.** Tap "It started when…" and finish the sentence.
- **Ask me differently.** Swaps any question for an easier one.
- **One gentle nudge.** After a very short answer it may ask for a bit more, at most once per check-in. You can turn this off.
- **Five check-ins:** Quick check-in (1 min), End of day, Something's on my mind (untangle a worry), Three good things, and Just write (with a daily prompt).

The questions live in [`src/flows.ts`](src/flows.ts). They're plain text, easy to change or add to.

## Privacy
- Entries are stored **only on your device**, in the browser's IndexedDB, encrypted with AES-256-GCM.
- With a passphrase, the encryption key is protected by your passphrase (PBKDF2, 600,000 rounds). Without it, nobody can read your entries — including you, if you forget it.
- No account, no server, no analytics, no third-party scripts. Works offline.
- **Back up regularly** (Settings → Save backup). Backups stay encrypted with your passphrase.

## Use it on your phone
Once deployed (below), open the site on your phone, then:
- **iPhone (Safari):** Share → *Add to Home Screen*
- **Android (Chrome):** ⋮ menu → *Add to Home screen* / *Install app*

Installing it matters on iPhone: Safari may clear data from websites you haven't visited in a while, but not from home-screen apps.

## Deploy (free, GitHub Pages)
1. Merge this branch into `main`.
2. In the repo: **Settings → Pages → Source: GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` builds and publishes on every push to `main`.

## Develop
```sh
npm install
npm run dev      # local dev server
npm test         # unit tests (question flows + encryption)
npm run build    # production build in dist/
```
