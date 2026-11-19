import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { followFor, isWeekly } from "./follow.ts";
import { reminderTimes, eventRemindersDue, REMINDERS_EVERY_MS } from "./notify-reminders.ts";
import { SnapshotV2, type SnapshotV2Event } from "./website.ts";

// The reminders before an event (NT-40 – NT-46), on the golden schedule's real events, as
// published on 12 October 2026.
const schedule = SnapshotV2.parse(
  JSON.parse(readFileSync(new URL("../golden/snapshot-v2.json", import.meta.url), "utf8")),
);
const byTitle = (title: string) =>
  schedule.events.find((e) => e.title.startsWith(title)) as SnapshotV2Event;
/** The 15 minutes that end at `to`, as the timer's run takes them. */
const run = (to: string, events = schedule) =>
  eventRemindersDue(events, new Date(Date.parse(to) - REMINDERS_EVERY_MS), new Date(to));
const weekly = (e: SnapshotV2Event, events = schedule) =>
  isWeekly(followFor(e, events.events, events.site.programs));
// The golden schedule holds one session of each class; a class held weekly has more, so
// Tuesday Rest and Reflect is given its next two Tuesdays.
const rest = byTitle("Tuesday Rest and Reflect");
const later = (days: number): SnapshotV2Event => ({
  ...rest,
  id: `${rest.id}-${String(days)}`,
  start: new Date(Date.parse(rest.start) + days * 86_400_000).toISOString(),
  end: rest.end && new Date(Date.parse(rest.end) + days * 86_400_000).toISOString(),
});
const withWeekly: SnapshotV2 = { ...schedule, events: [...schedule.events, later(7), later(14)] };

test("a weekly class: one reminder 24 hours before, to its lists as one message (NT-41, NT-45)", () => {
  expect(weekly(rest, withWeekly)).toBe(true);
  // It starts on 13 October at 6 PM Eastern, 22:00 UTC.
  const mine = run("2026-10-12T22:00:00Z", withWeekly).filter((r) => r.eventId === rest.id);
  expect(mine).toHaveLength(1);
  expect(mine[0]).toMatchObject({
    kind: "day",
    lists: [`class-${rest.classId}`, `event-${rest.id}`],
  });
  expect(mine[0]?.send.message).toMatchObject({
    condition: `'class-${rest.classId}' in topics || 'event-${rest.id}' in topics`,
    webpush: {
      // Waits for a phone that is off until the class starts (NT-45).
      headers: { TTL: String(24 * 60 * 60) },
      data: {
        title: "Tomorrow: Tuesday Rest and Reflect",
        body: "Tue, Oct 13, 2026 · 6:00 – 6:30 PM Eastern · KMC DC",
        url: "/?day=2026-10-13",
        tag: rest.id,
      },
    },
  });
});

test("each reminder is due in exactly one run (NT-45)", () => {
  const mine = (to: string) => run(to).filter((r) => r.eventId === rest.id);
  expect(mine("2026-10-12T21:45:00Z")).toEqual([]);
  expect(mine("2026-10-12T22:00:00Z")).toHaveLength(1);
  expect(mine("2026-10-12T22:15:00Z")).toEqual([]);
});

test("a weekly event gets no week-before reminder, only a day before each session (NT-42)", () => {
  const sessions = withWeekly.events.filter((e) => e.classId === rest.classId);
  expect(sessions).toHaveLength(3);
  for (const event of sessions) {
    const { week, day } = reminderTimes(event);
    const kinds = (at: Date) =>
      eventRemindersDue(withWeekly, new Date(at.getTime() - 1), at)
        .filter((r) => r.eventId === event.id)
        .map((r) => r.kind);
    expect(kinds(week)).toEqual([]);
    expect(kinds(day)).toEqual(["day"]);
  }
});

test("an event that isn't weekly: a week before at its start time, and a day before (NT-42)", () => {
  const once = schedule.events.filter((e) => !weekly(e) && !e.allDay);
  expect(once.length).toBeGreaterThan(0);
  for (const event of once) {
    const { week, day } = reminderTimes(event);
    const kinds = (at: Date) =>
      eventRemindersDue(schedule, new Date(at.getTime() - 1), at)
        .filter((r) => r.eventId === event.id)
        .map((r) => r.kind);
    expect(kinds(week), event.title).toEqual(["week"]);
    expect(kinds(day), event.title).toEqual(["day"]);
    const [reminder] = eventRemindersDue(schedule, new Date(week.getTime() - 1), week).filter(
      (r) => r.eventId === event.id,
    );
    expect(reminder?.send.message.webpush.data.title).toBe(`In a week: ${event.title}`);
    // Waits a day for a phone that is off (NT-45).
    expect(reminder?.send.message.webpush.headers.TTL).toBe(String(24 * 60 * 60));
  }
});

test("a week before keeps the start time across a clock change (NT-42)", () => {
  // Clocks go back on 1 November 2026: 7 PM on 4 November is 7 PM on 28 October, an hour
  // less than 7 times 24 hours earlier.
  const { week, day } = reminderTimes({ start: "2026-11-04T19:00:00-05:00", allDay: false });
  expect(week.toISOString()).toBe("2026-10-28T23:00:00.000Z");
  expect(day.toISOString()).toBe("2026-11-04T00:00:00.000Z");
});

test("an all-day event: 9:00 AM Eastern, a day and a week before its date (NT-43)", () => {
  const { week, day } = reminderTimes({ start: "2026-12-12T00:00:00-05:00", allDay: true });
  expect(day.toISOString()).toBe("2026-12-11T14:00:00.000Z");
  expect(week.toISOString()).toBe("2026-12-05T14:00:00.000Z");
});

test("a study program's session goes to its program's list too (NT-13)", () => {
  // The golden schedule predates the programs' settings: given here as data/site.json has them.
  const withPrograms: SnapshotV2 = {
    ...schedule,
    site: {
      ...schedule.site,
      programs: [
        {
          id: "fp",
          shortName: "FP",
          category: "Study Programs",
          titles: ["The Foundation Program"],
        },
      ],
    },
  };
  const session = byTitle("The Foundation Program");
  const at = reminderTimes(session).day;
  const [reminder] = eventRemindersDue(withPrograms, new Date(at.getTime() - 1), at).filter(
    (r) => r.eventId === session.id,
  );
  expect(reminder?.lists).toEqual([
    `class-${session.classId}`,
    `event-${session.id}`,
    "program-fp",
  ]);
});

test("a moved event is reminded before its new time; a cancelled one not at all (NT-44)", () => {
  const moved: SnapshotV2 = {
    ...schedule,
    events: schedule.events.map((e) =>
      e.id === rest.id
        ? { ...e, start: "2026-10-13T19:00:00-04:00", end: "2026-10-13T19:30:00-04:00" }
        : e,
    ),
  };
  const mine = (to: string, events: SnapshotV2) =>
    run(to, events).filter((r) => r.eventId === rest.id);
  expect(mine("2026-10-12T22:00:00Z", moved)).toEqual([]);
  expect(mine("2026-10-12T23:00:00Z", moved)).toHaveLength(1);
  const cancelled = { ...schedule, events: schedule.events.filter((e) => e.id !== rest.id) };
  expect(mine("2026-10-12T22:00:00Z", cancelled)).toEqual([]);
});

test("an online event with no place says Online (NT-46)", () => {
  const online = schedule.events.find((e) => e.location?.online === true);
  if (!online) return;
  const at = reminderTimes(online).day;
  const [reminder] = eventRemindersDue(schedule, new Date(at.getTime() - 1), at).filter(
    (r) => r.eventId === online.id,
  );
  expect(reminder?.send.message.webpush.data.body?.endsWith(" · Online")).toBe(true);
});
