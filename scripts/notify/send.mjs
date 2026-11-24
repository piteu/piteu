// Run by .github/workflows/notify.yml every hour. Sends whichever Bruna reminders are due.
// The code in the BRUNA_PUSH secret comes from Bruna → Settings → Notifications.
// Notifications only contain the fixed reminder text below — never anything from the journal.
import webpush from 'web-push';
import { decodeCode, due, message } from './schedule.mjs';

const code = process.env.BRUNA_PUSH;
if (!code) {
  console.log('No BRUNA_PUSH secret yet — nothing to send. Set it up in Bruna → Settings → Notifications.');
  process.exit(0);
}

const cfg = decodeCode(code);
const kinds = process.env.SEND_TEST === 'true' ? ['test'] : due(cfg);
console.log(`Time zone ${cfg.tz}. Due now: ${kinds.join(', ') || 'nothing'}`);

// Push services require an https: address identifying the sender; use the app's own address.
const subject = /^https:\/\//.test(cfg.app || '') ? cfg.app : 'https://github.com';
webpush.setVapidDetails(subject, cfg.vapid.publicKey, cfg.vapid.privateKey);

let failed = false;
for (const kind of kinds) {
  try {
    await webpush.sendNotification(cfg.sub, JSON.stringify(message(kind)), { TTL: 3 * 3600, urgency: 'normal' });
    console.log(`Sent: ${kind}`);
  } catch (e) {
    failed = true;
    if (e.statusCode === 404 || e.statusCode === 410) {
      console.error('Your phone no longer accepts these notifications (it was reset or notifications were turned off).');
      console.error('In Bruna, go to Settings → Notifications → Turn on again, and update the BRUNA_PUSH secret with the new code.');
    } else {
      console.error(`Could not send "${kind}": ${e.statusCode ?? ''} ${e.body ?? e.message}`);
    }
  }
}
process.exit(failed ? 1 : 0);
