# F5 — Delivery and notifications

> Requirements for getting a schedule change to people: at once in an open app, by a notification when the app is closed, and always in the end; and for reminding people of the events they follow.
> IDs (`NT-*`) are stable.
> Approved by the owner on 11 November 2026, with the recommended option of each mock-up; the mock-ups for Android, dark, a refused permission and iPhone in Safari on 12 November 2026, and the Prayers screen the same day; on 13 November 2026, notifications chosen by event, option B of eight mock-ups ([gallery](../design/README.md#f5-delivery-and-notifications)): Events you follow and Add events in place of the event types and the Prayers screen; the same day, what following covers said on each kind's screen, option 1C.
> Planned as slices 1.11 and 1.12 of [PLAN.md](../PLAN.md); decisions [D64](../DECISIONS.md#d64) and [D65](../DECISIONS.md#d65).

## Why

A cancelled class or a moved time matters most to the person about to leave for it.
Today a change reaches the site within minutes of a save in Wix (D28), but an app left open doesn't look for it, a closed app can't be told, and an app that can't check says nothing.

<p align="center">
<img src="../design/mockups/notifications/settings-iphone-light.png" width="180" alt="Mock-up: Settings, opened from a gear, with a Notifications row">&nbsp;
<img src="../design/mockups/notifications/notifications-off-iphone-light.png" width="180" alt="Notifications off: the same screen, its switch off">&nbsp;
<img src="../design/mockups/notifications-by-event/event-2-following-iphone-light.png" width="180" alt="Mock-up: Notifications with the events followed and Add events">&nbsp;
<img src="../design/mockups/notifications-by-event/event-2b-add-iphone-light.png" width="180" alt="Mock-up: Add events, with a search and a switch for each event">&nbsp;
<img src="../design/mockups/notifications/event-follow-iphone-light.png" width="180" alt="Mock-up: Notify me of changes, switched on, in an event's panel">&nbsp;
<img src="../design/mockups/notifications/lock.png" width="180" alt="Illustration: two notifications on a lock screen">
</p>
<p align="center"><em>The approved mock-ups (iPhone, light): Settings · before turning on · Notifications · Add events · following an event · on the lock screen (an illustration). Android, dark, the refused permission and iPhone in Safari are in the <a href="../design/README.md#f5-delivery-and-notifications">gallery</a>.</em></p>

## Requirements

### Delivery

| ID | Requirement |
|---|---|
| NT-1 | **At once in an open app.** While the app is on screen and online, a newly published schedule shows within 5 seconds of its publish, with nothing to press. The app hears of it over one live connection that carries only the schedule's version, started after the list shows, so opening is no slower (NFR-1). |
| NT-2 | **Every minute behind it.** While on screen the app also asks the site for the schedule's version every 60 seconds, and at once when its connection returns; with the checks on opening and on every return (EV-18), a lost live connection costs at most a minute. |
| NT-3 | **Always the published schedule in the end.** Every route ends the same way: the app loads the schedule the site names as current. Applying it twice changes nothing, and no route applies an older one over a newer one. |
| NT-4 | **Quiet in the list.** A new schedule is applied as EV-19 says: silently, the day at the top kept, with no banner, flash or highlight. |
| NT-5 | **An open event that changes** shows one line under its title, "Updated just now", once its date, time or place has changed while its panel is open. An event that leaves the schedule while its panel is open keeps the panel open with its type and title, says "This event is no longer on the schedule. It was cancelled or has ended." and offers only Close. |
| NT-6 | **Says when it couldn't check.** When a check fails and none has succeeded for 10 minutes, a notice above the list says "Couldn't check for changes since {time}. Before you go, check example.org." in a neutral surface, in a live region already on the page; the whole notice opens the website, and it goes when a check succeeds. So an app returned to after hours offline says so at once. {time} is the last successful check, with its date and year when that wasn't today. Info's "Schedule updated" line stays (EV-41). |
| NT-7 | **The site follows the website.** Every 5 minutes the server compares the website with the schedule published on the site and starts a copy when they differ in which events are listed or in a date or time (D28's rule), so a lost Wix signal or a failed publish is put right within about 10 minutes (D64). |
| NT-8 | **Never silently behind.** When the site has differed from the website for 15 minutes, admins get the Problem email ("The app is behind the website since {time}"), at most once a day (AN-4), and an alert from Google Cloud that doesn't depend on the app's own email; "works again" follows when they match. A second alert tells admins when the checks themselves have stopped. |

### Notifications

| ID | Requirement |
|---|---|
| NT-10 | **Off until chosen.** Nothing asks for notifications by itself. The phone's permission question appears only after the person turns the **Notifications** switch on; the line under the switch first says what they will get and that the phone will ask. |
| NT-11 | **Changes: only what changes a plan.** Besides reminders (NT-40), a notification is sent when an event is cancelled (it leaves the website) or its date, start time or end time changes, and for nothing else: not a new event, a title, a description, a picture or a place. |
| NT-12 | **By event, not by type.** People follow the events they go to; there are no switches for event types (owner, 13 November 2026). An event is followed in its panel (NT-13) or on its kind's screen under Notifications (NT-22), and the two are the same choice. |
| NT-13 | **By event.** An event's panel has a row **Notify me** with a switch, above its buttons. An event held more than once on the schedule (a weekly class, a prayer) is followed every time it is held, whatever its date; the row says so ("Every Wednesday Step by Step Meditation", or its when line as NT-22 says it). A study program is one choice: following any of its classes follows all of them, whatever their day or the form of their title on the website, so TTP's Sunday and Tuesday classes are followed together, and the row says "Every TTP class" (owner, 13 November 2026). An event held once is followed by itself, and the row says "One time · " and its date. |
| NT-14 | **Once per change, per phone.** A phone that follows an event both by itself and as part of its series gets one notification. A second change to the same event replaces the first on the lock screen. |
| NT-15 | **What it says.** The title starts with what happened and names the event: "Cancelled: {title}" or "New time: {title}". The text gives the date with its year and the time in Eastern time; a moved event says the new time and the old one. Tapping it opens the app on the list at that event's date, the new one for a moved event and the date it was on for a cancelled one, with the new schedule loaded; the event's panel isn't opened. The list shows All for that visit, so the event is listed whatever filter is remembered. |
| NT-16 | **After the app can show it.** A notification is sent only once the schedule that holds the change is published, never before. A phone that is off gets it when it is back, until the event's start; after that it is dropped. |
| NT-17 | **The Notifications screen** is one screen, on or off, as option E of the [mock-ups](../design/mockups/notifications-by-kind/flow-option-E.png) (owner, 13 November 2026): the **Notifications** switch (on this phone), then the events followed (NT-47) and **Add events**, a row for each of the events list's kinds, **Classes**, **Special Events** and **Prayers** (the list's filter says Special; here the full name, owner, 13 November 2026), each with a square of its colour (D45), how many of it are followed ("Following 1 of 10") and ›. Off, the line under the switch says what notifications are for, and the events followed are kept and counted, waiting: the kinds' rows are dimmed and don't open, so no event can be chosen until notifications are on (owner, 13 November 2026). On, it ends as NT-48 says. An event followed by itself that is no longer on the schedule is dropped, and its list left; an event followed every time it is held stays. |
| NT-18 | **When the phone says no.** With permission refused or later removed in the phone's settings, the screen says so and how to allow it there; the app never asks again by itself. |
| NT-19 | **iPhone needs the Home Screen.** In Safari on iPhone, where notifications aren't possible, the screen says to add the app to the Home Screen first and links to the steps (IN-10); it shows no switch that can't work. |
| NT-20 | **No accounts.** No name, email or sign-in. The choices are kept on the phone; the messaging service holds only an anonymous code for the phone and the lists it joined, removed when notifications are turned off (D11). |
| NT-21 | **A notification is a courtesy, not the record.** The app shows the published schedule whenever it is opened, whether or not a notification arrived. |
| NT-22 | **A kind's events.** Each row of Add events opens a screen of its own, titled with the kind, back to Notifications: first one sentence on what turning an event on does (NT-48) (option 1C of the [mock-ups](../design/mockups/notification-wording/option-1C.png), owner, 13 November 2026), then every event of that kind on the schedule, as the list sorts them into its filter's kinds (a study program's session and a branch class are classes; a special event the website also lists as a class is under Classes, in At KMC DC, and under Special, the same choice in both (D45)), each held more than once first, by name, then each other event by date. Each card's when line starts, in bold, with what following it covers (owner, 13 November 2026): **Weekly** for an event held on usual days, then those days and its time, "usually" before the time when a session is held on another day or at another time ("Weekly · Tuesdays, 5:00 PM", "Weekly · Tuesdays to Fridays, usually 8:00 AM"); **One time** for an event held once, then its date ("One time · Saturday, November 14, 2026"); for an event held more than once with no usual days, how many times, then its dates, or the first when there are more than three ("2 times · Nov 29 and Dec 29, 2026", "5 times · from Nov 29, 2026"). A study program's days come from its sessions, Sunday first, with its start time when every session starts at the same time ("Weekly · Sundays, 12:00 PM", "Weekly · Sundays and Tuesdays"). Classes are grouped like with like, each group under its heading: **At KMC DC**, **Branch classes**, then **Study programs**, a group with no events left out (owner, 13 November 2026). Each is a card like the list's (EV-11): tinted with its kind's colour, its picture from the website (D7), or its kind's colour when it has none, a bar of the colour, the name on up to two lines, the where line (the place and Online, as the list says them), the when line (on up to two lines, never cut), and a switch. Every card is the same height; at very large text cards grow and nothing is cut. An event's switch here is the same as Notify me in its panel, and the kind's row counts it. |
| NT-23 | **Off keeps the choices.** Turning **Notifications** off leaves every list at the messaging service (NT-20) and keeps the events followed on the phone. Turning it on joins them again, so the screen is as it was left. Nothing is on until the person chose it. |
| NT-24 | **No switch waits for the network.** Every switch moves at once. Once the phone has allowed notifications, the **Notifications** switch shows on and events can be followed straight away; getting the phone's code and joining its lists follow in the background. If that fails, the switch goes back to off and the screen says "Couldn't change notifications. Check your connection and try again.", with the choices kept. A choice the service refuses flips back the same way. |

### Reminders

Asked for by the owner on 17 November 2026 and approved the same day; decision [D69](../DECISIONS.md#d69), built as [slice 1.16](../PLAN.md#slice-116--reminders-before-an-event).
Mock-ups: option B of five for the Notifications screen (owner's choice), and the event panel's row ([panels](../design/mockups/reminders/)).

<p align="center">
<img src="../design/mockups/reminders/option-B.png" width="640" alt="Mock-up, option B: Notifications with Your events, each event's card saying Day before or Week before and day before, in light, dark and the largest text">
</p>
<p align="center">
<img src="../design/mockups/reminders/panel-row.png" width="640" alt="Mock-up: Notify me in an event's panel, saying what it sends, for a weekly class and a one-time event">
</p>

| ID | Requirement |
|---|---|
| NT-40 | **Reminders for the events followed.** A phone with notifications on gets a reminder before each event it follows, as well as its changes (NT-11). Following an event is the one choice for both (NT-13): there is no separate setting for reminders or for their times, and nothing goes to a phone that didn't follow the event. |
| NT-41 | **A day before.** A reminder is sent 24 hours before the start of every event followed; for an event held more than once, before each time it is held. |
| NT-42 | **A week before, except weekly events.** A reminder is also sent 7 days before the start, at the event's start time, for an event whose card says **One time** or how many times ("2 times"), before each of its dates (NT-22). An event whose card says **Weekly**, a study program among them, gets only the day-before reminder. |
| NT-43 | **Events over several days, and all-day events.** An event over several days is reminded before its start only, not before each day. An all-day event's reminders are sent at 9:00 AM Eastern, a day and a week before its date. |
| NT-44 | **From the published schedule.** Reminders are timed from the schedule published when they are sent: a moved event is reminded before its new time, and a cancelled event not at all. An event that joins the schedule, or is followed, after a reminder's time gets only the reminders still ahead. |
| NT-45 | **Once, and on time.** Each reminder is sent once, within 15 minutes of its time; a phone that follows an event both by itself and as part of its series gets one (NT-14). When the schedule can't be read at a reminder's time it is tried again, and after 3 hours dropped. A phone that is off gets a day-before reminder when it is back, until the event starts, and a week-before reminder for 24 hours. |
| NT-46 | **What it says.** The title says when and names the event: "Tomorrow: {title}" or "In a week: {title}". The text gives the date with its year, the time in Eastern time and the place as the list says it, or Online ("Wed, Nov 18, 2026 · 7:00 – 8:00 PM Eastern · KMC DC"). Tapping it opens the app on the list at the event's date, as NT-15. A later notification about the same event replaces it on the lock screen (NT-14). |
| NT-47 | **Your events.** Between the switch and the kinds' rows, the Notifications screen lists every event followed under **Your events**, as option B of the [mock-ups](../design/mockups/reminders/option-B.png) (owner, 17 November 2026): each is the card of its kind's screen (NT-22) with one more line, beside a bell, saying which reminders it sends, "Day before" or "Week before and day before", and its switch. Events held more than once come first, by name, then the others by date, as on a kind's screen. Turning a card's switch off stops following the event, the same choice as its panel's and its kind's screen's; the card stays, switched off, until the screen is left, so it can be turned back on. With no event followed it says "No events yet. Add them below, or turn on Notify me in any event." The kinds' rows follow under **Add events**. With notifications off the cards are dimmed and their switches don't move, as the kinds' rows (NT-17). At very large text the cards grow and nothing is cut. |
| NT-48 | **One idea, in few words.** Following an event keeps a person up to date on it; the screens say so as one thing and never list two kinds of notification (owner, 17 November 2026). Under the Notifications switch, on: "You’ll be reminded before each event below, and told if it changes."; off: "Follow events to be reminded before them and told if they change. Your phone will ask you to allow notifications." The panel's row is **Notify me**, and its line says what this event sends: "A reminder the day before each class, and if one changes" for a weekly event (each class, each prayer, each session of a special event, "each TTP class"), "A reminder a week and a day before each date, and if one changes" for one held more than once with no usual days, and "A reminder a week and a day before, and if it changes" for a one-time event. A kind's screen starts "Turn an event on to be reminded and kept up to date. We’ll remind you the day before, and a week before too for events that aren’t weekly." (owner, 17 November 2026) The Notifications screen ends "Turn an event off to stop its notifications." A change is what NT-11 says: cancelled, or a new date or time. |
| NT-49 | **Said wherever notifications are described.** The privacy page and the explainer say that notifications remind people of the events they follow, in the release that brings reminders. |
| NT-50 | **Switched on or off for each stage.** Reminders can be turned off and on again in each stage (dev, test and prod) by itself, with no code change or deploy: pausing the stage's reminders timer in Cloud Scheduler and resuming it ([runbook](../runbooks.md#turn-reminders-off-or-on-for-a-stage)). They stay on in prod; in dev and test they are on while they are being tested or a fault is being fixed, and off otherwise (owner, 17 November 2026). A reminder whose time passed while they were off isn't sent when they come back on. Change notifications (NT-11) aren't affected. |

### Settings

| ID | Requirement |
|---|---|
| NT-30 | **Info becomes Settings.** The button at the end of the top bar is a gear, named "Settings" to screen readers, and its sheet is titled **Settings** (EV-41's targets and behaviour unchanged). Its first row is **Notifications ›**, with "Off" or how many are on; then Add to Home Screen, Privacy and Share the app, and the version, as before. |
| NT-31 | **The words that point there change with it.** `/get-app` (IN-10), the privacy page and the explainer say Settings and show the gear where they said Info and ⓘ. |

<p align="center">
<img src="../design/mockups/notifications/updated-just-now-iphone-light.png" width="180" alt="Mock-up: Updated just now under an open event's title">&nbsp;
<img src="../design/mockups/notifications/no-longer-on-schedule-iphone-light.png" width="180" alt="Mock-up: This event is no longer on the schedule, with only Close">&nbsp;
<img src="../design/mockups/notifications/couldnt-check-iphone-light.png" width="180" alt="Mock-up: the Couldn't check notice above the list">
</p>
<p align="center"><em>NT-5 and NT-6 as approved on 12 November 2026 (iPhone, light): Updated just now · no longer on the schedule · couldn't check. Android and dark are beside them in the <a href="../design/README.md#f5-delivery-and-notifications">gallery</a>.</em></p>

## Limits, said in the app

Notifications reach only phones that turned them on, and an iPhone only with the app on its Home Screen (iOS 16.4 or later).
A phone that is off or offline gets its notification when it is back; Focus and Do Not Disturb can hold one back.
iPhone doesn't let a web app refresh in the background, so the schedule itself updates when the app is on screen.
The privacy page says what the messaging service holds (NT-20).

## Not in this feature

Announcements and urgent notices ([backlog](backlog.md)), notifications for new events, quiet hours (the phone's own Focus does this), choosing a reminder's time, and reminders without change notifications.
