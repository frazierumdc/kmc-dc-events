// pnpm copy  reads the website's events and builds the schedule phones download
//            (docs/architecture/data-pipeline.md). Publishes nothing itself: on a change it
//            writes <out>/v2/feed/ for the workflow to deploy.
//
// Options:
//   --from-file <file>  a saved feed (pnpm feed:capture) instead of the live one
//   --published <url>   the site to compare with (default PUBLISHED_URL, from the environment
//                       or the gitignored .env at the repository root; nothing is read from
//                       GitHub, D57); "none" compares
//                       with nothing
//   --out <dir>         where to write (default .copy/)
//   --featured <file>   featured.json from the stage's bucket (EV-44); without it, the
//                       published schedule's featured events are kept
//
// Writes <out>/summary.md every run, and <out>/mail/ the emails' inputs (mail-inputs.ts):
// problem.json on a failure; after a copy that passed its checks, website.json (all the
// website's events now, whatever their status: what the send-email job compares for the
// Schedule changes email, D62; none when that read failed), and duplicates.json when there
// are any.
// On a change, <out>/notify.json: the notifications for cancelled and moved events, against
// the published schedule (D65), sent by the update job after its publish. Exit codes: 0 the same as published, 10 changed,
// 1 a check failed (nothing to publish), 2 usage. The token comes from WIX_FEED_TOKEN or the
// dev project's Secret Manager (feed-token.ts, D61); WIX_FEED_URL overrides the feed's address
// and WIX_ALL_EVENTS_URL the record's (by default allEvents beside the feed).

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  FeaturedFile,
  FeedEnvelope,
  ManifestV2,
  notifyChanges,
  SiteSettings,
  SnapshotV2,
} from "@kmcdc/domain";
import { copyWebsite, deliveryLine, failureSummary } from "./copy-website.ts";
import { loadDotEnv, ROOT, syncSettings } from "./config.ts";
import { FeedError, fetchFeed } from "./fetch-feed.ts";
import { feedToken } from "./feed-token.ts";
import { mailInputs, type ProblemFile } from "./mail-inputs.ts";

const { values } = parseArgs({
  options: {
    "from-file": { type: "string" },
    published: { type: "string" },
    out: { type: "string" },
    featured: { type: "string" },
  },
});
const { cwd } = syncSettings();
const outDir = values.out ? path.resolve(cwd, values.out) : path.join(ROOT, ".copy");
if (!values.published && !syncSettings().publishedUrl) loadDotEnv();
const publishedFrom: string =
  values.published ||
  syncSettings().publishedUrl ||
  usage(
    "Set PUBLISHED_URL (the site the schedule is published to) in the shell or in .env, or pass --published <url>.",
  );

function usage(message: string): never {
  console.error(message);
  process.exit(2);
}

const mailDir = path.join(outDir, "mail");
const now = new Date();
await rm(outDir, { recursive: true, force: true });
await mkdir(mailDir, { recursive: true });

const writeJson = (file: string, value: unknown) =>
  writeFile(path.join(mailDir, file), `${JSON.stringify(value)}\n`);
const finish = async (summary: string, code: number) => {
  await writeFile(path.join(outDir, "summary.md"), summary);
  console.log(summary);
  process.exit(code);
};
const fail = async (problem: string) => {
  const file: ProblemFile = {
    problem,
    failedAt: now.toISOString(),
    lastPublishedAt: published ? published.publishedAt : await lastPublishedAt(),
  };
  await writeJson("problem.json", file);
  return finish(failureSummary(problem), 1);
};

/** When the site's schedule was published, from its manifest; null for none, undefined if unknown. */
async function lastPublishedAt(): Promise<string | null | undefined> {
  if (publishedFrom === "none") return null;
  try {
    const response = await fetch(`${publishedFrom.replace(/\/+$/, "")}/v2/feed/manifest.json`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 404) return null;
    if (!response.ok) return undefined;
    return ManifestV2.parse(await response.json()).publishedAt;
  } catch {
    return undefined;
  }
}

const site = SiteSettings.parse(
  JSON.parse(await readFile(path.join(ROOT, "data/site.json"), "utf8")),
);

let published: SnapshotV2 | null = null;
let feed: FeedEnvelope;
const fromFile = values["from-file"];
// Read beside the feed, so the copy takes no longer; a saved feed stands in for it.
const allEvents = fromFile ? null : readAllEvents();
try {
  feed = fromFile
    ? FeedEnvelope.parse(JSON.parse(await readFile(path.resolve(cwd, fromFile), "utf8")))
    : await fetchFeed({ token: feedToken(), url: syncSettings().feedUrl });
} catch (error) {
  if (!(error instanceof FeedError) && !(error instanceof Error && fromFile)) throw error;
  await fail(`Unreadable: ${error.message}`);
  throw error; // unreachable: fail() exits
}

if (publishedFrom !== "none") {
  const url = `${publishedFrom.replace(/\/+$/, "")}/v2/feed/latest.json`;
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  } catch (error) {
    await fail(`Could not read the published schedule at ${url}: ${(error as Error).message}`);
    throw error;
  }
  if (response.ok) {
    // A published schedule this code can't read is replaced, as if there were none.
    const parsed = SnapshotV2.safeParse(await response.json().catch(() => null));
    published = parsed.success ? parsed.data : null;
  } else if (response.status !== 404) {
    await fail(`Could not read the published schedule at ${url} (${String(response.status)}).`);
  }
}

// The featured events' pages (EV-44); a file that can't be read keeps the published ones.
let featured: string[] | null = null;
if (values.featured) {
  const parsed = FeaturedFile.safeParse(
    JSON.parse(await readFile(path.resolve(cwd, values.featured), "utf8").catch(() => "null")),
  );
  if (parsed.success) featured = parsed.data.featured;
  else
    console.error(
      'featured.json isn\'t { "featured": [links] }; the published featured events are kept.',
    );
}

const result = copyWebsite({ feed, site, published, now, checkFreshness: !fromFile, featured });
if (result.status === "failed") await fail(result.problem);
else {
  const record = fromFile ? feed : await allEvents;
  const mail = mailInputs(result.files.snapshot, now.toISOString());
  if (record) await writeJson("website.json", record);
  if (mail.duplicates) await writeJson("duplicates.json", mail.duplicates);
  if (result.status === "changed") {
    const { snapshot, manifest, json } = result.files;
    const feedDir = path.join(outDir, "v2/feed");
    await mkdir(path.join(feedDir, "snapshots"), { recursive: true });
    await writeFile(path.join(feedDir, "snapshots", `${snapshot.version}.json`), json);
    await writeFile(path.join(feedDir, "latest.json"), json);
    await writeFile(path.join(feedDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    // Sent only after the publish, so a tapped notification finds the new schedule (NT-16).
    const notices = notifyChanges(published, snapshot, now);
    await writeFile(path.join(outDir, "notify.json"), `${JSON.stringify(notices)}\n`);
  }
  const delivery = result.status === "changed" && !fromFile ? deliveryLine(feed, now) : null;
  await finish(
    delivery ? `${result.summary}\n${delivery}\n` : result.summary,
    result.status === "changed" ? 10 : 0,
  );
}

/**
 * All the website's events now, for the Schedule changes email (AN-1). It has no part in the
 * schedule: when it can't be read the copy goes on, and that email waits for the next copy.
 */
async function readAllEvents(): Promise<FeedEnvelope | null> {
  try {
    return await fetchFeed({
      token: feedToken(),
      // Beside the feed, wherever that is.
      url: syncSettings().allEventsUrl,
      maxRetries: 1,
    });
  } catch (error) {
    console.error(
      `Couldn't read all the website's events: no Schedule changes this time. ${(error as Error).message}`,
    );
    return null;
  }
}
