import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import fixtures from "@kmcdc/sync/fixtures/wix-events.json" with { type: "json" };
import { ROOT } from "./feed-token.ts";

// `pnpm copy` as the Update schedule workflow runs it (EV-8, EV-9): a saved feed in, the
// schedule's files and summary.md out, and the exit code the workflow publishes on.

const CLI = path.join(import.meta.dirname, "copy-cli.ts");
let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "copy-cli-"));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function feedFile(name: string, changes: Record<string, unknown> = {}) {
  const events = Object.values(fixtures);
  const file = path.join(dir, name);
  await writeFile(
    file,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      window: { from: "2026-10-08T04:00:00Z", to: "2027-11-13T04:00:00Z" },
      access: "visitor",
      count: events.length,
      events,
      ...changes,
    }),
  );
  return file;
}

/** Runs the command; resolves with its exit code. */
function copy(from: string, published: string, out: string, extra: string[] = []) {
  return new Promise<number>((resolve) => {
    execFile(
      process.execPath,
      [CLI, "--from-file", from, "--published", published, "--out", out, ...extra],
      { env: { ...process.env, INIT_CWD: dir } },
      (error) => {
        resolve(error ? Number(error.code) : 0);
      },
    );
  });
}

/** Serves `root` as the published site. */
async function serve(root: string): Promise<{ url: string; server: Server }> {
  const server = createServer((req, res) => {
    readFile(path.join(root, req.url ?? "/"))
      .then((body) => res.end(body))
      .catch(() => res.writeHead(404).end());
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("no port");
  return { url: `http://127.0.0.1:${String(address.port)}`, server };
}

test("a first schedule: exit 10, the files to publish and the summary", async () => {
  const out = path.join(dir, "first");
  expect(await copy(await feedFile("feed.json"), "none", out)).toBe(10);
  const manifest = JSON.parse(await readFile(path.join(out, "v2/feed/manifest.json"), "utf8")) as {
    version: string;
    snapshots: Record<string, string>;
  };
  expect(manifest.snapshots["2"]).toBe(`/v2/feed/snapshots/${manifest.version}.json`);
  const latest = await readFile(path.join(out, "v2/feed/latest.json"), "utf8");
  expect(await readFile(path.join(out, `v2/feed/snapshots/${manifest.version}.json`), "utf8")).toBe(
    latest,
  );
  expect(await readFile(path.join(out, "summary.md"), "utf8")).toContain(
    "## Update schedule: published",
  );
});

test("the same as the published schedule: exit 0, nothing to publish", async () => {
  const first = path.join(dir, "first-again");
  expect(await copy(await feedFile("feed.json"), "none", first)).toBe(10);
  const { url, server } = await serve(first);
  try {
    const out = path.join(dir, "same");
    expect(await copy(await feedFile("feed.json"), url, out)).toBe(0);
    expect(await readdir(out)).toEqual(["mail", "summary.md"]);
    // Nothing changed, so no Schedule changes email.
    expect(await readdir(path.join(out, "mail"))).not.toContain("changes.json");
  } finally {
    server.close();
  }
});

test("an unreadable or malformed feed: exit 1, nothing to publish, the app keeps its schedule", async () => {
  const unreadable = path.join(dir, "unreadable.json");
  await writeFile(unreadable, "not json");
  const malformed = await feedFile("malformed.json", { count: 99 });
  for (const [from, problem] of [
    [unreadable, "Unreadable"],
    [malformed, "Malformed"],
  ] as const) {
    const out = path.join(dir, problem);
    expect(await copy(from, "none", out)).toBe(1);
    expect(await readdir(out)).toEqual(["mail", "summary.md"]);
    // The Problem email's input: the reason, and no schedule published before.
    const mail = JSON.parse(await readFile(path.join(out, "mail/problem.json"), "utf8")) as {
      problem: string;
      lastPublishedAt: string | null;
    };
    expect(mail.problem).toMatch(new RegExp(`^${problem}: `));
    expect(mail.lastPublishedAt).toBeNull();
    const summary = await readFile(path.join(out, "summary.md"), "utf8");
    expect(summary).toContain(problem);
    expect(summary).toContain("The app keeps the last published schedule.");
  }
});

test("every good copy keeps the website as it read it, and never the comparison (D62)", async () => {
  const out = path.join(dir, "kept");
  expect(await copy(await feedFile("feed.json"), "none", out)).toBe(10);
  // The send-email job compares this read with the one kept at the last Schedule changes email.
  expect(existsSync(path.join(out, "mail/website.json"))).toBe(true);
  expect(existsSync(path.join(out, "mail/changes.json"))).toBe(false);
});

// Only where the repository has no .env (CI, and the Mac since D61): the CLI would read
// PUBLISHED_URL from it.
test.skipIf(existsSync(path.join(ROOT, ".env")))(
  "without a published site to compare with, it says what to set: exit 2 (D57)",
  async () => {
    const code = await new Promise<number>((resolve) => {
      const env = Object.fromEntries(
        Object.entries(process.env).filter(([k]) => k !== "PUBLISHED_URL"),
      );
      execFile(
        process.execPath,
        [CLI, "--from-file", path.join(dir, "missing.json"), "--out", path.join(dir, "unset")],
        { env: { ...env, INIT_CWD: dir } },
        (error, _stdout, stderr) => {
          expect(stderr).toContain("Set PUBLISHED_URL");
          resolve(error ? Number(error.code) : 0);
        },
      );
    });
    expect(code).toBe(2);
  },
);
