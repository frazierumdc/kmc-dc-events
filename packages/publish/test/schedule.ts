import { ManifestV2, SnapshotV2, type SnapshotV2Event } from "@kmcdc/domain";
import manifest from "@kmcdc/domain/golden/manifest-v2.json" with { type: "json" };
import snapshot from "@kmcdc/domain/golden/snapshot-v2.json" with { type: "json" };

// Test helpers: the golden schedule, one of its events, and an edited newer one. The app has
// its own for its tests (apps/web/test/schedule.ts).

export interface Schedule {
  manifest: ManifestV2;
  snapshot: SnapshotV2;
}

export const golden: Schedule = {
  manifest: ManifestV2.parse(manifest),
  snapshot: SnapshotV2.parse(snapshot),
};

/** A golden event by title, with changes. */
export function goldenEvent(
  title: string,
  changes: Partial<SnapshotV2Event> = {},
): SnapshotV2Event {
  const event = golden.snapshot.events.find((e) => e.title === title);
  if (!event) throw new Error(`no golden event "${title}"`);
  return { ...event, ...changes };
}

/** The golden schedule under a new version, with its events changed by `edit`. */
export function editedSchedule(edit: (events: SnapshotV2Event[]) => SnapshotV2Event[]): Schedule {
  const version = "20261010T120000Z-0000beef";
  return {
    manifest: ManifestV2.parse({
      ...golden.manifest,
      version,
      publishedAt: "2026-10-10T12:00:00Z",
      snapshots: { "2": `/v2/feed/snapshots/${version}.json` },
    }),
    snapshot: SnapshotV2.parse({
      ...golden.snapshot,
      version,
      events: edit([...golden.snapshot.events]),
    }),
  };
}
