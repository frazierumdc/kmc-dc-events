// The reminders before an event (D69, NT-40 – NT-46): a day before every event, and a week
// before one that isn't held weekly, sent to the lists of the phones that follow it. Worked
// out from the published schedule alone, so a moved event is reminded before its new time and
// a cancelled one not at all (NT-44). Pure.

import { dayAddress } from "./day-address.ts";
import { eventPlace, eventWhen } from "./event-text.ts";
import { followFor, isWeekly } from "./follow.ts";
import { fcmSend, type FcmSend } from "./notify-message.ts";
import { classList, eventList, programList, type NotifyList } from "./notify-lists.ts";
import { eventProgram } from "./programs.ts";
import { addDays, easternDate, easternMidnight, easternMinutes } from "./time.ts";
import type { SnapshotV2, SnapshotV2Event } from "./website.ts";

/** How often the reminders' timer runs: each run sends what came due in its own 15 minutes. */
export const REMINDERS_EVERY_MS = 15 * 60_000;

/** An all-day event's reminders go at 9:00 AM Eastern (NT-43). */
const ALL_DAY_MINUTES = 9 * 60;

/** A week-before reminder waits a day for a phone that is off (NT-45). */
const WEEK_WAITS_MS = 24 * 60 * 60_000;

/** One reminder, ready to send, and what it is about for the run's log. */
export interface Reminder {
  kind: "day" | "week";
  eventId: string;
  title: string;
  /** When it was due. */
  due: Date;
  lists: NotifyList[];
  send: FcmSend;
}

/** The instant of `minutes` after midnight Eastern on `date`, whatever the clocks did that day. */
function easternAt(date: string, minutes: number): Date {
  const guess = new Date(Date.parse(easternMidnight(date)) + minutes * 60_000);
  return new Date(guess.getTime() + (minutes - easternMinutes(guess)) * 60_000);
}

/**
 * When an event's reminders are due: a day before is 24 hours before its start (NT-41); a
 * week before is 7 days earlier at its start time (NT-42); an all-day event's are at 9:00 AM
 * Eastern, a day and a week before its date (NT-43).
 */
export function reminderTimes(event: Pick<SnapshotV2Event, "start" | "allDay">): {
  day: Date;
  week: Date;
} {
  const date = easternDate(event.start);
  if (event.allDay)
    return {
      day: easternAt(addDays(date, -1), ALL_DAY_MINUTES),
      week: easternAt(addDays(date, -7), ALL_DAY_MINUTES),
    };
  return {
    day: new Date(Date.parse(event.start) - 24 * 60 * 60_000),
    week: easternAt(addDays(date, -7), easternMinutes(event.start)),
  };
}

/**
 * The reminders that came due after `from` and up to `to`, for the published schedule: one
 * per event and time, to the event's own list, its class's and, for a study program's
 * session, its program's, as one message, so a phone on two of them gets one (NT-45). An
 * event over several days is one event, reminded before its start (NT-43). "Tomorrow:
 * {title}" waits for a phone that is off until the event starts, "In a week: {title}" for a
 * day (NT-45, NT-46).
 */
export function eventRemindersDue(schedule: SnapshotV2, from: Date, to: Date): Reminder[] {
  const due = (at: Date) => at.getTime() > from.getTime() && at.getTime() <= to.getTime();
  const reminders: Reminder[] = [];
  for (const event of schedule.events) {
    const times = reminderTimes(event);
    if (!due(times.day) && !due(times.week)) continue;
    const program = eventProgram(event, schedule.site.programs);
    const lists: NotifyList[] = [
      classList(event.classId),
      eventList(event.id),
      ...(program ? [programList(program.id)] : []),
    ];
    const place =
      eventPlace(event, schedule.site)?.name ??
      (event.location?.online === true || event.online !== null ? "Online" : null);
    const body = `${eventWhen(event, { zone: "Eastern" })}${place ? ` · ${place}` : ""}`;
    const note = { body, url: dayAddress(event.start), tag: event.id };
    const add = (kind: Reminder["kind"], at: Date, title: string, expires: Date) => {
      reminders.push({
        kind,
        eventId: event.id,
        title: event.title,
        due: at,
        lists,
        send: fcmSend(lists, { title, ...note }, expires, to),
      });
    };
    if (due(times.day)) add("day", times.day, `Tomorrow: ${event.title}`, new Date(event.start));
    if (due(times.week) && !isWeekly(followFor(event, schedule.events, schedule.site.programs)))
      add(
        "week",
        times.week,
        `In a week: ${event.title}`,
        new Date(times.week.getTime() + WEEK_WAITS_MS),
      );
  }
  return reminders.sort((a, b) => a.due.getTime() - b.due.getTime());
}
