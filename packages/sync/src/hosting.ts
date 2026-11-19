// Publishing a schedule without rebuilding the app (D63, EV-21): through Firebase Hosting's
// own API, a new version takes every file of the version now live except the schedule's own
// (/v2/feed/ and the event pages under /e/), which are replaced by the new schedule's. Hosting
// stores files by the hash of their gzipped bytes, so a file kept from the live version is
// named by its hash and never downloaded or uploaded.

import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

/**
 * A file ready for Hosting: its gzipped bytes and their SHA-256, which names it. A file
 * kept from the live version has only its name: Hosting already holds it.
 */
export interface HostedFile {
  hash: string;
  gzipped?: Uint8Array;
}

/** A file kept from the live version, by the hash it has there. */
export const keptFile = (hash: string): HostedFile => ({ hash });

/**
 * Gzips as Hosting expects. The header's operating-system byte is set to Unix, so the same
 * content has the same hash on every machine that builds it.
 */
export function hostedFile(content: string | Uint8Array): Required<HostedFile> {
  const gzipped = gzipSync(content, { level: 9 });
  gzipped[9] = 3;
  return { gzipped, hash: createHash("sha256").update(gzipped).digest("hex") };
}

/** How many files are sent to Hosting at the same time. */
export const UPLOADS_AT_ONCE = 24;

/** The paths a schedule owns on the site; every other file is the app's. */
export const ownedBySchedule = (path: string) =>
  path.startsWith("/v2/feed/") || path.startsWith("/e/");

/** Hosting's own files, which it adds to every version itself. */
const reserved = (path: string) => path.startsWith("/__/");

/**
 * The next version's files, path → hash: the live version's, without the old schedule's and
 * Hosting's own, with the new schedule's.
 */
export function nextFiles(
  live: ReadonlyMap<string, string>,
  schedule: ReadonlyMap<string, HostedFile>,
): Map<string, string> {
  const next = new Map<string, string>();
  for (const [path, hash] of live)
    if (!ownedBySchedule(path) && !reserved(path)) next.set(path, hash);
  for (const [path, file] of schedule) {
    if (!ownedBySchedule(path))
      throw new Error(`${path} is the app's: a schedule may only publish /v2/feed/ and /e/`);
    next.set(path, file.hash);
  }
  return next;
}

/** How two sets of files differ, by path. */
export function compareFiles(
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>,
): { added: string[]; removed: string[]; changed: string[]; same: number } {
  const added = [...after.keys()].filter((p) => !before.has(p)).sort();
  const removed = [...before.keys()].filter((p) => !after.has(p)).sort();
  const changed = [...after]
    .filter(([p, h]) => before.has(p) && before.get(p) !== h)
    .map(([p]) => p);
  return {
    added,
    removed,
    changed: changed.sort(),
    same: after.size - added.length - changed.length,
  };
}

/** As much of Hosting's API as publishing needs. */
export interface Hosting {
  /** The version now live, with its settings (headers, rewrites, redirects). */
  live(): Promise<{ version: string; config: unknown }>;
  /** A version's files, path → hash. */
  files(version: string): Promise<Map<string, string>>;
  /** A new, empty version with these settings; its name. */
  createVersion(config: unknown): Promise<string>;
  /** Names the version's files; answers which hashes Hosting doesn't have yet, and where to send them. */
  populate(
    version: string,
    files: ReadonlyMap<string, string>,
  ): Promise<{ uploadUrl: string; required: string[] }>;
  upload(uploadUrl: string, file: Required<HostedFile>): Promise<void>;
  finalize(version: string): Promise<void>;
  /** Makes the version live. */
  release(version: string, message: string): Promise<void>;
}

export interface Published {
  version: string;
  /** Files sent, and files kept from the live version or already held by Hosting. */
  uploaded: number;
  kept: number;
}

/**
 * Publishes `schedule` over the live version. Nothing is live until the last call, so a
 * failure on the way leaves the site as it was.
 */
export async function publishSchedule(
  hosting: Hosting,
  schedule: ReadonlyMap<string, HostedFile>,
  message: string,
): Promise<Published> {
  const live = await hosting.live();
  const files = nextFiles(await hosting.files(live.version), schedule);
  const version = await hosting.createVersion(live.config);
  const { uploadUrl, required } = await hosting.populate(version, files);
  const byHash = new Map<string, HostedFile>();
  for (const f of schedule.values()) if (f.gzipped || !byHash.has(f.hash)) byHash.set(f.hash, f);
  const wanted = required.map((hash) => {
    const file = byHash.get(hash);
    // A file of the app's that Hosting no longer holds can't be supplied from here.
    if (!file) throw new Error(`Hosting asked for a file that isn't the schedule's (${hash})`);
    // Kept from the live version, so Hosting holds it; if it says otherwise, stop.
    if (!file.gzipped) throw new Error(`Hosting no longer holds a file kept from the live version`);
    return { hash, gzipped: file.gzipped };
  });
  // Several at once: one at a time, a first publish of 400 files took 5 minutes.
  for (let i = 0; i < wanted.length; i += UPLOADS_AT_ONCE)
    await Promise.all(
      wanted.slice(i, i + UPLOADS_AT_ONCE).map((f) => hosting.upload(uploadUrl, f)),
    );
  await hosting.finalize(version);
  await hosting.release(version, message);
  return { version, uploaded: required.length, kept: files.size - required.length };
}

const API = "https://firebasehosting.googleapis.com/v1beta1";
/** Hosting takes at most this many files in one populate call. */
const POPULATE_AT_ONCE = 1000;

/** Hosting's REST API for one site, with an access token of the publishing account. */
export function firebaseHosting(options: {
  site: string;
  token: () => Promise<string>;
  /** The Google project the calls are counted to, needed with a person's sign-in. */
  quotaProject?: string;
  fetch?: typeof globalThis.fetch;
}): Hosting {
  const { site, token, quotaProject, fetch = globalThis.fetch } = options;
  const call = async (
    url: string,
    init: { method?: string; json?: unknown; body?: Uint8Array } = {},
  ): Promise<unknown> => {
    const response = await fetch(url, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${await token()}`,
        ...(quotaProject ? { "x-goog-user-project": quotaProject } : {}),
        ...(init.json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(init.body ? { "Content-Type": "application/octet-stream" } : {}),
      },
      // A Blob, which every fetch takes as a body, whatever its typings say of byte arrays.
      body:
        init.json !== undefined
          ? JSON.stringify(init.json)
          : init.body && new Blob([Buffer.from(init.body)]),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      const what = new URL(url).pathname.replace(/\/[0-9a-f]{64}$/, "/…");
      throw new Error(
        `Hosting ${init.method ?? "GET"} ${what} answered ${String(response.status)}`,
      );
    }
    return init.body ? null : response.json();
  };
  return {
    async live() {
      const channel = (await call(`${API}/sites/${site}/channels/live`)) as {
        release?: { version?: { name?: string; config?: unknown } };
      };
      const version = channel.release?.version;
      if (!version?.name) throw new Error(`${site} has no live version to publish over`);
      return { version: version.name, config: version.config ?? {} };
    },
    async files(version) {
      const files = new Map<string, string>();
      let page = "";
      do {
        const query = new URLSearchParams({
          pageSize: "1000",
          ...(page ? { pageToken: page } : {}),
        });
        const list = (await call(`${API}/${version}/files?${query.toString()}`)) as {
          files?: { path: string; hash: string }[];
          nextPageToken?: string;
        };
        for (const f of list.files ?? []) files.set(f.path, f.hash);
        page = list.nextPageToken ?? "";
      } while (page);
      return files;
    },
    async createVersion(config) {
      const made = (await call(`${API}/sites/${site}/versions`, {
        method: "POST",
        json: { config },
      })) as { name: string };
      return made.name;
    },
    async populate(version, files) {
      const all = [...files];
      const required = new Set<string>();
      let uploadUrl = "";
      for (let i = 0; i < all.length; i += POPULATE_AT_ONCE) {
        const answer = (await call(`${API}/${version}:populateFiles`, {
          method: "POST",
          json: { files: Object.fromEntries(all.slice(i, i + POPULATE_AT_ONCE)) },
        })) as { uploadUrl?: string; uploadRequiredHashes?: string[] };
        uploadUrl = answer.uploadUrl ?? uploadUrl;
        for (const hash of answer.uploadRequiredHashes ?? []) required.add(hash);
      }
      return { uploadUrl, required: [...required] };
    },
    async upload(uploadUrl, file) {
      await call(`${uploadUrl}/${file.hash}`, { method: "POST", body: file.gzipped });
    },
    async finalize(version) {
      await call(`${API}/${version}?update_mask=status`, {
        method: "PATCH",
        json: { status: "FINALIZED" },
      });
    },
    async release(version, message) {
      const query = new URLSearchParams({ versionName: version });
      await call(`${API}/sites/${site}/releases?${query.toString()}`, {
        method: "POST",
        json: { message },
      });
    },
  };
}
