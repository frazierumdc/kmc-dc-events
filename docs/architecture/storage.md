# Storage

> Every file the app's jobs keep between runs, where it is, who writes it, who reads it and how long it lives.
> Decided in [D63](../DECISIONS.md#d63); the paths are defined once in code, in `packages/domain/src/state-paths.ts`, and this page lists them.

## One bucket per environment

Each environment has one private Cloud Storage bucket in its own Google project, in `us-east4`, named for what it holds:

| Environment | Project | Bucket |
|---|---|---|
| dev | `your-project-id-dev` | `your-project-id-dev-state` |
| test | `your-project-id-test` | `your-project-id-test-state` |
| prod | `your-project-id` | `your-project-id-prod-state` |

A bucket has one folder per job.
A job's account writes only its own folder, so finding a file starts with the question "which job owns this?".
No two files share a name, so a file copied out of the bucket still says what it is.

## What is in it

| Path | What | Written by | Read by | Life |
|---|---|---|---|---|
| `send-email/state.json` | The mail memory ([email.md](email.md#memory-between-runs-mail-state)): what was sent and when, and the Problem email's once-a-day record | `mail-sender@` (Send email) | `mail-sender@` | Kept; older versions for 30 days |
| `send-email/website-at-last-changes-email.json` | All the website's events as read at the last Schedule changes email, whatever their status, to compare the next one with (D62) | `mail-sender@` | `mail-sender@` | Kept; older versions for 30 days |
| `update-schedule/runs/<run>/hand-over.json` | What one copy found for the emails, in one file: its result, whether it published, who started it, and the copy's `mail/` files (the website as it read it, the schedule as copied, Duplicate events' and Problem's inputs) | `feed-reader@` (the `update-schedule` job) | `mail-sender@` (the `send-email` job) | Deleted after 7 days |
| `update-schedule/lock.json` | Who is running now, so there is one run at a time per project; a run that finds it waits, and takes over one older than 20 minutes | `feed-reader@` | `feed-reader@` | Removed when the run ends |

The two `update-schedule/` files are used by the two jobs ([apps/job](../../apps/job/src/main.ts)).
`<run>` is Cloud Run's own name for the run, so a hand-over can be matched to its log.

## Rules

- **Private.** Nothing in the bucket is public, and public access is prevented on the bucket itself.
- **One writer per folder.** Each account's permission is limited to its folder's path; `mail-sender@` may also read `update-schedule/`, and nothing else crosses.
- **No lost writes.** Send email writes `state.json` only over the version it read; when another run wrote first, the write fails and the run says so, and that run's memory stays.
- **A bucket that can't be read stops Send email** before anything is sent, since sending without the memory would send again what already went out.
- **Not the schedule.** The schedule phones load is on Firebase Hosting ([data-pipeline.md](data-pipeline.md)); the bucket holds only the jobs' memory.

## Set up and look inside

Once per project, the owner runs `scripts/setup-state-bucket.sh <project>`, which makes the bucket with its versions, its deletion rules and the two accounts' permissions.
The `send-email` job always uses the bucket (`MAIL_STATE_BUCKET`); on a developer's machine the memory is a local file.

To look inside: Google Cloud console → Cloud Storage → the bucket, or `gcloud storage ls -r gs://your-project-id-dev-state`.
To read the mail memory: `gcloud storage cat gs://your-project-id-dev-state/send-email/state.json`.
