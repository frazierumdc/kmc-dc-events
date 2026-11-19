import type { FeedEnvelope } from "@kmcdc/domain";
import { websiteReadChanges } from "@kmcdc/sync";
import { expect, test } from "vitest";
import fixtures from "@kmcdc/sync/fixtures/wix-events.json" with { type: "json" };
import { MAX_LISTED, scheduleChangesEmail, titleCase } from "@kmcdc/mailer";

// The Schedule changes email as the send-email job makes it (AN-1, D62): packages/sync's
// websiteReadChanges compares two reads of the website, and the mailer's template writes the
// email. Here, in the job, because the job is where the two packages meet: the mailer does
// not depend on packages/sync. Real events from the Wix feed, changed as in the approved
// mock-up (docs/design/mockups/emails/email-changes-phone.png).

type Raw = (typeof fixtures)["weekly-class"];
const events = Object.values(fixtures) as Raw[];
const READ_AT = "2026-10-09T08:07:30Z"; // 4:07 AM Eastern
const RUN =
  "https://console.cloud.google.com/run/jobs/details/us-east4/update-schedule/executions?project=your-project-id-dev";
const read = (list: unknown[]): FeedEnvelope => ({
  generatedAt: READ_AT,
  window: { from: "2026-10-08T08:07:30Z", to: "2027-11-13T08:07:30Z" },
  access: "elevated",
  count: list.length,
  events: list,
});
type Edit = (e: Raw) => unknown;
/** The website with each named event changed; null takes it off. */
const website = (edits: Record<string, Edit | null>) =>
  events.flatMap((e) => {
    const edit = Object.entries(edits).find(([title]) => e.title.startsWith(title));
    if (!edit) return [e];
    return edit[1] === null ? [] : [edit[1](e)];
  });
const at =
  (startDate: string, endDate: string): Edit =>
  (e) => ({
    ...e,
    dateAndTimeSettings: { ...e.dateAndTimeSettings, startDate, endDate },
  });
/** The email for the website going from `before` to `after`. */
function email(before: Record<string, Edit | null>, after: Record<string, Edit | null>) {
  const changes = websiteReadChanges(read(website(before)), read(website(after)));
  if (!changes) throw new Error("no earlier read");
  return scheduleChangesEmail({ changes, runUrl: RUN });
}

const mockUp = () =>
  email(
    {
      "Center Cherishing": at("2026-11-01T19:00:00.000Z", "2026-11-01T22:00:00.000Z"),
      "Richmond Meditation Class": null,
      "New Years Eve": (e) => ({ ...e, title: "New Years Eve Prayers" }),
    },
    {
      "Tuesday Rest and Reflect": at("2026-10-13T22:30:00.000Z", "2026-10-13T23:00:00.000Z"),
      "The Foundation Program": (e) => ({ ...e, status: "CANCELED" }),
      "Heart Jewel": null,
    },
  );

test("the mock-up's changes: subject, then each group in order (AN-1, AN-2)", async () => {
  const sent = mockUp();
  expect(sent.subject).toBe(
    "Schedule Changes: 2 Date or Time, 1 New, 1 Cancelled, 1 Removed, 1 Other",
  );
  await expect(sent.text).toMatchFileSnapshot("__snapshots__/schedule-changes.txt");
  await expect(sent.html).toMatchFileSnapshot("__snapshots__/schedule-changes.html");
});

test("one sentence per change, naming only what changed, date or time first", () => {
  const { text } = mockUp();
  expect(text.startsWith("6 changes in the website")).toBe(true);
  expect(text).toContain("Copied on Friday, October 9, 2026, at 4:07 AM.");
  expect(text).toContain(
    "1. Tuesday Rest and Reflect, Tue, Oct 13, 2026, now starts at 6:30 PM (was 6:00 PM).\n   Kadampa Meditation Center DC · this week\n   https://",
  );
  expect(text).toContain(
    "2. Center Cherishing moved to Sun, Nov 8, 2026 (was Sun, Nov 1), 2:00 – 5:00 PM.",
  );
  expect(text).toContain(
    "3. New: Richmond Meditation Class, Mon, Oct 12, 2026, 7:00 – 8:00 PM.\n   Diversity Thrift · this week\n   https://",
  );
  // A cancelled or removed event has no page to open, and never a reason why.
  expect(text).toContain(
    "4. Cancelled: The Foundation Program, Sun, Oct 18, 2026, 12:00 – 2:00 PM.\n   Kadampa Meditation Center DC\n\n",
  );
  expect(text).toContain("5. Removed: Heart Jewel Prayers & Silent Meditation, Wed, Oct 21, 2026");
  // A description is never told.
  expect(text).not.toContain("description");
  expect(text).toContain(
    'New Years Eve Compassion Prayers by Candlelight, Thu, Dec 31, 2026: renamed (was "New Years Eve Prayers").',
  );
});

test("titles from the website are escaped in HTML", () => {
  const sent = email(
    { "Center Cherishing": null },
    { "Center Cherishing": (e) => ({ ...e, title: "Q&A <live>" }) },
  );
  expect(sent.html).toContain("Q&amp;A &lt;live&gt;");
  expect(sent.html).not.toContain("<live>");
  expect(sent.subject).toBe("Schedule Changes: 1 New");
});

const many = (n: number) => {
  const base = fixtures.richmond;
  const start = Date.parse(base.dateAndTimeSettings.startDate);
  const added = Array.from({ length: n }, (_, i) => ({
    ...base,
    id: `new-${String(i)}`,
    dateAndTimeSettings: {
      ...base.dateAndTimeSettings,
      startDate: new Date(start + (i + 1) * 3 * 86_400_000).toISOString(),
      endDate: undefined,
    },
  }));
  const changes = websiteReadChanges(read(events), read([...events, ...added]));
  if (!changes) throw new Error("no earlier read");
  return scheduleChangesEmail({ changes, runUrl: RUN });
};

test(`more than ${String(MAX_LISTED)} changes: the first ${String(MAX_LISTED)} in full, the rest counted with the run's link`, () => {
  const { text, html } = many(35);
  expect(text.match(/Richmond Meditation Class/g)).toHaveLength(MAX_LISTED);
  expect(text).toContain(`And 5 more changes, listed in the run's summary: ${RUN}`);
  expect(html).toContain(`href="${RUN}"`);
});

test("a very large change: counts by month only", () => {
  const { text } = many(120);
  expect(text).toContain("NEW (120)\n6 in Oct 2026, 10 in Nov 2026, 10 in Dec 2026,");
  expect(text).not.toContain("Richmond Meditation Class");
  expect(text).toContain(`Every change is listed in the run's summary: ${RUN}`);
});

test("subjects are in title case with no tag (AN-11)", () => {
  expect(email({}, { "Heart Jewel": null }).subject).toBe("Schedule Changes: 1 Removed");
  expect(titleCase("Schedule copy failed: couldn't read the website")).toBe(
    "Schedule Copy Failed: Couldn't Read the Website",
  );
  expect(titleCase("Foundation Program: no classes Dec 13, 2026 – Jan 3, 2027")).toBe(
    "Foundation Program: No Classes Dec 13, 2026 – Jan 3, 2027",
  );
});

// One change of each type on its own, as the email shows it (AN-2).
test.each([
  {
    name: "moved",
    sent: email(
      { "Center Cherishing": at("2026-11-08T18:00:00.000Z", "2026-11-08T20:00:00.000Z") },
      {},
    ),
  },
  {
    name: "moved-and-renamed",
    sent: email(
      {
        "Richmond Meditation Class": (e) => ({
          ...(at("2026-10-13T23:00:00.000Z", "2026-10-14T00:00:00.000Z")(e) as Raw),
          title: "Richmond Class",
        }),
      },
      {},
    ),
  },
  { name: "new", sent: email({ "Richmond Meditation Class": null }, {}) },
  {
    name: "cancelled",
    sent: email({}, { "Richmond Meditation Class": (e) => ({ ...e, status: "CANCELED" }) }),
  },
  { name: "removed", sent: email({}, { "Richmond Meditation Class": null }) },
  {
    name: "title",
    sent: email({ "Center Cherishing": (e) => ({ ...e, title: "Center Cleaning" }) }, {}),
  },
])("one change: $name", async ({ name, sent }) => {
  await expect(sent.text).toMatchFileSnapshot(`__snapshots__/schedule-changes-${name}.txt`);
  await expect(sent.html).toMatchFileSnapshot(`__snapshots__/schedule-changes-${name}.html`);
});
