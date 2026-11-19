# 0011. Notifications by topic, with no accounts

- **Status:** Accepted
- **Decided:** 11 to 17 November 2026
- **Recorded:** Written up on 17 November 2026 from the project's decision log, for this copy of the repository.
- **Source decisions:** D11, D65, D69

## Context

People want to hear when an event they attend is cancelled or moved, and to be reminded of it, when the app isn't open.
The app is private by design: no user accounts, tracking or analytics, and nothing loaded from other companies.

## Options

| Option | Trade-off |
|---|---|
| Accounts and a database of people, phones and preferences | Flexible targeting; personal data to protect, against the app's privacy rule |
| Topic lists in the messaging service: a phone joins a list per event or weekly class; choices are kept on the phone | No database of people; relies on registration tokens that the provider marks as deprecated for a newer id that can't join lists |
| A switch per event type | Simpler screen; people hear about events they don't attend. Tried first and retired |

## Decision

Opt-in notifications through Firebase Cloud Messaging web push.
Each choice joins the phone to a topic for that event or class; the app keeps the choices on the phone.
Only cancelled or moved events are announced, plus reminders before events a person follows.
If more than a small fixed number of notices would go out at once, none are sent.
The messaging library is downloaded only when someone opens the Notifications screen.
The web push key pair is the deployment's own, so leaving the messaging provider later would not require phones to subscribe again.

## Consequences

- No accounts and no store of people or phones.
- Alerts are rare and relevant, because only moved or cancelled events and chosen reminders are sent.
- Opening the app is no slower for people who never use notifications.
- Known risk, recorded in the log: if the provider ends topic lists for registration tokens, this decision has to be made again.
- On iPhone, notifications need the app on the home screen ([0001](0001-installable-web-app-no-app-stores.md)).
