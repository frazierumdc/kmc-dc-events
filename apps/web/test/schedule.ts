import type { ManifestV2, SnapshotV2Event } from "@kmcdc/domain";
import manifest from "@kmcdc/domain/golden/manifest-v2.json" with { type: "json" };
import snapshot from "@kmcdc/domain/golden/snapshot-v2.json" with { type: "json" };
import {
  LATEST_PATH,
  MANIFEST_PATH,
  readDownload,
  type Schedule,
} from "../src/schedule/schedule.ts";
import type { ScheduleStore } from "../src/schedule/schedule-store.ts";

// Test helpers: the golden schedule, one of its events, a newer variant, a fake network and
// a memory store.

/** A schedule from its two files, as the app reads a download. */
export function schedule(files: { manifest: unknown; snapshot: unknown }): Schedule {
  const read = readDownload(files);
  if (!read) throw new Error("not a valid schedule");
  return read;
}

export const golden: Schedule = schedule({ manifest, snapshot });

/** A golden event by title, with changes. */
export function goldenEvent(
  title: string,
  changes: Partial<SnapshotV2Event> = {},
): SnapshotV2Event {
  const event = golden.snapshot.events.find((e) => e.title === title);
  if (!event) throw new Error(`no golden event "${title}"`);
  return { ...event, ...changes };
}

/** The golden schedule under a new version, with the first event's title changed. */
export function newerSchedule(title = "Newer title"): Schedule {
  const version = "20261010T120000Z-0000beef";
  const [first, ...rest] = golden.snapshot.events;
  if (!first) throw new Error("golden snapshot has no events");
  return schedule({
    manifest: {
      ...golden.manifest,
      version,
      publishedAt: "2026-10-10T12:00:00Z",
      snapshots: { "2": `/v2/feed/snapshots/${version}.json` },
    },
    snapshot: { ...golden.snapshot, version, events: [{ ...first, title }, ...rest] },
  });
}

/** The golden schedule under a new version, with its events changed by `edit`. */
export function editedSchedule(edit: (events: SnapshotV2Event[]) => SnapshotV2Event[]): Schedule {
  const newer = newerSchedule();
  return schedule({
    manifest: newer.manifest,
    snapshot: {
      ...golden.snapshot,
      version: newer.snapshot.version,
      events: edit([...golden.snapshot.events]),
    },
  });
}

/** A newer schedule where Tuesday Rest and Reflect moved from 6:00 to 6:30 PM. */
export function movedSchedule(): Schedule {
  return editedSchedule((events) =>
    events.map((e) =>
      e.title === "Tuesday Rest and Reflect"
        ? { ...e, start: "2026-10-13T18:30:00-04:00", end: "2026-10-13T19:00:00-04:00" }
        : e,
    ),
  );
}

export interface FakeNetwork {
  fetchFn: typeof fetch;
  /** Paths requested, in order. */
  requests: string[];
  serve: (files: Files | null) => void;
  /** Milliseconds every answer waits. */
  delayMs: number;
}

/** A schedule's two files. */
export interface Files {
  manifest: ManifestV2;
  snapshot: unknown;
}

/** Serves one schedule (manifest, its snapshot, latest.json); null means offline. */
export function fakeNetwork(files: Files | null = golden): FakeNetwork {
  let served: Record<string, unknown> | null = null;
  const net: FakeNetwork = {
    requests: [],
    delayMs: 0,
    serve(s) {
      served = s && {
        [MANIFEST_PATH]: s.manifest,
        [s.manifest.snapshots["2"]]: s.snapshot,
        [LATEST_PATH]: s.snapshot,
      };
    },
    fetchFn: async (input) => {
      const path = typeof input === "string" ? input : "";
      net.requests.push(path);
      if (net.delayMs > 0) await new Promise((r) => setTimeout(r, net.delayMs));
      if (!served) throw new TypeError("Failed to fetch");
      const body = served[path];
      return body === undefined
        ? new Response("Not found", { status: 404 })
        : new Response(typeof body === "string" ? body : JSON.stringify(body));
    },
  };
  net.serve(files);
  return net;
}

export function memoryStore(initial: Schedule | null = null): ScheduleStore & {
  saved: () => Schedule | null;
} {
  let kept = initial;
  return {
    read: () => Promise.resolve(kept),
    write: (s) => {
      kept = s;
      return Promise.resolve();
    },
    saved: () => kept,
  };
}
