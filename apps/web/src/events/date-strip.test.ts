import { expect, test } from "vitest";
import { dateStrip } from "./date-strip.ts";
import { upcomingDays } from "./days.ts";
import { golden, goldenEvent } from "../../test/schedule.ts";

const KINDS = golden.snapshot.site.categoryKinds;
const days = upcomingDays(golden.snapshot.events, new Date("2026-10-13T12:00:00Z"), KINDS);

test("every date from today to the last event, with months and years (EV-13)", () => {
  const strip = dateStrip(days, "all", "2026-10-13");
  expect(strip[0]).toEqual({
    date: "2026-10-13",
    weekday: "Tue",
    day: "13",
    month: "Oct 2026",
    isToday: true,
    dots: ["class", "special"],
    count: 2,
    label: "Tuesday, October 13, 2026, 2 events",
  });
  expect(strip.at(-1)?.date).toBe("2026-11-08");
  expect(strip).toHaveLength(27);
  expect(strip.filter((d) => d.month).map((d) => [d.date, d.month])).toEqual([
    ["2026-10-13", "Oct 2026"],
    ["2026-11-01", "Nov 2026"],
  ]);
  expect(strip.find((d) => d.date === "2026-10-16")).toMatchObject({
    dots: [],
    count: 0,
    label: "Friday, October 16, 2026, no events",
    isToday: false,
  });
});

test("one dot per kind on the day, in a fixed order; dots and counts follow the filter", () => {
  const prayers = dateStrip(days, "prayer", "2026-10-13");
  expect(prayers).toHaveLength(27); // the dates stay put when the filter changes
  expect(prayers.find((d) => d.date === "2026-10-18")).toMatchObject({
    dots: ["prayer"],
    label: "Sunday, October 18, 2026, 1 event",
  });
  const busy = upcomingDays(
    Array.from({ length: 5 }, (_, i) =>
      goldenEvent("Tuesday Rest and Reflect", { id: `x${String(i)}` }),
    ),
    new Date("2026-10-13T12:00:00Z"),
    KINDS,
  );
  expect(dateStrip(busy, "all", "2026-10-13")[0]).toMatchObject({
    count: 5,
    dots: ["class"],
    label: "Tuesday, October 13, 2026, 5 events",
  });
  const mixed = upcomingDays(
    [
      goldenEvent("Wishfulfilling Jewel with Tsog", {
        id: "p1",
        start: "2026-10-13T08:00:00-04:00",
        end: null,
      }),
      goldenEvent("Wishfulfilling Jewel with Tsog", {
        id: "p2",
        start: "2026-10-13T09:00:00-04:00",
        end: null,
      }),
      goldenEvent("Center Cherishing", { id: "n1", start: "2026-10-13T10:00:00-04:00", end: null }),
      goldenEvent("Tuesday Rest and Reflect", { id: "c1" }),
    ],
    new Date("2026-10-13T11:00:00Z"),
    KINDS,
  );
  expect(dateStrip(mixed, "all", "2026-10-13")[0]?.dots).toEqual(["class", "prayer"]);
  expect(dateStrip(mixed, "prayer", "2026-10-13")[0]?.dots).toEqual(["prayer"]);
  const kindless = upcomingDays(
    [goldenEvent("Center Cherishing", { id: "n2", start: "2026-10-13T10:00:00-04:00", end: null })],
    new Date("2026-10-13T11:00:00Z"),
    KINDS,
  );
  expect(dateStrip(kindless, "all", "2026-10-13")[0]?.dots).toEqual([null]);
});

test("no events, no dates", () => {
  expect(dateStrip([], "all", "2026-10-13")).toEqual([]);
});

test("the new year shows over January 1, and dates are read with their year (EV-13)", () => {
  const strip = dateStrip([{ date: "2027-01-02", entries: [] }], "all", "2026-12-30");
  expect(strip.map((d) => d.month)).toEqual(["Dec 2026", null, "Jan 2027", null]);
  expect(strip[1]?.label).toBe("Thursday, December 31, 2026, no events");
  expect(strip[2]?.label).toBe("Friday, January 1, 2027, no events");
});
