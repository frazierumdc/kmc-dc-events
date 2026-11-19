# Documentation

## Where to look

| I want to… | Read |
|---|---|
| See the architecture review and the proposed refactors | **[architecture-review.md](architecture-review.md)** |
| See the measured baseline the refactors are compared with | [metrics-baseline.md](metrics-baseline.md) |
| See what each refactor changed, before and after | [refactor-log.md](refactor-log.md) |
| Know what's been decided, and why | [adr/](adr/README.md) |
| Supply settings and secrets | [configuration.md](configuration.md) |
| Understand the product in five minutes | [product/overview.md](product/overview.md) |
| Know exactly what the Events feature must do | [product/events.md](product/events.md) |
| Know exactly what helping people install the app must do | [product/install.md](product/install.md) |
| Know how a schedule change reaches phones, and what notifications must do | [product/notifications.md](product/notifications.md) |
| Understand how the system fits together | [architecture/overview.md](architecture/overview.md) |
| Understand the workflows and releases | [architecture/ci-cd.md](architecture/ci-cd.md) |
| Know how the website's events are copied into the app | [architecture/data-pipeline.md](architecture/data-pipeline.md) |
| Work with the website's feed | [architecture/wix-feed.md](architecture/wix-feed.md) |
| Look up a file or snapshot format | [architecture/data-model.md](architecture/data-model.md) |
| Find a file a job keeps between runs | [architecture/storage.md](architecture/storage.md) |
| Make a change the right way | [workflow/development.md](workflow/development.md) |

## About this copy

The pages under `product/`, `architecture/` and `workflow/` come from the source repository, with center-specific values replaced by placeholders ([SCRUB.md](../SCRUB.md)).
The source's plan, decision log, runbooks, console links, infrastructure and email pages, backlog and mock-up gallery are not included, so links to `PLAN.md`, `DECISIONS.md`, `runbooks.md`, `links.md`, `infrastructure.md`, `email.md`, `backlog.md` and `design/` lead nowhere here.
Decision numbers such as `D36` are mapped to ADRs in [adr/README.md](adr/README.md).
`architecture-review.md`, `metrics-baseline.md`, `refactor-log.md`, `configuration.md` and `adr/` were written for this copy.

## Rules for these documents

1. **One fact, one place.**
   Requirements live in `product/`, designs in `architecture/`, decisions in `DECISIONS.md`, status in `PLAN.md`.
   Other pages link; they don't repeat.
2. **Status only in PLAN.md.**
   No "as built", "status" or "next steps" sections elsewhere.
3. **Describe what is true now.**
   When something changes, rewrite the text.
   No "changed on …", "retired", "formerly" or struck-through text; git history is the record.
4. **One file per feature** under `product/`, with its own ID prefix (`EV-`, `AN-`, …).
   IDs are never reused or renumbered.
5. **Small ID vocabulary:** feature prefixes, `NFR-` for qualities, `C-` for code rules, `D` for decisions.
   Nothing else.
6. **Requirements say what, architecture says how.**
   No code paths in requirements; no user stories in architecture.
7. **Updated in the same change as the code.**
8. **Plain, concise English.**
   Tables over paragraphs.
   No personal email addresses.
9. **One sentence per line.**
   Each sentence starts a new line; a table row stays on one line.
   The page looks the same, and a change shows in a pull request as exactly the sentences that changed.
