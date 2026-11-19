import { expect, test } from "vitest";
import fixture from "../fixtures/duplicates-2026-10-16.json" with { type: "json" };
import { findDuplicates } from "./duplicates.ts";
import { SnapshotV2Event } from "./website.ts";

// Real events from the dev schedule of 16 Oct 2026 (the fixture's note says which).
const events = fixture.events.map((e) => SnapshotV2Event.parse(e));
const byTitle = (title: string) => {
  const e = events.find((x) => x.title === title);
  if (!e) throw new Error(title);
  return e;
};
const summary = (groups: { start: string; events: { title: string }[] }[]) =>
  groups.map((g) => `${g.start} ${g.events.map((e) => e.title).join(" | ")}`);

test("the real schedule: 10 events listed twice and 1 clash (AN-13)", () => {
  const { duplicates, clashes } = findDuplicates(events);
  expect(summary(duplicates)).toEqual([
    "2026-11-22T10:00:00-05:00 Sunday Morning Meditation | Sunday Morning Meditation",
    "2026-12-02T19:00:00-05:00 Wednesday Step by Step Meditation | Wednesday Step by Step Meditation",
    "2026-12-06T10:00:00-05:00 Sunday Morning Meditation | Sunday Morning Meditation",
    "2026-12-09T19:00:00-05:00 Wednesday Step by Step Meditation | Wednesday Step by Step Meditation",
    "2026-12-16T19:00:00-05:00 Wednesday Step by Step Meditation | Wednesday Step by Step Meditation",
    "2027-01-06T19:00:00-05:00 Wednesday Step by Step Meditation | Wednesday Step by Step Meditation",
    "2027-01-13T19:00:00-05:00 Wednesday Step by Step Meditation | Wednesday Step by Step Meditation",
    "2027-01-20T19:00:00-05:00 Wednesday Step by Step Meditation | Wednesday Step by Step Meditation",
    "2027-01-27T19:00:00-05:00 Wednesday Step by Step Meditation | Wednesday Step by Step Meditation",
    "2027-02-03T19:00:00-05:00 Wednesday Step by Step Meditation | Wednesday Step by Step Meditation",
  ]);
  expect(summary(clashes)).toEqual([
    "2026-11-29T10:00:00-05:00 Special Sunday Morning Meditation: From Judgement to Compassion with Teacher E. Example | Sunday Morning Meditation",
  ]);
  // Each listing keeps its own page, so the email can link to every copy.
  const first = duplicates[0]?.events.map((e) => e.page);
  expect(new Set(first).size).toBe(2);
});

test("the same time in two places is neither", () => {
  const monday = events.filter((e) => e.start === "2026-10-19T19:00:00-04:00");
  expect(monday.map((e) => e.location?.city).sort()).toEqual(["Richmond", "Washington"]);
  expect(findDuplicates(monday)).toEqual({ duplicates: [], clashes: [] });
});

test("an event listed once is neither", () => {
  const once = [byTitle("Monday Meditation Class")];
  expect(findDuplicates(once)).toEqual({ duplicates: [], clashes: [] });
});

// Hand-made variants of real events, for cases the schedule doesn't have today.
test("titles match ignoring capitals and spacing", () => {
  const e = byTitle("Monday Meditation Class");
  const copy = { ...e, id: "copy", title: "  monday  meditation CLASS " };
  expect(findDuplicates([e, copy]).duplicates).toHaveLength(1);
});

test("the place is the address, whatever the venue is called", () => {
  const e = byTitle("Monday Meditation Class");
  if (!e.location) throw new Error("no location");
  const renamed = { ...e, id: "copy", location: { ...e.location, name: "1200 Canal St SW" } };
  expect(findDuplicates([e, renamed]).duplicates).toHaveLength(1);
});

test("events with no place aren't compared", () => {
  const e = { ...byTitle("Monday Meditation Class"), location: null };
  expect(findDuplicates([e, { ...e, id: "copy" }])).toEqual({ duplicates: [], clashes: [] });
});

test("a time and place with a duplicate and another event is both", () => {
  const e = byTitle("Monday Meditation Class");
  const other = { ...e, id: "other", title: "Another Class" };
  const { duplicates, clashes } = findDuplicates([e, { ...e, id: "copy" }, other]);
  expect(summary(duplicates)).toEqual([
    "2026-10-19T19:00:00-04:00 Monday Meditation Class | Monday Meditation Class",
  ]);
  expect(summary(clashes)).toEqual([
    "2026-10-19T19:00:00-04:00 Another Class | Monday Meditation Class",
  ]);
});
