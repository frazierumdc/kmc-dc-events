import { eventsCalendar, SiteSettings, SnapshotV2 } from "@kmcdc/domain";
import fixture from "@kmcdc/domain/fixtures/schedule-2026-10-17.json" with { type: "json" };
import siteJson from "../../../../data/site.json" with { type: "json" };
import { expect, test } from "vitest";
import { eventsEmail } from "./events.ts";

// The dev schedule's real events on 17 Oct 2026, as in the approved mock-up
// (docs/design/mockups/emails/email-events-phone.png), with data/site.json's names.

const schedule = SnapshotV2.parse(fixture);
const site = SiteSettings.parse(siteJson);
const COPIED = "2026-10-17T08:07:30Z"; // 4:07 AM Eastern
const calendar = eventsCalendar(
  schedule.events,
  {
    categoryKinds: schedule.site.categoryKinds,
    programs: site.programs,
    emailNames: site.emailNames,
  },
  new Date("2026-10-17T08:30:00Z"),
);
const mail = (kind: "copy" | "published" = "copy") =>
  eventsEmail({
    calendar,
    site: schedule.site,
    asOf: { kind, at: kind === "copy" ? COPIED : schedule.publishedAt },
  });

test("KMC DC Events: 4 months, a calendar for each month, with both keys (AN-14)", async () => {
  const { subject, text, html } = mail();
  expect(subject).toBe("KMC DC Events, Oct 17, 2026 – Feb 16, 2027");
  await expect(text).toMatchFileSnapshot("__snapshots__/events.txt");
  await expect(html).toMatchFileSnapshot("__snapshots__/events.html");
  for (const month of [
    "October 2026",
    "November 2026",
    "December 2026",
    "January 2027",
    "February 2027",
  ])
    expect(html).toContain(`${month}</h2>`);
  // The colour key, and the prayers' key spelling out each code.
  for (const name of ["Classes", "Branch classes", "FP &amp; TTP", "Prayers", "Special events"])
    expect(html).toContain(`</span>${name}</span>`);
  expect(html).toContain(">HJ</b>Heart Jewel</span>");
  // Each event: its start time with minutes and a short name, in its kind's colour.
  expect(html).toContain("<b>8:00a</b> HJ</div>");
  expect(html).toContain("#9621a2;background:#f2e4f4");
  expect(html).toContain("<b>12:00p</b> FP</div>");
  // FP and TTP share the study programs' amethyst; no branch class in the saved schedule.
  expect(html).not.toContain("#0460cb;background:#e1ecf9");
  expect(html).toContain("<b>7:00p</b> TTP</div>");
  expect(html).toContain("cont.</b> Retreat</div>");
  // No lists of events under the calendars (owner, 7 November 2026), and no links in them.
  expect(html).not.toContain("<a ");
});

test("the plain text: by month and day, each event in full with its kind and link (AN-12)", () => {
  const { text } = mail();
  expect(text).toContain("Prayers\n  HJ  Heart Jewel\n");
  expect(text).toContain("NOVEMBER 2026\n\nSun, Nov 1\n");
  expect(text).toMatch(/ {2}12:00 – 2:00 PM {2}The Foundation Program \(FP\)\n/);
  expect(text).toContain("  Continues  Vajrasattva Retreat");
  expect(text).toContain("https://");
});

test("it says when the schedule was copied, never where from (AN-14)", () => {
  expect(mail().text).toContain("Copied on Saturday, October 17, 2026, at 4:07 AM.");
  expect(mail("published").text).toContain("The schedule in the app was last updated on");
  expect(mail().text).not.toContain("example.org/events-calendar");
});

test("the footer: when it comes, and the group", () => {
  const { text } = mail();
  expect(text).toContain(
    "This email comes on Mondays, Wednesdays and Fridays at 4:30 AM. Something wrong? Fix it in Wix; the next update copies the fix.",
  );
  expect(text).toContain("You get this because you're in the KMC DC Events group.");
});
