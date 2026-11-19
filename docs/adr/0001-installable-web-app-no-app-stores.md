# 0001. An installable web app, not app-store apps

- **Status:** Accepted
- **Decided:** Date not recorded (an early decision)
- **Recorded:** Written up on 17 November 2026 from the project's decision log, for this copy of the repository.
- **Source decisions:** D1

## Context

People at the center need tonight's classes on their phone, on iPhone and Android, without creating an account.
The app is built and maintained by a volunteer, so every extra codebase or review process is a cost.

## Options

| Option | Trade-off |
|---|---|
| An installable web app (PWA), opened from a link or QR code and added to the home screen | One codebase; updates reach everyone at once; on iPhone, lock-screen notifications work only once the app is on the home screen |
| Native apps in the App Store and Google Play | Not recorded as evaluated in detail. The log names what the web app avoids: store review and fees |

The app was custom-built; the log records no comparison with buying or adopting an existing product, so none is given here.

## Decision

An installable web app, with no App Store or Google Play apps.

## Consequences

- One codebase serves iPhone, Android and computers, and a release needs no store review.
- Installing takes a few taps that differ by browser, so the app carries its own install guide and a `/get-app` page, which became a feature of its own.
- Accepted limit: on iPhone, notifications need the app on the home screen.
