# 0010. Three isolated environments, promoted by pull request

- **Status:** Accepted
- **Decided:** 6 November 2026 (isolation rule); the pull-request rule earlier, date not recorded
- **Recorded:** Written up on 17 November 2026 from the project's decision log, for this copy of the repository.
- **Source decisions:** D42, D52, D53

## Context

The system sends real email to real people and publishes to an app people rely on.
An early setup shared one copy of the schedule across environments.

## Options

| Option | Trade-off |
|---|---|
| One environment with feature flags | Least to maintain; a test can reach real people |
| Separate sites sharing data and senders | Cheaper than full separation; a problem in one can still affect another |
| Fully separate environments, each with its own cloud project, site, sender, lists, timers and copy of the website | A test can never email real members; three of everything to set up and keep equal |

## Decision

Three environments, development, test and production, each deployed from its own branch (`dev`, `test`, `main`) and each running entirely on its own.
No run starts, feeds or publishes another environment.
Every change reaches `dev` through a pull request from a short-lived branch, `test` through a release pull request from `dev`, and `main` through a release pull request from `test`.
Merging is the deploy.

## Consequences

- A problem in one environment can't stop or change another, and a test can't email real members.
- Each change is checked by CI and on a real site twice before it reaches the public.
- The three sites can differ for a few minutes between runs.
- Three of everything to maintain; setup is scripted per project (`scripts/`), and settings are per environment.
