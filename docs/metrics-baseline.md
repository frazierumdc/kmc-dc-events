# Metrics baseline

> Measured on the tree of the first commit of this copy, before any refactor.
> Every later refactor step is compared with these numbers in `docs/refactor-log.md`.

## How it was measured

| | |
|---|---|
| Date | 17 November 2026 |
| Machine | Apple M5 Pro, 18 cores, macOS (local, not CI) |
| Tools | Node 24 (pnpm-managed), pnpm 12.10.1, Vitest 5.0.3, TypeScript 6.0, ESLint 10, Vite 8 |
| Timings | Wall clock, three runs each, after one warm-up run; the median is given |
| Not measured | Browser (Playwright) tests were not run: they need browser binaries downloaded. Line coverage was not measured: the repository has no coverage provider installed. CI times on GitHub's runners are not reproduced here |

## Checks

| Check | Command | Result | Time |
|---|---|---|---|
| Lint | `pnpm lint` (ESLint strict type-checked + Prettier) | 0 errors, 0 warnings | 8.3 s |
| Types | `pnpm typecheck` (strict, 10 projects) | 0 errors | 3.3 s |
| Unit and component tests | `pnpm test` | 844 tests in 89 files (125 suites), all pass **when the checkout has a GitHub `origin` remote** | 6.4 s |
| | the same, in a checkout with no `origin` remote | 837 pass, **7 fail** (`packages/mailer/src/cli.test.ts`) | 6.4 s |
| Site settings | `pnpm data:check` | 3 files, 0 problems | 0.1 s |
| Build | `pnpm build` (the web app) | Succeeds | 1.3 s warm, 3.5 s first run |
| Browser tests | `pnpm e2e` | Not run. 90 test cases in 9 spec files, each on two browser engines (iPhone WebKit, Android Chromium) | n/a |

The 7 failures are an environment dependency, not a product bug: the mail CLI reads the repository's address from the `origin` remote when `GITHUB_REPOSITORY` is unset, and the test removes every `GITHUB_*` variable before running it.
A clone from GitHub always has the remote, so CI and a normal clone pass.
It is refactor 1 in the [architecture review](architecture-review.md).

## Tests by package

| Package | Test files | Tests | Summed test time |
|---|---|---|---|
| `apps/web` | 28 | 215 | 8.2 s |
| `packages/ui` | 6 | 197 | 1.3 s |
| `packages/domain` | 18 | 124 | 0.1 s |
| `packages/mailer` | 16 | 114 | 3.1 s |
| `packages/sync` | 14 | 109 | 2.1 s |
| `apps/functions` | 4 | 50 | 0.1 s |
| `apps/job` | 2 | 18 | under 0.1 s |
| `packages/cloud` | 1 | 17 | under 0.1 s |
| **Total** | **89** | **844** | |

Slowest files: `apps/web/src/App.test.tsx` 3.8 s, `packages/mailer/src/cli.test.ts` 2.7 s, `apps/web/src/schedule-files.test.ts` 2.0 s, `packages/sync/src/copy-cli.test.ts` 1.8 s.
Vitest reports that `apps/web` creates a jsdom environment 28 times, about 29 s of worker time in all, which is most of the run's CPU.

## Size (TypeScript and TSX, lines including comments and blanks)

| Package | Source files | Source lines | Test files | Test lines | Test : source |
|---|---|---|---|---|---|
| `packages/ui` | 28 | 4,389 (+ 3,817 CSS) | 6 | 1,772 | 0.40 |
| `apps/web` | 40 | 4,213 (+ 416 CSS) | 28 | 3,697 | 0.88 |
| `packages/mailer` | 22 | 2,959 | 16 | 1,767 | 0.60 |
| `packages/domain` | 20 | 2,507 | 18 | 1,644 | 0.66 |
| `packages/sync` | 18 | 2,068 | 14 | 1,698 | 0.82 |
| `apps/functions` | 5 | 930 | 4 | 667 | 0.72 |
| `apps/job` | 5 | 434 | 2 | 325 | 0.75 |
| `packages/cloud` | 8 | 405 | 1 | 353 | 0.87 |
| `brand` | 4 | 331 | 0 | 0 | 0 |
| **Total** | **150** | **18,236** | **89** | **11,923** | **0.65** |
| `e2e` | 3 helpers, 152 lines | | 9 specs | 2,113 | |

## Largest files (over 300 lines, not tests or fixtures)

| Lines | File |
|---|---|
| 3,817 | `packages/ui/src/theme.css` |
| 860 | `packages/ui/src/SettingsSheet.tsx` |
| 499 | `apps/web/src/App.tsx` |
| 441 | `packages/ui/src/NotificationsScreen.tsx` |
| 432 | `packages/domain/src/website.ts` |
| 411 | `apps/functions/src/index.ts` |
| 370 | `packages/ui/src/SwipeTabs.tsx` |
| 370 | `packages/mailer/src/send.ts` |
| 363 | `packages/ui/src/EventSheet.tsx` |
| 351 | `packages/ui/src/icons.tsx` |
| 348 | `packages/ui/src/InstallPlayer.tsx` |
| 327 | `packages/mailer/src/templates/schedule-changes.ts` |
| 327 | `packages/domain/src/follow.ts` |
| 303 | `packages/sync/src/copy-website.ts` |

14 source files are over 300 lines; 4 test files are too (`e2e/tests/events.spec.ts` 911, `packages/ui/src/components.test.tsx` 840, `SettingsSheet.test.tsx` 567, `App.test.tsx` 491).

## Cyclomatic complexity

Measured with ESLint's `complexity` rule, added on the command line only (the repository's lint config does not enforce it).

| Threshold | Functions over it |
|---|---|
| Over 10 | 44 |
| Over 15 | 13 |
| Over 20 | 6 |

| Complexity | Function | File |
|---|---|---|
| 52 | `adaptWixEvent` | `packages/sync/src/wix-adapter.ts` |
| 34 | `programDatesEmail` | `packages/mailer/src/templates/program.ts` |
| 31 | `App` | `apps/web/src/App.tsx` |
| 28 | `copyWebsite` | `packages/sync/src/copy-website.ts` |
| 24 | group expansion (arrow function) | `packages/mailer/src/groups.ts` |
| 24 | `summarizeFeed` | `packages/sync/src/summarize-feed.ts` |

## Web bundle (`apps/web/dist`, production build, no notification settings)

| File | Raw | Gzip |
|---|---|---|
| `assets/install-guide-*.js` (shared chunk: React, the UI package) | 282.6 kB | 84.6 kB |
| `assets/main-*.js` (the app) | 145.3 kB | 46.8 kB |
| `assets/firebase-*.js` (messaging, loaded only on the Notifications screen) | 54.8 kB | 16.3 kB |
| `assets/get-*.js` (the `/get-app` page) | 2.8 kB | 1.2 kB |
| `assets/install-guide-*.css` (the whole theme) | 48.8 kB | 10.1 kB |
| `assets/get-*.css` | 3.4 kB | 1.2 kB |
| `assets/main-*.css` | 1.6 kB | 0.8 kB |
| `sw.js` | 23.4 kB | 8.1 kB |
| `index.html` | 14.4 kB | 2.0 kB |

- JavaScript to open the app: 427.9 kB raw, **131.4 kB gzip** (shared chunk + main).
- JavaScript to open `/get-app`: 285.4 kB raw, **85.8 kB gzip** (shared chunk + its own), for a page that shows install steps.
- Service-worker precache: 19 entries, 650.9 KiB.
- `dist` in all: 69 files, 6.1 MB, mostly the 44 iPhone and iPad start-up images.

## Structure

| Measure | Value |
|---|---|
| Workspace packages | 10 (3 apps, 5 packages, `e2e`, `brand`) |
| Cross-package imports by relative path (`../../../packages/…`) in source | 11, in `apps/functions` (8), `packages/cloud` (2), `apps/job` (1) |
| Workspace dependencies used but not declared in `package.json` | `apps/functions` → domain, sync, cloud; `packages/cloud` → domain |
| Files that read environment variables directly | 14 |
| Distinct environment variable names read in code | About 40 |
| Duplicated modules | 1 (`published-url.ts`, the same 22 lines in `packages/sync` and `packages/mailer`) |
| Source files of 40 lines or more with no test file of their own | 38 of 150; of those, 15 are not imported directly by any test file (some are exercised indirectly, through a parent component or the browser tests) |
| GitHub workflows | 8, plus 3 composite actions |
