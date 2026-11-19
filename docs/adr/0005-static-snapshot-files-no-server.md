# 0005. Static snapshot files, with no server or database until a feature needs one

- **Status:** Accepted
- **Decided:** Date not recorded
- **Recorded:** Written up on 17 November 2026 from the project's decision log, for this copy of the repository.
- **Source decisions:** D38, D41

## Context

Phones need the schedule quickly, offline, and without accounts.
The schedule changes a few times a day at most.

## Options

| Option | Trade-off |
|---|---|
| An API server and a database that phones query | Familiar; a server to run, secure and pay for, and an outage hides the schedule |
| Static files on a CDN: an immutable snapshot of the schedule and a tiny manifest naming the current one | Nothing to run; every change is a publish; anything needing a write from a browser has to wait or use a managed service |

## Decision

Start static.
The app and the schedule are static files on Firebase Hosting.
Each publish writes a versioned, immutable snapshot and a small manifest; phones fetch the manifest and download a snapshot only when its version changes, and keep the last good one in IndexedDB.
A server and a database are added only when a feature needs one.

## Consequences

- No application server to operate, and the app opens instantly and works offline.
- The snapshot format is the one contract phones depend on, so it changes only by adding optional fields.
- The schedule is never stored in the repository.
- The principle has had small, deliberate exceptions since: timers and a signal endpoint as functions ([0014](0014-pipeline-jobs-on-the-cloud-ci-on-github.md)), one live record ([0012](0012-layered-schedule-delivery.md)), and a function that manages notification topics ([0011](0011-notifications-by-topic-no-accounts.md)).
