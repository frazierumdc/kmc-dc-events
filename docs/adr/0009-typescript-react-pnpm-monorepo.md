# 0009. TypeScript everywhere, React, a pnpm monorepo, vertical slices

- **Status:** Accepted
- **Decided:** Date not recorded (an early decision)
- **Recorded:** Written up on 17 November 2026 from the project's decision log, for this copy of the repository.
- **Source decisions:** D12

## Context

The system has a browser app, a data pipeline, an email sender and cloud functions, built by one developer directing an AI coding assistant.

## Options

The decision log records the choice and a one-line reason.
It records no comparison with other languages, UI libraries or repository layouts, so none is given here.

## Decision

TypeScript (strict) everywhere, React for the app, one pnpm workspace, and every feature built as a vertical slice through all layers with its tests.
Node runs the TypeScript directly; nothing is compiled for the server side.

## Consequences

- One language and one set of types from the feed to the screen; the contract package is shared by every part.
- Features are finished through every layer, not half-built.
- A single lint, type and test run covers everything.
- Package boundaries inside the workspace are by convention, and some are bypassed; the architecture review proposes enforcing them.
