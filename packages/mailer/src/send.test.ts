import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  findDuplicates,
  parseMailSettings,
  SiteSettings,
  SnapshotV2,
  SnapshotV2Event,
} from "@kmcdc/domain";
import dupFixture from "@kmcdc/domain/fixtures/duplicates-2026-10-16.json" with { type: "json" };
import fixture from "@kmcdc/domain/fixtures/schedule-2026-10-17.json" with { type: "json" };
import { afterAll, beforeEach, expect, test } from "vitest";
import site from "../../../data/site.json" with { type: "json" };
import { MailState } from "./mail-state.ts";
import {
  afterCopy,
  findProgram,
  sendEvents,
  sendNextReminders,
  sendProgramDates,
  type SendContext,
} from "./send.ts";

// What goes out after an Update schedule copy, and on request (D51, D55), with the fake
// sender, on the dev schedule's real events of 17 Oct 2026.

const schedule = SnapshotV2.parse(fixture);
const settings = SiteSettings.parse(site);
const ALL_ON = parseMailSettings(undefined).settings;
let dir: string;
let outbox: string;
let copyDir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "send-"));
  outbox = path.join(dir, "outbox");
  copyDir = path.join(dir, "mail");
  await writeFile(path.join(dir, ".keep"), "");
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

function context(
  now: string,
  state = MailState.parse({}),
  extra: Partial<SendContext> = {},
): SendContext {
  return {
    env: { MAIL_ENV: "fake" },
    outboxDir: outbox,
    to: "list",
    now: new Date(now),
    runUrl:
      "https://console.cloud.google.com/run/jobs/details/us-east4/update-schedule/executions?project=your-project-id-dev",
    updateJobUrl:
      "https://console.cloud.google.com/run/jobs/details/us-east4/update-schedule/executions?project=your-project-id-dev",
    repositoryUrl: "https://github.com/example-org/events-app",
    site: settings,
    schedule: () => Promise.resolve(schedule),
    state,
    log: () => undefined,
    ...extra,
  };
}

/** The subjects written since the last call, in alphabetical order. */
async function sent(): Promise<string[]> {
  const files = await readdir(outbox).catch(() => []);
  const subjects = await Promise.all(
    files.sort().map(async (f) => {
      const eml = await readFile(path.join(outbox, f), "utf8");
      await rm(path.join(outbox, f));
      const raw = /^Subject: (.*)$/m.exec(eml)?.[1] ?? "";
      const b64 = /^=\?UTF-8\?B\?(.*)\?=$/.exec(raw)?.[1];
      return b64 ? Buffer.from(b64, "base64").toString("utf8") : raw;
    }),
  );
  return subjects.sort();
}

async function withDuplicates(events: SnapshotV2Event[]) {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(copyDir, { recursive: true });
  await writeFile(
    path.join(copyDir, "duplicates.json"),
    JSON.stringify({
      duplicates: findDuplicates(events),
      site: schedule.site,
      copiedAt: "2026-10-17T08:07:30Z",
    }),
  );
}

const copy = (result: "same" | "changed" | "failed", extra: { published?: boolean } = {}) => ({
  dir: copyDir,
  result,
  published: extra.published ?? false,
  settings: ALL_ON,
  stateDir: path.join(dir, "state"),
});

/** What a copy that passed its checks leaves: the website as read, and its changes if any. */
async function withWebsite(website: string, changed: boolean) {
  await mkdir(copyDir, { recursive: true });
  await writeFile(path.join(copyDir, "website.json"), website);
  const changesFile = path.join(copyDir, "changes.json");
  if (!changed) {
    await rm(changesFile, { force: true });
    return;
  }
  await writeFile(
    changesFile,
    JSON.stringify({
      changes: {
        readAt: "2026-10-17T08:07:30Z",
        moved: [],
        added: [
          {
            id: "e1",
            title: "Monday Meditation Class",
            start: "2026-10-19T23:00:00.000Z",
            end: "2026-10-20T00:00:00.000Z",
            allDay: false,
            place: "Kadampa Meditation Center DC",
            page: "https://www.example.org/event-details/monday-meditation-class",
          },
        ],
        cancelled: [],
        removed: [],
        edited: [],
      },
    }),
  );
}
const kept = () => readFile(path.join(dir, "state/website.json"), "utf8");

test("Schedule changes once a day, from the 4:07 AM copy, then the website is kept (AN-1, D62)", async () => {
  const state = MailState.parse({});
  await withWebsite('{"v":"3am"}', true);
  await afterCopy(context("2026-10-17T07:30:00Z", state), copy("changed")); // 3:30 AM Sync now
  expect(await sent()).toEqual([]);
  expect(existsSync(path.join(dir, "state/website.json"))).toBe(false);

  await withWebsite('{"v":"4am"}', true);
  await afterCopy(context("2026-10-17T08:07:30Z", state), copy("same")); // 4:07 AM, unpublished too
  expect(await sent()).toEqual(["Schedule Changes: 1 New"]);
  expect(await kept()).toBe('{"v":"4am"}');
  expect(state.changesDue).toBe("2026-10-17T08:07:30.000Z");

  await withWebsite('{"v":"4pm"}', true);
  await afterCopy(context("2026-10-17T20:07:30Z", state), copy("changed")); // 4:07 PM
  expect(await sent()).toEqual([]);
  expect(await kept()).toBe('{"v":"4am"}');

  await withWebsite('{"v":"next day"}', false);
  await afterCopy(context("2026-10-18T08:07:30Z", state), copy("same")); // nothing changed
  expect(await sent()).toEqual([]);
  expect(await kept()).toBe('{"v":"next day"}');
});

test("Schedule changes: a failed 4:07 AM copy leaves it to the next good copy that day", async () => {
  const state = MailState.parse({});
  await rm(copyDir, { recursive: true, force: true });
  await afterCopy(context("2026-10-17T08:07:30Z", state), copy("failed"));
  expect(state.changesDue).toBeNull();
  await withWebsite('{"v":"4pm"}', true);
  await afterCopy(context("2026-10-17T20:07:30Z", state), copy("changed"));
  expect(await sent()).toEqual(["Schedule Changes: 1 New"]);
  expect(await kept()).toBe('{"v":"4pm"}');
});

test("a Saturday copy sends nothing new, and remembers when it copied (AN-14)", async () => {
  const ctx = context("2026-10-17T08:07:30Z");
  expect(await afterCopy(ctx, copy("same"))).toEqual([]);
  expect(await sent()).toEqual([]);
  expect(ctx.state.copiedAt).toBe("2026-10-17T08:07:30.000Z");
});

test("a failed copy isn't remembered as a copy", async () => {
  const ctx = context("2026-10-17T08:07:30Z");
  await afterCopy(ctx, copy("failed"));
  expect(ctx.state.copiedAt).toBeNull();
});

test("KMC DC Events by its timer: Mon, Wed, Fri, once a day (AN-14, D51)", async () => {
  const state = MailState.parse({ copiedAt: "2026-10-19T08:07:30.000Z" });
  await sendEvents(context("2026-10-19T08:30:00Z", state), { scheduled: true }); // Mon 4:30 AM
  expect(await sent()).toEqual(["KMC DC Events, Oct 19, 2026 – Feb 18, 2027"]);
  expect(state.eventsSent).toBe("2026-10-19T08:30:00.000Z");
  await sendEvents(context("2026-10-19T08:35:00Z", state), { scheduled: true });
  expect(await sent()).toEqual([]);
  await sendEvents(context("2026-10-20T08:30:00Z", state), { scheduled: true }); // Tuesday
  expect(await sent()).toEqual([]);
  await sendEvents(context("2026-10-21T08:30:00Z", state), { scheduled: true }); // Wednesday
  expect(await sent()).toEqual(["KMC DC Events, Oct 21, 2026 – Feb 20, 2027"]);
});

test("KMC DC Events on request goes at once, whatever the day, and isn't remembered", async () => {
  const state = MailState.parse({});
  await sendEvents(context("2026-10-20T14:00:00Z", state));
  expect(await sent()).toEqual(["KMC DC Events, Oct 20, 2026 – Feb 19, 2027"]);
  await sendEvents(context("2026-10-20T14:00:00Z", state, { to: "me" }));
  expect(await sent()).toEqual(["Preview: KMC DC Events, Oct 20, 2026 – Feb 19, 2027"]);
  expect(state.eventsSent).toBeNull();
});

test("Duplicate events when the copy found any (AN-13)", async () => {
  await withDuplicates(dupFixture.events.map((e) => SnapshotV2Event.parse(e)));
  await afterCopy(context("2026-10-17T08:07:30Z"), copy("same"));
  expect(await sent()).toEqual(["Duplicate Events: 2 Listed Twice, 1 Overlap"]);
});

test("Monday from 4 AM: each program's dates, once (D51)", async () => {
  const state = MailState.parse({});
  await afterCopy(context("2026-10-19T07:30:00Z", state), copy("same")); // 3:30 AM Sync now
  expect(await sent()).toEqual([]);
  await afterCopy(context("2026-10-19T08:07:30Z", state), copy("same"));
  expect(await sent()).toEqual([
    "FP Dates: Oct 25, 2026 – Feb 28, 2027",
    "TTP Dates: Oct 20, 2026 – Feb 28, 2027",
  ]);
  expect(state.programs.fp?.lastSent).toBe("2026-10-19T08:07:30.000Z");
  await afterCopy(context("2026-10-19T20:07:30Z", state), copy("same"));
  expect(await sent()).toEqual([]);
});

test("if the Monday 4 AM copy failed, the 4 PM one sends the dates", async () => {
  const state = MailState.parse({});
  await afterCopy(context("2026-10-19T08:07:30Z", state), copy("failed"));
  expect(await sent()).toEqual([]);
  await afterCopy(context("2026-10-19T20:07:30Z", state), copy("same"));
  expect(await sent()).toContain("FP Dates: Oct 25, 2026 – Feb 28, 2027");
});

test("No class reminder 2 days before, from 4 AM, once", async () => {
  const state = MailState.parse({});
  await afterCopy(context("2026-11-27T09:07:30Z", state), copy("same")); // Fri 4:07 AM
  expect((await sent()).filter((s) => s.includes("No Class"))).toEqual([
    "Foundation Program: No Class on Sunday, Nov 29, 2026",
  ]);
  expect(state.programs.fp?.reminders).toEqual(["2026-11-29"]);
  await afterCopy(context("2026-11-27T21:07:30Z", state), copy("same"));
  expect((await sent()).filter((s) => s.includes("No Class"))).toEqual([]);
});

test("a reminder for a class day before the schedule's first session, from the remembered sessions", async () => {
  const state = MailState.parse({});
  await afterCopy(context("2026-10-19T08:07:30Z", state), copy("same")); // Monday's dates
  await sent();
  // By Fri 23 Oct the schedule has dropped Tuesday 20 Oct's session.
  const later = { ...schedule, events: schedule.events.filter((e) => e.start >= "2026-10-23") };
  await afterCopy(
    context("2026-10-23T08:07:30Z", state, { schedule: () => Promise.resolve(later) }),
    copy("same"),
  );
  expect((await sent()).filter((s) => s.includes("Instead of Class"))).toEqual([
    "Teacher Training Program: Offering to the Spiritual Guide Instead of Class on Sunday, Oct 25, 2026",
  ]);
  expect(state.programs.ttp?.reminders).toEqual(["2026-10-25"]);
});

test("a failed copy sends only Problem; a switched-off email doesn't go", async () => {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(copyDir, { recursive: true });
  await writeFile(
    path.join(copyDir, "problem.json"),
    JSON.stringify({
      problem: "Unreadable: Could not reach the feed: fetch failed",
      failedAt: "2026-10-17T08:07:40Z",
    }),
  );
  await afterCopy(context("2026-10-19T08:07:30Z"), copy("failed"));
  expect(await sent()).toEqual(["Schedule Copy Failed: Couldn't Read the Website"]);
  await afterCopy(context("2026-10-19T08:07:30Z"), {
    ...copy("same"),
    settings: { ...ALL_ON, programs: false },
  });
  expect((await sent()).filter((s) => s.includes("Dates"))).toEqual([]);
});

test("one email failing doesn't stop the others; each is named (AN-9)", async () => {
  const ctx = context("2026-10-19T08:07:30Z", MailState.parse({}), { env: { MAIL_ENV: "dev" } });
  const failures = await afterCopy(ctx, copy("same"));
  expect(failures.map((f) => f.split(":")[0])).toEqual([
    "Foundation Program dates",
    "Teacher Training Program dates",
  ]);
});

test("on request: a preview records nothing; to the list it moves the change note's start", async () => {
  const state = MailState.parse({});
  const fp = findProgram(settings, "fp");
  await sendProgramDates(context("2026-10-20T14:00:00Z", state, { to: "me" }), fp);
  expect(await sent()).toEqual(["Preview: FP Dates: Oct 25, 2026 – Feb 28, 2027"]);
  expect(state.programs.fp?.lastSessions ?? null).toBeNull();
  await sendProgramDates(context("2026-10-20T14:00:00Z", state), fp);
  expect(state.programs.fp?.lastSessions).toHaveLength(14);
  // It isn't Monday's: the next Monday still sends.
  expect(state.programs.fp?.lastSent).toBeNull();
});

test("on request: each program's next reminder, which then counts as sent", async () => {
  const state = MailState.parse({});
  await sendNextReminders(context("2026-10-20T14:00:00Z", state));
  expect(await sent()).toEqual([
    "Foundation Program: No Class on Sunday, Nov 29, 2026",
    "Teacher Training Program: Offering to the Spiritual Guide Instead of Class on Sunday, Oct 25, 2026",
  ]);
  await afterCopy(context("2026-10-23T08:07:30Z", state), copy("same")); // Fri before Oct 25
  expect((await sent()).filter((s) => s.includes("Class on"))).toEqual([]);
});
