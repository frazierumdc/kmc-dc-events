import { expect, test } from "vitest";
import fixture from "../fixtures/schedule-2026-10-17.json" with { type: "json" };
import site from "../../../data/site.json" with { type: "json" };
import {
  classDaysWithout,
  eventTone,
  prayerEvent,
  nextNoClass,
  programDatesDue,
  programSessions,
  remindersDue,
  sessionAfter,
  sessionChanges,
  sessionRecord,
  type Program,
} from "./programs.ts";
import { SiteSettings, SnapshotV2 } from "./website.ts";

// The dev schedule's real Foundation and Teacher Training Program sessions on 17 Oct 2026
// (AN-15, AN-16, AN-19, AN-20, D49, D51).

const schedule = SnapshotV2.parse(fixture);
const settings = SiteSettings.parse(site);
const program = (id: string): Program => {
  const p = settings.programs.find((x) => x.id === id);
  if (!p) throw new Error(id);
  return p;
};
const FP = program("fp");
const TTP = program("ttp");
const fp = programSessions(schedule.events, FP);
const ttp = programSessions(schedule.events, TTP);
const at = (iso: string) => new Date(iso);

test("each program's sessions, every form of its title (AN-15)", () => {
  expect(fp).toHaveLength(15);
  expect(ttp).toHaveLength(21);
  expect(new Set(ttp.map((s) => s.title))).toEqual(
    new Set(["Teacher Training Program", "Teacher Training Program (TTP)"]),
  );
});

test("class days without a session, a break as one (AN-16, AN-20)", () => {
  const show = (p: Program, s: typeof fp) =>
    classDaysWithout(s, p).map((g) => (g.from === g.to ? g.from : `${g.from} – ${g.to}`));
  expect(show(FP, fp)).toEqual(["2026-11-29", "2026-12-13 – 2027-01-03"]);
  // Sundays and Tuesdays; the 10th and 25th hold a prayer and split the break (AN-21).
  expect(show(TTP, ttp)).toEqual([
    "2026-10-25",
    "2026-11-15",
    "2026-11-24 – 2026-11-29",
    "2026-12-13",
    "2026-12-20 – 2027-01-05",
    "2027-01-10",
    "2027-01-12 – 2027-01-31",
  ]);
});

test("a class day on the 10th or 25th without a session holds the prayer; one with a session stays a class (AN-21)", () => {
  const prayers = classDaysWithout(ttp, TTP).filter((g) => g.prayer);
  expect(prayers.map((g) => [g.from, g.prayer])).toEqual([
    ["2026-10-25", "Offering to the Spiritual Guide"],
    ["2027-01-10", "Offering to the Spiritual Guide"],
  ]);
  expect(ttp.some((s) => s.start.startsWith("2026-11-10"))).toBe(true);
  expect(classDaysWithout(fp, FP).some((g) => g.prayer)).toBe(false);
  const [oct25, jan10] = prayers;
  if (!oct25 || !jan10) throw new Error("no prayer days");
  expect(prayerEvent(schedule.events, oct25)?.title).toBe(
    "Offering to the Spiritual Guide (with Tsog)",
  );
  expect(prayerEvent(schedule.events, jan10)).toBeNull(); // not on the schedule yet
});

test("the class days before the schedule's first session count from the last one remembered (AN-20, AN-21)", () => {
  // On Fri 23 Oct the schedule no longer lists Tuesday 20 Oct's session.
  const later = ttp.filter((s) => s.start >= "2026-10-23");
  expect(classDaysWithout(later, TTP)[0]?.from).toBe("2026-11-15");
  expect(classDaysWithout(later, TTP, "2026-10-20")[0]).toEqual({
    from: "2026-10-25",
    to: "2026-10-25",
    days: ["2026-10-25"],
    prayer: "Offering to the Spiritual Guide",
  });
});

test("after a break, the next session", () => {
  const [, holidays] = classDaysWithout(fp, FP);
  if (!holidays) throw new Error("no break");
  expect(sessionAfter(fp, holidays)?.start).toBe("2027-01-10T12:00:00-05:00");
});

test("changes since the last dates email: moved, added, removed; none the first time (AN-19)", () => {
  const now = at("2026-10-19T08:07:00Z");
  const last = fp.map(sessionRecord);
  expect(sessionChanges(null, fp, now)).toEqual([]);
  expect(sessionChanges(last, fp, now)).toEqual([]);
  const nov22 = fp.find((s) => s.start.startsWith("2026-11-22"));
  if (!nov22) throw new Error("no Nov 22");
  const moved = fp.map((s) =>
    s === nov22
      ? { ...s, start: "2026-11-22T13:00:00-05:00", end: "2026-11-22T15:00:00-05:00" }
      : s,
  );
  const changes = sessionChanges(
    last,
    moved.filter((s) => !s.start.startsWith("2026-10-25")),
    now,
  );
  expect(changes.map((c) => c.kind)).toEqual(["removed", "moved"]);
  const added = { ...nov22, id: "new", start: "2026-11-29T12:00:00-05:00" };
  expect(sessionChanges(last, [...fp, added], now).map((c) => c.kind)).toEqual(["added"]);
});

test("a session moved and moved back, or one that has passed, is no change", () => {
  const last = fp.map(sessionRecord);
  const later = at("2026-10-26T08:07:00Z"); // Oct 25 has passed and left the schedule
  expect(sessionChanges(last, fp.slice(1), later)).toEqual([]);
});

test("program dates: Mondays from 4 AM Eastern, once (D51)", () => {
  expect(programDatesDue(at("2026-10-19T08:07:00Z"), null)).toBe(true); // Mon 4:07 AM
  expect(programDatesDue(at("2026-10-19T07:30:00Z"), null)).toBe(false); // Mon 3:30 AM
  expect(programDatesDue(at("2026-10-20T08:07:00Z"), null)).toBe(false); // Tue
  // The 4 AM copy sent it; the 4 PM one doesn't again; if it failed, the 4 PM one does.
  expect(programDatesDue(at("2026-10-19T20:07:00Z"), "2026-10-19T08:07:30Z")).toBe(false);
  expect(programDatesDue(at("2026-10-19T20:07:00Z"), "2026-10-12T08:07:30Z")).toBe(true);
});

test("No class reminders: 2 days before, from 4 AM, once (D51)", () => {
  const gaps = classDaysWithout(fp, FP);
  const friday = at("2026-11-27T09:07:00Z"); // Fri 4:07 AM, before Sun Nov 29
  expect(remindersDue(gaps, [], friday).map((g) => g.from)).toEqual(["2026-11-29"]);
  expect(remindersDue(gaps, ["2026-11-29"], friday)).toEqual([]);
  expect(remindersDue(gaps, [], at("2026-11-27T08:30:00Z"))).toEqual([]); // 3:30 AM
  expect(remindersDue(gaps, [], at("2026-11-28T09:07:00Z"))).toEqual([]); // the day before
  expect(remindersDue(gaps, [], at("2026-12-11T09:07:00Z")).map((g) => g.days.length)).toEqual([4]);
});

test("the next No class, for Send email", () => {
  const gaps = classDaysWithout(fp, FP);
  expect(nextNoClass(gaps, at("2026-10-17T12:00:00Z"))?.from).toBe("2026-11-29");
  expect(nextNoClass(gaps, at("2026-11-30T12:00:00Z"))?.from).toBe("2026-12-13");
});

test("an event's own colour: a program's or branch class's, or slate for another center's special event (D45, D67)", () => {
  const session = fp[0];
  if (!session) throw new Error("no FP session");
  expect(eventTone(session, "class", settings.programs)).toBe("program");
  const retreat = { categories: ["Retreats & Special Events"], title: "Sample Retreat" };
  expect(eventTone({ ...retreat, otherCenter: true }, "special", settings.programs)).toBe(
    "elsewhere",
  );
  expect(eventTone(retreat, "special", settings.programs)).toBeNull();
  expect(eventTone({ ...retreat, otherCenter: true }, "prayer", settings.programs)).toBeNull();
});
