import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import {
  addDays,
  easternMidnight,
  easternDate,
  endedBeforeToday,
  isAllDay,
  ManifestV2,
  SnapshotV2,
  stableStringify,
  toEasternIso,
  type OnlineOption,
  type PublishedSite,
  type SnapshotV2Event,
  type WebsiteEvent,
} from "@kmcdc/domain";
import { classId } from "./class-id.ts";

/**
 * Website events + site settings → the schema 2 snapshot and manifest phones download
 * (data-model.md; data-pipeline.md step 4). Pure.
 */

/** How far ahead the snapshot reaches. */
export const HORIZON_DAYS = 400;

/** Size limit for a snapshot, gzipped (data-model.md). */
export const MAX_SNAPSHOT_GZIP_BYTES = 1024 * 1024;

export interface SnapshotV2Files {
  snapshot: SnapshotV2;
  manifest: ManifestV2;
  /** The snapshot as written: the same text in `latest.json` and `snapshots/<version>.json`. */
  json: string;
  gzipBytes: number;
}

export type SnapshotV2Result = { ok: true; files: SnapshotV2Files } | { ok: false; error: string };

/**
 * @param publishedAt When this schedule is published (UTC instant). It names the version but
 *   isn't part of its hash, so the same events and site always give the same hash.
 * @param online Event id → its online option (online-options.ts).
 * @param featured The featured events' ids, in order (EV-44); those not listed are dropped.
 */
export function buildSnapshotV2(
  events: readonly WebsiteEvent[],
  site: PublishedSite,
  now: Date,
  publishedAt: string,
  maxGzipBytes = MAX_SNAPSHOT_GZIP_BYTES,
  online: ReadonlyMap<string, OnlineOption> = new Map(),
  featured: readonly string[] = [],
): SnapshotV2Result {
  const horizon = Date.parse(easternMidnight(addDays(easternDate(now), HORIZON_DAYS)));
  const listed = events
    .filter((e) => !endedBeforeToday(e.start, e.end, now) && Date.parse(e.start) < horizon)
    .map((e) => snapshotEvent(e, online.get(e.id) ?? null))
    .sort(
      (a, b) =>
        Date.parse(a.start) - Date.parse(b.start) ||
        a.title.localeCompare(b.title) ||
        a.id.localeCompare(b.id),
    );

  const ids = new Set(listed.map((e) => e.id));
  const shown = [...new Set(featured)].filter((id) => ids.has(id));
  const body = {
    schema: 2 as const,
    timezone: "America/New_York" as const,
    site,
    events: listed,
    // Only when there are some, so a schedule without them keeps its hash.
    ...(shown.length > 0 ? { featured: shown } : {}),
  };
  const version = `${publishedAt.replace(/[-:]/g, "").slice(0, 15)}Z-${contentHash(body)}`;
  const snapshot = SnapshotV2.safeParse({ ...body, version, publishedAt });
  if (!snapshot.success) {
    const issue = snapshot.error.issues[0];
    return { ok: false, error: `snapshot ${issue?.path.join(".") ?? ""}: ${issue?.message ?? ""}` };
  }
  const manifest = ManifestV2.parse({
    schema: 2,
    version,
    publishedAt,
    snapshots: { "2": `/v2/feed/snapshots/${version}.json` },
    schedule: scheduleFingerprint(listed),
    minAppBuild: null,
    message: null,
  });

  const json = JSON.stringify(snapshot.data);
  const gzipBytes = gzipSync(json).length;
  if (gzipBytes > maxGzipBytes)
    return {
      ok: false,
      error: `the snapshot is ${String(gzipBytes)} bytes gzipped, over the limit of ${String(maxGzipBytes)}`,
    };
  return { ok: true, files: { snapshot: snapshot.data, manifest, json, gzipBytes } };
}

/**
 * A fingerprint of which events are listed and when: 16 hex of the sha256 of every event's
 * id, start and end, in id order. It changes when an event is added, removed or moved, and
 * not for a title, a description or anything else (D28, D64).
 */
export function scheduleFingerprint(
  events: readonly { id: string; start: string; end: string | null }[],
): string {
  const lines = events.map((e) => `${e.id}\t${e.start}\t${e.end ?? ""}`).sort();
  return createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16);
}

/** The hash part of a version: `20261009T103112Z-3fa9c2d1` → `3fa9c2d1`. */
export function versionHash(version: string): string {
  return version.slice(-8);
}

/** First 8 hex of the sha256 of everything but the version and publish time. */
function contentHash(body: unknown): string {
  return createHash("sha256").update(stableStringify(body)).digest("hex").slice(0, 8);
}

function snapshotEvent(e: WebsiteEvent, online: OnlineOption | null): SnapshotV2Event {
  return {
    id: e.id,
    classId: classId(e),
    title: e.title,
    summary: e.summary,
    description: e.description,
    start: toEasternIso(e.start),
    end: e.end && toEasternIso(e.end),
    allDay: isAllDay(e.start, e.end),
    categories: e.categories,
    location: e.location,
    page: e.page,
    registrationOpen: e.registrationOpen,
    picture: e.picture,
    online,
    ...(e.otherCenter ? { otherCenter: true as const } : {}),
  };
}

/** Any ISO instant → UTC, whole seconds: `2026-10-08T19:02:59-04:00` → `2026-10-08T23:02:59Z`. */
export function toUtcSeconds(instant: string): string {
  return new Date(instant).toISOString().slice(0, 19) + "Z";
}
