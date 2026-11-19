import type { SnapshotV2Event } from "@kmcdc/domain";
import { describe, expect, test } from "vitest";
import {
  KIND_FILTERS,
  currentFilter,
  dayHeading,
  filterDays,
  findListed,
  upcomingDays,
} from "./days.ts";
import { golden, goldenEvent } from "../../test/schedule.ts";

const events = golden.snapshot.events;
const KINDS = golden.snapshot.site.categoryKinds;
const event = (over: Partial<SnapshotV2Event>) => goldenEvent("Tuesday Rest and Reflect", over);
const titles = (now: string, list: readonly SnapshotV2Event[] = events) =>
  upcomingDays(list, new Date(now), KINDS).map((d) => [
    d.date,
    d.entries.map((e) => (e.allDay ? `All day: ${e.event.title}` : e.event.title)),
  ]);

test("by Eastern date; finished events drop off; online events listed as the website lists them", () => {
  // Tuesday 13 October, 8 AM Eastern: Monday's Richmond class has finished.
  expect(titles("2026-10-13T12:00:00Z").slice(0, 4)).toEqual([
    ["2026-10-13", ["All day: International Fall Festival", "Tuesday Rest and Reflect"]],
    ["2026-10-14", ["All day: International Fall Festival"]],
    ["2026-10-15", ["All day: International Fall Festival"]],
    [
      "2026-10-17",
      [
        "Online: Silent Saturday: A Heart of Gratitude",
        "Silent Saturday Retreat - A Heart of Gratitude",
      ],
    ],
  ]);
});

test("a multi-day event is on each of its days: the first at its start time, then all-day (D31)", () => {
  const festival = [goldenEvent("International Fall Festival")];
  const [first, second] = upcomingDays(festival, new Date("2026-10-09T12:00:00Z"), KINDS);
  expect(first?.entries[0]).toMatchObject({ allDay: false, day: { n: 1, of: 7 } });
  expect(second?.entries[0]).toMatchObject({ allDay: true, day: { n: 2, of: 7 } });
  // From a later day, it still counts its days from its start.
  const [later] = upcomingDays(festival, new Date("2026-10-13T12:00:00Z"), KINDS);
  expect(later?.entries[0]?.day).toEqual({ n: 5, of: 7 });
  expect(titles("2026-10-09T12:00:00Z", festival).map(([date]) => date)).toEqual([
    "2026-10-09",
    "2026-10-10",
    "2026-10-11",
    "2026-10-12",
    "2026-10-13",
    "2026-10-14",
    "2026-10-15",
  ]);
  // It ends at noon on the 15th.
  expect(titles("2026-10-15T15:59:00Z", festival)).toHaveLength(1);
  expect(titles("2026-10-15T16:00:00Z", festival)).toEqual([]);
});

test("an evening that ran past midnight is under today, at its time", () => {
  const late = event({
    title: "Late",
    start: "2026-10-12T23:00:00-04:00",
    end: "2026-10-13T01:00:00-04:00",
  });
  expect(titles("2026-10-13T04:30:00Z", [late])).toEqual([["2026-10-13", ["Late"]]]);
});

test("an event drops off when it ends; with no end, an hour after it starts", () => {
  const rest = event({ end: "2026-10-13T18:30:00-04:00" });
  expect(titles("2026-10-13T22:29:00Z", [rest])).toHaveLength(1);
  expect(titles("2026-10-13T22:30:00Z", [rest])).toEqual([]);
  const open = event({ end: null });
  expect(titles("2026-10-13T22:59:00Z", [open])).toHaveLength(1);
  expect(titles("2026-10-13T23:00:00Z", [open])).toEqual([]);
});

test("an evening event stays on its Eastern day, after the clock change too", () => {
  const late = event({ title: "Late", start: "2026-11-02T23:30:00-05:00", end: null });
  expect(titles("2026-11-02T12:00:00Z", [late])).toEqual([["2026-11-02", ["Late"]]]);
});

test("all-day events first, then by start time, then by title", () => {
  const list = [
    event({ title: "Evening", start: "2026-10-14T19:00:00-04:00", end: null }),
    event({ title: "Morning B", start: "2026-10-14T07:00:00-04:00", end: null }),
    event({ title: "Morning A", start: "2026-10-14T07:00:00-04:00", end: null }),
    event({
      title: "Whole day",
      start: "2026-10-14T00:00:00-04:00",
      end: "2026-10-15T00:00:00-04:00",
      allDay: true,
    }),
  ];
  expect(titles("2026-10-13T12:00:00Z", list)).toEqual([
    ["2026-10-14", ["All day: Whole day", "Morning A", "Morning B", "Evening"]],
  ]);
});

test("day headings say Today and Tomorrow, then the weekday, each with its year (EV-10)", () => {
  expect(dayHeading("2026-10-13", "2026-10-13")).toBe("Today, October 13, 2026");
  expect(dayHeading("2026-10-14", "2026-10-13")).toBe("Tomorrow, October 14, 2026");
  expect(dayHeading("2026-10-15", "2026-10-13")).toBe("Thursday, October 15, 2026");
  expect(dayHeading("2027-01-01", "2026-12-31")).toBe("Tomorrow, January 1, 2027");
  expect(dayHeading("2027-01-08", "2026-12-31")).toBe("Friday, January 8, 2027");
});

describe("the kind filter (EV-12)", () => {
  const days = upcomingDays(events, new Date("2026-10-13T12:00:00Z"), KINDS);

  test("choices: always All, Classes, Special, Prayers (D45)", () => {
    expect(KIND_FILTERS.map((f) => f.label)).toEqual(["All", "Classes", "Special", "Prayers"]);
  });

  test("a remembered choice the app doesn't offer shows as All (EV-15)", () => {
    expect(currentFilter("special")).toBe("special");
    expect(currentFilter("Chanted Prayers")).toBe("all"); // a website category, kept by 4a
    expect(currentFilter("")).toBe("all");
  });

  test("each event has its categories' kind; one with none is only under All", () => {
    const kinds = days.flatMap((d) => d.entries.map((e) => [e.event.title, e.kind]));
    expect(Object.fromEntries(kinds)).toEqual({
      "International Fall Festival": "special",
      "Tuesday Rest and Reflect": "class",
      "Online: Silent Saturday: A Heart of Gratitude": "special",
      "Silent Saturday Retreat - A Heart of Gratitude": "special",
      "The Foundation Program": "class",
      "Wishfulfilling Jewel with Tsog": "prayer",
      "Center Cherishing": null,
    });
    const shown = (filter: "class" | "special" | "prayer") =>
      filterDays(days, filter).flatMap((d) => d.entries.map((e) => e.event.title));
    expect([...shown("class"), ...shown("special"), ...shown("prayer")]).not.toContain(
      "Center Cherishing",
    );
  });

  test("the filter keeps matching events and drops empty days", () => {
    expect(filterDays(days, "all")).toEqual(days);
    expect(filterDays(days, "prayer").map((d) => d.date)).toEqual(["2026-10-18"]);
    expect(
      filterDays(days, "special")
        .find((d) => d.date === "2026-10-17")
        ?.entries.map((e) => e.event.title),
    ).toEqual([
      "Online: Silent Saturday: A Heart of Gratitude",
      "Silent Saturday Retreat - A Heart of Gratitude",
    ]);
  });

  test("a special event the website also lists as a weekly class is under Classes too, still special (D45)", () => {
    // As the website lists 29 November 2026's special Sunday morning meditation.
    const special = event({
      id: "special-sunday",
      title: "Special Sunday Morning Meditation",
      categories: ["Weekly Meditation Classes", "Retreats & Special Events"],
    });
    const listed = upcomingDays([special], new Date("2026-10-13T12:00:00Z"), KINDS);
    const entry = listed[0]?.entries[0];
    expect(entry).toMatchObject({ kind: "special", alsoClass: true, tone: null });
    const under = (filter: "class" | "special" | "prayer") =>
      filterDays(listed, filter).flatMap((d) => d.entries.map((e) => e.event.id));
    expect(under("class")).toEqual(["special-sunday"]);
    expect(under("special")).toEqual(["special-sunday"]);
    expect(under("prayer")).toEqual([]);
    // Under All it is listed once.
    expect(filterDays(listed, "all").flatMap((d) => d.entries)).toHaveLength(1);
    expect(days.flatMap((d) => d.entries).every((e) => !e.alsoClass)).toBe(true);
  });

  test("another center's special event is listed in slate, under Special (D67)", () => {
    const retreat = event({
      id: "other-center",
      categories: ["Retreats & Special Events"],
      otherCenter: true,
    });
    const [entry] =
      upcomingDays([retreat], new Date("2026-10-13T12:00:00Z"), KINDS)[0]?.entries ?? [];
    expect(entry).toMatchObject({ kind: "special", tone: "elsewhere" });
  });

  test("an id finds its listed event; an unknown or finished one finds nothing", () => {
    const rest = goldenEvent("Tuesday Rest and Reflect");
    expect(findListed(days, rest.id)?.event.title).toBe("Tuesday Rest and Reflect");
    expect(findListed(days, goldenEvent("Richmond Meditation Class").id)).toBeNull();
    expect(findListed(days, "nope")).toBeNull();
  });

  test("an online event's id opens the event it belongs to (D46)", () => {
    const silent = goldenEvent("Silent Saturday Retreat - A Heart of Gratitude", {
      online: {
        type: "event",
        id: "online-1",
        page: "https://www.example.org/event-details/online-silent-saturday",
        registrationOpen: true,
      },
    });
    const listed = upcomingDays([silent], new Date("2026-10-12T15:00:00Z"), KINDS);
    expect(findListed(listed, "online-1")?.event.id).toBe(silent.id);
  });
});

describe("study programs (AN-15)", () => {
  const programs = [
    {
      id: "fp" as const,
      shortName: "FP",
      category: "Study Programs",
      titles: ["The Foundation Program"],
    },
    {
      id: "ttp" as const,
      shortName: "TTP",
      category: "Study Programs",
      titles: ["Teacher Training Program", "Teacher Training Program (TTP)"],
    },
  ];
  const session = (title: string, categories = ["Study Programs"]) =>
    event({ id: title, title, categories });

  test("a program's session and a branch class carry their own colour; others carry none (D45)", () => {
    const list = [
      session("The Foundation Program"),
      session("teacher training  program (ttp)"),
      session("Study Group"),
      session("The Foundation Program", ["Weekly Meditation Classes"]),
      session("Richmond Meditation Class", ["Richmond Branch Classes"]),
    ];
    const [day] = upcomingDays(list, new Date("2026-10-12T15:00:00Z"), KINDS, programs);
    expect(day?.entries.map((e) => [e.event.title, e.kind, e.tone])).toEqual([
      ["Richmond Meditation Class", "class", "branch"],
      ["Study Group", "class", null],
      ["teacher training  program (ttp)", "class", "program"],
      ["The Foundation Program", "class", "program"],
      ["The Foundation Program", "class", null],
    ]);
  });

  test("a schedule published before programs were: no program colour", () => {
    const [day] = upcomingDays(
      [session("The Foundation Program")],
      new Date("2026-10-12T15:00:00Z"),
      KINDS,
    );
    expect(day?.entries[0]?.tone).toBeNull();
  });
});
