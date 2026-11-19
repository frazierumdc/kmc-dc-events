import { scheduleChanges, SnapshotV2, type SnapshotV2Event } from "@kmcdc/domain";
import { expect, test } from "vitest";
import golden from "@kmcdc/domain/golden/snapshot-v2.json" with { type: "json" };
import { changesMarkdown } from "./schedule-changes.ts";

// The update job's summary (data-pipeline.md step 6); the comparison itself is tested in
// packages/domain.

const before = SnapshotV2.parse(golden);
const NOW = new Date("2026-10-09T15:00:00Z");
const byTitle = (title: string): SnapshotV2Event => {
  const e = before.events.find((x) => x.title === title);
  if (!e) throw new Error(title);
  return e;
};
const withEvents = (events: SnapshotV2Event[]): SnapshotV2 => ({ ...before, events });

test("the same schedule has no changes", () => {
  const c = scheduleChanges(before, before, NOW);
  expect(changesMarkdown(c, before, NOW)).toEqual(["No changes on the website."]);
});

test("no published schedule: the first one", () => {
  const c = scheduleChanges(null, before, NOW);
  expect(changesMarkdown(c, before, NOW)).toEqual(["First schedule: 8 events."]);
});

test("new, removed, date or time changed, and other details, by id", () => {
  const weekly = byTitle("Tuesday Rest and Reflect");
  const prayer = byTitle("Wishfulfilling Jewel with Tsog");
  const study = byTitle("The Foundation Program");
  const richmond = byTitle("Richmond Meditation Class");
  const added = { ...weekly, id: "new-id", title: "New Class" };
  const after = withEvents([
    ...before.events
      .filter((e) => e.id !== prayer.id)
      .map((e) =>
        e.id === weekly.id
          ? { ...e, start: "2026-10-13T19:00:00-04:00", end: "2026-10-13T19:30:00-04:00" }
          : e.id === study.id
            ? { ...e, registrationOpen: true, summary: "New" }
            : e.id === richmond.id
              ? {
                  ...e,
                  start: "2026-10-12T20:00:00-04:00",
                  end: "2026-10-12T21:00:00-04:00",
                  page: `${e.page}?x`,
                }
              : e,
      ),
    added,
  ]);
  const c = scheduleChanges(before, after, NOW);
  expect(changesMarkdown(c, after, NOW).join("\n")).toBe(
    [
      "",
      "### Next 7 days",
      "",
      "**New**",
      "",
      "- Tue 13 Oct, 6:00 PM · New Class",
      "",
      "**Date or time changed**",
      "",
      "- Richmond Meditation Class: Mon 12 Oct, 7:00 PM – 8:00 PM → Mon 12 Oct, 8:00 PM – 9:00 PM (also page)",
      "- Tuesday Rest and Reflect: Tue 13 Oct, 6:00 PM – 6:30 PM → Tue 13 Oct, 7:00 PM – 7:30 PM",
      "",
      "### Later",
      "",
      "**Removed**",
      "",
      "- Sun 18 Oct, 5:00 PM · Wishfulfilling Jewel with Tsog",
      "",
      "**Other details changed**",
      "",
      "- Sun 18 Oct, 12:00 PM · The Foundation Program: registrationOpen, summary",
    ].join("\n"),
  );
});

test("events that ended before today are dropped, not removed", () => {
  const later = new Date("2026-10-19T15:00:00Z");
  const after = withEvents(before.events.filter((e) => Date.parse(e.start) > later.getTime()));
  const c = scheduleChanges(before, after, later);
  expect(changesMarkdown(c, after, later)).toEqual([
    "No changes on the website.",
    "7 finished events dropped.",
  ]);
});
