# Configuration

> How settings and secrets are supplied in this copy.
> Nothing here is a real value: every project, address and host is a placeholder ([SCRUB.md](../SCRUB.md)).

## What works with no configuration

`pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm data:check`, `pnpm build` and the dev server (`pnpm --filter @kmcdc/web dev`) need no account, secret or environment variable.
The dev server and the tests build the schedule from the fixtures in `packages/*/fixtures` and `packages/domain/golden`.
Email runs in fake mode by default: `pnpm mail …` writes messages to `.outbox/` instead of sending.

## Environment variables

Set these in the shell, in a gitignored `.env` at the repository root, or in the CI environment.
No value is committed.

Each runtime reads its environment in one module, which returns typed settings and has its own unit tests; the rest of the code takes values as arguments.

| Runtime | Module |
|---|---|
| The copy and feed commands | `packages/sync/src/config.ts` |
| The mail command | `packages/mailer/src/cli-settings.ts` (its own settings) and `packages/mailer/src/config.ts` (the mail settings, from the environment it is given) |
| The container job | `apps/job/src/config.ts` |
| The cloud functions | `apps/functions/src/config.ts`, plus Firebase parameters declared in `options.ts` |
| The app build | `apps/web/build-config.ts` |

A setting that only one step uses is still checked when that step reads it, not at start-up: a stage with no live record or no notifications leaves those settings out and still runs.

| Variable | Read by | What it is |
|---|---|---|
| `APP_ENV` | `apps/web/build-config.ts` | `dev`, `test` or unset (prod): the app's name and the label on its logo |
| `BUILD_ID` | `apps/web/build-config.ts` | The build's id; `local` when unset |
| `KILL_SWITCH` | `apps/web/build-config.ts` | `1` builds a service worker that removes itself |
| `LIVE_URL` | web build, update job | The realtime record open apps listen to; unset builds an app that only polls |
| `WEB_APP_CONFIG`, `PUSH_PUBLIC_KEY` | `apps/web/build-config.ts`, checked by `push-config.ts` | The messaging service's public web settings; unset builds an app without notifications |
| `WIX_FEED_URL`, `WIX_ALL_EVENTS_URL` | `packages/sync/src/config.ts` | The feed's addresses; default to the placeholders in `deployment.ts` |
| `WIX_FEED_TOKEN` | `packages/sync/src/config.ts` | The feed's bearer token (secret) |
| `FEED_PROJECT` | `packages/sync/src/config.ts` | The cloud project whose secret store holds the feed token, for local runs |
| `PUBLISHED_URL` | `packages/sync`, `packages/mailer` | The site whose published schedule a run compares with or emails from |
| `PUBLIC_BASE_URL` | publish commands in `packages/publish`, update job | The site's public address, written into event pages and calendar files |
| `MAIL_ENV` | `packages/mailer/src/config.ts` | `fake` (default), `dev`, `test` or `prod` |
| `MAIL_FROM` | mailer | The sending address |
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` | mailer | The sending account's sign-in (secrets) |
| `SCHEDULE_CHANGES_EMAILS`, `DUPLICATE_EVENTS_EMAILS`, `EVENTS_EMAILS`, `ADMIN_EMAILS`, `FP_EMAILS`, `TTP_EMAILS`, `DEV_EMAILS` | mailer | Each email's recipient list (secrets) |
| `MAIL_SETTINGS` | mailer | JSON switches for the emails |
| `MAIL_STATE_FILE`, `MAIL_STATE_BUCKET`, `MAIL_OUTBOX` | mailer | Where the mail memory and the fake outbox are kept |

A stage's settings are its two jobs' own environment variables in Cloud Run, written when `scripts/setup-update-job.sh` makes each job (from values given in the script's own environment) and changed there afterwards (Cloud Run → Jobs → the job → Edit): on `update-schedule`, `PUBLIC_BASE_URL`, `PUBLISHED_URL` and, when it isn't the code's own, `WIX_FEED_URL`; on `send-email`, `MAIL_ENV`, `MAIL_FROM`, `MAIL_SETTINGS` and the `PUBLISHED_URL` the emails read. Its sign-in and recipient lists are in the project's Secret Manager. None of them is in a GitHub environment (D57, D61), and `pnpm mail:authorize <project-id>` reads `MAIL_FROM` from the job.

| Variable | Read by | What it is |
|---|---|---|
| `PROJECT`, `REGION` | `packages/mailer/src/cli-settings.ts` | The job's own (below): with them the emails link to the Update schedule job's page in the Cloud console; without them, to the console's list of jobs |
| `RUN_URL` | `packages/mailer/src/cli-settings.ts` | Optional: the address of the run's own log, for the Schedule changes email |
| `JOB`, `PROJECT`, `REGION`, `STATE_BUCKET`, `HOSTING_SITE`, `SEND_EMAIL_JOB`, `TRIGGER`, `RUN`, `EMAIL`, `TO`, `SCHEDULED`, `SINCE`, `JOB_WORK_DIR` | `apps/job/src/config.ts` | The container job's settings, set by its deploy |
| `STAGE` | `apps/functions/src/options.ts` | Function parameter written by the functions deploy workflow: `dev`, `test` or `prod`, named in the check's log lines |
| `WIX_FEED_TOKEN`, `WIX_SIGNAL_SECRET` | `apps/functions/src/options.ts` | Function secrets, read from the project's secret store |

The pipeline's jobs and functions get their settings in their own cloud project; nothing in the pipeline reads a GitHub setting or token at run time ([ADR 0017](adr/0017-the-pipeline-runs-only-on-the-cloud.md)).
The GitHub workflows, which only build and deploy, read their settings from GitHub environment variables (`vars.*`), and sign in to the cloud with Workload Identity Federation (`WIF_PROVIDER` and one `*_SERVICE_ACCOUNT` per workflow), so no long-lived key is stored.

## Placeholder constants in code

A few values that identify one deployment are still constants.
Each is a placeholder here; a real deployment edits them.
Refactor 3 moved the first four rows into the runtime's configuration module; the rest are where they were ([refactor-log.md](refactor-log.md)).

| Constant | File | Placeholder |
|---|---|---|
| `FEED_URL`, `ALL_EVENTS_URL` | `packages/sync/src/deployment.ts` | `https://www.example.org/_functions/…` |
| `FEED_PROJECT` | `packages/sync/src/deployment.ts` | `your-project-id-dev` |
| `SITES` | `apps/web/build-config.ts` | `https://events[.dev|.test].example.org` |
| `APP_ORIGINS` (the allowed-origin pattern of `notifyLists`) | `apps/functions/src/config.ts` | `events[.dev|.test].example.org` |
| `stateBucketName` | `packages/domain/src/state-paths.ts` | `your-project-id-<env>-state` |
| `WEBSITE` | `apps/web/src/App.tsx` | `example.org` |
| `STAGES` | `wix/backend/events.js` | One function address per stage |
| Privacy contact | `packages/ui/src/privacy.ts`, `apps/web/get-app/index.html` | `contact@example.org` |
| Center name, contact, links, allowed hosts | `data/site.json` | Placeholder contact and host |

## Cloud setup

The scripts in `scripts/` create the cloud resources for one project and take the project id as their first argument; none holds a project id of its own.
Run them against your own project.
