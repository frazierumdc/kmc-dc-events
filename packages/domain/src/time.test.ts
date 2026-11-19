import { describe, expect, test } from "vitest";
import {
  addDays,
  easternDate,
  easternMidnight,
  easternMinutes,
  easternWeekday,
  endedBeforeToday,
  formatEasternDateTime,
  formatEasternShort,
  formatLongDate,
  formatMonthDay,
  formatShortDate,
  formatShortMonthDay,
  formatShortMonth,
  formatShortWeekday,
  formatTime12,
  isAllDay,
  multiDayDates,
  startOfTodayEastern,
  toEasternIso,
} from "./time.ts";

describe("Eastern dates", () => {
  test("an evening in UTC is still the same Eastern day", () => {
    expect(easternDate("2026-10-08T03:30:00Z")).toBe("2026-10-07");
    expect(easternWeekday("2026-10-08T03:30:00Z")).toBe("wed");
    expect(easternMinutes("2026-10-07T23:00:00Z")).toBe(19 * 60);
  });

  test("addDays crosses months and years", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-10-08", 400)).toBe("2027-11-12");
  });
});

describe("clocks fall back on 2026-11-01", () => {
  test("midnight is 4 hours behind UTC that day and 5 the next", () => {
    expect(easternMidnight("2026-11-01")).toBe("2026-11-01T04:00:00.000Z");
    expect(easternMidnight("2026-11-02")).toBe("2026-11-02T05:00:00.000Z");
  });

  test("1:30 AM happens twice, with different offsets", () => {
    expect(toEasternIso("2026-11-01T05:30:00Z")).toBe("2026-11-01T01:30:00-04:00");
    expect(toEasternIso("2026-11-01T06:30:00Z")).toBe("2026-11-01T01:30:00-05:00");
    expect(formatTime12("2026-11-01T06:30:00Z")).toBe("1:30 AM");
  });

  test("a 7 PM class keeps its local time on either side", () => {
    expect(toEasternIso("2026-10-31T23:00:00Z")).toBe("2026-10-31T19:00:00-04:00");
    expect(toEasternIso("2026-11-03T00:00:00Z")).toBe("2026-11-02T19:00:00-05:00");
    expect(formatTime12("2026-11-03T00:00:00Z")).toBe("7:00 PM");
  });

  test("today starts at Eastern midnight, whatever the time of day", () => {
    expect(startOfTodayEastern(new Date("2026-11-01T23:59:00-05:00"))).toBe(
      "2026-11-01T04:00:00.000Z",
    );
  });
});

describe("clocks spring forward on 2027-03-14", () => {
  test("midnight is 5 hours behind UTC that day and 4 the next", () => {
    expect(easternMidnight("2027-03-14")).toBe("2027-03-14T05:00:00.000Z");
    expect(easternMidnight("2027-03-15")).toBe("2027-03-15T04:00:00.000Z");
  });

  test("1:59 AM is followed by 3:00 AM", () => {
    expect(toEasternIso("2027-03-14T06:59:00Z")).toBe("2027-03-14T01:59:00-05:00");
    expect(toEasternIso("2027-03-14T07:00:00Z")).toBe("2027-03-14T03:00:00-04:00");
  });

  test("a 7 PM class keeps its local time on either side", () => {
    expect(toEasternIso("2027-03-14T00:00:00Z")).toBe("2027-03-13T19:00:00-05:00");
    expect(toEasternIso("2027-03-14T23:00:00Z")).toBe("2027-03-14T19:00:00-04:00");
  });
});

test("12-hour times around noon and midnight", () => {
  expect(formatTime12("2026-10-07T04:05:00Z")).toBe("12:05 AM");
  expect(formatTime12("2026-10-07T16:00:00Z")).toBe("12:00 PM");
  expect(formatTime12("2026-10-07T17:15:00Z")).toBe("1:15 PM");
});

describe("ended before today", () => {
  const now = new Date("2026-10-08T15:00:00Z"); // 11 AM Eastern
  test("an event that ended yesterday evening has ended", () => {
    expect(endedBeforeToday("2026-10-07T23:00:00Z", "2026-10-08T00:15:00Z", now)).toBe(true);
  });
  test("an event that ended this morning counts as today", () => {
    expect(endedBeforeToday("2026-10-08T11:00:00Z", "2026-10-08T12:00:00Z", now)).toBe(false);
  });
  test("with no end, an event counts as one hour long", () => {
    expect(endedBeforeToday("2026-10-08T03:00:00Z", null, now)).toBe(true); // 11 PM to midnight
    expect(endedBeforeToday("2026-10-08T03:30:00Z", null, now)).toBe(false); // runs past midnight
  });
});

describe("all-day events", () => {
  test("midnight to 11:59 PM, or to a later midnight", () => {
    expect(isAllDay("2026-10-10T04:00:00Z", "2026-10-11T03:59:00Z")).toBe(true);
    expect(isAllDay("2026-10-10T04:00:00Z", "2026-10-11T04:00:00Z")).toBe(true);
    expect(isAllDay("2026-10-10T04:00:00Z", "2026-10-13T03:59:00Z")).toBe(true);
  });
  test("across the clock change", () => {
    expect(isAllDay("2026-10-31T04:00:00Z", "2026-11-02T04:59:00Z")).toBe(true);
  });
  test("not when it starts or ends at another time, or has no end", () => {
    expect(isAllDay("2026-10-10T13:00:00Z", "2026-10-11T03:59:00Z")).toBe(false);
    expect(isAllDay("2026-10-10T04:00:00Z", "2026-10-10T16:00:00Z")).toBe(false);
    expect(isAllDay("2026-10-10T04:00:00Z", null)).toBe(false);
  });
});

test("short Eastern date and time", () => {
  expect(formatEasternShort("2026-10-13T22:00:00Z")).toBe("Tue 13 Oct, 6:00 PM");
  expect(formatEasternShort("2027-01-01T04:30:00Z")).toBe("Thu 31 Dec, 11:30 PM");
});

test("a full date from an Eastern date, with its year", () => {
  expect(formatLongDate("2026-10-09")).toBe("Friday, October 9, 2026");
  expect(formatLongDate("2027-03-14")).toBe("Sunday, March 14, 2027");
});

test("the schedule's update time, in Eastern time (EV-17)", () => {
  expect(formatEasternDateTime("2026-10-05T18:15:00Z")).toBe("October 5, 2026, 2:15 PM");
  expect(formatEasternDateTime("2027-01-01T03:30:00Z")).toBe("December 31, 2026, 10:30 PM");
});

test("short dates for rows and the date row", () => {
  expect(formatMonthDay("2026-10-09")).toBe("October 9, 2026");
  expect(formatShortDate("2026-10-15")).toBe("Thu, Oct 15");
  expect(formatShortDate("2027-01-01")).toBe("Fri, Jan 1");
  expect(formatShortMonthDay("2026-11-29")).toBe("Nov 29");
  expect(formatShortWeekday("2026-11-01")).toBe("Sun");
  expect(formatShortMonth("2026-12-31")).toBe("Dec 2026");
});

describe("multi-day events (D31)", () => {
  test("every Eastern date from the start to the end", () => {
    // International Fall Festival: Fri 9 Oct 7:30 PM to Thu 15 Oct noon.
    expect(multiDayDates("2026-10-09T23:30:00Z", "2026-10-15T16:00:00Z")).toEqual([
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
    ]);
    // A weekend across the clock change: Sat 31 Oct 10:30 AM to Sun 1 Nov 12:45 PM.
    expect(multiDayDates("2026-10-31T14:30:00Z", "2026-11-01T17:45:00Z")).toEqual([
      "2026-10-31",
      "2026-11-01",
    ]);
  });
  test("one day: no end, the same day, an evening past midnight, midnight to midnight", () => {
    expect(multiDayDates("2026-10-13T22:00:00Z", null)).toBeNull();
    expect(multiDayDates("2026-10-13T22:00:00Z", "2026-10-13T23:00:00Z")).toBeNull();
    expect(multiDayDates("2026-10-13T23:00:00Z", "2026-10-14T05:30:00Z")).toBeNull();
    expect(multiDayDates("2026-10-14T04:00:00Z", "2026-10-15T04:00:00Z")).toBeNull();
  });
  test("two whole days ending at midnight", () => {
    expect(multiDayDates("2026-10-14T04:00:00Z", "2026-10-16T04:00:00Z")).toEqual([
      "2026-10-14",
      "2026-10-15",
    ]);
  });
});
