import { ManifestV2, SnapshotV2 } from "@kmcdc/domain";

/**
 * Reads the schedule the deploy publishes: the manifest, then the snapshot it names
 * (data-model.md), falling back to `latest.json` if that snapshot can't be fetched. Both
 * are checked against schema 2, so a broken file shows an error rather than a wrong list.
 * A schedule keeps the two files exactly as downloaded, so the phone stores them whole:
 * checking drops fields this version doesn't know, and a later version may need them.
 */

export const MANIFEST_PATH = "/v2/feed/manifest.json";
export const LATEST_PATH = "/v2/feed/latest.json";

/** The two files as downloaded, unchecked. */
export interface Download {
  manifest: unknown;
  snapshot: unknown;
}

export interface Schedule {
  manifest: ManifestV2;
  snapshot: SnapshotV2;
  download: Download;
}

/** Checks downloaded files against schema 2; null when they aren't a matching pair. */
export function readDownload(download: Download): Schedule | null {
  const manifest = ManifestV2.safeParse(download.manifest);
  const snapshot = SnapshotV2.safeParse(download.snapshot);
  if (!manifest.success || !snapshot.success) return null;
  if (manifest.data.version !== snapshot.data.version) return null;
  return { manifest: manifest.data, snapshot: snapshot.data, download };
}

export class ScheduleError extends Error {
  /** True when the network couldn't be reached at all, as opposed to a bad answer. */
  readonly offline: boolean;

  constructor(message: string, offline = false) {
    super(message);
    this.offline = offline;
  }
}

/** The manifest, checked, with the file as downloaded. */
export interface Manifest {
  manifest: ManifestV2;
  raw: unknown;
}

export async function fetchManifest(fetchFn: typeof fetch = fetch): Promise<Manifest> {
  const raw = await getJson(fetchFn, MANIFEST_PATH);
  const manifest = ManifestV2.safeParse(raw);
  if (!manifest.success) throw new ScheduleError("The schedule's manifest isn't valid.");
  return { manifest: manifest.data, raw };
}

/** The snapshot a manifest names; `latest.json` if that one can't be fetched. */
export async function fetchSnapshot(
  { manifest, raw: rawManifest }: Manifest,
  fetchFn: typeof fetch = fetch,
): Promise<Schedule> {
  let raw: unknown;
  try {
    raw = await getJson(fetchFn, manifest.snapshots["2"]);
  } catch (error) {
    if (error instanceof ScheduleError && error.offline) throw error;
    raw = await getJson(fetchFn, LATEST_PATH);
  }
  const snapshot = SnapshotV2.safeParse(raw);
  if (!snapshot.success) throw new ScheduleError("The schedule isn't valid.");
  if (snapshot.data.version !== manifest.version)
    throw new ScheduleError("The schedule doesn't match its manifest.");
  return { manifest, snapshot: snapshot.data, download: { manifest: rawManifest, snapshot: raw } };
}

/**
 * A first visit (NFR-1): the manifest and `latest.json` are fetched side by side, so the
 * schedule takes one round trip, not two; when `latest.json` isn't the manifest's version
 * (a copy published in between), the snapshot the manifest names is fetched.
 */
export async function loadSchedule(fetchFn: typeof fetch = fetch): Promise<Schedule> {
  const [manifest, latest] = await Promise.all([
    fetchManifest(fetchFn),
    getJson(fetchFn, LATEST_PATH).then(
      (raw) => ({ raw }),
      () => null,
    ),
  ]);
  if (latest) {
    const snapshot = SnapshotV2.safeParse(latest.raw);
    if (snapshot.success && snapshot.data.version === manifest.manifest.version)
      return {
        manifest: manifest.manifest,
        snapshot: snapshot.data,
        download: { manifest: manifest.raw, snapshot: latest.raw },
      };
  }
  return fetchSnapshot(manifest, fetchFn);
}

async function getJson(fetchFn: typeof fetch, path: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchFn(path, { cache: "no-cache" });
  } catch {
    throw new ScheduleError("The schedule couldn't be reached.", true);
  }
  if (!response.ok)
    throw new ScheduleError(`The schedule couldn't be loaded (${String(response.status)}).`);
  try {
    return await response.json();
  } catch {
    throw new ScheduleError("The schedule isn't valid.");
  }
}
