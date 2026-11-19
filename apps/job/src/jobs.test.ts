import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FeedEnvelope } from "@kmcdc/domain";
import { expect, test } from "vitest";
import fixtures from "@kmcdc/sync/fixtures/wix-events.json" with { type: "json" };
import { HandOver, readMailFiles, writeMailFiles } from "./hand-over.ts";
import { scheduleChanges, sendEmail, type SendEmailSteps } from "./send-email.ts";
import { updateSchedule, type CopyResult, type UpdateScheduleSteps } from "./update-schedule.ts";

// The two jobs' rules (D63), with every step faked: what runs, in which order, for each
// result of the copy and each way of starting it.

function steps(
  result: CopyResult,
  options: { publishFails?: boolean; tellFails?: boolean; notifyFails?: boolean } = {},
) {
  const calls: string[] = [];
  let handedOver: HandOver | null = null;
  const fake: UpdateScheduleSteps = {
    lock: () => {
      calls.push("lock");
      return Promise.resolve(() => {
        calls.push("release");
        return Promise.resolve();
      });
    },
    copy: () => {
      calls.push("copy");
      return Promise.resolve({ result, files: { "website.json": "{}" } });
    },
    publish: () => {
      calls.push("publish");
      return options.publishFails
        ? Promise.reject(new Error("Hosting said no"))
        : Promise.resolve();
    },
    tellOpenApps: () => {
      calls.push("tell open apps");
      return options.tellFails ? Promise.reject(new Error("no record")) : Promise.resolve();
    },
    notify: () => {
      calls.push("notify");
      return options.notifyFails ? Promise.reject(new Error("no messaging")) : Promise.resolve();
    },
    handOver: (h) => {
      calls.push("hand over");
      handedOver = h;
      return Promise.resolve();
    },
    startEmail: () => {
      calls.push("start send-email");
      return Promise.resolve("send-email-abc");
    },
    log: () => undefined,
  };
  return { fake, calls, handedOver: () => handedOver };
}

test("a changed copy: published, handed over, send-email started, the lock released last", async () => {
  const s = steps("changed");
  expect(await updateSchedule(s.fake, "")).toEqual({
    result: "changed",
    published: true,
    emailed: true,
    failed: false,
  });
  expect(s.calls).toEqual([
    "lock",
    "copy",
    "publish",
    "tell open apps",
    "notify",
    "hand over",
    "start send-email",
    "release",
  ]);
  expect(s.handedOver()).toEqual({
    result: "changed",
    published: true,
    trigger: "",
    files: { "website.json": "{}" },
  });
});

test("the same schedule: nothing published, the emails still get their turn", async () => {
  const s = steps("same");
  expect((await updateSchedule(s.fake, "")).published).toBe(false);
  expect(s.calls).toEqual(["lock", "copy", "hand over", "start send-email", "release"]);
});

test("a copy the check started sends no email when it works (D28)", async () => {
  const s = steps("changed");
  expect(await updateSchedule(s.fake, "wix")).toMatchObject({ published: true, emailed: false });
  expect(s.calls).toEqual([
    "lock",
    "copy",
    "publish",
    "tell open apps",
    "notify",
    "hand over",
    "release",
  ]);
  expect(s.handedOver()?.trigger).toBe("wix");
});

test("a failed copy publishes nothing and always starts send-email, for Problem", async () => {
  for (const trigger of ["", "wix"]) {
    const s = steps("failed");
    expect(await updateSchedule(s.fake, trigger)).toMatchObject({ emailed: true, failed: true });
    expect(s.calls).toEqual(["lock", "copy", "hand over", "start send-email", "release"]);
  }
});

test("a publish that fails: the run fails, and the hand-over says nothing was published", async () => {
  const s = steps("changed", { publishFails: true });
  expect(await updateSchedule(s.fake, "")).toMatchObject({ published: false, failed: true });
  expect(s.handedOver()?.published).toBe(false);
  expect(s.calls.at(-1)).toBe("release");
});

test("open apps are told right after a publish; a record that can't be written fails nothing", async () => {
  const s = steps("changed", { tellFails: true });
  expect(await updateSchedule(s.fake, "wix")).toMatchObject({ published: true, failed: false });
  expect(s.calls.slice(2, 4)).toEqual(["publish", "tell open apps"]);
  const none = steps("changed", { publishFails: true });
  await updateSchedule(none.fake, "");
  expect(none.calls).not.toContain("tell open apps");
});

test("notifications go after the publish; failing to send fails nothing (NT-16, NT-21)", async () => {
  const s = steps("changed", { notifyFails: true });
  expect(await updateSchedule(s.fake, "wix")).toMatchObject({ published: true, failed: false });
  expect(s.calls.slice(2, 5)).toEqual(["publish", "tell open apps", "notify"]);
  const none = steps("changed", { publishFails: true });
  await updateSchedule(none.fake, "");
  expect(none.calls).not.toContain("notify");
  const same = steps("same");
  await updateSchedule(same.fake, "");
  expect(same.calls).not.toContain("notify");
});

test("the lock is released when a step throws", async () => {
  const s = steps("changed");
  s.fake.handOver = () => Promise.reject(new Error("bucket down"));
  await expect(updateSchedule(s.fake, "")).rejects.toThrow("bucket down");
  expect(s.calls.at(-1)).toBe("release");
});

// ---- send-email ----

const events: unknown[] = Object.values(fixtures);
const feed = (list: unknown[] = events): FeedEnvelope => ({
  generatedAt: "2026-10-09T14:58:00Z",
  window: { from: "2026-10-08T04:00:00Z", to: "2027-11-13T04:00:00Z" },
  access: "visitor",
  count: list.length,
  events: list,
});

/** The copy's files for the website as `list`. */
const copyFiles = (list: unknown[] = events): Record<string, string> => ({
  "website.json": JSON.stringify(feed(list)),
});

test("Schedule changes: none before a read is kept, none for the same website", () => {
  expect(scheduleChanges(copyFiles(), null)).toBeNull();
  expect(scheduleChanges(copyFiles(), JSON.stringify(feed()))).toBeNull();
  expect(scheduleChanges({}, JSON.stringify(feed()))).toBeNull();
});

test("Schedule changes: worked out here, from the website now and the read kept (D62)", () => {
  const earlier = JSON.stringify(feed(events.slice(1)));
  const changes = scheduleChanges(copyFiles(), earlier);
  expect(changes?.changes.added).toHaveLength(1);
  expect(changes?.changes.readAt).toBe("2026-10-09T14:58:00Z");
});

function mailSteps(handOver: HandOver | null, earlier: string | null = null) {
  const seen: { files?: Record<string, string>; args?: string[]; read?: string } = {};
  const fake: SendEmailSteps = {
    readHandOver: (run) => {
      seen.read = run;
      return Promise.resolve(handOver && JSON.stringify(handOver));
    },
    earlierWebsite: () => Promise.resolve(earlier),
    writeFiles: (files) => {
      seen.files = files;
      return Promise.resolve();
    },
    mail: (args) => {
      seen.args = args;
      return Promise.resolve(0);
    },
    log: () => undefined,
  };
  return { fake, seen };
}

test("after a copy: the mailer gets the copy's files and this job's Schedule changes", async () => {
  const handOver: HandOver = {
    result: "changed",
    published: true,
    trigger: "",
    files: { ...copyFiles(), "changes.json": "the copy's own, never used" },
  };
  const m = mailSteps(handOver, JSON.stringify(feed(events.slice(1))));
  expect(await sendEmail(m.fake, { run: "update-schedule-xyz" })).toBe(0);
  expect(m.seen.read).toBe("update-schedule-xyz");
  expect(m.seen.args).toEqual(["after-copy", "--result", "changed", "--published"]);
  expect(Object.keys(m.seen.files ?? {}).sort()).toEqual(["changes.json", "website.json"]);
  expect(m.seen.files?.["changes.json"]).toContain('"added"');
});

test("after a failed copy: Problem's file as it is, no Schedule changes", async () => {
  const handOver: HandOver = {
    result: "failed",
    published: false,
    trigger: "wix",
    files: { "problem.json": '{"problem":"Unreadable"}' },
  };
  const m = mailSteps(handOver, JSON.stringify(feed()));
  await sendEmail(m.fake, { run: "r" });
  expect(m.seen.args).toEqual(["after-copy", "--result", "failed"]);
  expect(m.seen.files).toEqual({ "problem.json": '{"problem":"Unreadable"}' });
});

test("one email by name, as its timer or a person asks", async () => {
  const timer = mailSteps(null);
  await sendEmail(timer.fake, { email: "events", scheduled: true });
  expect(timer.seen.args).toEqual(["events", "--to", "list", "--scheduled"]);
  const alarm = mailSteps(null);
  await sendEmail(alarm.fake, { email: "behind", since: "2026-11-12T01:45:00Z" });
  expect(alarm.seen.args).toEqual(["behind", "--to", "list", "--since", "2026-11-12T01:45:00Z"]);
  const person = mailSteps(null);
  await sendEmail(person.fake, { email: "duplicates", to: "me" });
  expect(person.seen.args).toEqual(["duplicates", "--to", "me"]);
});

test("a test email: the job run with EMAIL=test runs the mailer's test (the only way to send a real one)", async () => {
  const m = mailSteps(null);
  await sendEmail(m.fake, { email: "test" });
  expect(m.seen.args).toEqual(["test", "--to", "list"]);
});

test("a run with no hand-over, or nothing asked, fails and sends nothing", async () => {
  const m = mailSteps(null);
  await expect(sendEmail(m.fake, { run: "missing" })).rejects.toThrow("No hand-over");
  await expect(sendEmail(m.fake, {})).rejects.toThrow("Nothing asked");
  expect(m.seen.args).toBeUndefined();
});

test("the copy's files go to a folder and back by name; a path is refused", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "hand-over-"));
  await writeMailFiles(dir, { "website.json": "{}", "problem.json": "p" });
  expect(await readFile(path.join(dir, "problem.json"), "utf8")).toBe("p");
  expect(await readMailFiles(dir)).toEqual({ "website.json": "{}", "problem.json": "p" });
  expect(await readMailFiles(path.join(dir, "none"))).toEqual({});
  await expect(writeMailFiles(dir, { "../escape.json": "x" })).rejects.toThrow("Not a file name");
});
