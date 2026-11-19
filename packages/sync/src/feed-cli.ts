// pnpm feed:check    fetches the Wix feed and prints a summary; fails if the feed is broken.
// pnpm feed:capture  does the same and saves the response to .capture/feed.json (gitignored).
//
// Options: --test-site (the Wix test site), --out <file> (capture only).
// The token comes from WIX_FEED_TOKEN, or from a gitignored .env file at the repository root.
// WIX_FEED_URL overrides the feed's address.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { FeedError, fetchFeed } from "./fetch-feed.ts";
import { ROOT, syncSettings } from "./config.ts";
import { feedToken } from "./feed-token.ts";
import { summarizeFeed } from "./summarize-feed.ts";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { "test-site": { type: "boolean" }, out: { type: "string" } },
});
const command = positionals[0];
if (command !== "check" && command !== "capture") {
  console.error("Usage: feed-cli.ts check|capture [--test-site] [--out <file>]");
  process.exit(2);
}

const token = feedToken();

try {
  const feed = await fetchFeed({
    token,
    url: syncSettings().feedUrl,
    testSite: values["test-site"] === true,
  });
  const summary = summarizeFeed(feed);

  console.log(`Generated  ${summary.generatedAt}`);
  console.log(`Window     ${summary.window.from} → ${summary.window.to}`);
  console.log(`Access     ${summary.access}`);
  console.log(`Events     ${summary.count}`);
  console.log(
    `Statuses   ${Object.entries(summary.statuses)
      .map(([status, n]) => `${status} ${n}`)
      .join(", ")}`,
  );
  console.log(`In person  ${summary.venues} (${summary.venuesWithAddress} with an address)`);
  console.log(`Online     ${summary.online}`);
  console.log(`Categories ${summary.withCategories} events have at least one`);
  for (const { id, reason } of summary.unreadable) {
    console.log(`Unreadable ${id ?? "?"}: ${reason}`);
  }
  for (const warning of summary.warnings) console.log(`Warning    ${warning}`);
  for (const problem of summary.problems) console.log(`Problem    ${problem}`);

  if (command === "capture") {
    const { cwd } = syncSettings();
    const out = values.out ? path.resolve(cwd, values.out) : path.join(ROOT, ".capture/feed.json");
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, `${JSON.stringify(feed, null, 2)}\n`);
    console.log(`Saved      ${path.relative(cwd, out)}`);
  }
  if (summary.problems.length > 0) process.exitCode = 1;
} catch (error) {
  if (!(error instanceof FeedError)) throw error;
  console.error(error.message);
  process.exitCode = 1;
}
