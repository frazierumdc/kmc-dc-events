# The Wix feed

> The app's only source of events (D4): a read-only Velo HTTP function in the center's Wix site.
> This page is its contract, install and test guide.
> Only the adapter (`packages/sync/src/wix-adapter.ts`, D37) reads it; everything after the adapter works on neutral website events ([data-model.md](data-model.md#website-event)).
> Audience: the developer, who needs the Wix **Website Manager** role.

| Code | What |
|---|---|
| `wix/backend/http-functions.js` | The feed and the record of all events, pasted into Wix as is (Prettier skips `wix/`) |
| `wix/backend/events.js` | The signal on each event change (D28), pasted into Wix as is |
| `packages/domain/src/feed.ts` | The contract's part: zod `FeedEnvelope`, which names no source |
| `packages/sync/src/wix-event.ts` | The source's event shape, beside the adapter: zod `WixEvent` |
| `packages/sync/src/fetch-feed.ts` | `fetchFeed`: the client the update job and the checks use |
| `packages/sync/src/wix-adapter.ts` | Wix event → website event: the only code that knows Wix's shapes |
| `packages/sync/src/feed-cli.ts` | `pnpm feed:check` and `pnpm feed:capture` |

## Contract

```
GET https://www.example.org/_functions/appEvents
Authorization: Bearer <KMC_APP_FEED_TOKEN>
```

| | |
|---|---|
| Returns | Every event with status `UPCOMING` or `STARTED` and a published date, ending after yesterday and starting within 400 days, any category, sorted by start |
| Never returns | Drafts, cancelled or ended events; guest, order, form, dashboard or online-meeting data |
| Shape | `{ generatedAt, window: { from, to }, access: "visitor" \| "elevated", count, events: [...] }`; each event in the Wix Events V3 REST shape, only the fields the app reads |
| Wrong or missing token | `403 { error: "Not authorised" }` |
| Wix error | `500 { error, detail }` |
| Size | About 1 MB for ~250 events; one request per copy run |
| Debug | `?raw=1` adds the first event exactly as Wix gave it (`raw`) and the first venue's raw location (`rawLocation`) |
| Test site | Add `?rc=test-site` to call a Wix test site instead of the live one |

**One event** (trimmed; from the capture of 7 October 2026):

```json
{
  "id": "3efe9c7a-d27a-480c-912b-3ba7ed7de483",
  "slug": "wednesday-step-by-step-meditation-2026-10-07-19-00",
  "title": "Wednesday Step by Step Meditation",
  "status": "UPCOMING",
  "shortDescription": "Deepen your meditation practice by exploring key meditations on the stages of the path to inner peace.",
  "description": { "nodes": [ "…Wix rich text…" ] },
  "location": {
    "name": "Kadampa Meditation Center DC",
    "type": "VENUE",
    "address": {
      "formattedAddress": "1200 Canal St SW, Washington, DC 20024, USA",
      "city": "Washington", "subdivision": "DC", "postalCode": "20024-3522", "country": "US",
      "geocode": { "latitude": 38.8762356, "longitude": -77.0117944 }
    }
  },
  "dateAndTimeSettings": {
    "startDate": "2026-10-07T23:00:00.000Z",
    "endDate": "2026-10-08T00:00:00.000Z",
    "timeZoneId": "America/New_York",
    "recurrenceStatus": "RECURRING_UPCOMING",
    "recurringEvents": { "categoryId": "f736d09f-21b3-4638-9981-32b3128da441" }
  },
  "eventPageUrl": { "base": "https://www.example.org", "path": "/event-details/wednesday-step-by-step-meditation-2026-10-07-19-00" },
  "registration": { "type": "TICKETING", "status": "OPEN_TICKETS" },
  "categories": [
    { "id": "7cbb60f2-cb91-4e5b-b6cc-8769db81ab9b", "name": "Weekly Meditation Classes" },
    { "id": "f736d09f-21b3-4638-9981-32b3128da441", "name": "Wednesday Step by Step Meditation" }
  ],
  "mainImage": { "url": "https://static.wixstatic.com/media/…" },
  "createdDate": "2026-07-24T01:32:39.853Z",
  "updatedDate": "2026-10-07T01:51:59.000Z",
  "publishedDate": "2026-07-24T01:32:40.053Z"
}
```

**Quirks the adapter handles** (seen in real captures):

- Every recurring event lists its recurrence category ("Wednesday Step by Step Meditation" above) among its categories, and Velo returns no `states` to mark it.
  Drop the category whose id equals `recurringEvents.categoryId`.
- Venue names vary for the same place ("Kadampa Meditation Center DC", "1200 Canal St SW", "Kadampa Meditation Center Washington DC"); the app shows them as Wix has them.
- Online venues have names like "Online Conference" or "Zoom Link" and no address.
- `registration.status` is `CLOSED_AUTOMATICALLY` on about half the events, always for a whole series: chanted prayers (except Heart Jewel Prayers & Silent Meditation), study programs, and special events whose registration has closed.
  Open registration is `OPEN_TICKETS` or `OPEN_RSVP`; the app then shows **Register**, otherwise **More info** (D36).
- `detailedDescription` is mostly empty; the rich `description` holds the long text.
  Links are `LINK` decorations on its text (`linkData.link.url`, web or `mailto:`).

### All events

```
GET https://www.example.org/_functions/allEvents
Authorization: Bearer <KMC_APP_FEED_TOKEN>
```

The record of the website for the Schedule changes email (AN-1, D62), a second function in the same file.
The app never reads it, and `appEvents` is as it was.

| | |
|---|---|
| Returns | Every event with a published date and status `UPCOMING`, `STARTED`, `ENDED` or `CANCELED`, in the same window, shape and order as `appEvents` |
| Never returns | Drafts; guest, order, form, dashboard or online-meeting data |
| Access | Always `"elevated"`: a visitor isn't shown ended or cancelled events |
| Read by | The update job's copy, beside the feed (`readAllEvents` in `packages/sync/src/copy-cli.ts`); when it fails the copy goes on and the email waits |

## Sample captures

Two real captures from 7 October 2026 are kept outside git (they're about 1 MB each); use them for the first dry run and to cut test fixtures:

| File | Taken | Notes |
|---|---|---|
| `feed.json` | 14:38 ET, test site | 249 events; **addresses present** (244 of 244 in-person events). The reference capture |
| `feed-live.json` | 13:50 ET, live site | 249 events; **every `address` is `{}`** (taken before the feed passed addresses through). Useful as a fixture for "venue with no address" |

They are in the earlier project at `KMCDC-Mobile-App/apps/api/.wix-capture/`.
Copy them into this repository's gitignored `.capture/` folder, or take a fresh one with `pnpm feed:capture`.

## Install (or re-install)

1. **Make a token** and keep it in the password manager: `openssl rand -hex 32`.
2. **Store it in Wix:** Dashboard → Developer Tools → Secrets Manager → Store Secret, name `KMC_APP_FEED_TOKEN`.
3. **Open the code panel:** Wix Editor → Dev Mode (Wix Studio: the Code icon) → Backend.
4. **`http-functions.js`:** create it if missing.
   If it holds other `get_…` functions, keep them and add the code below them (each name may appear only once).
5. **Paste** the contents of `wix/backend/http-functions.js` and save.
6. **Publish.**
   HTTP functions only serve published code.
   Publishing the live site publishes **every** pending editor change, so check with whoever edits the site first; or publish to a test site (Release Manager → Create Test Site) and use `?rc=test-site`.
7. **Store the same token in each Google project's Secret Manager** as `WIX_FEED_TOKEN` (D61): `scripts/setup-feed-secret.sh <project>` makes the empty secret and its reader once per project, then add the token as a version, as in [Rotate the feed token](../runbooks.md#rotate-the-feed-token).

## Test

```sh
pnpm feed:check                 # summary; add --test-site for a Wix test site
pnpm feed:capture               # the same, and saves .capture/feed.json
```

The token comes from `WIX_FEED_TOKEN` when set, otherwise from `your-project-id-dev`'s Secret Manager through the Mac's gcloud sign-in (`FEED_PROJECT` overrides the project); `WIX_FEED_URL` overrides the address.
The update job reads the token from its own stage's project (D61), so **Sync now** on a stage proves the feed and that project's token work.

**Good result:** `access` is `visitor`; a few hundred events; every status is `UPCOMING` or `STARTED`; nearly every event has categories; every in-person event has an address.
The check fails (exit 1) when an event doesn't match `WixEvent`, `count` disagrees with the events sent, or there are no events; anything else unusual is printed as a warning.

To look at the first event exactly as Wix gives it: `curl -sS -H "Authorization: Bearer $WIX_FEED_TOKEN" "https://www.example.org/_functions/appEvents?raw=1" | jq .raw`.

| Result | Likely cause | Fix |
|---|---|---|
| `403` | Token missing or different | Check the secret's name and value, and the `Bearer` header |
| `404` | Not published, or wrong name | Publish again; the path is `/_functions/appEvents` |
| `500` with `detail` | Wix refused the query or a field differs | Read `detail` and Wix Logging Tools |
| `access: elevated` | Wix didn't allow a visitor query | Acceptable (the status filter still applies); note it |
| Empty `events` | Filter or field names differ | Compare with `?raw=1` |

## The Wix signal

A second backend file, `wix/backend/events.js`, installed as `backend/events.js`, tells each stage's app server that an event changed (D28).
It exports a function for each of Wix's Events app events that can change the website: `wixEventsV3_onEventCreated`, `wixEventsV3_onEventUpdated`, `wixEventsV3_onEventCanceled` and `wixEventsV3_onEventPublished`.
None for a delete: Wix deletes only drafts and cancelled events, and a published event that hasn't taken place must be cancelled first ([Deleting an Event](https://support.wix.com/en/article/deleting-an-event-in-wix-events)), so a delete never changes the website.
Wix also calls the older names (`wixEvents_…`) for the same change, about 0.3 seconds earlier (tested on the published site, 11 November 2026), so only one family is exported, to send one signal per change.
Wix calls them for draft events too; creating or editing a draft sends nothing, as the website doesn't show drafts.
A draft is an event without a `publishedDate`, the field the feed also checks.
Publishing or cancelling any event always sends, so the app never keeps an event the website dropped.
Each sends the same signal to every stage in its `STAGES` list: a POST with that stage's secret in the header `x-kmc-signal`, and no event details.
A skipped change is logged in Wix Logs: "App signal (updated) skipped: a draft".
The stage's server then reads the whole website through the feed above, so the signal's payload doesn't matter.
Backend events don't fire in the editor's preview, only on the published site.
Today `STAGES` holds dev only.
Sources: Wix Velo [Events backend events](https://dev.wix.com/docs/velo/events-service-plugins/wix-events/events/introduction), [onEventUpdated](https://dev.wix.com/docs/velo/events-service-plugins/wix-events/events/on-event-updated), [wix-events-backend onEventUpdated](https://dev.wix.com/docs/velo/apis/wix-events-backend/events/on-event-updated).

### Install the signal

1. **Copy the stage's secret** on the Mac, without printing it: `gcloud secrets versions access latest --secret WIX_SIGNAL_SECRET --project your-project-id-dev | pbcopy`.
2. **Store it in Wix:** Dashboard → Developer Tools → Secrets Manager → Store Secret, name `KMC_APP_SIGNAL_DEV`, and paste.
   Then clear the clipboard (copy anything else).
3. **Open the code panel:** Wix Editor → Dev Mode (Wix Studio: the Code icon) → Backend.
4. **`events.js`:** create it if missing.
   If it holds other functions for the Events app, keep those that aren't for the KMC DC app and remove any earlier test functions for it; each name may appear only once.
5. **Paste** the contents of `wix/backend/events.js` and save.
6. **Publish**, as for the feed: publishing the live site publishes every pending editor change, so check with whoever edits the site first.

### Test the signal

1. In the Events app, change the time of an upcoming event that shows in the app, and save.
2. Within a few minutes, dev's log shows the signal and the check (below): "schedule changed (1 moved, 0 new, 0 removed); started Update schedule on dev".
3. About 3 minutes later the Update schedule run on `dev` has finished, and the dev app shows the new time when it is next opened or returned to.
4. Change the time back; the same happens again.
5. Edit only the description of an event: the check logs "no schedule change; nothing started".
6. Edit a draft event: Wix Logs show "skipped: a draft", and dev's log shows no signal.

Wix's side: Dashboard → Settings → Developer Tools → Logging Tools → Wix Logs, where a failed signal logs "App signal … to dev".
The app's side, on the Mac:

```sh
gcloud logging read 'resource.type="cloud_run_revision" AND (resource.labels.service_name="wixsignal" OR resource.labels.service_name="checkwebsite") AND textPayload:"Wix signal"' --project your-project-id-dev --limit 10 --format='value(timestamp,resource.labels.service_name,textPayload)'
```

| Result | Likely cause | Fix |
|---|---|---|
| Nothing in either log | Not published, or `events.js` misnamed | Publish again; the file is `backend/events.js` |
| Wix logs a 403 | The secret differs from the stage's | Copy and store it again (steps 1 – 2) |
| The check logs "no schedule change" after a time change | The event isn't upcoming, or isn't in the app | Try an event the app shows |

## Changing the feed code

Edit `wix/backend/http-functions.js` in a pull request like any code, update `FeedEnvelope` or `WixEvent` and add a test case for whatever changed, then paste and publish in Wix after merging and run `pnpm feed:check`.
The feed's output shape is part of the contract: add fields freely, never rename or remove one the adapter reads.

## Removing it

Delete `get_appEvents` (or the file), publish, delete `KMC_APP_FEED_TOKEN` from Secrets Manager and `WIX_FEED_TOKEN` from each Google project's Secret Manager.
