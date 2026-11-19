import type { SnapshotV2Event } from "@kmcdc/domain";
import { describe, expect, test } from "vitest";
import { eventIdFromPath, eventPath } from "./event-route.ts";
import { eventSheet, eventWhen } from "./sheet.ts";
import { goldenEvent } from "../../test/schedule.ts";

const rest = goldenEvent("Tuesday Rest and Reflect");
const at = (over: Partial<SnapshotV2Event>) => ({ ...rest, ...over });

describe("When (EV-31)", () => {
  test("full date with its year, then the times in Eastern", () => {
    expect(eventWhen(rest)).toEqual(["Tuesday, October 13, 2026", "6:00 PM to 6:30 PM Eastern"]);
    expect(eventWhen(at({ end: null }))).toEqual(["Tuesday, October 13, 2026", "6:00 PM Eastern"]);
  });

  test("a multi-day event says when it ends, with its year", () => {
    expect(eventWhen(goldenEvent("International Fall Festival"))).toEqual([
      "Friday, October 9, 2026 at 7:30 PM",
      "to Thursday, October 15, 2026 at 12:00 PM Eastern",
    ]);
    const newYear = at({ start: "2026-12-30T19:00:00-05:00", end: "2027-01-02T12:00:00-05:00" });
    expect(eventWhen(newYear)).toEqual([
      "Wednesday, December 30, 2026 at 7:00 PM",
      "to Saturday, January 2, 2027 at 12:00 PM Eastern",
    ]);
  });

  test("an evening past midnight stays one day", () => {
    const late = at({ start: "2026-12-31T21:00:00-05:00", end: "2027-01-01T00:30:00-05:00" });
    expect(eventWhen(late)).toEqual(["Thursday, December 31, 2026", "9:00 PM to 12:30 AM Eastern"]);
  });

  test("all-day events, on one day or several", () => {
    const one = {
      allDay: true,
      start: "2026-11-08T00:00:00-05:00",
      end: "2026-11-08T23:59:00-05:00",
    };
    expect(eventWhen(at(one))).toEqual(["Sunday, November 8, 2026", "All day"]);
    const three = { ...one, end: "2026-11-10T23:59:00-05:00" };
    expect(eventWhen(at(three))).toEqual([
      "Sunday, November 8, 2026 to Tuesday, November 10, 2026",
      "All day",
    ]);
    const span = { ...one, start: "2026-12-31T00:00:00-05:00", end: "2027-01-01T23:59:00-05:00" };
    expect(eventWhen(at(span))).toEqual([
      "Thursday, December 31, 2026 to Friday, January 1, 2027",
      "All day",
    ]);
  });
});

describe("Where (EV-32)", () => {
  test("the place's name and address as the website has them", () => {
    expect(eventSheet(rest).where).toEqual({
      online: false,
      lines: ["Kadampa Meditation Center DC", "1200 Canal St SW, Washington, DC 20024, USA"],
    });
    expect(eventSheet(goldenEvent("Richmond Meditation Class")).where.lines[0]).toBe(
      "Diversity Thrift",
    );
  });

  test("the name isn't repeated in the address; no place, no lines", () => {
    const place = {
      online: false,
      name: "1200 Canal St SW",
      address: "1200 Canal St SW",
      city: null,
      geo: null,
    };
    expect(eventSheet(at({ location: place })).where.lines).toEqual(["1200 Canal St SW"]);
    const street = { ...place, address: "1200 Canal St SW, Washington, DC 20024, USA" };
    expect(eventSheet(at({ location: street })).where.lines).toEqual([
      "1200 Canal St SW",
      "Washington, DC 20024, USA",
    ]);
    expect(eventSheet(at({ location: null })).where).toEqual({ online: false, lines: [] });
  });

  test("online events say Online", () => {
    expect(eventSheet(goldenEvent("Online: Silent Saturday: A Heart of Gratitude")).where).toEqual({
      online: true,
      lines: ["Online"],
    });
  });
});

describe("categories and description (EV-30, EV-33)", () => {
  test("the website's categories as text; none when it has none", () => {
    expect(eventSheet(rest).categories).toBe("Weekly Meditation Classes");
    expect(
      eventSheet(at({ categories: ["Chanted Prayers", "Retreats & Special Events"] })).categories,
    ).toBe("Chanted Prayers · Retreats & Special Events");
    expect(eventSheet(goldenEvent("Center Cherishing")).categories).toBeNull();
  });

  test("the full description, else the summary, else none", () => {
    expect(eventSheet(rest).description).toMatch(/^With Buddhist Teacher/);
    expect(eventSheet(goldenEvent("The Foundation Program")).description).toBe(
      goldenEvent("The Foundation Program").summary,
    );
    expect(eventSheet(at({ description: " ", summary: null })).description).toBeNull();
  });
});

test("an event's address and back (EV-37)", () => {
  const id = "3efe9c7a-d27a-480c-912b-3ba7ed7de483";
  expect(eventPath(id)).toBe(`/e/${id}`);
  expect(eventIdFromPath(`/e/${id}`)).toBe(id);
  expect(eventIdFromPath(`/e/${id}/`)).toBe(id);
  expect(eventIdFromPath("/e/not/an/id")).toBeNull();
  expect(eventIdFromPath("/e/<script>")).toBeNull();
  expect(eventIdFromPath("/")).toBeNull();
});
