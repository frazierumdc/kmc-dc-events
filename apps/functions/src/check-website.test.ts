import { describe, expect, test } from "vitest";
import site from "../../../data/site.json" with { type: "json" };
import { SiteSettings, type FeedEnvelope } from "@kmcdc/domain";
import fixtures from "@kmcdc/sync/fixtures/wix-events.json" with { type: "json" };
import { copyWebsite } from "@kmcdc/sync";
import {
  alarmEmail,
  behindMessage,
  behindSince,
  checkMessage,
  checkTask,
  mayStart,
  publishedSchedule,
  runKey,
  sameSecret,
  scheduleCheck,
  type Published,
} from "./check-website.ts";

// The check after a Wix signal (D28, D64): one per 5-second window; only a moved, new or
// cancelled event counts; compared with what the copy published, by its manifest.

const settings = SiteSettings.parse(site);
const NOW = new Date("2026-10-09T15:00:00Z");
const events: unknown[] = Object.values(fixtures);
const feed = (list: unknown[] = events): FeedEnvelope => ({
  generatedAt: "2026-10-09T14:58:00Z",
  window: { from: "2026-10-08T04:00:00Z", to: "2027-11-13T04:00:00Z" },
  access: "visitor",
  count: list.length,
  events: list,
});

/** What a copy of `list` publishes: the check must agree with the copy about a change. */
function publish(list: unknown[] = events): Published {
  const copy = copyWebsite({
    feed: feed(list),
    site: settings,
    published: null,
    now: NOW,
    checkFreshness: false,
  });
  if (copy.status === "failed") throw new Error(copy.problem);
  const { manifest, snapshot } = copy.files;
  return { schedule: manifest.schedule ?? "", manifest, snapshot };
}
const withEvent = (i: number, change: object) =>
  events.map((e, j) => (j === i ? { ...(e as object), ...change } : e));

describe("checkTask", () => {
  test("signals in the same 5 seconds share one check, a second after the window", () => {
    const a = checkTask(new Date("2026-11-11T15:00:01Z"));
    const b = checkTask(new Date("2026-11-11T15:00:04Z"));
    expect(a.id).toBe(b.id);
    expect(a.scheduleTime.toISOString()).toBe("2026-11-11T15:00:06.000Z");
    expect(checkTask(new Date("2026-11-11T15:00:05Z")).id).not.toBe(a.id);
    // A change waits for its check at most a window and a second.
    const wait = (at: string) => checkTask(new Date(at)).scheduleTime.getTime() - Date.parse(at);
    expect(wait("2026-11-11T15:00:00Z")).toBe(6_000);
    expect(wait("2026-11-11T15:00:04.999Z")).toBe(1_001);
  });
});

describe("sameSecret", () => {
  test("only the exact secret", () => {
    expect(sameSecret("s3cret", "s3cret")).toBe(true);
    expect(sameSecret("s3cre", "s3cret")).toBe(false);
    expect(sameSecret("s3cret!", "s3cret")).toBe(false);
    expect(sameSecret(undefined, "s3cret")).toBe(false);
    expect(sameSecret("", "")).toBe(false);
  });
});

describe("scheduleCheck", () => {
  test("the website as published: no change", () => {
    expect(scheduleCheck(publish(), feed(), settings, NOW)).toEqual({
      changed: false,
      website: publish().schedule,
    });
  });

  test("only a title or description edited: no change", () => {
    expect(
      scheduleCheck(publish(), feed(withEvent(0, { title: "Renamed" })), settings, NOW).changed,
    ).toBe(false);
  });

  test("a new or a cancelled event: changed, with counts when the schedule was read", () => {
    const fewer = events.slice(1);
    expect(scheduleCheck(publish(fewer), feed(), settings, NOW)).toEqual({
      changed: true,
      website: publish().schedule,
      counts: { moved: 0, added: 1, removed: 0 },
    });
    expect(scheduleCheck(publish(), feed(fewer), settings, NOW)).toEqual({
      changed: true,
      website: publish(fewer).schedule,
      counts: { moved: 0, added: 0, removed: 1 },
    });
  });

  test("changed by the fingerprint alone, without the whole schedule", () => {
    const { schedule, manifest } = publish(events.slice(1));
    expect(scheduleCheck({ schedule, manifest }, feed(), settings, NOW)).toEqual({
      changed: true,
      website: publish().schedule,
    });
  });

  test("a publish that failed still shows: the site keeps the earlier schedule", () => {
    // The website moved on, the site didn't: every later check says changed.
    const stillPublished = publish(events.slice(1));
    expect(scheduleCheck(stillPublished, feed(), settings, NOW).changed).toBe(true);
    expect(scheduleCheck(stillPublished, feed(), settings, NOW).changed).toBe(true);
  });

  test("nothing published, or unreadable: changed, so the update job decides", () => {
    expect(scheduleCheck(null, feed(), settings, NOW)).toEqual({
      changed: true,
      website: publish().schedule,
      notCompared: "nothing published yet",
    });
    expect(scheduleCheck("unreadable", feed(), settings, NOW)).toEqual({
      changed: true,
      website: publish().schedule,
      notCompared: "the published schedule couldn't be read",
    });
  });
});

describe("checkMessage", () => {
  test("no change: nothing started", () => {
    expect(checkMessage({ changed: false }, "dev")).toBe(
      "Check: no schedule change; nothing started",
    );
  });

  test("a change: the counts and the run started", () => {
    expect(checkMessage({ changed: true, counts: { moved: 1, added: 2, removed: 0 } }, "dev")).toBe(
      "Check: schedule changed (1 moved, 2 new, 0 removed); started Update schedule on dev",
    );
  });

  test("a change at midnight, when only finished events left", () => {
    expect(checkMessage({ changed: true, counts: { moved: 0, added: 0, removed: 0 } }, "dev")).toBe(
      "Check: schedule changed (only finished events left it); started Update schedule on dev",
    );
  });

  test("not compared: says why", () => {
    expect(checkMessage({ changed: true, notCompared: "nothing published yet" }, "dev")).toBe(
      "Check: nothing published yet; started Update schedule on dev",
    );
  });
});

describe("mayStart", () => {
  const key = runKey({ changed: true, website: "abc123" });
  let clock = 0;
  const run = (title: string, done = true, succeeded = false, minute = (clock += 1)) => ({
    title,
    started: new Date(NOW.getTime() - (100 - minute) * 60_000),
    done,
    succeeded,
  });
  const mine = `Update schedule (${key})`;

  test("names a copy after the website's state", () => {
    expect(key).toBe("wix abc123");
    expect(runKey({ changed: true })).toBe("wix unknown");
  });

  test("starts when nothing was tried for this state", () => {
    expect(mayStart([], key)).toBe("start");
    expect(mayStart([run("Update schedule", true, true)], key)).toBe("start");
    expect(mayStart([run("Update schedule (wix other)", true, true)], key)).toBe("start");
  });

  test("not while a copy waits or runs: it reads the website as it is then", () => {
    expect(mayStart([run("Update schedule", false)], key)).toBe("running");
  });

  test("a failed copy is tried again, three times in all", () => {
    expect(mayStart([run(mine)], key)).toBe("start");
    expect(mayStart([run(mine), run(mine)], key)).toBe("start");
    expect(mayStart([run(mine), run(mine), run(mine)], key)).toBe("gave up");
  });

  test("a copy that succeeded while the site still differs: never a loop", () => {
    expect(mayStart([run(mine, true, true)], key)).toBe("disagree");
  });

  test("a website edited back to an earlier state is copied again (12 November 2026)", () => {
    // An event moved at 04:24 and copied, moved again and copied, then moved back.
    const earlier = run(mine, true, true, 10);
    const other = run("Update schedule (wix other)", true, true, 20);
    expect(mayStart([earlier, other], key)).toBe("start");
    // A copy by the timer or by hand publishes too.
    expect(mayStart([earlier, run("Update schedule ()", true, true, 20)], key)).toBe("start");
    // A failed copy of another state published nothing, so it still disagrees.
    expect(mayStart([earlier, run("Update schedule (wix other)", true, false, 20)], key)).toBe(
      "disagree",
    );
    // And the copy after it counts again.
    expect(mayStart([earlier, other, run(mine, true, true, 30)], key)).toBe("disagree");
  });

  test("the log says why nothing started", () => {
    const check = { changed: true, website: "abc123" };
    expect(checkMessage(check, "dev", "running")).toBe(
      "Check: the site differs from the website, but a copy is already waiting or running; nothing more started",
    );
    expect(checkMessage(check, "dev", "disagree")).toContain("already succeeded");
    expect(checkMessage(check, "dev", "gave up")).toContain("3 copies for this already failed");
  });
});

describe("publishedSchedule", () => {
  const SITE = "https://p.web.app";
  const serve = (answers: Record<string, Response>) => {
    const calls: string[] = [];
    const fetch = (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : input.toString();
      calls.push(url);
      const path = new URL(url).pathname;
      return Promise.resolve(answers[path] ?? new Response("<html>", { status: 200 }));
    };
    return { calls, fetch };
  };

  test("reads only the manifest when it has a fingerprint, past Hosting's cache", async () => {
    const { manifest } = publish();
    const { calls, fetch } = serve({ "/v2/feed/manifest.json": Response.json(manifest) });
    const published = await publishedSchedule({ site: SITE, now: NOW, fetch });
    expect(published?.schedule).toBe(manifest.schedule);
    expect(calls).toEqual([`${SITE}/v2/feed/manifest.json?check=${String(NOW.getTime())}`]);
  });

  test("a manifest from before fingerprints: worked out from its schedule", async () => {
    const { manifest, snapshot, schedule } = publish();
    const old = { ...manifest, schedule: undefined };
    const { fetch } = serve({
      "/v2/feed/manifest.json": Response.json(old),
      [manifest.snapshots["2"]]: Response.json(snapshot),
    });
    expect((await publishedSchedule({ site: SITE, now: NOW, fetch }))?.schedule).toBe(schedule);
  });

  test("nothing published: null, for a 404 and for Hosting's app page", async () => {
    const missing = serve({ "/v2/feed/manifest.json": new Response("", { status: 404 }) });
    expect(await publishedSchedule({ site: SITE, fetch: missing.fetch })).toBeNull();
    expect(await publishedSchedule({ site: SITE, fetch: serve({}).fetch })).toBeNull();
  });

  test("the site failing: throws, so the check starts the update job", async () => {
    const { fetch } = serve({ "/v2/feed/manifest.json": new Response("", { status: 503 }) });
    await expect(publishedSchedule({ site: SITE, fetch })).rejects.toThrow("(503)");
  });
});

describe("behindSince", () => {
  const now = new Date("2026-11-12T02:00:00Z");
  const key = "wix abc123";
  const run = (title: string, minutesAgo: number, done = true) => ({
    title,
    started: new Date(now.getTime() - minutesAgo * 60_000),
    done,
    succeeded: done,
  });
  const mine = `Update schedule (${key})`;

  test("not behind before 15 minutes, or with no copy for this state", () => {
    expect(behindSince([], key, now)).toBeNull();
    expect(behindSince([run(mine, 14)], key, now)).toBeNull();
    expect(behindSince([run("Update schedule (wix other)", 60)], key, now)).toBeNull();
    expect(behindSince([run("Update schedule", 60)], key, now)).toBeNull();
  });

  test("behind since the first copy for this state, once that is 15 minutes ago", () => {
    expect(behindSince([run(mine, 5), run(mine, 15), run(mine, 10)], key, now)).toEqual(
      new Date("2026-11-12T01:45:00Z"),
    );
  });

  test("a website edited back to an earlier state is behind only since its new copy", () => {
    const back = [run(mine, 120), run("Update schedule (wix other)", 90), run(mine, 20)];
    expect(behindSince(back, key, now)).toEqual(new Date("2026-11-12T01:40:00Z"));
    expect(behindSince(back.slice(0, 2), key, now)).toBeNull();
  });

  test("a copy that still waits or runs after 15 minutes counts, whoever started it", () => {
    expect(behindSince([run("Update schedule", 50, false)], key, now)).toEqual(
      new Date("2026-11-12T01:10:00Z"),
    );
    expect(behindSince([run("Update schedule", 3, false)], key, now)).toBeNull();
  });

  test("the log line the alert counts", () => {
    expect(behindMessage(new Date("2026-11-12T01:45:00Z"))).toBe(
      "Behind the website since 2026-11-12T01:45:00.000Z: the site still differs from the website",
    );
  });
});

describe("alarmEmail", () => {
  const now = new Date("2026-11-12T12:00:00Z");
  const run = (email: string, hoursAgo: number) => ({
    title: `Send email (${email})`,
    started: new Date(now.getTime() - hoursAgo * 3_600_000),
  });

  test("behind: started when none was in the last 24 hours", () => {
    expect(alarmEmail([], true, now)).toBe("behind");
    expect(alarmEmail([run("events", 1)], true, now)).toBe("behind");
    expect(alarmEmail([run("behind", 24.5)], true, now)).toBe("behind");
    expect(alarmEmail([run("behind", 2)], true, now)).toBeNull();
  });

  test("behind again after it worked: still once a day", () => {
    expect(alarmEmail([run("working", 1), run("behind", 2)], true, now)).toBeNull();
  });

  test("matching again: working once, after the last behind", () => {
    expect(alarmEmail([run("behind", 2)], false, now)).toBe("working");
    expect(alarmEmail([run("behind", 2), run("working", 1)], false, now)).toBeNull();
    expect(alarmEmail([run("events", 1)], false, now)).toBeNull();
    expect(alarmEmail([], false, now)).toBeNull();
  });
});
