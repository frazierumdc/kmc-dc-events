# 0008. Eastern time for everything

- **Status:** Accepted
- **Decided:** Date not recorded (an early decision)
- **Recorded:** Written up on 17 November 2026 from the project's decision log, for this copy of the repository.
- **Source decisions:** D10

## Context

The center is in Washington, DC.
Phones may be in another time zone, and daylight saving changes twice a year.

## Options

The decision log records the choice and its reason, not alternatives.
The implied alternative is the phone's local time.

## Decision

"Today" means today in Washington, DC, wherever the phone is.
All business time logic goes through one module (`packages/domain/src/time.ts`).
The app holds events from today to 400 days ahead.

## Consequences

- Times are right for travellers and across daylight-saving changes.
- Timers, emails and "finished events drop off" all share one definition of the day.
- The time zone is a constant; another center in another zone would need it to become a setting.
