# 0012. Layered schedule delivery instead of relying on push

- **Status:** Accepted
- **Decided:** 9 to 12 November 2026
- **Recorded:** Written up on 17 November 2026 from the project's decision log, for this copy of the repository.
- **Source decisions:** D28, D59, D64

## Context

A cancelled or moved event must reach phones, and nobody should be shown an old time as if it were current.
Push delivery is not guaranteed, and iPhones allow it only for home-screen apps.
A review on 11 November 2026 found three gaps in the first design: the comparison copy was saved before publishing, a failed publish sent no email, and a phone that couldn't check said nothing.

## Options

| Option | Trade-off |
|---|---|
| Polling only (a check every minute) | Simple; up to a minute late. Kept as the fallback |
| Push notifications to wake open apps | Reaches only people who allowed them; iPhone allows no silent ones |
| A server holding connections open | Costs more than a managed record and is one more thing to run |
| A document database listener for the live record | Needs the provider's client library, roughly 80 to 100 kB more for every phone |
| A layered design: a signal from the website, a safety-net check, one live record, polling behind it | More moving parts; every failure has another route |

## Decision

1. The website sends a signal that carries no data when staff save an event; signals are gathered into one check per 5-second window.
2. The check compares the website with the schedule actually published on the site, by a fingerprint in the manifest, and starts an update only for a real schedule change (an event moved, added or cancelled).
3. The same check runs every 5 minutes as a safety net, and full copies run twice a day.
4. Each publish writes the new version to one record in the Realtime Database; open apps listen with the browser's own `EventSource`, with no client library, and then load the schedule from the site.
5. An app on screen also checks every minute and when its connection returns.
6. A site that differs from the website for 15 minutes alerts administrators; an app that could not check for 10 minutes says so.

## Consequences

- An open app shows a change within seconds; every other route ends at the same published file.
- A lost signal, a failed start or a failed publish is put right by the next check, because the reference is what phones actually load.
- Hundreds of small edits do not start hundreds of runs.
- More parts to understand and operate; the design memo states what no design can promise (a phone that is off).
