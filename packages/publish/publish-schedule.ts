// node packages/publish/publish-schedule.ts --site <Hosting site> --origin <site address>
//                                   [--schedule <folder>] [--dry-run] [--message <text>]
//
// Puts a schedule on Firebase Hosting through Hosting's API, keeping every other file of the
// version now live (D63, EV-21; packages/sync/src/hosting.ts). --schedule is the copy's
// v2/feed folder (manifest.json and the snapshot it names); without it, the schedule now on
// the site is rebuilt, which with --dry-run checks that this publisher makes the same files
// as the last deploy did. --dry-run publishes nothing and says what would change.
// The publishing account's token comes from GOOGLE_OAUTH_ACCESS_TOKEN, or inside a job from
// the metadata server. Exit 1 on a failure, 2 for usage.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { ManifestV2 } from "@kmcdc/domain";
import {
  compareFiles,
  firebaseHosting,
  hostedFile,
  keptFile,
  nextFiles,
  publishSchedule,
  type HostedFile,
} from "@kmcdc/sync";
import { publishSettings } from "./src/config.ts";
import { scheduleFiles } from "./src/schedule-files.ts";

const { values } = parseArgs({
  options: {
    site: { type: "string" },
    origin: { type: "string" },
    schedule: { type: "string" },
    message: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});
if (!values.site || !values.origin) {
  console.error(
    "Usage: node packages/publish/publish-schedule.ts --site <site> --origin <address> [--schedule <folder>] [--dry-run]",
  );
  process.exit(2);
}
const origin = values.origin.replace(/\/+$/, "");
const settings = publishSettings();
const { cwd } = settings;

async function token(): Promise<string> {
  if (settings.accessToken) return settings.accessToken;
  const response = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok) throw new Error(`No Google sign-in (${String(response.status)})`);
  return ((await response.json()) as { access_token: string }).access_token;
}

async function fromSite(sitePath: string): Promise<Uint8Array> {
  // A passing error of the site's (5xx) is tried again, twice.
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`${origin}${sitePath}`, {
      cache: "no-cache",
      signal: AbortSignal.timeout(30_000),
    });
    if (response.ok) return new Uint8Array(await response.arrayBuffer());
    if (response.status < 500 || attempt === 3)
      throw new Error(`Could not read ${sitePath} (${String(response.status)})`);
    await new Promise((r) => setTimeout(r, 1_000 * attempt));
  }
}

try {
  const folder = values.schedule ? path.resolve(cwd, values.schedule) : null;
  const manifest = folder
    ? new Uint8Array(await readFile(path.join(folder, "manifest.json")))
    : await fromSite("/v2/feed/manifest.json");
  const named = ManifestV2.parse(JSON.parse(new TextDecoder().decode(manifest)));
  const snapshotPath = named.snapshots["2"];
  const snapshot = folder
    ? new Uint8Array(await readFile(path.join(folder, snapshotPath.replace("/v2/feed/", ""))))
    : await fromSite(snapshotPath);
  const indexHtml = new TextDecoder().decode(await fromSite("/index.html"));
  const hosting = firebaseHosting({
    site: values.site,
    token,
    quotaProject: settings.quotaProject,
  });
  // Publishing a new schedule: an event that hasn't changed keeps its files on the site.
  // Rebuilding the schedule now on the site (no --schedule) makes every file, to check it.
  const live = folder
    ? {
        snapshot: await fromSite("/v2/feed/latest.json"),
        hashes: await hosting.files((await hosting.live()).version),
      }
    : null;
  const built = await scheduleFiles({ manifest, snapshot, indexHtml, origin }, live);
  const schedule = new Map<string, HostedFile>();
  let keptFiles = 0;
  for (const [name, content] of built) {
    if (typeof content === "object" && "kept" in content) {
      schedule.set(name, keptFile(content.kept));
      keptFiles += 1;
    } else schedule.set(name, hostedFile(content));
  }
  console.log(
    `Schedule ${named.version}: ${String(schedule.size - keptFiles)} files made, ${String(keptFiles)} kept from unchanged events.`,
  );
  if (values["dry-run"]) {
    // By path: which files a publish would add, replace or drop. Hashes of the same content
    // differ between machines (gzip), so "replaced" here doesn't mean the content changed.
    const live = await hosting.files((await hosting.live()).version);
    const mine = new Map([...live].filter(([p]) => !p.startsWith("/__/")));
    const diff = compareFiles(mine, nextFiles(live, schedule));
    console.log(
      `Schedule ${named.version}: ${String(schedule.size)} files of its own; the app's ${String(diff.same)} files are kept as they are; ${String(diff.added.length)} paths added, ${String(diff.removed.length)} removed.`,
    );
    for (const p of diff.added.slice(0, 10)) console.log(`  added: ${p}`);
    for (const p of diff.removed.slice(0, 10)) console.log(`  removed: ${p}`);
    if (!folder) {
      // Rebuilding the schedule now on the site: every file must be what the site serves.
      const names = [...built.keys()];
      const different: string[] = [];
      const check = async (name: string) => {
        const content = built.get(name) ?? "";
        if (typeof content === "object" && "kept" in content) return;
        const mineBytes = Buffer.from(content);
        if (!mineBytes.equals(Buffer.from(await fromSite(name)))) different.push(name);
      };
      for (let i = 0; i < names.length; i += 16)
        await Promise.all(names.slice(i, i + 16).map(check));
      console.log(
        different.length === 0
          ? `All ${String(names.length)} files are byte for byte what the site serves.`
          : `${String(different.length)} of ${String(names.length)} files differ from what the site serves:`,
      );
      for (const p of different.sort().slice(0, 20)) console.log(`  differs: ${p}`);
      if (different.length > 0) process.exitCode = 1;
    }
  } else {
    const done = await publishSchedule(
      hosting,
      schedule,
      values.message ?? `schedule ${named.version}`,
    );
    console.log(
      `Published ${named.version} as ${done.version}: ${String(done.uploaded)} files sent, ${String(done.kept)} kept.`,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
