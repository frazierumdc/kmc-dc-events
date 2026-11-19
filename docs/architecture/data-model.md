# Data model

> The neutral *website event*, the site settings, and the two files phones download.
> Every shape here is a zod schema in `packages/domain`; this page explains them, the code defines them.
> The app shows exactly what the website shows (D36); the one piece of event information of the app's own is the online schedule (D46).

## What lives where

```
data/
  site.json                hand-edited by pull request: the center's name, contact,
                           links, home city, allowed hosts, kinds, online schedule and
                           other centers' events (D67); checked by pnpm data:check
  pictures/                other centers' events' pictures (D67), each event's thumbnail
                           and story picture, named as their files on the site
```

The schedule itself is **not** in the repository (D38).
The update job reads the source, builds the snapshot and publishes it to Firebase Hosting; the published snapshot is the only copy.

## Website event

What the adapter (D37) makes of each event: what the event's page on the website shows, and nothing more.
Everything after the adapter reads only this shape.

```jsonc
{
  "id": "3efe9c7a-d27a-480c-912b-3ba7ed7de483",   // the source's own id (D39)
  "title": "Wednesday Step by Step Meditation",
  "summary": "Deepen your meditation practice by exploring key meditations …",  // or null
  "description": "Join us …\n\nEveryone is welcome …",   // plain text with paragraphs; or null
  "start": "2026-10-14T23:00:00Z",                 // UTC instant
  "end": "2026-10-15T00:00:00Z",                   // or null
  "categories": ["Weekly Meditation Classes"],     // the website's names, in its order
  "location": {                                    // null when the website gives none
    "online": false,
    "name": "Kadampa Meditation Center DC",        // or null
    "address": "1200 Canal St SW, Washington, DC 20024, USA",  // or null
    "city": "Washington",                          // or null
    "geo": { "lat": 38.8762356, "lng": -77.0117944 }           // or null
  },
  "page": "https://www.example.org/event-details/wednesday-step-by-step-meditation-2026-10-14-19-00",
  "registrationOpen": true,
  "picture": "https://static.wixstatic.com/media/…~mv2.jpg"  // or null; only from Wix's media server
}
```

Rules: instants in UTC, whole seconds; text is plain (shown as text, C-6); `page` is https on an allowed host or the event is left out with a warning (EV-6).
An event with no title or no start is left out with a warning.
The description is kept whole; a link on words gets its address after them in brackets, "Heart Jewel (https://tharpa.com/…)", unless the words already are the address (EV-33).
An online event keeps the source's venue name ("Online Conference"); a place still to be decided gives no location.
The picture is the website's own, its address only; each publish copies it to the site as a thumbnail, `/v2/feed/pictures/<hash>-256.jpg`, 256 pixels square (`packages/domain/src/thumbnail.ts`, D7).

## Site settings — `data/site.json`

```jsonc
{
  "center": { "name": "Kadampa Meditation Center DC", "shortName": "KMC DC" },
  "homeCity": "Washington",        // rows show a city label only for events elsewhere (EV-11)
  "contact": { "phoneDisplay": "202.555.0100", "phoneE164": "+12025550100", "email": "info@example.org" },
  "links": { "onlineClasses": "https://www.example.org/online-classes" },
  "allowedHosts": ["www.example.org"],
  "categoryKinds": {                // each website category's kind (D45); others have none
    "Weekly Meditation Classes": "class", "Study Programs": "class",
    "Richmond Branch Classes": "class", "Retreats & Special Events": "special",
    "Online Special Events": "special", "Chanted Prayers": "prayer"
  },
  "membership": {                   // the card at the end of the list (EV-17), from the pricing plans page
    "title": "You belong here", "intro": "Become a member and …",
    "benefits": ["Free drop-in classes", "…"],  // 1 – 3
    "note": "Benefits vary by plan.",
    "link": "https://www.example.org/pricing-plans/list"   // on an allowed host
  },
  "online": {                       // copied from the online classes page (D46)
    "livestreams": [
      { "category": "Weekly Meditation Classes",
        "times": [{ "day": "sun", "start": "10:00" }, { "day": "wed", "start": "19:00" }, …] },
      { "category": "Chanted Prayers", "except": ["Dakini Yoga", "Quick Path to Great Bliss"] }
    ],
    "iconOnly": [{ "category": "Retreats & Special Events", "titleWord": "Festival" }]
  },
  "programs": [                     // the study programs whose members get their dates (AN-15)
    { "id": "fp", "name": "Foundation Program", "shortName": "FP", "category": "Study Programs",
      "titles": ["The Foundation Program", "Foundation Program"], "classDays": ["sun"] },
    { "id": "ttp", "name": "Teacher Training Program", "shortName": "TTP", "category": "Study Programs",
      "titles": ["Teacher Training Program", "Teacher Training Program (TTP)"],
      "classDays": ["sun", "tue"],
      "prayerDays": { "monthDays": [10, 25], "prayer": "Offering to the Spiritual Guide" } }
  ],
  "emailNames": {                   // short names in the KMC DC Events calendars (AN-14)
    "prayers": [{ "code": "HJ", "name": "Heart Jewel", "startsWith": "Heart Jewel" }, …],
    "classes": [{ "label": "Mon", "startsWith": "Monday Meditation" }, …],
    "special": [{ "label": "Silent", "startsWith": "Silent Saturday" }, …]
  }
}
```

These describe the center and its website, never a single event, except `online`: an event at the center (in the home city, not online) is livestreamed when one of its categories is a livestream's `category`, its Eastern weekday and start time are in `times` (when given), and its title isn't in `except`.
An event anywhere in an `iconOnly` rule's `category` with its `titleWord` (one word, any case) in its title shows only the list's online icon.
A program's sessions are the events in its `category` whose title is one of its `titles` (ignoring capitals and spacing); its `classDays` (D49) are the days a class without a session is noted and reminded (AN-16, AN-20); its optional `prayerDays` name the days of the month whose class day without a session holds `prayer` instead (AN-21), linked to the event that day whose title starts with it; its `shortName` names it in its dates email's subject and greeting (AN-16); its `id` is its email list (`FP_EMAILS`, `TTP_EMAILS`) and its Send email choice (`program-fp`).
In the KMC DC Events email, a prayer whose title starts with an `emailNames.prayers` entry's `startsWith` shows its `code` (1 – 4 letters or digits), explained by its `name` in the prayers' key; a class or special event whose title starts with an `emailNames.classes` or `emailNames.special` entry's `startsWith` shows its `label` (one word); a program's session shows its program's `shortName`.
A prayer not listed shows its title's initials, a class or special event its title's first word: add new titles here.
Each `category` must be in `categoryKinds`.
`online`, `emailNames` and `allowedHosts` aren't published to phones; of `programs` only each program's `id`, `shortName`, `category` and `titles` are, so phones can colour its sessions (D45); `membership` is, and a phone reads a missing or unreadable one as none (no card), and missing programs as none.
Days are `sun` – `sat`; times are Eastern, 24-hour.
An event's kind is the first of `special`, `class`, `prayer` that one of its categories maps to.
Later features add keys (Info cards, install text).

## Class id

A class or program is the same title in the same city, or online (D39); the app doesn't use the id yet.
`classId()` (`packages/sync/src/class-id.ts`, used by the snapshot build) takes the title's words (no capitals, accents or punctuation) and the city (`online` for an online event, nothing for an in-person event without a city), and returns `c_` plus the first 12 Crockford base32 characters of the sha256 of the two lines.
The same class always gets the same id; nothing is stored.
Titles that differ on the website are different classes ("Teacher Training Program" and "Teacher Training Program (TTP)").

## Manifest — `/v2/feed/manifest.json`

```jsonc
{
  "schema": 2,
  "version": "20261009T103112Z-3fa9c2d1",   // published time + first 8 hex of the content's sha256
  "publishedAt": "2026-10-09T10:31:12Z",    // when this schedule was published; shown as "Schedule updated …"
  "snapshots": { "2": "/v2/feed/snapshots/20261009T103112Z-3fa9c2d1.json" },
  "schedule": "9c1e4b7a02d35f68",           // fingerprint of every event's id, start and end: the server's check compares it with the website (D64)
  "minAppBuild": null,                      // reserved: force old app builds to update
  "message": null                           // reserved
}
```

`/v2/feed/latest.json` is the current snapshot, for a first visit.

`/v2/feed/calendar/<event id>.ics` is each listed event's calendar file (RFC 5545, times in UTC), written from `latest.json` on every deploy (`packages/publish/calendar-files.ts`).
Its notes give the event's address in the app, then its page on the website, then its online page (`Online: …`) when it has one.
On iPhone, **Add to calendar → Apple Calendar** opens it in the app's own window, where iPhone offers to add it (EV-35): a home-screen app can't open a calendar file made on the phone, and a new view doesn't hand the file to Calendar.
A calendar file that isn't there answers 404, not the app's page (a rewrite in `firebase.json` to a path that doesn't exist).

`/e/<event id>` is, for each listed event, a copy of the app's `index.html` whose title, description and link preview tags (Open Graph) give the event's name and when and where (`Tue, Oct 13, 2026 · 6:00 – 6:30 PM Eastern · KMC DC`), with the event's share picture, `/e/<event id>/share.png`; both written from `latest.json` on every deploy (`packages/publish/event-pages.ts`).
A shared link then previews as the event (EV-35).
It opens the app at the event's panel like any other `/e/{id}`; an id with no page gets the app's own `index.html`.

The share picture (1200 × 630, the size link previews use) is a calendar page in the event's kind colour with the month and year, the day and the weekday; then the kind's name, the event's name (three lines at most), its time and its place (`packages/publish/src/share-picture.ts` says what it shows, `packages/publish/src/share-pictures.ts` draws it with Inter from `@fontsource/inter`).
It reaches people only through link previews: Share sends the event's link alone, which arrives as one preview showing it.
It is served with `no-cache`, so a changed event's picture is never kept.

## Snapshot v2 — `/v2/feed/snapshots/<version>.json`

```jsonc
{
  "schema": 2,
  "version": "20261009T103112Z-3fa9c2d1",
  "publishedAt": "2026-10-09T10:31:12Z",
  "timezone": "America/New_York",
  "site": { "center": { … }, "homeCity": "Washington", "contact": { … }, "links": { … } },
  "events": [
    {
      "id": "3efe9c7a-d27a-480c-912b-3ba7ed7de483",   // links: /e/{id}
      "classId": "c_4QJ8M2VX7K1D",                     // the class or program; not used yet
      "title": "Wednesday Step by Step Meditation",
      "summary": "…",
      "description": "…",
      "start": "2026-10-14T19:00:00-04:00",            // ISO with the Eastern offset
      "end": "2026-10-14T20:00:00-04:00",              // or null
      "allDay": false,                                 // starts at midnight Eastern, ends at midnight or 11:59 PM
      "categories": ["Weekly Meditation Classes"],
      "location": { "online": false, "name": "…", "address": "…", "city": "Washington", "geo": { … } },
      "page": "https://www.example.org/event-details/…",
      "registrationOpen": true,
      "picture": "https://static.wixstatic.com/media/…~mv2.jpg",   // or null (D7); an older schedule has none
      "online": {                                      // or null (D46)
        "type": "livestream",
        "page": "https://www.example.org/online-classes"
      }
    }
  ]
}
```

`online` is one of: `{ "type": "livestream", "page" }`, the center's livestream, whose links are on the online classes page; `{ "type": "event", "id", "page", "registrationOpen" }`, the website's separate online event, which isn't listed on its own; `{ "type": "iconOnly" }`, the list's online icon with no button; or `null`.
A reader takes a missing or unknown `online` as `null`.

Events are the website events from the start of today (Eastern) to 400 days ahead, in start order.

**Changing it:** within schema 2, only add optional fields; readers drop fields they don't know.
A breaking change means schema 3, published alongside 2 until every phone has updated.
`packages/domain/golden/` keeps a copy of a published snapshot and manifest, and a test checks schema 2 still reads them.
The version's hash covers the events and site settings only, never the publish time; a run whose hash matches the published one publishes nothing, so the version changes only when the website does.
Size limit: 1 MB gzip; the build stops above it.
Schema 2 is the only schema published.

## Ids

| Id | Format | Made by | Never changes |
|---|---|---|---|
| Event id | The source's own id (a GUID for Wix) | The source | For as long as the event exists in the source |
| Class id | `c_` + 12 Crockford base32 characters | Derived from title and city | Same title and city, same id |
| Snapshot version | `<UTC time>-<first 8 hex of sha256>` | Snapshot build | — |
