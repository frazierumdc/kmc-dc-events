import { eventKind, type SnapshotV2Event } from "@kmcdc/domain";
import { describe, expect, test } from "vitest";
import type { DayEntry } from "./days.ts";
import { eventRow } from "./rows.ts";
import { golden, goldenEvent } from "../../test/schedule.ts";

const row = (e: SnapshotV2Event, over: Partial<DayEntry> = {}) =>
  eventRow(
    {
      event: e,
      allDay: e.allDay,
      day: null,
      kind: eventKind(e.categories, golden.snapshot.site.categoryKinds),
      alsoClass: false,
      tone: null,
      ...over,
    },
    golden.snapshot.site,
  );
const rest = goldenEvent("Tuesday Rest and Reflect");

describe("the second line (EV-11)", () => {
  test("the time span; the center by its short name", () => {
    expect(row(rest)).toMatchObject({
      time: "6:00 PM",
      title: "Tuesday Rest and Reflect",
      detail: "6:00 PM to 6:30 PM",
      place: "KMC DC",
      online: false,
      label: "6:00 PM, Tuesday Rest and Reflect, Classes, 6:00 PM to 6:30 PM, at KMC DC",
    });
  });

  test("a day of a multi-day event says which day it is (D31)", () => {
    const festival = goldenEvent("International Fall Festival");
    expect(row(festival, { allDay: false, day: { n: 1, of: 7 } })).toMatchObject({
      time: "7:30 PM",
      kind: "special",
      place: "Málaga",
      detail: "Day 1 of 7",
      label: "7:30 PM, International Fall Festival, Special, Day 1 of 7, in Málaga",
    });
    expect(row(festival, { allDay: true, day: { n: 2, of: 7 } })).toMatchObject({
      time: "All day",
      detail: "Day 2 of 7",
    });
  });

  test("no end, or an all-day event on one day: no second line", () => {
    expect(row({ ...rest, end: null }).detail).toBeNull();
    const allDay = {
      ...rest,
      start: "2026-10-14T00:00:00-04:00",
      end: "2026-10-15T00:00:00-04:00",
      allDay: true,
    };
    expect(row(allDay)).toMatchObject({ time: "All day", detail: null });
  });
});

describe("the where line (EV-11, D46)", () => {
  const livestream = {
    type: "livestream" as const,
    page: "https://www.example.org/online-classes",
  };

  test("another city by name; the center's city, in any case, as KMC DC", () => {
    const richmond = row(goldenEvent("Richmond Meditation Class"));
    expect(richmond.place).toBe("Richmond");
    expect(richmond.label).toBe(
      "7:00 PM, Richmond Meditation Class, Classes, 7:00 PM to 8:00 PM, in Richmond",
    );
    const dc = { ...rest, location: rest.location && { ...rest.location, city: "WASHINGTON" } };
    expect(row(dc).place).toBe("KMC DC");
  });

  test("Online beside the place for an event that can also be attended online", () => {
    expect(row({ ...rest, online: livestream })).toMatchObject({
      place: "KMC DC",
      online: true,
      label:
        "6:00 PM, Tuesday Rest and Reflect, Classes, 6:00 PM to 6:30 PM, at KMC DC, also online",
    });
  });

  test("the online icon alone marks a festival abroad as also online", () => {
    const festival = goldenEvent("International Fall Festival", { online: { type: "iconOnly" } });
    expect(row(festival, { allDay: true, day: { n: 5, of: 7 } })).toMatchObject({
      place: "Málaga",
      online: true,
      label: "All day, International Fall Festival, Special, Day 5 of 7, in Málaga, also online",
    });
  });

  test("an online event: Online alone", () => {
    const online = row(goldenEvent("Online: Silent Saturday: A Heart of Gratitude"));
    expect([online.online, online.place]).toEqual([true, null]);
    expect(online.label).toBe(
      "10:00 AM, Online: Silent Saturday: A Heart of Gratitude, Special, 10:00 AM to 1:00 PM, Online",
    );
  });

  test("no city: the venue's name; no location: nothing", () => {
    const noCity = { ...rest, location: rest.location && { ...rest.location, city: null } };
    expect(row(noCity).place).toBe(rest.location?.name);
    const blank = {
      ...rest,
      location: rest.location && { ...rest.location, city: null, name: " " },
    };
    expect(row(blank).place).toBeNull();
    expect(row({ ...rest, location: null })).toMatchObject({ place: null, online: false });
  });

  test("an event with no kind has no kind in its name", () => {
    const cherishing = row(goldenEvent("Center Cherishing"));
    expect(cherishing.kind).toBeNull();
    expect(cherishing.label).not.toMatch(/Classes|Special|Prayers/);
  });
});

// The event's picture (EV-11, D7): its thumbnail on the app's own site, never Wix's address.
test("a row has its event's picture as a thumbnail on the site; none without one", () => {
  const picture =
    "https://static.wixstatic.com/media/7399f8_97e14fcb0db643238b516beb9f20839f~mv2.jpg";
  expect(row({ ...rest, picture }).picture).toMatch(
    /^\/v2\/feed\/pictures\/[0-9a-f]{16}-256\.jpg$/,
  );
  expect(row({ ...rest, picture: null }).picture).toBeNull();
});
