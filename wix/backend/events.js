// backend/events.js — KMC DC Events app: tells the app's server that an event changed (D28).
// Source of truth: wix/backend/events.js in this repository; install and test
// steps in docs/architecture/wix-feed.md §The Wix signal.
//
// When a published event is created or updated, and whenever an event is published or
// canceled, each stage below gets a POST with its own secret in the header x-kmc-signal, and
// nothing else: no event details leave Wix. Creating or editing a draft sends nothing, as the
// website and the app don't show drafts. Deleting sends nothing either: Wix deletes only drafts
// and cancelled events, neither on the website (Help Center, "Deleting an Event"). The stage's server then reads
// the whole website through the feed (http-functions.js) and updates the app only when a date
// or time moved, or an event was added or cancelled.
//
// Wix calls both the older wixEvents_… and the newer wixEventsV3_… names for one change, so
// only the newer are exported: one signal per change. Backend events fire only on the
// published site, never in the editor's preview. Each skipped change is logged in Wix Logs.
import { fetch } from 'wix-fetch';
import { getSecret } from 'wix-secrets-backend';

// Each stage's signal address and the name of its secret in Wix Secrets Manager.
const STAGES = [
  {
    name: 'dev',
    url: 'https://us-east4-your-project-id-dev.cloudfunctions.net/wixSignal',
    secret: 'KMC_APP_SIGNAL_DEV',
  },
];

export function wixEventsV3_onEventCreated(event) {
  return signalIfPublished('created', event.entity);
}

export function wixEventsV3_onEventUpdated(event) {
  return signalIfPublished('updated', event.entity);
}

// Published or canceled: always, so the app never keeps an event the website dropped.
export function wixEventsV3_onEventCanceled() {
  return signal('canceled');
}

export function wixEventsV3_onEventPublished() {
  return signal('published');
}

// Published, as the feed counts it: Wix gives a published event its publishedDate; a draft has
// none. Without the event at all, it can't tell, so it signals.
function signalIfPublished(what, entity) {
  if (entity && !entity.publishedDate) {
    console.log(`App signal (${what}) skipped: a draft (status ${entity.status})`);
    return Promise.resolve();
  }
  return signal(what);
}

/** One POST to each stage; a stage that fails is logged and never stops the others. */
async function signal(what) {
  await Promise.all(
    STAGES.map(async (stage) => {
      try {
        const secret = await getSecret(stage.secret);
        const res = await fetch(stage.url, { method: 'POST', headers: { 'x-kmc-signal': secret } });
        if (res.status !== 202) console.error(`App signal (${what}) to ${stage.name}: ${res.status}`);
      } catch (e) {
        console.error(`App signal (${what}) to ${stage.name} failed`, e);
      }
    }),
  );
}
