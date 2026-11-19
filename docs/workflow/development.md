# Development workflow

> How every change is made, by a person or an AI coding agent.
> The short version for agents is in [CLAUDE.md](../../CLAUDE.md); this is the full one.

## Working agreement

- **Every change reaches `dev` through a pull request** from a short-lived branch, `test` only through a `dev` → `test` release pull request, and `main` only through a `test` → `main` release pull request (D42).
  Nothing is committed straight to `dev`, `test` or `main`; pull requests are merged when the owner says so.
  Branch names start with `feat/`, `fix/`, `docs/` or `chore/`.
- **One numbered step at a time.**
  Each slice in [PLAN.md](../PLAN.md) has numbered steps.
  Do one, report what changed and how it was checked, then go on.
- **Ask before every commit and push.**
  Group commits sensibly; cite requirement IDs (`EV-12`, `AN-2`) in messages.
- **Docs in the same change as the code.**
  If behaviour changes, the requirement or architecture page changes in the same commit.
  Tick the plan's checkbox in the same commit too.
- **PLAN.md is kept current.**
  The owner reads it to know what's going on.
  A plan agreed in conversation (a new idea, a slice added, split or re-ordered, a step added) goes into PLAN.md in a pull request straight away, with a Status log line; so does every step done.
  PLAN.md's **Now** box is rewritten each time, and each Status log line carries its pull request number.
- **Every pull request is easy to follow.**
  Its description has the four parts of [the template](../../.github/pull_request_template.md): What changes for you, Read (links to the changed sections), Needs your OK, Checked.
- **Never read or scrape example.org's pages.**
  The feed is the only source; anything else only when the owner asks.
- **The app shows exactly what the website shows** (D36).
  Schedule changes reach the app only by the update job copying the website (D38); never add event details of the app's own, and never edit or hold back schedule data by hand.
  The one exception is the online schedule in `data/site.json` (D46).
- **No personal email addresses in the repository** (docs, code, fixtures, commits).
- **Plain, concise English** in docs, commit messages and replies.

## A vertical slice

Every feature is built through every layer it touches, in this order, and is finished before the next one starts.
A layer that isn't touched is named and skipped with a reason.

| # | Layer | Where | Rules |
|---|---|---|---|
| 1 | **Contract** | `packages/domain` | Change zod schemas first: feed, website event, site settings, snapshot. Snapshot changes are additive only. All time logic in `time.ts`. TSDoc on public functions |
| 2 | **Data** | `packages/sync`, `data/site.json` | Only the adapter knows the source (D37); new site settings optional with defaults; `pnpm data:check` passes |
| 3 | **Tools and workflows** | `packages/sync`, `packages/mailer`, `.github/workflows/` | Secrets only from environments; every external call has a timeout and a fake for tests |
| 4 | **App** | `packages/ui`, `apps/web` | iPhone and Android styling, light and dark from theme tokens, accessible names, offline, in a tab and installed; tolerant of older snapshots and unknown fields |
| 5 | **Tests** | every package, `e2e/` | Unit tests per layer; at least one cross-layer test (feed → adapter → snapshot → app shows it) |
| 6 | **Docs** | `docs/` | Requirements, architecture pages and PLAN checkboxes |

**Before starting a slice:** read its section in PLAN.md, its requirements, and the architecture pages it names; check its open decisions; if a behaviour isn't specified, propose the requirement first and get the owner's OK.
A requirements file marked **Draft** isn't approved: work on its slice starts only once the owner approves it and the draft banner is removed.
If the screens have no mock-up, make one first ([mockups.md](mockups.md)).

## Definition of done

A slice is done only when all of these are true:

1. Every requirement in its scope passes, checked against the requirement text.
2. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm data:check` and `pnpm e2e` pass in CI.
   A change of wording alone runs no CI (owner): its commits carry `[skip ci]` and only the unit tests that quote the words run, on the Mac.
3. It's deployed to the dev site and checked working on a real phone (iPhone and Android for anything on screen).
   Each release then reaches the test and prod sites; the prod site isn't launched until Phase 3 (D30).
4. Docs updated; PLAN.md checkboxes ticked and the slice's status row updated.
5. Anything deliberately left out is written down in the slice section as "Deferred".

## Rules that keep the code safe to change

| # | Rule |
|---|---|
| C-1 | Every data shape is defined once in `packages/domain` and imported everywhere else. |
| C-2 | Only the adapter reads the source's format; everything after it uses website events (D37). |
| C-3 | Ids come from the source or are derived from it (D39); nothing is stored to keep them. |
| C-4 | All business time logic goes through `packages/domain/src/time.ts`, in Eastern time. |
| C-5 | Never invent a link; Register and More info only to the event's page on an allowed host. |
| C-6 | Text from the website is rendered as text, never as HTML; web addresses in it may become links. |
| C-7 | Snapshot schema 2 changes are additive; a breaking change needs schema 3 published alongside. |
| C-8 | Colours come from theme tokens with light and dark values; platform differences go through the platform theme, not duplicated components. |
| C-9 | No month-grid calendar. |
| C-10 | The web app makes no requests to other companies' servers and adds no tracking; any new network dependency needs a requirements change and a privacy-page update. |
| C-11 | Service-worker changes keep the kill switch and are tested updating from the previous prod build. |
| C-12 | Secrets only in GitHub environments and Wix Secrets Manager; never in code, logs, pull requests, emails or the app. |
| C-13 | Only published Wix events reach the snapshot; there are no app-only events or details (D36), except the online option from the online schedule (D46). |
| C-14 | Emails contain only public event information and links, and no recipient address appears in code, logs or pull requests. |

## Testing

| Layer | Tools | Covers |
|---|---|---|
| Domain | Vitest | Schemas, class ids, Eastern dates across 2026-11-01 and 2027-03-14 |
| Copy | Vitest + fixtures | Adapter on every fixture case, checks, what-changed summary, snapshot build; `pnpm copy` run on a saved feed (files written, exit codes) |
| Mailer | Vitest | Template snapshots, message encoding, dedupe |
| UI and app | Vitest + Testing Library | Components, list logic, schedule sync against a fake feed, storage, app-update rules against a fake service worker; WCAG AA contrast of the theme colours in `packages/ui/src/theme.css` |
| Browser | Playwright: WebKit (iPhone 15) and Chromium (Pixel 7), browser time zone set to Tokyo to prove Eastern dates | List, filters, day picking, details panel, offline reload, app update, kill switch, install files; WCAG 2.2 AA audit with axe (light and dark), second visit under 1 s, JS within 150 KB gzip, no requests to other sites or cookies, Reduce Motion, keyboard |
| Cross-layer | Vitest + Testing Library (`apps/web/src/pipeline.test.tsx`) | Real-feed fixtures → adapter → snapshot → the page lists the events; a website edit reaches the page with "Schedule updated"; the same website publishes nothing; a broken source leaves the phone on its last schedule |
| Real phones | By hand | The release checklist below |

## Release checklist

On the test site, after a `dev` → `test` release and before the `test` → `main` one:

- [ ] iPhone, Safari tab: list, filters, a day, details panel, Register opens the event.
- [ ] iPhone, home-screen app: opens full screen; Airplane Mode → reopens with the list.
- [ ] Android, Chrome: the same; installed app opens offline.
- [ ] "Schedule updated …" shows the expected time.
- [ ] Nothing hidden at the bottom of the screen; dark mode readable.

## Running it locally

| To | Run |
|---|---|
| Install | `pnpm install` (pnpm 12 from `npm install -g pnpm`; pnpm downloads Node 24 for the scripts) |
| Fix formatting | `pnpm format` (Prettier; `pnpm lint` checks it) |
| Checks | `pnpm lint && pnpm typecheck && pnpm test && pnpm data:check` |
| Line coverage | `pnpm test:coverage`: the tests, then a table of line coverage per package; lint fails a function whose complexity is over 20 |
| Browser tests | `pnpm e2e` (first time: `pnpm --filter @kmcdc/e2e exec playwright install chromium webkit`) |
| The app with a saved schedule | `pnpm --filter @kmcdc/web dev`, then http://localhost:5173. The dev server builds `/v2/feed/` from `.capture/feed.json` (or the test fixtures) through the adapter |
| The built app, as deployed | `pnpm build && pnpm copy --from-file .capture/feed.json --out apps/web/dist && pnpm --filter @kmcdc/web preview`, then http://localhost:4173 |
| On an iPhone on the same Wi-Fi | `scripts/dev-cert.sh` once (mkcert), trust the certificate on the phone, then open `https://<mac-name>.local:5173` |
| Check the Wix feed | `pnpm feed:check` (the token from `your-project-id-dev`'s Secret Manager through gcloud, D61) |
| Save the feed | `pnpm feed:capture` → `.capture/feed.json` |
| Try a copy | `pnpm copy --from-file .capture/feed.json` → `.copy/v2/feed/`, `.copy/summary.md` and the emails' inputs in `.copy/mail/`; nothing is published |
| A test email | `pnpm mail test`: to `.outbox/` (`MAIL_ENV` unset); a real one is the stage's `send-email` job run by hand with `EMAIL=test` ([ci-cd.md](../architecture/ci-cd.md#emails-by-hand)), as the Gmail sign-ins are in Secret Manager (D60) |
| Email templates | After a copy, `MAIL_ENV=fake pnpm mail duplicates .copy/mail/duplicates.json`, then open `.outbox/`. Schedule changes is made by the send-email job; `pnpm mail changes <file>` takes a `changes.json` saved from one |

What the Mac needs (D57, D61):

- **The feed token** comes from `your-project-id-dev`'s Secret Manager through gcloud (`FEED_PROJECT` picks another project). No file holds it.
- **The site** `pnpm copy` and `pnpm mail` read comes from `PUBLISHED_URL`: set it in the shell or in a gitignored `.env` at the repository root (for dev, the dev site's address), or pass `--published <url>` to `pnpm copy` and `--schedule <file>` to `pnpm mail`. Nothing is read from GitHub: a stage's settings are on its two jobs in Cloud Run.
- **Settings in GitHub Actions** come only from the job's environment: the commands never read GitHub's settings there or in CI.

### Trying test or prod from the Mac

The same commands try test or prod with one setting in front.
They publish nothing and send nothing: `pnpm copy` writes `.copy/` (or `--out`), and `pnpm mail` writes `.outbox/` while `MAIL_ENV` is unset.

| To check | Dev (default) | Test | Prod |
|---|---|---|---|
| The environment's feed token works (`200`) | `pnpm feed:check` | `FEED_PROJECT=your-project-id-test pnpm feed:check` | `FEED_PROJECT=your-project-id pnpm feed:check` |
| What the next Update schedule would change on its site | `pnpm copy` | `PUBLISHED_URL=https://events.test.example.org pnpm copy` | `PUBLISHED_URL=https://events.example.org pnpm copy` |
| An email made from its site's schedule (a preview in `.outbox/`) | `pnpm mail events --to me` | `PUBLISHED_URL=https://events.test.example.org pnpm mail events --to me` | `PUBLISHED_URL=https://events.example.org pnpm mail events --to me` |

`pnpm copy` reads the live feed; add `--from-file .capture/feed.json` to use the saved one.
Any email works in place of `events` (`duplicates`, `program-fp`, `reminders`, …; `pnpm mail` lists them).
The addresses are each environment's `PUBLISHED_URL` ([infrastructure.md](../architecture/infrastructure.md)).

Debug on an iPhone with Safari's Web Inspector (Settings → Apps → Safari → Advanced) and the Mac's Develop menu.
Safari tabs and the home-screen app keep separate storage.

## Runbooks (write each with the slice that needs it)

Every runbook goes in [docs/runbooks.md](../runbooks.md).

| Runbook | Slice | Where |
|---|---|---|
| Switch the service worker off (kill switch) | 1.2 | [runbooks.md](../runbooks.md#switch-the-service-worker-off-kill-switch) |
| Rotate the feed token | 1.1 | [runbooks.md](../runbooks.md#rotate-the-feed-token) |
| Copying failed: what each Problem email means | 2.1 | runbooks.md |
| Re-authorise Gmail | 2.1 | runbooks.md |
| Change who gets an email (Google Groups) | 2.1 | runbooks.md |
| Roll back a release | 1.2 | [runbooks.md](../runbooks.md#roll-back-a-release) |
