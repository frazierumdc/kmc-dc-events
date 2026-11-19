import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { findDuplicates, SnapshotV2, SnapshotV2Event } from "@kmcdc/domain";
import dupFixture from "@kmcdc/domain/fixtures/duplicates-2026-10-16.json" with { type: "json" };
import { afterAll, beforeAll, expect, test } from "vitest";
import latest from "@kmcdc/domain/fixtures/schedule-2026-10-17.json" with { type: "json" };
import fixture from "../fixtures/schedule-2026-10-16.json" with { type: "json" };

// `pnpm mail <type> <file>` as the Update schedule workflow's mail job runs it, with the fake
// sender: the files `pnpm copy` writes in, one email per command out, title-case subjects with
// no tag (AN-11). Real events from the dev schedule of 16 Oct 2026.

const CLI = path.join(import.meta.dirname, "cli.ts");
let dir: string;
let outbox: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "mail-cli-"));
  outbox = path.join(dir, "outbox");
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** Runs the command; resolves with its exit code and output. */
function mail(args: string[], env: Record<string, string> = {}) {
  return new Promise<{ code: number; out: string }>((resolve) => {
    const clean = Object.fromEntries(
      Object.entries(process.env).filter(
        ([k]) => !k.startsWith("GITHUB_") && !k.startsWith("MAIL"),
      ),
    );
    execFile(
      process.execPath,
      [CLI, ...args],
      {
        env: {
          ...clean,
          MAIL_ENV: "fake",
          // The repository's address is given, as in CI, so the checkout's git remote is never
          // read: the suite passes in a copy with no `origin`. A placeholder, not a real repository.
          GITHUB_REPOSITORY: "example-org/events-app",
          MAIL_OUTBOX: outbox,
          MAIL_STATE_FILE: path.join(dir, "state.json"),
          INIT_CWD: dir,
          ...env,
        },
      },
      (error, stdout, stderr) => {
        resolve({ code: error ? Number(error.code) : 0, out: `${stdout}${stderr}` });
      },
    );
  });
}

async function input(name: string, value: unknown) {
  await writeFile(path.join(dir, name), JSON.stringify(value));
  return name;
}

/** The subjects of the emails written since `before`. */
async function subjects(before: string[] = []) {
  const files = (await readdir(outbox).catch(() => [])).filter((f) => !before.includes(f));
  return Promise.all(
    files.map(async (f) => {
      const raw = /^Subject: (.*)$/m.exec(await readFile(path.join(outbox, f), "utf8"))?.[1] ?? "";
      // Subjects with characters outside ASCII (the en dash) are encoded.
      const b64 = /^=\?UTF-8\?B\?(.*)\?=$/.exec(raw)?.[1];
      return b64 ? Buffer.from(b64, "base64").toString("utf8") : raw;
    }),
  );
}

const schedule = SnapshotV2.parse(fixture);
const COPIED = "2026-10-16T20:07:30Z";

test("changes: one Schedule changes email to management", async () => {
  const richmond = schedule.events.find((e) => e.title.startsWith("Richmond"));
  if (!richmond) throw new Error("no Richmond class");
  const { id, title, start, end, allDay, page } = richmond;
  const changes = {
    readAt: COPIED,
    moved: [],
    added: [{ id, title, start, end, allDay, place: "Diversity Thrift", page }],
    cancelled: [],
    removed: [],
    edited: [],
  };
  const file = await input("changes.json", { changes });
  const seen = await readdir(outbox).catch(() => []);
  const { code, out } = await mail(["changes", file]);
  expect(code).toBe(0);
  expect(out).toContain("(1 recipient)");
  expect(out).not.toContain("@");
  expect(await subjects(seen)).toEqual(["Schedule Changes: 1 New"]);
});

test("duplicates: one Duplicate events email to management", async () => {
  const events = dupFixture.events.map((e) => SnapshotV2Event.parse(e));
  const file = await input("duplicates.json", {
    duplicates: findDuplicates(events),
    site: schedule.site,
    copiedAt: COPIED,
  });
  const seen = await readdir(outbox).catch(() => []);
  expect((await mail(["duplicates", file])).code).toBe(0);
  expect(await subjects(seen)).toEqual(["Duplicate Events: 2 Listed Twice, 1 Overlap"]);
});

test("working while nothing failed sends nothing", async () => {
  const seen = await readdir(outbox).catch(() => []);
  const { code, out } = await mail(["working"]);
  expect(code).toBe(0);
  expect(out).toContain("nothing to send");
  expect(await subjects(seen)).toEqual([]);
});

test("problem: emails once a day, remembered in the mail memory; working clears it", async () => {
  const file = await input("problem.json", {
    problem: "Unreadable: Could not reach the feed: fetch failed",
    failedAt: "2026-10-17T08:07:40Z",
    lastPublishedAt: "2026-10-16T13:08:50Z",
  });
  const seen = await readdir(outbox).catch(() => []);
  expect((await mail(["problem", file])).code).toBe(0);
  const again = await mail(["problem", file]);
  expect(again.code).toBe(0);
  expect(again.out).toContain("not sent again");
  expect(await subjects(seen)).toEqual(["Schedule Copy Failed: Couldn't Read the Website"]);
  const before = await readdir(outbox);
  expect((await mail(["working"])).code).toBe(0);
  expect(await subjects(before)).toHaveLength(1);
  const state = JSON.parse(await readFile(path.join(dir, "state.json"), "utf8")) as {
    problem: unknown;
  };
  expect(state.problem).toBeNull();
});

test("a send that fails is said, exit 1 (AN-9)", async () => {
  const file = await input("duplicates-again.json", {
    duplicates: findDuplicates(dupFixture.events.map((e) => SnapshotV2Event.parse(e))),
    site: schedule.site,
    copiedAt: COPIED,
  });
  const { code, out } = await mail(["duplicates", file], {
    MAIL_ENV: "dev",
  });
  expect(code).toBe(1);
  expect(out).toMatch(/^duplicates: MAIL_ENV=dev needs .*DUPLICATE_EVENTS_EMAILS/m);
});

test("Send email: one email at once from a schedule, or a preview to just me (D55)", async () => {
  const file = await input("latest.json", latest);
  const seen = await readdir(outbox).catch(() => []);
  expect((await mail(["events", "--schedule", file])).code).toBe(0);
  expect((await mail(["program-fp", "--schedule", file, "--to", "me"])).code).toBe(0);
  const got = await subjects(seen);
  expect(got).toHaveLength(2);
  expect(got.some((s) => s.startsWith("Preview: FP Dates"))).toBe(true);
  expect(got.some((s) => s.startsWith("KMC DC Events,"))).toBe(true);
});

test("KMC DC Events by its timer, switched off: nothing sent (AN-17)", async () => {
  const file = await input("latest.json", latest);
  const seen = await readdir(outbox).catch(() => []);
  const { code, out } = await mail(["events", "--scheduled", "--schedule", file], {
    MAIL_SETTINGS: '{"events": false}',
  });
  expect(code).toBe(0);
  expect(out).toContain("switched off");
  expect(await subjects(seen)).toEqual([]);
});

test("an unknown command, a missing file or a bad option: usage, exit 2", async () => {
  expect((await mail(["bogus"])).code).toBe(2);
  expect((await mail(["changes"])).code).toBe(2);
  expect((await mail(["duplicates", "--to", "everyone"])).code).toBe(2);
  expect((await mail(["after-copy", "--dir", "x", "--result", "maybe"])).code).toBe(2);
});
