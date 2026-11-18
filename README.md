# Bruna — a private journal that feels like a chat

Bruna asks you short, kind questions and you answer by tapping, writing a few words, or skipping.
It's built for people who find writing hard.

## How it helps you write
- **Tap first.** Every check-in starts with a mood tap and feeling words, so something is saved even if you type nothing.
- **Small, concrete questions.** "What happened that left you feeling stressed?" rather than "How was your day?"
- **Sentence starters.** Tap "It started when…" and finish the sentence.
- **Ask me differently.** Swaps any question for an easier one.
- **One gentle nudge.** After a very short answer it may ask for a bit more, at most once per check-in. You can turn this off.
- **Six check-ins:** Quick check-in (1 min), What I did, End of day, Something's on my mind (untangle a worry), Three good things, and Just write (with a daily prompt).

The questions live in [`src/flows.ts`](src/flows.ts) and the follow-ups in [`src/details.ts`](src/details.ts). They're plain text, easy to change or add to.

## Remembering what you did, and when
- **What I did** check-in: tap what you did and who you saw. Your own activities and people become one-tap options.
- **Specific follow-up questions** about up to three of the things you tapped, e.g. "You went for a walk — where did you go?", "What did you and Rita talk about?", "What was the appointment for? What did they say?" (End of day asks about two.) "No more questions" stops them at any time.
- **Tell someone about my day**: your answers become a few plain sentences ("Went for a walk: along the river. Saw Rita: she told me about her new job.") you can read out, copy or share. Shown at the end of the check-in and on every day in Memory.
- **Fill in yesterday**: if a day wasn't logged, the app offers to catch up the next morning, and the entry is filed under the right day.
- **Memory tab**:
  - *Calendar*: tap any day to see what you did, who with, and what you wrote. *On this day* shows a week, a month and a year ago.
  - *When did I last…*: e.g. "Saw Rita: 12 days ago · 9 times · about every 5 days".
  - *Practice*: picks a recent day and asks what you did. Tap what you remember, then see what you logged. Trying to recall before checking helps memories stick.
- **Daily reminder** (Settings): adds a repeating event to your phone's calendar. No server, and nothing from your journal is in it.

## Insights
The Insights tab shows how things change over a **week, month or year**, and you can step back to earlier periods:
check-ins, days journaled, average mood compared with the previous period, current streak, a mood chart
(tap for details, or view it as a table), your most-picked feelings, what your check-ins were about (with your
usual mood for each), and mood by day of the week. It's all calculated on your device.

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

The address follows the repository name (`…github.io/piteu`). To get `…github.io/bruna` instead, rename the repository on GitHub (Settings → General → Repository name) before installing it on your phone.

## Develop
```sh
npm install
npm run dev      # local dev server
npm test         # unit tests (question flows + encryption)
npm run build    # production build in dist/
```
