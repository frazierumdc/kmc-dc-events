# Product overview

## What it is

**KMC DC Events** is a phone app for the events of the **Kadampa Meditation Center DC** and its branches (Richmond today, more planned).
People see what's coming up, find their class in seconds, and go straight to the center's website (example.org) to register and pay.
It is an installable web app: opened from a link or QR code and added to the home screen, where it opens full screen and works offline (D1).

## Goals

| # | Goal | How we'll know |
|---|---|---|
| G1 | Find tonight's class in a few seconds | Opening the app shows today's events first, with no login and no wait, even offline |
| G2 | Nobody enters an event twice, and the app never disagrees with the website | Events are created only in Wix; the app shows exactly what the website shows, from the next copy (4 AM or 4 PM) |
| G3 | Staff always know what changed, and students know their dates | Every change copied from the website, and every duplicate, is emailed to management staff from the center's Gmail; program members get their dates weekly and a reminder before a week without class |
| G4 | Costs almost nothing | Runs inside Google's and GitHub's free tiers at 20 or 5,000 users |
| G5 | Easy and safe to change | Every feature is built and tested through every layer at once; a new developer can ship a small change in their first week |

## Who it's for

| Who | What they need |
|---|---|
| Visitors and newcomers | What's on this week, what each event is, how to get there |
| Regular attendees | Their usual class, quickly |
| Branch attendees | Their own location's events, never confused with DC's |
| Staff who edit events | Keep working in Wix as today; hear when the app picks up a change |
| Management staff | Hear at once when dates or times change or an event is listed twice; every event of the next 4 months, as a calendar, three times a week |
| Program members (Foundation, Teacher Training) | Their dates each week, a note when one changes, a reminder before a week without class |
| Administrators | Know the app is healthy and up to date, without technical work |
| Developers (occasional, volunteer or contractor) | Understand, fix and extend it safely from these docs |

About 20 users at launch, possibly 500 soon after; 2–4 admins; a few management staff.

## Principles

1. **The app shows exactly what the website shows** (D36).
   Only events published on the Wix site appear (D3), as the site shows them; the app adds nothing of its own and corrects nothing.
   If something should show in the app, it belongs in Wix.
2. **Copied, not reviewed.**
   An update job publishes the website's events twice a day, at 4 AM and 4 PM; the app depends on Wix only through one adapter (D37, D38).
3. **Eastern time everywhere** (D10).
4. **Offline first.**
   Phones download a small ready-made schedule file and render from it; they never query a server for events.
5. **Private.**
   No accounts, no tracking, nothing loaded from other companies (D11).
6. **Start static.**
   No server or database until a feature needs one (D41).

## Scope

| Now (features F1, F2, F4 and F5) | Later ([backlog.md](backlog.md)) | Never |
|---|---|---|
| Events list, date strip, filters | Location picker and branch links | Registration or payment in the app |
| Event details panel, Register, add to calendar, directions, share | Info screen, QR posters | User accounts or logins |
| Offline, installable with steps for each phone, self-updating | Announcements (incl. urgent pop-ups) | Tracking, ads, analytics that identify people |
| Copying the website twice a day | Admin console for staff | App-only events or details |
| Schedule emails to staff and program members | | Month-grid calendar |
| Changes at once in an open app; notifications each person chooses (planned) | | |
| Promotion emails for special events (draft, not approved) | | |
| | Event images, search, widgets, other languages | App Store / Google Play apps |
| | | A separate app per branch |

## Features

| Id | Feature | Requirements | Status |
|---|---|---|---|
| F1 | Events | [events.md](events.md) | See [PLAN.md](../PLAN.md) |
| F2 | Schedule emails | [emails.md](emails.md) | See [PLAN.md](../PLAN.md) |
| F3 | Promotion emails | [promotion-emails.md](promotion-emails.md) (**draft, not approved**) | See [PLAN.md](../PLAN.md) |
| F4 | Install the app | [install.md](install.md) | See [PLAN.md](../PLAN.md) |
| F5 | Delivery and notifications | [notifications.md](notifications.md) | See [PLAN.md](../PLAN.md) |
| F6+ | Later features | [backlog.md](backlog.md) | Not planned |

## Glossary

| Term | Meaning |
|---|---|
| **Admin** | A person who looks after the app; gets the Problem emails |
| **Class days** | The weekdays a study program always meets (D49); a class day without a session gets a reminder |
| **Branch / location** | A place that runs events: the main center in DC, or a branch such as Richmond |
| **Adapter** | The one piece of code that turns the source's data (Wix) into website events |
| **Category** | A tag staff give an event in Wix; the app shows its name as the website does |
| **Update job** | The **Update schedule** job, on Google Cloud: copies the website's events into the app at 4 AM and 4 PM, and on demand (Sync now) |
| **Email list** | A Google Group that receives one kind of email: management staff, admins, or a program's members (D47) |
| **Feed** | The read-only Wix endpoint the app reads events from |
| **Class id** | The id of a class or program, from its title and city; carried in the schedule, not used by the app yet |
| **Event id** | The source's own id for an event, used in links (`/e/{id}`) |
| **Management staff** | The center's managers; get Schedule changes, Duplicate events and KMC DC Events, each from its own group |
| **Program** | A study program with its own emails: the Foundation Program (FP) and the Teacher Training Program (TTP) |
| **Published event** | Live on the center's Wix site: not a draft, not cancelled |
| **Site settings** | `data/site.json`: the center's name, contact, links, home city |
| **Snapshot** | The complete, checked schedule file phones download |
| **Website event** | One event as the website shows it: the neutral shape after the adapter |
| **Vertical slice** | A piece of a feature built through every layer at once |
