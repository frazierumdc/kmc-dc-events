# 0004. One adapter knows the source

- **Status:** Accepted
- **Decided:** Date not recorded
- **Recorded:** Written up on 17 November 2026 from the project's decision log, for this copy of the repository.
- **Source decisions:** D4, D37

## Context

The website runs on a hosted website builder with its own event format, quirks and API.
The app, the emails and the notifications all need event data.

## Options

| Option | Trade-off |
|---|---|
| Every consumer reads the source's format | Fewer types; the platform's quirks spread through the codebase |
| One adapter turns the source's event into a neutral "website event"; everything after it reads only that | One more type and a mapping step; the platform is confined to one module |

## Decision

One adapter (`packages/sync/src/wix-adapter.ts`) knows the source.
Publishing, the app, the emails and notifications read only the neutral website event.
The source is a read-only, token-protected feed function installed in the website, which returns every published event for the next 400 days in one request.

## Consequences

- The platform's quirks stay in one file, and moving to another platform means rewriting the adapter, not the app.
- The adapter is the most complex function in the repository; the architecture review proposes splitting it into field mappers.
- The feed's own schema currently sits in the shared contract package, which softens this boundary; the review proposes moving it beside the adapter.
