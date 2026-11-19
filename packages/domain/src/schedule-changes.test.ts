import { expect, test } from "vitest";
import golden from "../golden/snapshot-v2.json" with { type: "json" };
import {
  changeCount,
  hasWebsiteChanges,
  scheduleChanges,
  upcomingChanges,
} from "./schedule-changes.ts";
import { SnapshotV2, type SnapshotV2Event } from "./website.ts";

const before = SnapshotV2.parse(golden);
const NOW = new Date("2026-10-09T15:00:00Z");
const byTitle = (title: string): SnapshotV2Event => {
  const e = before.events.find((x) => x.title === title);
  if (!e) throw new Error(title);
  return e;
};
const withEvents = (events: SnapshotV2Event[]): SnapshotV2 => ({ ...before, events });
/** `before` with each listed event changed by `edit`, the rest as they were. */
const editing = (edits: Record<string, (e: SnapshotV2Event) => SnapshotV2Event>) =>
  withEvents(before.events.map((e) => edits[e.title]?.(e) ?? e));

test("the same schedule has no changes", () => {
  const c = scheduleChanges(before, before, NOW);
  expect(hasWebsiteChanges(c)).toBe(false);
  expect(changeCount(upcomingChanges(before, before, NOW))).toBe(0);
});

test("no earlier schedule: the first one", () => {
  const c = scheduleChanges(null, before, NOW);
  expect([c.first, c.added.length, hasWebsiteChanges(c)]).toEqual([true, 0, true]);
});

test("new, removed, date or time changed, and other details, by id", () => {
  const prayer = byTitle("Wishfulfilling Jewel with Tsog");
  const added = { ...byTitle("Tuesday Rest and Reflect"), id: "new-id", title: "New Class" };
  const after = withEvents([
    ...editing({
      "Tuesday Rest and Reflect": (e) => ({
        ...e,
        start: "2026-10-13T19:00:00-04:00",
        end: "2026-10-13T19:30:00-04:00",
      }),
      "The Foundation Program": (e) => ({ ...e, registrationOpen: true, summary: "New" }),
      "Richmond Meditation Class": (e) => ({
        ...e,
        start: "2026-10-12T20:00:00-04:00",
        end: "2026-10-12T21:00:00-04:00",
        page: `${e.page}?x`,
      }),
    }).events.filter((e) => e.id !== prayer.id),
    added,
  ]);
  const c = scheduleChanges(before, after, NOW);
  expect(c.added.map((e) => e.id)).toEqual(["new-id"]);
  expect(c.removed.map((e) => e.id)).toEqual([prayer.id]);
  expect(c.moved.map((m) => [m.after.title, m.fields])).toEqual([
    ["Richmond Meditation Class", ["page"]],
    ["Tuesday Rest and Reflect", []],
  ]);
  expect(c.edited.map((m) => [m.after.title, m.fields])).toEqual([
    ["The Foundation Program", ["registrationOpen", "summary"]],
  ]);
});

test("events that ended before today are dropped, not removed", () => {
  const later = new Date("2026-10-19T15:00:00Z");
  const after = withEvents(before.events.filter((e) => Date.parse(e.start) > later.getTime()));
  const c = scheduleChanges(before, after, later);
  expect([c.removed.length, c.finished]).toEqual([0, 7]);
  expect(hasWebsiteChanges(c)).toBe(false);
});

test("a site settings change counts for the update job", () => {
  const site = { ...before.site, homeCity: "Arlington" };
  const c = scheduleChanges(before, { ...before, site }, NOW);
  expect([c.siteChanged, hasWebsiteChanges(c)]).toEqual([true, true]);
});

// ---- What the reader is told (EV-19) ----

test("the reader hears of new dates and times, removed and new events, not edited details", () => {
  const prayer = byTitle("Wishfulfilling Jewel with Tsog");
  const after = withEvents([
    ...editing({
      "Silent Saturday Retreat - A Heart of Gratitude": (e) => ({
        ...e,
        start: "2026-11-07T10:00:00-05:00",
        end: "2026-11-07T13:00:00-05:00",
      }),
      "Center Cherishing": (e) => ({ ...e, description: `${e.description ?? ""} Bring a friend.` }),
    }).events.filter((e) => e.id !== prayer.id),
    { ...byTitle("The Foundation Program"), id: "new-id", title: "New Program" },
  ]);
  const c = upcomingChanges(before, after, NOW);
  expect(c.moved.map((m) => [m.before.start, m.after.start])).toEqual([
    ["2026-10-17T10:00:00-04:00", "2026-11-07T10:00:00-05:00"],
  ]);
  expect(c.removed.map((e) => e.title)).toEqual(["Wishfulfilling Jewel with Tsog"]);
  expect(c.added.map((e) => e.title)).toEqual(["New Program"]);
  expect(c).not.toHaveProperty("edited");
  expect(changeCount(c)).toBe(3);
});

test("a new end time alone is told; details alone are not (EV-19)", () => {
  const later = editing({
    "Center Cherishing": (e) => ({ ...e, end: "2026-11-08T18:00:00-05:00" }),
  });
  expect(upcomingChanges(before, later, NOW).moved.map((m) => m.after.title)).toEqual([
    "Center Cherishing",
  ]);
  const details = editing({
    "Center Cherishing": (e) => ({ ...e, title: "Center Cherishing Day", description: "New." }),
  });
  expect(scheduleChanges(before, details, NOW).edited).toHaveLength(1);
  expect(changeCount(upcomingChanges(before, details, NOW))).toBe(0);
});

test("nothing to tell when only finished events dropped off or the site settings changed", () => {
  // Monday evening: the Richmond class has finished; the festival hasn't.
  const monday = new Date("2026-10-13T01:00:00Z");
  const richmond = byTitle("Richmond Meditation Class");
  const site = { ...before.site, homeCity: "Arlington" };
  const after = { ...withEvents(before.events.filter((e) => e.id !== richmond.id)), site };
  expect(changeCount(upcomingChanges(before, after, monday))).toBe(0);
});

test("changes to events that have already finished aren't told", () => {
  const monday = new Date("2026-10-13T01:00:00Z");
  const after = editing({
    "Richmond Meditation Class": (e) => ({ ...e, start: "2026-10-12T19:30:00-04:00" }),
    "International Fall Festival": (e) => ({ ...e, end: "2026-10-16T12:00:00-04:00" }),
  });
  const c = upcomingChanges(before, after, monday);
  expect(c.moved.map((m) => m.after.title)).toEqual(["International Fall Festival"]);
  const edited = editing({
    "Richmond Meditation Class": (e) => ({ ...e, description: "Changed." }),
  });
  expect(changeCount(upcomingChanges(before, edited, monday))).toBe(0);
});
