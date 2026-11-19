# KMC DC Events

An installable, offline-first phone app for a meditation center's events, plus the pipeline that keeps it in step with the center's website and sends schedule emails.

Originally built for the Kadampa Meditation Center DC (KMC DC), which owns and runs the live app.
This repository is an independent copy of the code with every center-specific setting replaced by a placeholder ([SCRUB.md](SCRUB.md)); it is a code sample, not the center's deployment.

- **What it does:** people see what's coming up, find their class in seconds, and go to the center's website to register and pay. The app shows exactly what the website shows.
- **How it stays current:** an update job reads the website's events through one adapter, validates them, and publishes an immutable schedule snapshot that phones download. Staff edit events in one place, the website.
- **Architecture review and decisions:** [docs/architecture-review.md](docs/architecture-review.md), [docs/metrics-baseline.md](docs/metrics-baseline.md), [docs/adr/](docs/adr/README.md).
- **All documentation:** [docs/README.md](docs/README.md).

## How it works

```
Website (staff edit events) ──feed──▶ Update job (timer, or a signal from the website)
                                          │ adapter → website events → checks → snapshot
                                          ▼ only when something changed
                              Static hosting ──▶ phones (offline-first)
                                          └────▶ schedule emails to staff and study programs
```

No application server and no database hold the schedule: the update job publishes the file phones download ([architecture overview](docs/architecture/overview.md)).

## Repository

| Path | What |
|---|---|
| `apps/web` | The installable web app (React + Vite, service worker) |
| `apps/functions` | Firebase functions: timers, the website's change signal, notification lists, reminders |
| `apps/job` | The container entry for the two Cloud Run jobs (update schedule, send email) |
| `packages/domain` | Shared data shapes (zod), class ids, Eastern time, schedule comparison. Pure, no I/O |
| `packages/sync` | Feed client, the website adapter, checks, snapshot builder, hosting publish |
| `packages/mailer` | Schedule emails through the Gmail API |
| `packages/publish` | What is published for each event beside the schedule (calendar file, share text and picture, its own page), and the commands that put a schedule on the site |
| `packages/cloud` | Small Google Cloud REST clients (bucket, jobs, lock, messaging) |
| `packages/ui` | React components and theme |
| `data/` | Site settings (`site.json`) |
| `wix/` | Code installed in the website (the feed and the change signal) |
| `e2e/` | Playwright browser tests |
| `scripts/` | One-time cloud setup scripts, each taking the project as an argument |
| `docs/` | Requirements, architecture, the architecture review, ADRs |

## Running it

Needs pnpm 12.
On first install pnpm downloads Node 24, which the repository's scripts run on.

```sh
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm data:check
pnpm --filter @kmcdc/web dev    # http://localhost:5173, schedule from the test fixtures
pnpm build                      # the production build of the app
```

Nothing above needs a cloud account or a secret.
Deploying it, reading a live feed or sending email needs your own configuration: [docs/configuration.md](docs/configuration.md).

## Licence

The code is released under the [MIT License](LICENSE).
The licence does not cover the center's name or logo.
The logo under `brand/` and the pictures under `data/pictures/` are placeholders drawn for this copy ([SCRUB.md](SCRUB.md)); the center's own logo is supplied at deploy time.
