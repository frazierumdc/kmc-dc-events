# Refactor log

> The before and after of each refactor from the [architecture review](architecture-review.md), measured the way [metrics-baseline.md](metrics-baseline.md) was.
> Each refactor is one pull request with behaviour unchanged.
> "Before" is the first commit of this copy; "after" is that pull request's branch. "All six merged" covers refactors 1 to 6; later refactors have a section each, measured against `main` as it was when they started.

## How it was measured

| | |
|---|---|
| Date | 18 November 2026 |
| Machine and tools | The same as the baseline: Apple M5 Pro, macOS, Node 24, pnpm 12.10.1, Vitest 5, TypeScript 6, ESLint 10, Vite 8 |
| Checks on every pull request | `pnpm lint`, `pnpm typecheck`, `pnpm data:check`, `pnpm test` locally; the same plus the Playwright suite in CI on GitHub |
| Browser tests locally | Run for refactors 5 and 6 and for the six merged together (WebKit and Chromium were already installed): 147 pass, 13 skipped |
| Not measured | The job's container image was not built (no Docker on this machine); its install step was reproduced instead. No deploy workflow was run: they are disabled in this copy. Line coverage is still not measured (refactor 10) |

## Summary

| # | Refactor | Finding | Metric | Before | After |
|---|---|---|---|---|---|
| 1 | Mail CLI test no longer needs a git remote | F19 | Tests passing in a checkout with no `origin` remote | 837 of 844 | 844 of 844 |
| 2 | Package boundaries made real | F1, F2 | Relative imports into another package (source) | 11 | 0 |
| | | | The same, in tests | 9 | 0 |
| | | | Workspace dependencies used but not declared | 4 | 0 |
| 3 | One configuration module per runtime | F7, F10, F12 | Files that read the environment directly | 14 | 10 |
| | | | ... of which are a configuration module | 0 | 5 |
| | | | ... of which are other runtime code | 12 | 3 |
| | | | Placeholder deployment constants outside a configuration module or `data/site.json` | 8 | 4 |
| 4 | Schedule publishing moved out of the web app | F3 | `apps/job` depends on `apps/web` | yes | no |
| | | | `apps/web/tsconfig.json` include list | 10 entries | 5 |
| | | | Packages in the job's filtered install | 1,148 | 780 |
| | | | Size of that install (`node_modules`, macOS) | 887 MB | 577 MB |
| 5 | UI package by feature; `SettingsSheet` and the stylesheet split | F13, F14 | `SettingsSheet.tsx` | 860 lines | 189 |
| | | | Largest stylesheet | 3,817 lines | 580 |
| | | | CSS loaded by `/get-app` | 52.2 kB (11.4 kB gzip) | 22.4 kB (5.5 kB gzip) |
| | | | Files directly in `packages/ui/src` | 34 | 6 |
| 6 | `App` slimmed into feature hooks; web app source by feature | F15 | `App.tsx` | 499 lines | 133 |
| | | | `App` complexity | 31 | 9 |
| | | | Source files directly in `apps/web/src` | 33 | 8 |

## Targets the review set that were not reached

The review gave each refactor an expected effect. Four were not reached, and the numbers above are the measured ones.

| Refactor | Target | Measured | Why |
|---|---|---|---|
| 3 | Files reading the environment: 5 or fewer | 10 by the same count (6 configuration modules once refactor 4 is in, 2 other runtime files, 2 browser-test tooling files) | The two runtime files left are a default argument in the token helper, used by a hand-run script, and Vite's built-in `import.meta.env.PROD` flag, which is not a setting. The browser-test tooling was left alone |
| 3 | Every setting validated at start-up | Not done | It would change behaviour: a setting only one step uses is checked when that step reads it, so a stage with no live record or no notifications leaves those settings out and still runs. The modules keep that timing and the same messages |
| 5 | Largest component file under 300 lines | 441 | True for the file that was split (860 to 189). `NotificationsScreen.tsx`, not in scope, is now the largest |
| 5 | `/get-app` script smaller | 86.8 kB to 86.9 kB gzip | Almost all of it is React, which the page shares with the app. Only its CSS could be cut |

One target was met exactly at its limit: source files in `apps/web/src`, "under 8", is 8.

## What each refactor found on the way

- **2.** `apps/functions` cannot list workspace packages in its `package.json`: Firebase's cloud build runs npm on that file, and npm rejects the `workspace:` protocol. The dependencies are declared through a pnpm hook instead ([ADR 0016](adr/0016-functions-workspace-dependencies-declared-by-hook.md)). The review had not seen this constraint.
- **2.** A feed fixture was read by tests in five packages through relative paths. It moved beside the feed schema, in the contract package.
- **3.** The region and the service-account naming were repeated as literals in the functions' entry file. Each function's deployment description is identical before and after.
- **4.** The review described five Node scripts at the web app's root. They also imported app source modules, three of which nothing in the app used. Those moved with the scripts; the calendar code that both the app and the publisher use is now one copy in the new package's browser-safe entry.
- **5.** The stylesheet depends on cascade order, so the feature sheets are assembled by an ordered index, not imported by each component. That made a byte-identical build possible: the app's CSS is the same bytes before and after.
- **6.** One hook had to change form to pass the hooks lint (a ref updated in an effect, not during render).

## How "behaviour unchanged" was checked

| Refactor | Check |
|---|---|
| 1 | The suite run with git unable to read a remote |
| 2 | The functions bundle holds the same lines of code (sorted, the two builds differ by one duplicated comment and one swapped pair of local names). The job image's install was reproduced with and without the hook file |
| 3 | All 70 files of the built app are byte-identical for the same environment. The deployment description of each of the 7 functions is identical. The commands' own process-level tests pass unchanged |
| 4 | 347 published files (calendar files, event pages, share pictures) for a fixture schedule hash the same. Each command exits with its usage as the image check expects |
| 5 | Built CSS: same content hashes after the split. 20 full-page screenshots of `/get-app` across 7 browser identities and both themes are pixel-identical. Browser tests pass |
| 6 | The screen's behaviour tests are unchanged apart from import paths. Browser tests pass |

## All six merged

Measured on the six branches merged together locally (not yet on `main`: each pull request is merged by the owner).

### Checks

| Check | Baseline | All six merged |
|---|---|---|
| Lint | 0 errors, 8.3 s | 0 errors, 8.6 s |
| Types | 0 errors, 3.3 s, 10 projects | 0 errors, 3.4 s, 11 projects |
| Unit and component tests | 844 in 89 files, 6.4 s; 7 fail with no `origin` remote | 879 in 95 files, 6.4 s; none depend on the remote |
| Site settings | 0 problems | 0 problems |
| Build | Succeeds, 1.3 s | Succeeds, 1.1 s |
| Browser tests | Not run | 147 pass, 13 skipped, 31 s |

The 35 new tests are for the configuration modules (32 from refactor 3, 3 from refactor 4).

### Structure

| Measure | Baseline | All six merged |
|---|---|---|
| Workspace packages | 10 | 11 (`packages/publish` added) |
| Relative imports into another package, source and tests | 20 | 0, and a lint rule forbids them |
| Workspace dependencies used but not declared | 4 | 0 |
| Files that read the environment directly | 14 | 10 (6 configuration modules, 2 other runtime, 2 test tooling) |
| `apps/job` depends on `apps/web` | yes | no |
| Files directly in `apps/web/src`, not tests | 33 | 8 |
| Files directly in `packages/ui/src` | 34 | 6 |
| TypeScript source files over 300 lines | 13 | 11 |
| Stylesheets over 300 lines | 1 (3,817 lines) | 5 (347 to 580 lines) |

### Complexity

| Threshold | Baseline | All six merged |
|---|---|---|
| Functions over 10 | 44 | 44 |
| Functions over 15 | 13 | 12 |
| Functions over 20 | 6 | 5 |

`App` left all three lists (31 to 9). `useEventPanel`, the panel logic that was inside it, enters the first at 14.
The five functions still over 20 are pipeline and email code (`adaptWixEvent` 52, `programDatesEmail` 34, `copyWebsite` 28, group expansion 24, `summarizeFeed` 24): refactor 8, not in this round.

### Web bundle

| | Baseline | All six merged |
|---|---|---|
| Script to open the app, gzip | 131.4 kB | 133.3 kB |
| Script to open `/get-app`, gzip | 85.8 kB | 86.9 kB |
| CSS to open the app | 50.4 kB (11.0 kB gzip) | 50.4 kB (10.7 kB gzip) |
| CSS to open `/get-app` | 52.2 kB (11.4 kB gzip) | 22.4 kB (5.5 kB gzip) |
| Service-worker precache | 19 entries, 650.9 KiB | 18 entries, 670.1 KiB |

The script sizes are within 2 kB of the baseline.
For the app, 1.5 kB of the 1.9 kB difference was already there on the unchanged tree when this round started (rebuilt on 18 November it gives 132.9 kB, not 131.4 kB), and the remaining 0.4 kB is the cost of more, smaller modules.
The precache grew by 19 KiB because the tokens and install styles are now in both pages' CSS files.

## Refactor 7: one file per cloud function; the pipeline runs only on Google Cloud

Findings F5 and F16. Done on 18 November 2026, after refactors 1 to 6 were merged, in two steps: the split (behaviour unchanged), then the removal of the GitHub-workflow path, which the owner decided the same day ([ADR 0017](adr/0017-the-pipeline-runs-only-on-the-cloud.md)).
"Before" is `main` with refactors 1 to 6 merged.

| Metric | Before | After |
|---|---|---|
| `apps/functions/src/index.ts` | 400 lines (411 at the baseline) | 22 |
| Functions defined in one file | 7 | 1 each, in `apps/functions/src/functions/`; shared options in `options.ts` |
| Orchestration paths for the pipeline | 2 | 1 |
| Branches on the `JOBS_ON` setting in the functions | 7 | 0 |
| Function parameters and secrets that exist for GitHub | 3 (`JOBS_ON`, `TIMER_REPOSITORY`, `GITHUB_DISPATCH_TOKEN`) | 0 |
| Workflow and composite-action lines | 835 in 11 files | 599 in 9 files |
| ... `update-schedule.yml` | 132 | removed |
| ... the feed-token action | 44 | removed |
| ... `mail-send.yml` | 154 | 126 |
| ... `deploy.yml` | 50 | 32 |
| ... `publish-site.yml` | 112 | 101 |
| ... `deploy-functions.yml` | 87 | 84 |
| Functions source, not tests | 960 lines | 846 |
| Functions tests | 701 lines | 527 |
| Complexity of the website check's handler | 15 | 13 |
| Unit and component tests | 879 in 95 files | 870 in 94 files |
| Whole change against `main` | | 40 files changed: 1,089 lines removed, 612 added (this section included) |

The 9 tests that left were the tests of `start-workflow.ts`, the module that started and listed GitHub workflow runs; no other test changed.
Lint, types and the site-settings check: 0 problems, as before.

### What was removed

- `update-schedule.yml`, and the feed-token action only it used.
- In the functions: `start-workflow.ts` and its test, the three settings above, and every branch on `JOBS_ON`.
- The workflow-call half of `mail-send.yml` (only `update-schedule.yml` called it) and the "new schedule" input of `publish-site.yml`.
- The `schedule-switch` job of `deploy.yml`, which switched `update-schedule.yml` on and off.
- In the setup scripts: the GitHub token's permissions (`setup-functions-deploy.sh`, `setup-wix-signal.sh`), the permission for `update-schedule.yml` to act as the feed reader and the variables it read (`setup-feed-secret.sh`), and the "switch over" instruction (`setup-update-job.sh`).

### How "behaviour unchanged" was checked

- **The split.** The functions bundle exports the same seven names, and each function's deployment description is identical. Sorted, the bundle's lines differ only by blank lines and the bundler's file-name comments.
- **The removal.** The bundle still exports the same seven names. The deployment descriptions differ in exactly one way: the GitHub token is no longer among the secrets of the two timers and the check. What each function does where the jobs already run on Google is the code that ran there before, with the other branch deleted.
- The setup scripts were checked for syntax only; none was run. No workflow was run: the deploy workflows are disabled in this copy.

### What does change, by the decision

- An environment that still had `JOBS_ON` unset or `github` starts the cloud jobs from its next functions deploy. Its two jobs must exist first.
- Reminders before an event are sent wherever the reminder timer is not paused; before, only where `JOBS_ON` was `google`.
- A kill-switch deploy no longer switches the update job off. It does not need to: the job replaces only the schedule's files.

### Kept on purpose, and open

- `mail-send.yml` by hand and `mail-test.yml`: not part of the pipeline. Whether they stay is the owner's call.
- The `TIMER_BRANCH` setting was kept at first, as a label in the check's log lines. The owner renamed it to `STAGE` afterwards (below).
- The Problem emails still said "GitHub → Actions → Update schedule → Run workflow" and linked to that workflow's runs. Fixed afterwards, with the owner's wording (below: "The Problem emails point at the Cloud Run job").
- `pnpm copy --emailed`, which only the retired workflow passed in automation, was kept at first; the owner had it removed afterwards (below).

## Refactor 8: the adapter's field mappers; no function over 20

Findings F17 and F18. Done on 18 November 2026 on top of refactor 7; "before" is refactor 7's branch. Behaviour unchanged.

| Metric | Before | After | The review's target |
|---|---|---|---|
| `adaptWixEvent` complexity | 52 | 9 | 15 or less |
| `programDatesEmail` | 34 | 9 | |
| `copyWebsite` | 28 | 12 | |
| Group expansion (the largest function in `groups.ts`) | 24 | 12 | |
| `summarizeFeed` | 24 | 1 | |
| Functions over 20 | 5 | 0 | 2 or fewer |
| Functions over 15 | 12 | 7 | |
| Functions over 10 | 43 | 42 | |
| Unit and component tests | 870 in 94 files | 912 in 95 files | |

- **The adapter.** `adaptWixEvent` now reads as its steps: why an event isn't listed, its page, then its fields. Each field has a small pure mapper (`whyNotListed`, `timeZoneWarning`, `eventPage`, `eventTimes`, `eventCategories`, `eventLocation`, `eventPicture`), and each mapper has a table test: 42 new cases in `wix-adapter-fields.test.ts`.
- **The copy.** The two checks on the source's answer are one function, and the run's summary is built section by section.
- **The program dates email.** One function per kind of row: a session, a prayer day, a day or span without class.
- **The feed check and group expansion.** Counting, problems and warnings are separate functions; looking a group up and paging through its members are separate from walking them. Members are still read one page at a time, in the same order of requests.

Functions over 10 fell by only one: the five large functions left the list, and four of the new, smaller ones are between 11 and 12.
The seven still over 15 (16 to 20) are `websiteReadChanges`, `readEvents`, `fetchFeed`, `jobRuns`, `scheduleFiles`, `checkData` and the feed code's `addressOf`; none was in this refactor's scope.

### How "behaviour unchanged" was checked

- The adapter's existing tests on real events pass unchanged, as do the copy's, the feed check's and group expansion's.
- The program dates email's four snapshot files (two emails, HTML and text) are unchanged.
- Lint, types and the site-settings check: 0 problems.

## Refactor 9: the source's schema beside the adapter; duplicates removed

Findings F6, F9 and F11. Done on 18 November 2026 on top of refactor 8. Behaviour unchanged.

| Metric | Before | After | The review's target |
|---|---|---|---|
| Source-platform schema files in `packages/domain` | 1 (`feed.ts`: the envelope and the Wix event) | 0 (`feed.ts` holds only the envelope) | 0 |
| Files in `packages/domain` that read the source's event shape | 2 (`feed.ts`, `website-read-changes.ts`) | 0 | |
| Duplicated modules (`published-url.ts`) | 1, in two packages | 0 | 0 |
| HTML-escape helpers | 2 | 1 (`escapeHtml` in the contract; the mailer's `esc` is its short name) | |
| Unit and component tests | 912 in 95 files | 912 in 96 files | Same tests |

- `WixEvent`, `WixAddress` and `WixCategory` are in `packages/sync/src/wix-event.ts`.
- `websiteReadChanges`, which parses the source's events, moved to `packages/sync` with its tests. The shapes of its result and `hasReadChanges`, which the mailer's template reads, stay in the contract.
- The Wix events fixture moved from `packages/domain/fixtures` to `packages/sync/fixtures`.
- The test count is the same by coincidence of one out, one in: the mailer's copy of the `published-url` test left with its module, and the shared escape helper got a test.

One thing the review did not foresee: `packages/mailer` now depends on `packages/sync`.
The single `published-url` helper has to be in a package both command-line tools can import, and it runs a process, so it cannot be in the contract package, which does no I/O; the mailer's Schedule changes test also needs `websiteReadChanges`.
The mailer imports the helper by its own entry (`@kmcdc/sync/published-url`), not the whole package.
The alternative, a new small package for developer-machine helpers, was not taken for one 19-line file.

### How "behaviour unchanged" was checked

- Types, lint and all tests pass; the moved tests are unchanged apart from their imports.
- The escape helper's two former copies replaced the same four characters in the same order; the privacy page's and the emails' tests and snapshots are unchanged.
- The app and the functions bundle build.

## Refactor 10: coverage measured, complexity guarded

Findings F20, F21 and F22. Done on 18 November 2026 on top of refactor 9. No production code changed.

| Metric | Before | After | The review's target |
|---|---|---|---|
| Line coverage | Not measured | 78.3% (3,838 of 4,899 lines in 180 source files) | A recorded number per package |
| Complexity guard in lint | None | An error over 20 | A warning at 15 |
| Functions over 20 | 0 | 0, held by lint | |
| Functions over 15 | 7 | 7 | 13, held or lower by lint |
| `packages/cloud` test files | 1 (17 tests) | 4 (23 tests) | 4 |
| Unit and component tests | 912 in 96 files | 918 in 99 files | |

Line coverage per package, from `pnpm test:coverage` (V8 coverage of each package's source, tests left out):

| Package | Source files | Lines | Covered | Line coverage |
|---|---|---|---|---|
| `apps/functions` | 15 | 209 | 114 | 54.5% |
| `apps/job` | 6 | 136 | 68 | 50.0% |
| `apps/web` | 37 | 789 | 653 | 82.8% |
| `packages/cloud` | 8 | 112 | 102 | 91.1% |
| `packages/domain` | 21 | 589 | 581 | 98.6% |
| `packages/mailer` | 22 | 951 | 711 | 74.8% |
| `packages/publish` | 13 | 307 | 194 | 63.2% |
| `packages/sync` | 22 | 770 | 619 | 80.4% |
| `packages/ui` | 36 | 1,036 | 796 | 76.8% |
| **All** | 180 | 4,899 | 3,838 | 78.3% |

- **Coverage.** `@vitest/coverage-v8` is installed, `pnpm test:coverage` runs the tests with it, and `scripts/coverage-by-package.js` prints the table above. CI runs it in place of `pnpm test` and puts the table on the run's summary page. It reports only: no threshold fails a run.
- **What the number leaves out.** The command-line programs are tested by starting them as separate processes, and coverage does not follow a child process. So `copy-cli.ts`, the mailer's `cli.ts` and the publish commands count as less covered than they are tested.
- **The guard.** Lint fails a function over 20, the highest the code has after refactor 8. The review asked for a warning at 15; a warning fails nothing, and seven functions are still between 16 and 20, so the guard is an error at the level the code meets. Lowering it to 15 means splitting those seven first.
- **The cloud clients' tests** are one file per module (`bucket`, `lock`, `jobs`, and the token, live record and messaging together), with six new cases: two runs racing for a free lock, a lock file that can't be read, a bucket failure while taking the lock, the in-memory bucket's version rule, the bucket's errors, and a file that comes without its version.

### Targets not reached

- **The job's entry file is still untested** (F22): `apps/job/src/main.ts`, 0 of 67 lines. The order of steps, the lock, the hand-over and what runs after a failure are in `update-schedule.ts` and `send-email.ts`, which are fully covered (22 of 22 and 20 of 20 lines); `main.ts` is the wiring that starts each program as a process and talks to Google. Testing it needs its dependencies passed in, which is a change to production code and was left out of a refactor that changes none.
- **`apps/functions` is at 54.5%** for the same reason: the seven function files made in refactor 7 are wiring around tested logic, and nothing loads them in a test.

### Found on the way

A lock file that can't be read (not JSON, or without a time) is never treated as left behind: a run waits for it for 15 minutes and gives up, every time, until someone deletes the file. A lock with a readable time is taken over after 20 minutes. The new test recorded the behaviour as it was; the owner changed it afterwards (below: "A damaged lock file is taken over").

## Refactor 11: test-suite housekeeping

Findings F25 and F26. Done on 18 November 2026 on top of refactor 10. The same tests, the same count; no production code changed.

| Metric | Before | After | The review's target |
|---|---|---|---|
| Largest test file | 911 lines (`e2e/tests/events.spec.ts`) | 361 (`e2e/tests/events-filter.spec.ts`) | Under 400 |
| Test files over 400 lines | 5 (911, 840, 564, 491, 410) | 0 | |
| Test helpers among production source | 2 (`test-schedule.ts` in `apps/web/src` and `packages/publish/src`) | 0 | 0 |
| Unit and component tests | 918 in 99 files | 918 in 106 files | Same tests, same count |
| Browser tests | 160 in 9 files | 160 in 12 files | Same tests, same count |
| Unit test wall time, three runs | 6.0, 6.0, 6.2 s (6.4 s at the baseline) | 5.0, 5.0, 5.1 s | Measured |
| Line coverage | 78.3% | 78.3% | |

- **Split by feature.** The Events browser spec is four specs (list, dates, filter, panel) with one support file. The UI package's `components.test.tsx` is four files beside the components they test; `SettingsSheet.test.tsx` gave its install and notifications tests to those features' folders; `App.test.tsx` and the notifications test are two files each.
- **Shared set-up is imported, not copied.** What more than one of the new files needs is in a `test/` folder beside each package's `src/` (`packages/ui/test`, `apps/web/test`), and in `e2e/tests/events-support.ts`. Each test's own text is unchanged.
- **Helpers out of `src/`.** The two `test-schedule.ts` files moved to `apps/web/test/schedule.ts` and `packages/publish/test/schedule.ts`.
- **One jsdom per worker.** The two projects that test in a browser-like environment (`apps/web`, `packages/ui`) run in Vitest's `vmThreads` pool, where each file still gets its own context but the environment is not built again for each. That is the 1 second.

### Checked

- Lint, types and the site-settings check: 0 problems. 918 unit tests pass in three runs in a row with the new pool.
- The browser suite locally: 147 pass, 13 skipped, as before the split.

### Not done

- The other browser specs (`quality`, `settings`, `splash`, `schedule-sync`, `sw`) each still read the golden files with their own few lines; they were not folded into the shared support file.
- The number of jsdom environments was not re-measured: Vitest prints it only as an occasional hint (24 for `apps/web` at the start of this work), and did not print it after the change.

## Refactor 12: the functions' deploy folder, separate from the workspace package

The root-cause fix for [ADR 0016](adr/0016-functions-workspace-dependencies-declared-by-hook.md), decided by the owner on 18 November 2026 and recorded in [ADR 0018](adr/0018-functions-deploy-folder-separate-from-the-workspace-package.md). Done on top of refactor 11.

**The functions deploy is untested.** No deploy, `firebase` or `gcloud` command was run: none can be from this copy. The first real deploy is the test.

| Metric | Before | After |
|---|---|---|
| pnpm hook files | 1 (`.pnpmfile.cjs`) | 0 |
| Manifests that hide dependencies (`apps/functions/package.json` listed none of its 3 workspace packages) | 1 | 0 |
| Files one `package.json` had to satisfy two package managers | 1 | 0: the workspace's for pnpm, the generated one for npm |
| Files every lockfile install must carry besides the lockfile and manifests | 1 | 0 |
| The functions bundle | 1,606,086 bytes | The same bytes (compared byte for byte). Both were about twice the right size: see the correction under "Lockfile rewritten by pnpm; security updates" |
| Deployment description of the 7 functions | | Identical |
| Workspace packages the bundle is built from that the deploy's path filter names | 2 of 3 | 3 of 3 (`packages/cloud` added) |
| Unit and component tests | 918 in 106 files | 929 in 107 files |

- The build (`pnpm --filter @kmcdc/functions build`) writes `apps/functions/deploy/`: `index.js` and a generated `package.json` (name, module type, `main`, `engines`, and `firebase-admin` and `firebase-functions` in the ranges `apps/functions/package.json` gives). `firebase.json` deploys that folder.
- The manifest is made by `apps/functions/scripts/deploy-manifest.ts`, with 11 tests: no `workspace:` entry, ranges equal to the source's, only the fields the cloud needs, and the bundle's left-out packages equal to the manifest's dependencies (the build also stops on that).
- The deploy workflow writes `.env` into the deploy folder; a build run after it leaves the file there (checked locally).
- The lockfile change is the functions' three workspace packages moving from development dependencies to dependencies, and the hook's checksum going. As in refactor 10, pnpm also wanted to re-link unrelated Firebase peers; that part was not kept, and a frozen install accepts the result.
- The other deploy workflows' path filters were checked against what they deploy: `deploy-jobs.yml` already names all of `packages/`, `apps/job`, the site settings, pictures and the lockfile, and `deploy.yml` runs on everything but docs. Only `packages/cloud` in `deploy-functions.yml` was missing.

## The Problem emails point at the Cloud Run job

A follow-up to refactor 7, with the wording the owner gave on 18 November 2026. Not a refactor: it changes what three emails say and where they link.

| Email | Before | After |
|---|---|---|
| Schedule copy failed, last step (three of its five causes) | "Then run Sync now (GitHub → Actions → Update schedule → Run workflow). You'll get a "works again" email." | "Open the Update schedule job in Google Cloud Run and select Execute. You'll get a "works again" email." |
| Schedule copy failed, second button and text line | "See the failed run" / "The failed run:", to the GitHub workflow | "Open the Update schedule job" / "The Update schedule job:", to the job's page in the Cloud console |
| The app is behind the website, step 1 | "Open Update schedule's runs on GitHub: the newest run's red step says what failed." | "Look at the Update schedule job's runs in Google Cloud Run: the newest run's log says what failed." |
| ... step 2 | "Run Sync now (GitHub → Actions → Update schedule → Run workflow). You'll get a "works again" email when the app matches the website." | "Open the Update schedule job in Google Cloud Run and select Execute. You'll get a "works again" email when the app matches the website." |
| ... step 3 | "If Sync now succeeds and this email comes again, follow the runbook." | "If that run succeeds and this email comes again, follow the runbook." |
| ... second button and text line | "See the runs" / "The runs:", to the GitHub workflow's runs | "Open the Update schedule job" / "The Update schedule job:", to the job's page |
| Schedule copying works again, link and text line | "See the run" / "The run:", to the GitHub workflow | "Open the Update schedule job" / "The Update schedule job:", to the job's page |
| Schedule changes, "Update schedule run" link and "the run's summary" address | The GitHub workflow, when the run named no log of its own | The job's page; the words are unchanged |

- The job's page is built by `jobConsoleUrl` in `packages/cloud` from the stage's `PROJECT` and `REGION` settings, which both jobs already have, and the job's name, the same three names that start the job. The job names are now constants in `packages/cloud`, used by the functions too.
- Where `PROJECT` or `REGION` is not set (a developer's machine), the link is the console's list of Cloud Run jobs.
- The runbook links in the emails still go to the repository on GitHub: that is where the runbooks are.
- No alert text or log line pointed at the GitHub workflow; the two Cloud Monitoring alerts in `scripts/setup-delivery-alerts.sh` name only the runbook.
- Unit and component tests: 929 → 931 (the job's page, and the mailer's setting for it). Four email snapshots changed, as the table says.

## The by-hand mail workflows retired

The owner's answer of 18 November 2026 to refactor 7's open question: email runs only on Google Cloud ([ADR 0017](adr/0017-the-pipeline-runs-only-on-the-cloud.md)).

| Metric | Before | After |
|---|---|---|
| Workflows that send email | 2 (`mail-send.yml` 126 lines, `mail-test.yml` 39) | 0 |
| Composite actions | 2 | 1 (the Gmail sign-in action, 54 lines, removed) |
| Workflow and action lines | 606 in 9 files | 387 in 6 files |
| Whole change | | 17 files: 318 lines removed, 42 added before this section |
| Unit and component tests | 931 in 107 files | 929 in 107 files |

- **Removed with them:** in the mailer's settings, the address of a GitHub Actions run and the switch that printed warnings as GitHub annotations, with their 3 tests; in `scripts/setup-mail-secrets.sh`, the permission for the two workflows to act as the mail account and the variables only they read.
- **A test email is still possible, and `mail-test.yml` was not the only way.** The `send-email` job runs any of the mailer's commands by name, `test` among them: Cloud Run → Jobs → `send-email` → Execute with overrides, `EMAIL=test`. It sends "Test from the KMC DC App" to `DEV_EMAILS` with the stage's own Gmail sign-in. A new test of the job records it (1 test). On a developer's machine `pnpm mail test` writes the email to `.outbox/`. The same job run with `EMAIL=<name>` and `TO=me` is what Send email's previews were.
- **Kept, and why:** `pnpm mail:authorize` still reads `MAIL_PROJECT` and `MAIL_FROM` from the stage's GitHub mail environment, because that environment is still where a stage's mail settings are written down: `scripts/setup-update-job.sh` reads `MAIL_ENV`, `MAIL_FROM`, `MAIL_SETTINGS` and `PUBLISHED_URL` from it when it creates the job. Moving those settings off GitHub is a separate decision.
- Nothing was run: the job, the scripts and the Cloud console steps above are from reading the code, and the new test proves only that the job passes `test` to the mailer.

## `TIMER_BRANCH` renamed to `STAGE`

The owner's answer of 18 November 2026. With no workflow left to start on a branch, the setting only says which stage the functions run for.

| | Before | After |
|---|---|---|
| The functions' setting | `TIMER_BRANCH`: the branch, `dev`, `test` or `main` | `STAGE`: `dev`, `test` or `prod` |
| Written by | `deploy-functions.yml`, from the branch's name | The same step, with `main` written as `prod`, as the workflow's environments are named |
| The check's log lines | "... started Update schedule on main" | "... started Update schedule on prod" (`dev` and `test` read as before) |
| The alarm's log line | "Alarm: started Send email (behind) on main" | "... on prod" |
| Unit and component tests | 929 | 929 |

- The two log-based metrics this repository defines (`scripts/setup-delivery-alerts.sh`) match "Behind the website since" and "Check: ". Neither includes the branch or stage, so they need no change.
- **A manual step for whoever deploys:** any saved log query, metric or alert made by hand in the Cloud console that matches "on main" must be changed to "on prod". None is defined in this repository, and the console cannot be read from here.
- After the first deploy with this change the functions read `STAGE`; nothing reads `TIMER_BRANCH` any more, and no stored value needs removing, since the deploy writes the setting's file anew each time.

## `pnpm copy --emailed` removed

The owner's answer of 18 November 2026. Only the retired GitHub workflow passed the option; the `send-email` job makes the Schedule changes comparison itself, from the website as each copy read it.

| | Before | After |
|---|---|---|
| Options of `pnpm copy` | 5 | 4 |
| Files a good copy may write to `mail/` | `website.json`, `changes.json`, `duplicates.json` | `website.json`, `duplicates.json` |
| Places that compare two reads of the website | 2 (the copy, the send-email job) | 1 (the job) |
| Unit and component tests | 929 | 927 |

Removed: the option, the code that read the earlier copy and wrote `changes.json`, the `changes` half of `mailInputs`, and their tests (2 removed, 1 reduced to what a copy still does).
Kept: the job still drops a `changes.json` it finds in a hand-over, because hand-overs written before this change stay in the bucket for 7 days.

Also in this pull request, docs only: [ADR 0015](adr/0015-feature-folders-inside-app-and-ui.md) names its decider.

## The `published-url` rule in the contract; `mailer` no longer depends on `sync`

The owner's answer of 18 November 2026 to refactor 9's question.

| Metric | Before | After |
|---|---|---|
| Workspace dependency edges (every `@kmcdc/*` entry in a `package.json`) | 20 | 19 |
| `packages/mailer` depends on | `cloud`, `domain`, `sync` | `cloud`, `domain` |
| Copies of the `published-url` rule | 1 | 1 |
| Unit and component tests | 927 in 107 files | 929 in 107 files |

- **The helper is not pure, so only its rule moved.** It asks GitHub's command-line tool for a setting, which is running a process, and `packages/domain` does no I/O. `publishedUrlFromGitHub` in `packages/domain` now holds everything that is a decision: when not to ask (CI), which command to run, and what counts as an answer. It takes the function that runs a command as an argument.
- **The I/O stayed where it was:** each of the two command-line tools has a four-line `runCommand` (in `packages/sync/src/config.ts` and `packages/mailer/src/cli-settings.ts`) and passes it in. That is two copies of one `execFileSync` call; the rule itself exists once. Because the runner is passed in, the rule now has tests for what it runs and for a failing command (3 tests where there was 1).
- **The mailer's Schedule changes test moved to `apps/job`** (`schedule-changes-email.test.ts`, with its 14 snapshot files, unchanged). It compares two reads of the website with `websiteReadChanges`, which is in `packages/sync`, and then writes the email with the mailer's template. The job is where those two packages meet, and the test is word for word the same apart from its imports.
- The lockfile change is one entry removed; a frozen install accepts it.

## A damaged lock file is taken over

The owner's answer of 18 November 2026 to what refactor 10 found. A change in behaviour, on purpose.

| | Before | After |
|---|---|---|
| A lock file that can't be read (not JSON, or without a time) | Never taken over: every run waited 15 minutes and gave up, until someone deleted the file | Taken over once the file itself is as old as the stale limit (20 minutes), with a warning in the log naming the file |
| ... while it is younger than that | Waited | Still waits, as for any lock |
| ... when the bucket does not say when the file was written | Waited | Still waits: an unknown age is never assumed stale |
| Unit and component tests | 929 | 933 |

- The file's age is its last write in the bucket (Cloud Storage's `Last-Modified`), which the bucket client now reads with the file.
- The log line: "Warning: the lock file update-schedule/lock.json can't be read; taking it over, as it was last written at <time>."
- The test that recorded the old behaviour is replaced by four: damaged and young (waits), damaged and old (taken over, warning logged), exactly at the limit, and no known age. One more reads the file's time from the bucket.
- `takeLock`'s complexity went from 14 to 17, under the guard of 20.

## Lockfile rewritten by pnpm; security updates

The owner's answer of 18 November 2026 to the lockfile question, with the nine advisories `pnpm audit --prod` reported.

| Metric | Before | After |
|---|---|---|
| `pnpm audit --prod` | 9 (3 high, 4 moderate, 2 low) | 0 |
| Lockfile | Kept by hand since refactor 2 | Written by pnpm, no hand edits (506 lines added, 482 removed) |
| Overrides | 0 | 3, each explained in `pnpm-workspace.yaml` |
| The functions bundle | 842,902 bytes | 844,619 bytes |
| Unit and component tests | 933 | 933 |
| Browser tests | 147 pass, 13 skipped | 147 pass, 13 skipped |

**Fixed by upgrading a direct dependency within its range**

| Advisory in | Fixed by |
|---|---|
| `zod` (direct, in four packages) | `zod` 4.6.5 → 4.6.7 |
| `body-parser`, `qs` (through `firebase-functions` → `express`) | An update inside `express`'s own ranges: `body-parser` 2.3.0 → 2.4.0, `qs` 6.16.0 → 6.16.2 and 6.17.1. `firebase-functions` itself has no newer release in range (7.4.0) |
| `fast-xml-parser` (through `firebase-admin`) | `firebase-admin` 14.5.0 → 14.5.1, `fast-xml-parser` 5.11.2 → 5.12.1 |

Also moved within range, with no advisory of their own left: `firebase` 13.2.0 → 13.4.0 and `satori` 0.56.1 → 0.56.2. Neither fixed its advisory, so each has an override below.

**Fixed by an override**, because no release of the package that asks for it takes the fixed version:

| Override | Why |
|---|---|
| `fflate` 0.7.3 → 0.7.5 | Through `satori` → `@shuding/opentype.js`, which asks for `^0.7.3`. 0.7.5 is inside that range, but updating did not move the locked version |
| `@grpc/grpc-js` 1.9.16 → 1.14.7, under `@firebase/firestore` | The Firebase web SDK's Firestore pins `~1.9.0`. Same major version; the app uses no Firestore, so this code is not in the app |
| `rimraf` 5.0.10 → 6.1.4 (with it `glob` 14.0.6 and `minimatch` 11.0.9) | `glob` and `minimatch` have no fix in the versions `rimraf` 5 accepts. `google-gax` and `gaxios`, under `firebase-admin`, list `rimraf` but no file of theirs loads it. A major version of a package nothing here runs |

**What the overrides do not reach.** Firebase's cloud build installs the functions with npm from the generated manifest, with no lockfile and no overrides. There the cloud resolves the newest versions in range at each deploy, so the in-range fixes arrive by themselves, and `rimraf` 5 with its `glob` stays, unused, until `google-gax` moves.

**The bundle.** The functions bundle grew by 1,717 bytes. Its own code is identical (86,457 bytes); the only dependency inside it is `zod`, which went from 4.6.5 to 4.6.7. The Firebase SDKs are not in the bundle.

**Checked.** With every `node_modules` folder removed: a frozen install, lint, types, the site-settings check, 933 unit tests, the app's build, the functions bundle, and the browser suite. The job image's install step was reproduced outside the repository without Docker (only the files the Dockerfile copies, `pnpm install --frozen-lockfile --filter "@kmcdc/job..."`), and each of its three programs started and stopped as the image check expects (exit 2, 2 and 1).

### A correction to refactors 9 to 12

From refactor 9 until a fix on 18 November, `packages/sync` used `zod` without declaring it: the source's schema had moved there and the dependency had not. On this machine the import still resolved, because Node found a copy of `zod` in a folder above the repository, a different version; so the functions bundle carried `zod` twice. The 1,606,086 bytes recorded for refactor 12 is that doubled bundle. The comparison made there (the same bytes before and after refactor 12) was true, but both sides had the fault. A clean checkout could not resolve the import at all, which is how CI found it once it ran on the stacked pull requests. The fix is one line in `packages/sync/package.json`, on refactor 9's branch and merged up; the bundle is 842,902 bytes again (845,412 on `main` before refactor 7).

Two lessons recorded: a check made only in the working copy is not a check of the repository, so the stack is now also verified in a fresh clone; and CI runs on every pull request, whatever its base.

## Mail settings off GitHub, onto the send-email job

The owner's decision D57 of 18 November 2026, answering the question the mail-workflow retirement left open.

**Untested.** No script or `gcloud` command was run against a real project, and `pnpm mail:authorize` was not run: neither can be from this copy. The first use in the center's account is the test. What was checked is listed below.

| | Before | After |
|---|---|---|
| Where a stage's `MAIL_FROM`, `MAIL_ENV`, `MAIL_SETTINGS` and the emails' `PUBLISHED_URL` are written down | The GitHub environment `mail-dev`, `mail-test` or `mail-prod`, copied onto the job when it was made | Only the `send-email` job's own settings in Cloud Run |
| `pnpm mail:authorize` | `<mail-dev\|mail-test\|mail-prod>`; the project and sending account from GitHub with `gh` | `<project-id> [--from <address>]`; the sending account from the job with `gcloud run jobs describe`, or `--from` before the job exists |
| `scripts/setup-update-job.sh`, making the `send-email` job | 4 settings read from the GitHub mail environment | `MAIL_ENV` is the stage's name; `MAIL_FROM` from the script's own environment (required, checked before anything changes); `MAIL_SETTINGS` and the site address optional, the latter defaulting to the project's own Hosting address (named `MAIL_PUBLISHED_URL` here; one `PUBLISHED_URL` for both jobs since the next section) |
| `scripts/setup-mail-secrets.sh` | `<project-id> <mail environment>`; wrote `MAIL_PROJECT` to GitHub | `<project-id>`; touches nothing on GitHub |
| `pnpm mail` on a developer's machine, with no `PUBLISHED_URL` | Asked GitHub's `mail-dev` environment | Asks for `PUBLISHED_URL` or `--schedule <file>` |
| Reads or writes of a GitHub mail environment in the repository | 7 (2 in `authorize.ts`, 4 in `setup-update-job.sh`, 1 write in `setup-mail-secrets.sh`) plus the mailer's lookup | 0 |
| Unit and component tests | 933 | 936 |

- A job that already exists keeps its settings, as before: the script only writes them when it makes the job. So a stage whose job exists needs nothing moved; its settings are already on the job.
- Not in scope, and unchanged: the update job's site and feed addresses, which `setup-update-job.sh` still reads from the `dev`/`test`/`prod` and `wix-feed*` GitHub environments, and `pnpm copy`'s developer default from `wix-feed`. They are not mail settings.
- **Checked:** the scripts parse (`bash -n`). `setup-update-job.sh` was run against stand-in `gcloud`, `gh` and `curl` commands that only record what they are asked: without `MAIL_FROM` it stops with exit 2 after read-only questions; with it, the settings file it would give the job holds `MAIL_ENV`, `MAIL_FROM`, `MAIL_SETTINGS` and `PUBLISHED_URL`, and no question goes to a GitHub mail environment. The new argument parsing and the reading of a job's settings from `gcloud`'s JSON have unit tests; the JSON's shape is from Cloud Run's documented job resource, not from a real answer.

### What a deployer must do by hand

1. For each stage whose `send-email` job exists: open Cloud Run → Jobs → `send-email` and confirm it has `MAIL_ENV`, `MAIL_FROM`, `MAIL_SETTINGS` and `PUBLISHED_URL`, with the values the GitHub mail environment had. Nothing copies them now.
2. Then the variables of the GitHub environments `mail-dev`, `mail-test` and `mail-prod` can be deleted (and any secrets still there); nothing reads them.
3. For a new stage, in this order: `scripts/setup-mail-secrets.sh <project>`, `pnpm mail:authorize <project> --from <sending address> --new-client`, then `PUBLIC_BASE_URL=<site address> MAIL_FROM='<name> <address>' scripts/setup-update-job.sh <project> <branch>` (`PUBLIC_BASE_URL` since the next section).
4. To re-authorise later: `pnpm mail:authorize <project>`; it reads the sending account from the job.

## The update job's addresses off GitHub, onto the update-schedule job

The owner's decision D61 of 18 November 2026, the same move as the mail settings, for what `scripts/setup-update-job.sh` still read from the `dev`/`test`/`prod` and `wix-feed*` GitHub environments.

**Untested**, for the same reason: no script or `gcloud` command was run against a real project. The first use in the center's account is the test.

| | Before | After |
|---|---|---|
| Where the update job's `PUBLIC_BASE_URL`, `PUBLISHED_URL` and `WIX_FEED_URL` are written down | GitHub environments (`dev`/`test`/`prod` for the first, `wix-feed*` for the other two), copied onto the job when it was made | Only the `update-schedule` job's own settings in Cloud Run |
| `scripts/setup-update-job.sh`, making the `update-schedule` job | 3 settings read from GitHub with `gh` | `PUBLIC_BASE_URL` from the script's own environment (required); `PUBLISHED_URL` optional, defaulting to the project's own Hosting address, and now the one name for both jobs; `WIX_FEED_URL` optional, left off the job when not given |
| Missing required values | For mail only (`MAIL_FROM`) | Both jobs are checked first; the script names everything missing and stops with exit 2 before any change |
| `scripts/setup-feed-secret.sh` | `<project-id> <wix-feed environment>` (the second only named in messages) | `<project-id>` |
| `pnpm copy` on a developer's machine, with no `PUBLISHED_URL` | Asked GitHub's `wix-feed` environment with `gh` | Says what to set: `PUBLISHED_URL` in the shell or `.env`, or `--published <url>` |
| Reads of a GitHub environment by the setup scripts and command-line tools | 3 in `setup-update-job.sh`, 1 in `pnpm copy` | 0 |
| `publishedUrlFromGitHub` and the command runner it needed | In `packages/domain` and `packages/sync` | Removed: nothing asks GitHub |
| Unit and component tests | 936 | 933 (the removed helper's 3) |

- `setup-update-job.sh` still writes to GitHub once, at its end: the `jobs-<stage>` environment that the Deploy jobs workflow signs in with. That is the workflow's own configuration, not a stage's setting.
- A job that already exists keeps its settings, so an existing stage needs nothing moved.
- **Checked:** the scripts parse (`bash -n`). `setup-update-job.sh` run against stand-in `gcloud`, `gh` and `curl` commands that only record what they are asked: with nothing given it names both missing values and stops with exit 2 having made no change; with only one given it names the other; with both, the two settings files it would give the jobs hold the values above, and the only `gh` calls are the five that write `jobs-<stage>`.

### What a deployer must check by hand

1. For each stage whose `update-schedule` job exists: Cloud Run → Jobs → `update-schedule` → confirm `PUBLIC_BASE_URL` and `PUBLISHED_URL` (and `WIX_FEED_URL`, if the stage had one) hold the values the GitHub environments had. Nothing copies them now.
2. With the previous section's check of `send-email` done as well, these GitHub environments can be deleted, since nothing reads them: `wix-feed`, `wix-feed-test`, `wix-feed-prod`, `mail-dev`, `mail-test`, `mail-prod`.
3. **Keep** `dev`, `test` and `prod` (the app's deploy reads `PUBLIC_BASE_URL`, `APP_ENV`, `LIVE_URL` and its sign-in from them), `functions-dev`/`-test`/`-prod` and `jobs-dev`/`-test`/`-prod` (the two other deploy workflows). `PUBLIC_BASE_URL` therefore exists twice per stage, on the job and in the app deploy's environment, and must be changed in both if the site's address ever changes.
4. On a developer's machine: put `PUBLISHED_URL=<the dev site's address>` in a gitignored `.env` at the repository root, or pass `--published`.
5. A new stage, in order: `scripts/setup-state-bucket.sh`, `scripts/setup-mail-secrets.sh <project>`, `scripts/setup-feed-secret.sh <project>`, `scripts/setup-functions-deploy.sh`, `pnpm mail:authorize <project> --from <address> --new-client`, then `PUBLIC_BASE_URL=<site address> MAIL_FROM='<name> <address>' scripts/setup-update-job.sh <project> <branch>`.

## Not in this round

Refactors 7 to 12 were done after this round, each in its own section above. Nothing of the review's list is left; 12 was not on it.
