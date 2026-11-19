// The check after a Wix signal (D28, D64): read the website through the feed, compare it with
// the schedule published on the site, the one phones load, and say whether the schedule
// changed: an event moved, added or removed. A publish that failed still shows as a
// difference, so nothing hides. Everything here is injected or pure, so it runs in tests
// without Google.

import {
  ManifestV2,
  SnapshotV2,
  upcomingChanges,
  type FeedEnvelope,
  type SiteSettings,
} from "@kmcdc/domain";
import { scheduleFingerprint, websiteSchedule } from "@kmcdc/sync";

/**
 * How long the function gathers signals before one check: one check per window at most.
 * 5 seconds (owner, 12 November 2026): a change waits for the check at most that long, and
 * the signals Wix sends for one save or publish still give one check, not one each.
 */
export const WINDOW_MS = 5_000;

/**
 * The task for a signal at `now`: one per 5-second window, so a burst of edits gives one
 * check, run a second after its window ends.
 */
export function checkTask(now: Date): { id: string; scheduleTime: Date } {
  const window = Math.floor(now.getTime() / WINDOW_MS);
  return {
    id: `check-${String(window)}`,
    scheduleTime: new Date((window + 1) * WINDOW_MS + 1_000),
  };
}

/** Compares a signal's secret with the stage's, in constant time. */
export function sameSecret(given: string | undefined, expected: string): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** What the site has published, as far as the check needs it. */
export interface Published {
  /** The manifest's fingerprint of which events are listed and when (D64). */
  schedule: string;
  manifest: ManifestV2;
  /** The whole schedule, when it was read: for the log's counts. */
  snapshot?: SnapshotV2;
}

export interface ScheduleCheck {
  changed: boolean;
  /** The website's fingerprint now, when its schedule could be built. */
  website?: string;
  /** How the upcoming events differ, when both schedules were read. */
  counts?: { moved: number; added: number; removed: number };
  /** Why nothing was compared, when nothing was: then `changed` is true, so the job decides. */
  notCompared?:
    | "nothing published yet"
    | "the published schedule couldn't be read"
    | "a schedule couldn't be built";
}

/**
 * Whether the website's schedule differs from the published one: an event moved (date, start
 * or end), added or cancelled (owner, 10 November 2026), by their fingerprints, built by the
 * same code as the copy's. A title or a description doesn't count. Without a published
 * schedule, with one that couldn't be read ("unreadable"), or when the website's can't be
 * built, it says changed, so the update job decides.
 */
export function scheduleCheck(
  published: Published | null | "unreadable",
  feed: FeedEnvelope,
  site: SiteSettings,
  now: Date,
): ScheduleCheck {
  const schedule = websiteSchedule(feed, site, now);
  if (!schedule) return { changed: true, notCompared: "a schedule couldn't be built" };
  const website = scheduleFingerprint(schedule.events);
  if (published === "unreadable")
    return { changed: true, website, notCompared: "the published schedule couldn't be read" };
  if (!published) return { changed: true, website, notCompared: "nothing published yet" };
  if (website === published.schedule) return { changed: false, website };
  if (!published.snapshot) return { changed: true, website };
  const c = upcomingChanges(published.snapshot, schedule, now);
  return {
    changed: true,
    website,
    counts: { moved: c.moved.length, added: c.added.length, removed: c.removed.length },
  };
}

/** How long the guard looks back, and how many copies one state of the website may start. */
export const GUARD_MS = 6 * 60 * 60_000;
export const MAX_TRIES = 3;

/** What a copy started for a state of the website is called, so later checks can find it. */
export const runKey = (check: ScheduleCheck) => `wix ${check.website ?? "unknown"}`;

interface RunSeen {
  title: string;
  started: Date;
  done: boolean;
  succeeded: boolean;
}

/**
 * The copies tried for this state of the website since a copy last succeeded for another
 * state (or by the timer or by hand). A website edited back to an earlier state (an event
 * moved and moved back) is new again once another copy has published since.
 */
function triedSinceOther<T extends RunSeen>(runs: readonly T[], key: string): T[] {
  const mine = (r: RunSeen) => r.title.includes(`(${key})`);
  const lastOther = Math.max(
    -Infinity,
    ...runs.filter((r) => !mine(r) && r.done && r.succeeded).map((r) => r.started.getTime()),
  );
  return runs.filter((r) => mine(r) && r.started.getTime() > lastOther);
}

/**
 * Whether a check that found a difference may start a copy, given the stage's recent runs
 * (D64): not while one is waiting or running (it will read the website as it is then); not
 * when a copy for this same state of the website already succeeded and the site still
 * differs, as then the copy and the check disagree and more copies would change nothing; and
 * not after three tries. So one state of the website starts at most three copies in six
 * hours, counted from the last copy that published another state.
 */
export function mayStart(
  runs: readonly RunSeen[],
  key: string,
): "start" | "running" | "disagree" | "gave up" {
  if (runs.some((r) => !r.done)) return "running";
  const tried = triedSinceOther(runs, key);
  if (tried.some((r) => r.succeeded)) return "disagree";
  return tried.length >= MAX_TRIES ? "gave up" : "start";
}

/** How long the site may differ from the website before a person is told (NT-8, D64). */
export const BEHIND_MS = 15 * 60_000;
/** While it stays behind, the Problem email is started at most this often (AN-4). */
export const EMAIL_EVERY_MS = 24 * 60 * 60_000;

/**
 * Since when the site has been behind the website, or null while that is under 15 minutes:
 * from the first copy started for this state of the website, or a copy still waiting or
 * running that holds the next one back. A check that can't start a copy at all fails, and
 * the alert for checks that stopped tells of it.
 */
export function behindSince(runs: readonly RunSeen[], key: string, now: Date): Date | null {
  const times = [...runs.filter((r) => !r.done), ...triedSinceOther(runs, key)].map((r) =>
    r.started.getTime(),
  );
  if (times.length === 0) return null;
  const first = Math.min(...times);
  return now.getTime() - first >= BEHIND_MS ? new Date(first) : null;
}

/** The log line Cloud Monitoring's "behind" alert counts (scripts/setup-delivery-alerts.sh). */
export const behindMessage = (since: Date) =>
  `Behind the website since ${since.toISOString()}: the site still differs from the website`;

/** What Send email's runs are called when the check starts them (apps/job: its EMAIL setting). */
export const BEHIND_RUN = "(behind)";
export const WORKING_RUN = "(working)";

/**
 * Which email the check starts, from Send email's runs of the last 25 hours (NT-8): "behind"
 * when the site is behind and none was started in the last 24 hours; "working" when the site
 * matches again and the last one started said behind. The mailer's own once-a-day rule
 * (AN-4) still decides whether an email goes.
 */
export function alarmEmail(
  mailRuns: readonly { title: string; started: Date }[],
  behind: boolean,
  now: Date,
): "behind" | "working" | null {
  const alarms = mailRuns
    .filter((r) => r.title.includes(BEHIND_RUN) || r.title.includes(WORKING_RUN))
    .sort((a, b) => b.started.getTime() - a.started.getTime());
  const last = alarms[0];
  if (behind) {
    const lastBehind = alarms.find((r) => r.title.includes(BEHIND_RUN));
    return lastBehind && now.getTime() - lastBehind.started.getTime() < EMAIL_EVERY_MS
      ? null
      : "behind";
  }
  return last?.title.includes(BEHIND_RUN) ? "working" : null;
}

/** The log line for a check on a stage (`dev`, `test`, `prod`): what was found, and whether Update schedule started. */
export function checkMessage(
  check: ScheduleCheck,
  stage: string,
  start: ReturnType<typeof mayStart> = "start",
): string {
  if (!check.changed) return "Check: no schedule change; nothing started";
  if (start !== "start") {
    const why = {
      running: "a copy is already waiting or running; nothing more started",
      disagree: "a copy for this already succeeded and the site still differs; nothing started",
      "gave up": `${String(MAX_TRIES)} copies for this already failed; nothing more started`,
    }[start];
    return `Check: the site differs from the website, but ${why}`;
  }
  if (check.notCompared) return `Check: ${check.notCompared}; started Update schedule on ${stage}`;
  const c = check.counts;
  const what = !c
    ? "schedule changed"
    : c.moved + c.added + c.removed === 0
      ? "schedule changed (only finished events left it)"
      : `schedule changed (${String(c.moved)} moved, ${String(c.added)} new, ${String(c.removed)} removed)`;
  return `Check: ${what}; started Update schedule on ${stage}`;
}

export interface PublishedOptions {
  /** The site, e.g. `https://your-project-id-dev.web.app`. */
  site: string;
  now?: Date;
  fetch?: typeof globalThis.fetch;
}

/**
 * The schedule published on the site: its manifest's fingerprint, under 1 KB to read. Null
 * when nothing is published. A manifest from before fingerprints existed gets one worked out
 * from its schedule. Throws when the site won't answer.
 */
export async function publishedSchedule(options: PublishedOptions): Promise<Published | null> {
  const { site, now = new Date(), fetch = globalThis.fetch } = options;
  // A new address each time, so Hosting's servers never answer with a manifest from before
  // the last publish.
  const get = (path: string) =>
    fetch(`${site}${path}?check=${String(now.getTime())}`, { signal: AbortSignal.timeout(20_000) });
  const res = await get("/v2/feed/manifest.json");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`The site didn't give its manifest (${String(res.status)})`);
  // Hosting answers a missing file with the app's page: not a manifest, so nothing published.
  const manifest = ManifestV2.safeParse(await res.json().catch(() => null));
  if (!manifest.success) return null;
  if (manifest.data.schedule) return { schedule: manifest.data.schedule, manifest: manifest.data };
  const snapshot = await publishedSnapshot(options, manifest.data);
  return snapshot
    ? { schedule: scheduleFingerprint(snapshot.events), manifest: manifest.data, snapshot }
    : null;
}

/** The whole published schedule the manifest names; null when it can't be read as one. */
export async function publishedSnapshot(
  { site, fetch = globalThis.fetch }: PublishedOptions,
  manifest: ManifestV2,
): Promise<SnapshotV2 | null> {
  const res = await fetch(`${site}${manifest.snapshots["2"]}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`The site didn't give its schedule (${String(res.status)})`);
  const snapshot = SnapshotV2.safeParse(await res.json().catch(() => null));
  return snapshot.success ? snapshot.data : null;
}
