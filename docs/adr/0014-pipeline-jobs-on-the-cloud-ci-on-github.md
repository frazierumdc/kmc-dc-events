# 0014. Pipeline jobs run on the cloud provider; CI and deploys stay on GitHub Actions

- **Status:** Accepted; the migration was completed by [0017](0017-the-pipeline-runs-only-on-the-cloud.md) on 18 November 2026. Moving CI as well is open
- **Decided:** 6 and 11 November 2026
- **Recorded:** Written up on 17 November 2026 from the project's decision log, for this copy of the repository.
- **Source decisions:** D54, D63, D66 (open)

## Context

The update job and the emails first ran as GitHub Actions workflows.
GitHub's scheduled runs started hours late or not at all, and on 11 November 2026 its runners and artifact downloads failed for more than ten minutes with no incident shown, so a website change waited on the CI service.
CI minutes on the hosting plan were also limited.

## Options

| Option | Trade-off |
|---|---|
| Keep everything on GitHub Actions | One place; late timers, and the pipeline's uptime depends on the CI service |
| Timers on the cloud provider that start GitHub workflows | On-time starts; still needs a GitHub token and GitHub's runners |
| Run the update and email jobs as container jobs on the cloud provider, started by its own timers and API; keep CI and deploys on GitHub | The pipeline no longer depends on the CI service; two orchestration paths exist during the switch |
| Move CI and deploys to the cloud provider's build service as well | One place for everything that runs; four workflows to rewrite and prove again. Recorded as open, to be decided by measurement |

## Decision

Everything that isn't building and deploying the app runs in each environment's own cloud project: two Cloud Run jobs (update schedule, send email) started by cloud timers and by the website-change check, with one run at a time per project.
The update job publishes a new schedule through the hosting API without rebuilding the app.
The jobs keep their memory in one private bucket per environment, one folder per job, written only by that job's identity.
CI and app deploys stay on GitHub Actions.

## Consequences

- A schedule change no longer waits for the CI service, and most CI minutes are saved.
- A schedule publish never rebuilds or changes the app itself.
- Until every environment was switched, the GitHub workflows and the container job both existed and had to be kept equal (a `JOBS_ON` setting chose). [ADR 0017](0017-the-pipeline-runs-only-on-the-cloud.md) removed the GitHub path and the setting.
- "Start static" ([0005](0005-static-snapshot-files-no-server.md)) has a deliberate exception: functions and jobs run on the provider.
