import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import type { FcmSend } from "@kmcdc/domain";
import { quarterHour, sendReminders } from "./reminders.ts";

// The reminders' run (D69, NT-44, NT-45), on the golden schedule as the stage's site gives it.
const SITE = "https://your-project-id-dev.web.app";
const golden = readFileSync(
  new URL("../../../packages/domain/golden/snapshot-v2.json", import.meta.url),
  "utf8",
);
const manifest = JSON.stringify({
  schema: 2,
  version: (JSON.parse(golden) as { version: string }).version,
  publishedAt: "2026-10-12T16:00:00Z",
  snapshots: { "2": "/v2/feed/snapshots/golden.json" },
  schedule: "0123456789abcdef",
  minAppBuild: "0",
  message: "",
});
const site =
  (status = 200): typeof fetch =>
  (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (status !== 200) return Promise.resolve(new Response("", { status }));
    return Promise.resolve(new Response(url.includes("manifest.json") ? manifest : golden));
  };
function run(due: string, options: { now?: string; fetch?: typeof fetch; fail?: boolean } = {}) {
  const sent: FcmSend[] = [];
  const lines: string[] = [];
  const result = sendReminders({
    site: SITE,
    due: new Date(due),
    now: new Date(options.now ?? due),
    fetch: options.fetch ?? site(),
    send: (body) => {
      if (options.fail) return Promise.reject(new Error("Firebase didn't send"));
      sent.push(body);
      return Promise.resolve("sent");
    },
    log: (line) => lines.push(line),
  });
  return { result, sent, lines };
}

test("sends the reminders due in the run's 15 minutes", async () => {
  // Tuesday Rest and Reflect starts on 13 October 2026 at 6 PM Eastern.
  const { result, sent, lines } = run("2026-10-12T22:00:00Z");
  expect(await result).toBe(1);
  expect(sent[0]?.message.webpush.data.title).toBe("Tomorrow: Tuesday Rest and Reflect");
  expect(lines.at(-1)).toBe(
    "Reminders: 1 of 1 sent for the 15 minutes to 2026-10-12T22:00:00.000Z.",
  );
});

test("a run with nothing due sends nothing", async () => {
  const { result, sent } = run("2026-10-12T22:15:00Z");
  expect(await result).toBe(0);
  expect(sent).toEqual([]);
});

test("a run tried again sends the same reminders: its 15 minutes are its own", async () => {
  const { result, sent } = run("2026-10-12T22:00:00Z", { now: "2026-10-12T23:30:00Z" });
  expect(await result).toBe(1);
  expect(sent).toHaveLength(1);
});

test("more than 3 hours late, nothing is sent (NT-45)", async () => {
  const { result, sent, lines } = run("2026-10-12T22:00:00Z", { now: "2026-10-13T01:00:01Z" });
  expect(await result).toBe(0);
  expect(sent).toEqual([]);
  expect(lines[0]).toContain("more than 3 hours late");
});

test("a message that fails is logged and the run still ends well", async () => {
  const { result, lines } = run("2026-10-12T22:00:00Z", { fail: true });
  expect(await result).toBe(0);
  expect(lines[0]).toContain("Not reminded Tomorrow: Tuesday Rest and Reflect");
});

test("a site that won't answer fails the run before anything is sent, so it is tried again", async () => {
  const { result, sent } = run("2026-10-12T22:00:00Z", { fetch: site(503) });
  await expect(result).rejects.toThrow("manifest");
  expect(sent).toEqual([]);
});

test("the run's time is the quarter hour it was due", () => {
  expect(quarterHour(new Date("2026-10-12T22:00:07.412Z")).toISOString()).toBe(
    "2026-10-12T22:00:00.000Z",
  );
  expect(quarterHour(new Date("2026-10-12T22:14:59Z")).toISOString()).toBe(
    "2026-10-12T22:00:00.000Z",
  );
});
