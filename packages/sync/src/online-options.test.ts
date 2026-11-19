import { SiteSettings, type WebsiteEvent } from "@kmcdc/domain";
import { expect, test } from "vitest";
import fixtures from "@kmcdc/sync/fixtures/wix-events.json" with { type: "json" };
import siteFile from "../../../data/site.json" with { type: "json" };
import { onlineOptions } from "./online-options.ts";
import { adaptWixEvent } from "./wix-adapter.ts";

const site = SiteSettings.parse(siteFile);
const NOW = new Date("2026-10-09T15:00:00Z"); // Friday 11 AM Eastern
const livestream = { type: "livestream", page: site.links.onlineClasses };

function website(name: keyof typeof fixtures, changes: Partial<WebsiteEvent> = {}): WebsiteEvent {
  const r = adaptWixEvent(fixtures[name], site.allowedHosts);
  if (!r.ok) throw new Error(r.reason);
  return { ...r.event, ...changes };
}

/** The weekly class fixture (Tuesday 6:00 PM) moved to another start, Eastern. */
const weeklyAt = (id: string, start: string, end: string | null = null) =>
  website("weekly-class", { id, start, end });

test("weekly classes are livestreamed only at the online schedule's times", () => {
  const tuesday = website("weekly-class"); // Tue 13 Oct, 6:00 PM
  const stepByStep = weeklyAt("w1", "2026-10-14T23:00:00Z", "2026-10-15T00:00:00Z"); // Wed 7 PM
  const other = weeklyAt("w2", "2026-10-15T00:00:00Z"); // Wed 8 PM: not on the page
  const r = onlineOptions([tuesday, stepByStep, other], site, NOW);
  expect(r.options.get(tuesday.id)).toEqual(livestream);
  expect(r.options.get("w1")).toEqual(livestream);
  expect(r.options.has("w2")).toBe(false);
});

test("Eastern time decides the weekday, in winter too", () => {
  // Sunday 10:00 AM EST is 15:00 UTC.
  const sunday = weeklyAt("w3", "2026-11-08T15:00:00Z");
  const wrongHour = weeklyAt("w4", "2026-11-08T14:00:00Z");
  const r = onlineOptions([sunday, wrongHour], site, NOW);
  expect(r.options.get("w3")).toEqual(livestream);
  expect(r.options.has("w4")).toBe(false);
});

test("chanted prayers are livestreamed except Dakini Yoga and Quick Path to Great Bliss", () => {
  const prayer = website("prayer");
  const heartJewel = website("linked-description");
  const dakini = website("prayer", { id: "p1", title: "Dakini Yoga" });
  const quickPath = website("prayer", { id: "p2", title: "Quick Path to Great Bliss" });
  const r = onlineOptions([prayer, heartJewel, dakini, quickPath], site, NOW);
  expect(r.options.get(prayer.id)).toEqual(livestream);
  expect(r.options.get(heartJewel.id)).toEqual(livestream);
  expect(r.options.has("p1")).toBe(false);
  expect(r.options.has("p2")).toBe(false);
});

test("only events at the center: not other cities, not other categories", () => {
  const richmond = website("richmond");
  const prayerAway = website("prayer", {
    id: "p3",
    location: { online: false, name: "Hall", address: null, city: "Richmond", geo: null },
  });
  const noAddress = website("empty-address", { id: "p4" });
  const study = website("study-program");
  const r = onlineOptions([richmond, prayerAway, noAddress, study], site, NOW);
  expect(r.options.has(richmond.id)).toBe(false);
  expect(r.options.has("p3")).toBe(false);
  expect(r.options.get("p4")).toEqual(livestream);
  expect(r.options.has(study.id)).toBe(false);
});

test("an online event belongs to the in-person event starting at the same time", () => {
  const online = website("online");
  // Wix's two copies can end a few minutes apart.
  const inPerson = website("online-twin", { end: "2026-10-17T17:05:00Z" });
  const r = onlineOptions([online, inPerson], site, NOW);
  expect(r.events.map((e) => e.id)).toEqual([inPerson.id]);
  expect(r.options.get(inPerson.id)).toEqual({
    type: "event",
    id: online.id,
    page: online.page,
    registrationOpen: online.registrationOpen,
  });
  expect(r.warnings.filter((w) => w.id !== null)).toEqual([]);
});

test("another start, no shared title words, or a tie leaves the online event on its own", () => {
  const online = website("online");
  const later = website("online-twin", { start: "2026-10-17T14:30:00Z" });
  const r = onlineOptions([online, later], site, NOW);
  expect(r.events).toHaveLength(2);
  expect(r.options.size).toBe(0);
  expect(r.warnings[0]).toMatchObject({
    id: online.id,
    message: expect.stringContaining("no in-person event starting at the same time") as string,
  });

  const a = website("online-twin", { id: "a", title: "Morning" });
  const b = website("online-twin", { id: "b", title: "Evening" });
  expect(onlineOptions([online, a], site, NOW).options.size).toBe(0);
  expect(onlineOptions([online, a, b], site, NOW).options.size).toBe(0);
  const c = website("online-twin", { id: "c", title: "Silent Saturday" });
  const d = website("online-twin", { id: "d", title: "Saturday" });
  expect(onlineOptions([online, d, c], site, NOW).options.get("c")).toMatchObject({
    type: "event",
  });
  expect(onlineOptions([online, c, d], site, NOW).options.has("d")).toBe(false);
});

test("the online event wins over the livestream for a prayer with both", () => {
  const prayers = website("two-kinds"); // Chanted Prayers + Retreats & Special Events
  const online = website("online", {
    id: "o1",
    title: "Online: New Year's Eve Compassion Prayers by Candlelight",
    start: prayers.start,
    end: prayers.end,
  });
  expect(onlineOptions([prayers, online], site, NOW).options.get(prayers.id)).toMatchObject({
    type: "event",
    id: "o1",
  });
});

test("warnings: a class at a time not in the schedule, a time with no class", () => {
  const tuesday = website("weekly-class");
  const odd = [
    weeklyAt("x1", "2026-10-15T00:00:00Z"),
    weeklyAt("x2", "2026-10-22T00:00:00Z"),
    weeklyAt("x3", "2027-01-07T01:00:00Z"), // beyond 4 weeks: not checked
  ];
  const r = onlineOptions([tuesday, ...odd], site, NOW);
  const messages = r.warnings.map((w) => `${w.id ?? "-"}: ${w.message}`);
  expect(messages).toContain(
    "x1: Weekly Meditation Classes at a time not in the online schedule in data/site.json, so not livestreamed (2 events)",
  );
  expect(messages.some((m) => m.startsWith("x3"))).toBe(false);
  expect(messages).toContain(
    "-: Weekly Meditation Classes on Sunday at 10:00 AM is on the online timetable in data/site.json but not on the website's calendar in the next 28 days (paused, or not added in Wix); nothing to change in the app",
  );
  expect(messages.some((m) => m.includes("on Tuesday at 6:00 PM"))).toBe(false);
});

test("festivals and post-festival retreats show only the online icon, wherever they are held", () => {
  const festival = website("special-offsite"); // International Fall Festival, Málaga
  const postRetreat = website("online-twin", {
    id: "r1",
    title: "Post Fall Festival Retreat With Teacher D. Example",
  });
  const otherRetreat = website("online-twin", { id: "r2", start: "2026-10-24T14:00:00Z" });
  const prayerTitled = website("prayer", { id: "p5", title: "Festival Prayers" });
  const r = onlineOptions([festival, postRetreat, otherRetreat, prayerTitled], site, NOW);
  expect(r.options.get(festival.id)).toEqual({ type: "iconOnly" });
  expect(r.options.get("r1")).toEqual({ type: "iconOnly" });
  expect(r.options.has("r2")).toBe(false);
  expect(r.options.get("p5")).toEqual(livestream); // not Retreats & Special Events
  expect(r.events).toHaveLength(4);
});

test("a festival's own online event wins over the icon", () => {
  const festival = website("special-offsite");
  const online = website("online", {
    id: "o2",
    title: "Online: International Fall Festival",
    start: festival.start,
    end: festival.end,
  });
  const r = onlineOptions([festival, online], site, NOW);
  expect(r.options.get(festival.id)).toMatchObject({ type: "event", id: "o2" });
});
