import { expect, test } from "vitest";
import fixture from "../fixtures/schedule-2026-10-17.json" with { type: "json" };
import siteJson from "../../../data/site.json" with { type: "json" };
import {
  addMonths,
  calendarKind,
  eventsCalendar,
  eventsEmailDue,
  type CalendarItem,
} from "./events-calendar.ts";
import { SiteSettings, SnapshotV2 } from "./website.ts";

// The dev schedule's real events on 17 Oct 2026 (AN-14), with the short names and programs
// of data/site.json.

const schedule = SnapshotV2.parse(fixture);
const settings = SiteSettings.parse(siteJson);
const site = {
  categoryKinds: schedule.site.categoryKinds,
  programs: settings.programs,
  emailNames: settings.emailNames,
};
const NOW = new Date("2026-10-17T08:07:00Z"); // Sat 17 Oct 2026, 4:07 AM Eastern
const cal = eventsCalendar(schedule.events, site, NOW);
const items = (date: string): CalendarItem[] =>
  cal.months.flatMap((m) => m.weeks.flat()).find((d) => d.date === date && d.inMonth)?.items ?? [];

test("today to 4 months, the day before the same date: a calendar for each month", () => {
  expect([cal.from, cal.to]).toEqual(["2026-10-17", "2027-02-16"]);
  expect(cal.months.map((m) => m.month)).toEqual([
    "2026-10",
    "2026-11",
    "2026-12",
    "2027-01",
    "2027-02",
  ]);
});

test("every event that starts in range is counted, whatever its kind", () => {
  const inRange = schedule.events.filter((e) => {
    const d = e.start.slice(0, 10);
    return d >= cal.from && d <= cal.to;
  });
  expect(cal.count).toBe(inRange.length);
});

test("weeks run Sunday to Saturday, only those with a day in range", () => {
  const october = cal.months[0];
  // 17 Oct 2026 is a Saturday: October shows its last three weeks.
  expect(october?.weeks.map((w) => w[0]?.date)).toEqual(["2026-10-11", "2026-10-18", "2026-10-25"]);
  const first = october?.weeks[0];
  expect(first?.map((d) => d.inRange)).toEqual([false, false, false, false, false, false, true]);
  // The last week of October runs into November: those days are drawn empty.
  const last = october?.weeks[2];
  expect(last?.map((d) => d.inMonth)).toEqual([true, true, true, true, true, true, true]);
  const lastNov = cal.months[1]?.weeks.at(-1);
  expect(lastNov?.filter((d) => !d.inMonth).every((d) => d.items.length === 0)).toBe(true);
  const february = cal.months.at(-1);
  expect(february?.weeks.at(-1)?.map((d) => d.date)).toContain("2027-02-16");
  expect(february?.weeks.flat().some((d) => d.date === "2027-02-21")).toBe(false);
});

test("FP and TTP share the study programs' kind; other classes, prayers and special events keep theirs", () => {
  const kinds = new Set(
    cal.months.flatMap((m) => m.weeks.flat().flatMap((d) => d.items.map((i) => i.kind))),
  );
  // The saved schedule has no weekly classes.
  expect([...kinds].sort()).toEqual(["prayer", "program", "special"]);
  const fp = schedule.events.find((e) => e.title === "The Foundation Program");
  const ttp = schedule.events.find((e) => e.title === "Teacher Training Program (TTP)");
  expect(fp && calendarKind(fp, site)).toBe("program");
  expect(ttp && calendarKind(ttp, site)).toBe("program");
});

test("short names: prayer codes, program short names, class and special labels", () => {
  const shorts = new Set(
    cal.months.flatMap((m) =>
      m.weeks.flat().flatMap((d) => d.items.map((i) => `${String(i.kind)} ${i.short}`)),
    ),
  );
  for (const s of ["prayer HJ", "program FP", "program TTP", "special Blessing"])
    expect(shorts).toContain(s);
});

test("a class takes its label from data/site.json, or its title's first word; a branch class its own kind", () => {
  const base = schedule.events.find((e) => e.title === "The Foundation Program");
  if (!base) throw new Error("no FP session");
  const cls = (title: string, category = "Weekly Meditation Classes") => ({
    ...base,
    id: title,
    title,
    categories: [category],
  });
  const one = eventsCalendar(
    [
      cls("Monday Meditation Class"),
      cls("Richmond Meditation Class", "Richmond Branch Classes"),
      cls("Saturday Morning Class"),
    ],
    site,
    NOW,
  );
  const day = one.months.flatMap((m) => m.weeks.flat()).find((d) => d.items.length > 0);
  expect(day?.items.map((i) => `${String(i.kind)} ${i.short}`)).toEqual([
    "class Mon",
    "branch Rich",
    "class Saturday",
  ]);
});

test("the key lists the prayer codes used, in data/site.json's order", () => {
  const codes = cal.key.map((k) => k.code);
  expect(codes[0]).toBe("HJ");
  expect(cal.key.find((k) => k.code === "HJ")?.name).toBe("Heart Jewel");
  const order = settings.emailNames.prayers.map((p) => p.code).filter((c) => codes.includes(c));
  expect(codes.slice(0, order.length)).toEqual(order);
});

test("an event over several days is on each day, cont. on the later ones, first in its day", () => {
  const retreat = (date: string) =>
    items(date).find((i) => i.event.title.startsWith("Vajrasattva Retreat"));
  expect(retreat("2026-12-04")?.cont).toBe(false);
  expect(["2026-12-05", "2026-12-06", "2026-12-07"].map((d) => retreat(d)?.cont)).toEqual([
    true,
    true,
    true,
  ]);
  expect(items("2026-12-06")[0]?.cont).toBe(true);
});

test("a day's events in start order", () => {
  const day = items("2026-11-10").filter((i) => !i.cont);
  const starts = day.map((i) => Date.parse(i.event.start));
  expect(starts).toEqual([...starts].sort((a, b) => a - b));
  expect(day.length).toBeGreaterThan(1);
});

test("Mondays, Wednesdays and Fridays from 4 AM Eastern, once a day (D51)", () => {
  const mon430 = new Date("2026-11-09T09:30:00Z");
  expect(eventsEmailDue(mon430, null)).toBe(true);
  expect(eventsEmailDue(mon430, "2026-11-09T09:30:05Z")).toBe(false);
  expect(eventsEmailDue(mon430, "2026-11-06T09:30:05Z")).toBe(true);
  expect(eventsEmailDue(new Date("2026-11-11T09:30:00Z"), null)).toBe(true);
  expect(eventsEmailDue(new Date("2026-11-13T09:30:00Z"), null)).toBe(true);
  expect(eventsEmailDue(new Date("2026-11-10T09:30:00Z"), null)).toBe(false);
  expect(eventsEmailDue(new Date("2026-11-09T08:30:00Z"), null)).toBe(false);
});

test("addMonths clamps to the month's last day", () => {
  expect(addMonths("2026-10-31", 4)).toBe("2027-02-28");
  expect(addMonths("2026-11-09", 4)).toBe("2027-03-09");
});
