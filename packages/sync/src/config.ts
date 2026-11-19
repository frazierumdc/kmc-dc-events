// The settings of this package's commands (copy-cli.ts, feed-cli.ts), read from the
// environment in this one module. Everything else in the package takes values as arguments.
// docs/configuration.md lists each variable.

import { existsSync } from "node:fs";
import path from "node:path";
import { ALL_EVENTS_URL, FEED_PROJECT } from "./deployment.ts";

/** The repository root, for the commands in this package. */
export const ROOT = path.resolve(import.meta.dirname, "../../..");

export type Env = Record<string, string | undefined>;

export interface SyncSettings {
  /** Where relative paths on the command line start: where `pnpm` was run, or the process's own directory. */
  cwd: string;
  /** PUBLISHED_URL: the site the schedule is published to; "" when unset. */
  publishedUrl: string;
  /** WIX_FEED_URL, when it overrides the feed's address. */
  feedUrl: string | undefined;
  /** WIX_ALL_EVENTS_URL, or beside the feed wherever that is, or the default. */
  allEventsUrl: string;
  /** WIX_FEED_TOKEN; "" when unset. */
  feedToken: string;
  /** The project whose Secret Manager holds the feed token for local runs. */
  feedProject: string;
}

/** The settings in `env`. Pure: the same environment gives the same settings. */
export function readSyncSettings(env: Env, processCwd: string): SyncSettings {
  return {
    cwd: env.INIT_CWD ?? processCwd,
    publishedUrl: env.PUBLISHED_URL || "",
    feedUrl: env.WIX_FEED_URL || undefined,
    allEventsUrl:
      env.WIX_ALL_EVENTS_URL ||
      env.WIX_FEED_URL?.replace("/appEvents", "/allEvents") ||
      ALL_EVENTS_URL,
    feedToken: env.WIX_FEED_TOKEN || "",
    feedProject: env.FEED_PROJECT || FEED_PROJECT,
  };
}

/** The settings now. Read again after `loadDotEnv()`, which can add to them. */
export function syncSettings(): SyncSettings {
  return readSyncSettings(process.env, process.cwd());
}

/** Adds the gitignored .env at the repository root to the environment, when there is one. */
export function loadDotEnv(): void {
  const envFile = path.join(ROOT, ".env");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}
