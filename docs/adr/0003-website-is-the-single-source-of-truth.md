# 0003. The website is the single source of truth

- **Status:** Accepted
- **Decided:** Date not recorded; restated in the log as its central rule
- **Recorded:** Written up on 17 November 2026 from the project's decision log, for this copy of the repository.
- **Source decisions:** D3, D8, D36, D46, D67

## Context

Staff already create and edit events on the center's website, where people register and pay.
An earlier version of the app kept details of its own per event (notes, overrides, livestream buttons).

## Options

| Option | Trade-off |
|---|---|
| The app keeps its own editable copy of events | Staff would enter or correct events in two places, and the two could disagree |
| The app is a read-only copy of the website: same titles, times, places, descriptions, categories and registration state | Nothing to reconcile; anything missing must be added on the website |

## Decision

The website is the only place events are created, and the app shows exactly what the website shows.
It adds no event information of its own and corrects nothing.
Cancelled events disappear from the app because the website no longer lists them.
Two narrow exceptions are held in the site settings file: the online class timetable, and a short list of other centers' events added by hand at the owner's request.

## Consequences

- No second place for staff to edit and no data to reconcile.
- The app depends on the website's feed, which is why publishing fails closed ([0006](0006-fail-closed-publishing-without-review.md)).
- Events the website lists twice are shown twice; the system tells staff by email instead of correcting them.
- Accepted: the per-event extras of the earlier version are gone until they exist on the website.
