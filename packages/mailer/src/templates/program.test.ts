import {
  classDaysWithout,
  prayerEvent,
  programSessions,
  sessionAfter,
  sessionChanges,
  sessionRecord,
  SiteSettings,
  SnapshotV2,
  type NoClass,
  type Program,
} from "@kmcdc/domain";
import fixture from "@kmcdc/domain/fixtures/schedule-2026-10-17.json" with { type: "json" };
import { expect, test } from "vitest";
import site from "../../../../data/site.json" with { type: "json" };
import { noClassEmail, programDatesEmail } from "./program.ts";

// The dev schedule's real program sessions on 17 Oct 2026, as in the approved mock-ups
// (docs/design/mockups/emails/email-program-phone.png, email-reminder-phone.png,
// email-reminder-break-phone.png); the 22 Nov change is made up, as there.

const schedule = SnapshotV2.parse(fixture);
const settings = SiteSettings.parse(site);
const program = (id: string): Program => {
  const p = settings.programs.find((x) => x.id === id);
  if (!p) throw new Error(id);
  return p;
};
const FP = program("fp");
const MONDAY = new Date("2026-10-19T08:07:30Z"); // 4:07 AM Eastern
const all = programSessions(schedule.events, FP);
const ahead = all.filter((s) => Date.parse(s.end ?? s.start) > MONDAY.getTime());
const gaps = classDaysWithout(all, FP);
function datesEmail(sessions = ahead, last = ahead.map(sessionRecord), p = FP) {
  return programDatesEmail({
    program: p,
    sessions,
    noClass: gaps,
    changes: sessionChanges(last, sessions, MONDAY),
    site: schedule.site,
  });
}

const moved = ahead.map((s) =>
  s.start.startsWith("2026-11-22")
    ? { ...s, start: "2026-11-22T13:00:00-05:00", end: "2026-11-22T15:00:00-05:00" }
    : s,
);

test("the mock-up: a change note, every session, No class days (AN-16, AN-19)", async () => {
  const email = datesEmail(moved);
  expect(email.subject).toBe("FP Dates: Oct 25, 2026 – Feb 28, 2027");
  await expect(email.text).toMatchFileSnapshot("__snapshots__/program-dates.txt");
  await expect(email.html).toMatchFileSnapshot("__snapshots__/program-dates.html");
  expect(email.text).toContain(
    "Sunday, November 22, 2026: now 1:00 – 3:00 PM (was 12:00 – 2:00 PM).",
  );
  expect(email.text).toContain("Sun, Dec 13, 2026 – Sun, Jan 3, 2027 · No classes (4 Sundays)");
});

test("the opening: a greeting by the short name, no heading, no count; no prayer line without prayer days (AN-16)", () => {
  const email = datesEmail([...ahead], ahead.map(sessionRecord));
  expect(email.text.startsWith("Dear FP Sangha,\n\nBelow is the FP schedule.\n\n")).toBe(true);
  expect(email.html).not.toContain("<h1");
  expect(email.text).not.toMatch(/sessions? left|links to|chanted prayers|Classes:/);
});

test("with nothing on the schedule: the short name alone in the subject", () => {
  const email = datesEmail([], []);
  expect(email.subject).toBe("FP Dates");
  expect(email.text).toContain("No FP classes are on the schedule now.");
});

test("program emails have no footer (AN-16, AN-20)", () => {
  const gap = gaps[0];
  if (!gap) throw new Error("no gap");
  const reminder = noClassEmail({
    program: FP,
    gap,
    next: sessionAfter(all, gap),
    site: schedule.site,
  });
  for (const email of [datesEmail(), reminder]) {
    expect(email.text.split("\n")).not.toContain("--");
    expect(email.text).not.toMatch(/member of|as they are on/);
    expect(email.html).not.toContain("border-top");
  }
});

test("nothing changed: no note", () => {
  expect(datesEmail().text).not.toContain("CHANGED SINCE");
});

test("a session added and one removed are noted; a new one is marked", () => {
  const nov29 = {
    ...ahead[0],
    id: "new",
    start: "2026-11-29T12:00:00-05:00",
    end: "2026-11-29T14:00:00-05:00",
  };
  if (!ahead[0]) throw new Error("no sessions");
  const sessions = [
    ...ahead.filter((s) => !s.start.startsWith("2026-12-06")),
    nov29 as (typeof ahead)[number],
  ];
  const { text } = datesEmail(sessions.sort((a, b) => a.start.localeCompare(b.start)));
  expect(text).toContain("Sunday, November 29, 2026: a new session, 12:00 – 2:00 PM.");
  expect(text).toContain("Sunday, December 6, 2026: no longer on the schedule.");
  expect(text).toContain("Sun, Nov 29, 2026 · 12:00 – 2:00 PM · KMC DC (new)");
});

test("the Teacher Training Program: Sundays and Tuesdays, breaks counted in class days", () => {
  const TTP = program("ttp");
  const ttp = programSessions(schedule.events, TTP).filter(
    (s) => Date.parse(s.start) > MONDAY.getTime(),
  );
  const email = programDatesEmail({
    program: TTP,
    sessions: ttp,
    noClass: classDaysWithout(ttp, TTP),
    changes: [],
    site: schedule.site,
  });
  expect(email.subject).toMatch(/^TTP Dates: [A-Z][a-z]{2} \d+, 2026 – [A-Z][a-z]{2} \d+, 2027$/);
  expect(email.text).toContain("Tue, Nov 24, 2026 – Sun, Nov 29, 2026 · No classes (2 class days)");
});

const reminder = (gap: NoClass | undefined) => {
  if (!gap) throw new Error("no gap");
  return noClassEmail({ program: FP, gap, next: sessionAfter(all, gap), site: schedule.site });
};

test("No class reminder for one day (AN-20)", async () => {
  const email = reminder(gaps[0]);
  expect(email.subject).toBe("Foundation Program: No Class on Sunday, Nov 29, 2026");
  await expect(email.text).toMatchFileSnapshot("__snapshots__/no-class.txt");
  await expect(email.html).toMatchFileSnapshot("__snapshots__/no-class.html");
  expect(email.text).toContain("Next class: Sunday, December 6, 2026 · 12:00 – 2:00 PM · KMC DC");
});

test("No class reminder for a break: one email, when classes start again", async () => {
  const email = reminder(gaps[1]);
  expect(email.subject).toBe("Foundation Program: No Classes Dec 13, 2026 – Jan 3, 2027");
  await expect(email.text).toMatchFileSnapshot("__snapshots__/no-class-break.txt");
  expect(email.text.startsWith("No classes for 4 weeks")).toBe(true);
  expect(email.text).toContain("Classes start again: Sunday, January 10, 2027");
});

const TTP = program("ttp");
const ttpAll = programSessions(schedule.events, TTP);
const ttpGaps = classDaysWithout(ttpAll, TTP);
const oct25 = ttpGaps.find((g) => g.from === "2026-10-25");

test("TTP dates: a class day on the 10th or 25th without a session shows the prayer, linked (AN-21)", async () => {
  const sessions = ttpAll.filter((s) => Date.parse(s.end ?? s.start) > MONDAY.getTime());
  const prayers = new Map(
    ttpGaps.flatMap((g) => {
      const e = prayerEvent(schedule.events, g);
      return e ? [[g.from, e] as const] : [];
    }),
  );
  const email = programDatesEmail({
    program: TTP,
    sessions,
    noClass: ttpGaps,
    changes: [],
    site: schedule.site,
    prayers,
  });
  await expect(email.text).toMatchFileSnapshot("__snapshots__/program-dates-ttp.txt");
  await expect(email.html).toMatchFileSnapshot("__snapshots__/program-dates-ttp.html");
  expect(email.text).toMatch(/Sun, Oct 25, 2026 · Offering to the Spiritual Guide · \d/);
  expect(email.text).toContain("Sun, Jan 10, 2027 · Offering to the Spiritual Guide\n");
  expect(email.text).toContain("Sun, Dec 20, 2026 – Tue, Jan 5, 2027 · No classes (6 class days)");
  expect(email.text).not.toContain("Sun, Oct 25, 2026 · No class");
  expect(email.text).toContain(
    "Dear TTP Sangha,\n\nBelow is the TTP schedule.\nOffering to the Spiritual Guide dates link to the chanted prayers.",
  );
});

test("the reminder on a prayer day says the prayer is held instead (AN-21)", async () => {
  if (!oct25) throw new Error("no Oct 25");
  const email = noClassEmail({
    program: TTP,
    gap: oct25,
    next: sessionAfter(ttpAll, oct25),
    site: schedule.site,
    prayer: prayerEvent(schedule.events, oct25),
  });
  expect(email.subject).toBe(
    "Teacher Training Program: Offering to the Spiritual Guide Instead of Class on Sunday, Oct 25, 2026",
  );
  await expect(email.text).toMatchFileSnapshot("__snapshots__/no-class-prayer.txt");
  await expect(email.html).toMatchFileSnapshot("__snapshots__/no-class-prayer.html");
  expect(email.text).toContain(
    "There's no Teacher Training Program class on Sunday, October 25, 2026; we're doing Offering to the Spiritual Guide instead.",
  );
  expect(email.text).toContain("Instead: Offering to the Spiritual Guide (with Tsog)");
  expect(email.text).toContain("Next class: Tuesday, October 27, 2026");
});
