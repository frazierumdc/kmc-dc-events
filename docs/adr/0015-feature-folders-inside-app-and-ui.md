# 0015. Feature folders inside the web app and UI package; package boundaries kept

- **Status:** Accepted
- **Decided:** 18 November 2026, by the owner, Sean Frazier, before the refactor started and after an independent architecture review that also recommended keeping the layout
- **Recorded:** Written on 17 November 2026 as part of the architecture review.
- **Source decisions:** None (new)

## Context

The repository is organized by runtime and layer: `domain`, `sync`, `mailer`, `cloud`, `ui`, and three apps.
Inside `apps/web/src` (33 files) and `packages/ui/src` (28 files) everything sits in one flat directory, and features such as events, notifications and the install guide are not visible as units.
Some package boundaries are bypassed by relative imports.

## Options

| Option | Trade-off |
|---|---|
| Leave it as it is | No churn; the flat directories keep growing and large files keep absorbing features |
| Reorganize the whole monorepo by feature | One folder per feature end to end; a feature would span processes that must not share credentials, and every import in 150 files changes for no behaviour change |
| Keep packages as the runtime and security boundaries and enforce them; group files by feature inside the web app and the UI package, with a thin shared layer | Features become visible where the screens are; two organizing principles to explain |

## Decision

The third option.
Packages stay, and their boundaries are enforced by declared dependencies and a lint rule.
Inside `apps/web/src` and `packages/ui/src`, files are grouped as `schedule/`, `events/`, `notifications/`, `install/` and `app-shell/`, with `shared/` for primitives.

## Consequences

- Each move is one commit with tests passing and no behaviour change, measured against [metrics-baseline.md](../metrics-baseline.md).
- The largest component and stylesheet are split along the same feature lines.
- The public entry of `packages/ui` stays the same, so the app's imports change little.
- Reviewers need to know both rules: packages by runtime, folders by feature.
