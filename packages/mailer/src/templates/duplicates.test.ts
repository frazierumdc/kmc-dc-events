import { findDuplicates, SnapshotV2, SnapshotV2Event } from "@kmcdc/domain";
import dupFixture from "@kmcdc/domain/fixtures/duplicates-2026-10-16.json" with { type: "json" };
import { expect, test } from "vitest";
import fixture from "../../fixtures/schedule-2026-10-16.json" with { type: "json" };
import { datesPhrase, duplicatesEmail } from "./duplicates.ts";

// The real duplicates and clash on the dev schedule of 16 Oct 2026, as in the approved
// mock-up (docs/design/mockups/emails/email-duplicates-phone.png).

const site = SnapshotV2.parse(fixture).site;
const events = dupFixture.events.map((e) => SnapshotV2Event.parse(e));
const COPIED = "2026-10-16T20:07:30Z";
const email = (list = events) =>
  duplicatesEmail({ duplicates: findDuplicates(list), site, copiedAt: COPIED });

test("the real schedule: 3 things to check, each listing linked (AN-13)", async () => {
  const { subject, text, html } = email();
  expect(subject).toBe("Duplicate Events: 2 Listed Twice, 1 Overlap");
  expect(text.startsWith("3 things to check in Wix")).toBe(true);
  await expect(text).toMatchFileSnapshot("__snapshots__/duplicates.txt");
  await expect(html).toMatchFileSnapshot("__snapshots__/duplicates.html");
  for (const e of events.filter((x) => x.start.startsWith("2026-12-02T19")))
    expect(html).toContain(`href="${e.page}"`);
});

test("listed twice: the facts, then a possible fix; many dates as a range, each linked", () => {
  const { text } = email();
  expect(text).toContain(
    "1. Sunday Morning Meditation is listed twice on Nov 22 and Dec 6, 2026, 10:00 AM at KMC DC.\n   Possible fix: keep one listing and remove the other, unless people registered for it.\n   Nov 22:\n     First: ",
  );
  expect(text).toContain(
    "Wednesday Step by Step Meditation is listed twice on 8 Wednesdays (Dec 2, 2026 – Feb 3, 2027), 7:00 PM at KMC DC.",
  );
  // Every date's listings link, even when the dates are a range.
  for (const date of ["Dec 2", "Dec 9", "Dec 16", "Jan 6", "Jan 13", "Jan 20", "Jan 27", "Feb 3"])
    expect(text).toContain(`   ${date}:\n     First: `);
});

test("an overlap names each event; the reader decides which one", () => {
  const { text } = email();
  expect(text).toContain(
    "3. Special Sunday Morning Meditation: From Judgement to Compassion with Teacher E. Example and Sunday Morning Meditation are both at 10:00 AM on Sun, Nov 29, 2026, at KMC DC.\n   Possible fix: if one replaces the other, cancel the one that isn't happening.\n   Nov 29 events:\n     First: ",
  );
});

test("only an overlap: one thing to check, nothing listed twice", () => {
  const clash = events.filter((e) => e.start.startsWith("2026-11-29T10"));
  const { subject, text } = email(clash);
  expect(subject).toBe("Duplicate Events: 1 Overlap");
  expect(text.startsWith("1 thing to check in Wix")).toBe(true);
  expect(text).not.toContain("listed twice");
});

test("dates: one, a few by name, across a year, many as a range", () => {
  expect(datesPhrase(["2026-11-22"])).toBe("on Nov 22, 2026");
  expect(datesPhrase(["2026-11-22", "2026-12-06"])).toBe("on Nov 22 and Dec 6, 2026");
  expect(datesPhrase(["2026-12-30", "2027-01-06"])).toBe("on Dec 30, 2026 and Jan 6, 2027");
  expect(datesPhrase(["2026-12-02", "2026-12-03", "2026-12-09", "2026-12-10"])).toBe(
    "on 4 dates (Dec 2, 2026 – Dec 10, 2026)",
  );
});

test("no app name above the heading, and it never says why", () => {
  const { html, text } = email();
  expect(html).not.toContain("KMC DC Events App");
  expect(text).not.toMatch(/-1"|copy/);
});
