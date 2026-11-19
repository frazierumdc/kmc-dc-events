# 0017. The pipeline runs only on Google Cloud; the GitHub-workflow path is retired

- **Status:** Accepted
- **Decided:** 18 November 2026, by the owner, Sean Frazier: "the pipeline should only run on Google cloud."
- **Recorded:** Written on 18 November 2026 with refactor 7 ([refactor-log.md](../refactor-log.md)).
- **Source decisions:** None (new). Completes [0014](0014-pipeline-jobs-on-the-cloud-ci-on-github.md).

## Context

[ADR 0014](0014-pipeline-jobs-on-the-cloud-ci-on-github.md) moved the update job and the emails to two container jobs in each environment's cloud project, one environment at a time.
During the switch both ways of running the pipeline existed: the GitHub workflow `update-schedule.yml` (which called `publish-site.yml` and `mail-send.yml`), and the jobs in `apps/job`.
A `JOBS_ON` setting chose one per environment, and the cloud functions branched on it in seven places.
Every change to the pipeline had to be made, and kept equal, in both (finding F5 of the [architecture review](../architecture-review.md)).
The functions also kept a GitHub token as a secret, only to start and list workflow runs.

## Options

| Option | Trade-off |
|---|---|
| Keep both paths and the setting | A fallback if the jobs fail; every pipeline change made twice, and the path not in use is never exercised, so it cannot be trusted as a fallback |
| Keep only the GitHub workflows | One path; the late timers and the dependence on the CI service that ADR 0014 was written to remove |
| Keep only the cloud jobs | One path, no GitHub token in the pipeline, schedule publishes without a build; an environment must have its jobs set up before its functions are deployed |

## Decision

The pipeline (copying the website, publishing the schedule, the emails after a copy, the timed email, the website-change check, notifications and reminders) runs only on Google Cloud, in each environment's own project.
The GitHub-workflow path is removed: `update-schedule.yml`, the `JOBS_ON`, `TIMER_REPOSITORY` and `GITHUB_DISPATCH_TOKEN` settings, the functions' code that started and listed workflow runs, the workflow-call half of `mail-send.yml`, and the "new schedule" half of `publish-site.yml`.

GitHub Actions keeps what ADR 0014 left it: CI, and the deploys of the app, the functions and the jobs.
The two by-hand mail workflows, Send email (`mail-send.yml`) and Mail test (`mail-test.yml`), were kept at first as not part of the pipeline. The owner retired them the same day: email runs only on Google Cloud. One email on request, a preview or the test email is the `send-email` job run by hand with `EMAIL` set (`EMAIL=test` for the test email).

## Consequences

- One orchestration path instead of two; a pipeline change is made once.
- The functions hold no GitHub token, and nothing in the pipeline calls GitHub at run time.
- A schedule publish never builds the app; only a code deploy does.
- The functions now always start the cloud jobs. An environment's two jobs must exist (`scripts/setup-update-job.sh`, then Deploy jobs) before this version of the functions is deployed to it; there is no setting to fall back on.
- Reminders before an event, which were sent only where the jobs ran on the cloud, are now sent in every environment whose reminder timer is not paused.
- The kill switch no longer switches the update job off: the job replaces only the schedule's files and keeps every other file of the live version, so the kill-switch service worker stays in place until the next normal deploy.
- "Sync now" is running the environment's `update-schedule` job by hand, not a GitHub workflow.
- The Problem emails, which told the reader to run the GitHub workflow and linked to it, now say "Open the Update schedule job in Google Cloud Run and select Execute." and link to the job's page in the Cloud console (the owner's wording, 18 November 2026).
- No workflow on GitHub sends email, holds a Gmail sign-in or may act as the mail account. A stage's mail settings (`MAIL_ENV`, `MAIL_FROM`, `MAIL_SETTINGS`, the site whose schedule the emails list) are the `send-email` job's own settings in Cloud Run, and its sign-in and lists are in Secret Manager; the GitHub mail environments are no longer read or written by anything (the owner's decision D57, 18 November 2026). The update job's site and feed addresses followed the same way (D61): they are the `update-schedule` job's own settings, and the GitHub `wix-feed` environments are no longer read either. What GitHub still holds is what its own workflows need to build and deploy. The set-up scripts and `pnpm mail:authorize` that changed for this are untested until their first real use.
