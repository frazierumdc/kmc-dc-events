// Every file a schedule puts on the site (D63): the schedule itself under /v2/feed/, each
// event's calendar file, page and share picture, and each event picture's thumbnail under
// /v2/feed/pictures/ (slice 1.13). Built from the schedule's own files and the
// app's index.html, so publishing a schedule needs no build of the app (EV-21). The deploy's
// calendar-files.ts and event-pages.ts write the same files into a built site.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ManifestV2,
  SnapshotV2,
  storyPath,
  storySource,
  thumbnailPath,
  thumbnailSource,
} from "@kmcdc/domain";
import { drawPicture } from "./share-pictures.ts";
import { calendarFiles } from "./calendar.ts";
import { eventPages } from "./event-pages.ts";
import { pictureContent, picturePath } from "./share-picture.ts";

export interface ScheduleSource {
  /** `manifest.json` and the snapshot it names, exactly as the copy wrote them. */
  manifest: Uint8Array;
  snapshot: Uint8Array;
  /** The app's `index.html`, as on the site. */
  indexHtml: string;
  /** The site's public address, for links in the pages and calendar files. */
  origin: string;
}

/** What is on the site now, so an event that hasn't changed keeps its files as they are. */
export interface LiveSchedule {
  /** The schedule now published (`latest.json`). */
  snapshot: Uint8Array;
  /** The live version's files, site path → hash. */
  hashes: ReadonlyMap<string, string>;
}

/** A file kept from the live version: nothing to make, draw or send. */
export interface Kept {
  kept: string;
}

/** Gets a picture's thumbnail from its image server; null when it can't. */
export type FetchThumbnail = (picture: string) => Promise<Uint8Array | null>;

/**
 * Pictures kept in the repository, named as their files on the site (D67): another center's
 * event's thumbnail and story picture, so its own site's image server is never asked
 * (Squarespace can answer with WebP whatever is asked for). `pnpm data:check` requires them.
 */
export const STORED_PICTURES = fileURLToPath(new URL("../../../data/pictures/", import.meta.url));

/** A picture's file as kept in `dir`; null when it isn't there. */
async function storedPicture(dir: string, file: string): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await readFile(path.join(dir, path.basename(file))));
  } catch {
    return null;
  }
}

/** The thumbnail as its image server makes it: a small JPEG, or null on any failure. */
export const fetchThumbnail: FetchThumbnail = (picture) => fetchJpeg(thumbnailSource(picture));

/** A featured event's story picture (EV-44): a large JPEG, or null on any failure. */
export const fetchStoryPicture: FetchThumbnail = (picture) => fetchJpeg(storySource(picture));

async function fetchJpeg(url: string): Promise<Uint8Array | null> {
  try {
    // Asked for as JPEG: Squarespace's server otherwise sends WebP.
    const response = await fetch(url, {
      headers: { accept: "image/jpeg" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok || response.headers.get("content-type") !== "image/jpeg") return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Each picture's thumbnail, once however many events show it: kept from the site when it is
 * already there (a new picture has a new path), else the one in the repository
 * (`STORED_PICTURES`), otherwise fetched. One that can't be had is left out, and the app shows
 * the center's logo instead.
 */
export async function thumbnailFiles(
  snapshot: SnapshotV2,
  live: Pick<LiveSchedule, "hashes"> | null,
  fetchPicture: FetchThumbnail,
  stored = STORED_PICTURES,
): Promise<Map<string, Uint8Array | Kept>> {
  const files = new Map<string, Uint8Array | Kept>();
  for (const picture of new Set(snapshot.events.flatMap((e) => (e.picture ? [e.picture] : [])))) {
    const file = thumbnailPath(picture);
    const kept = live?.hashes.get(file);
    if (kept) {
      files.set(file, { kept });
      continue;
    }
    const bytes = (await storedPicture(stored, file)) ?? (await fetchPicture(picture));
    if (bytes) files.set(file, bytes);
  }
  return files;
}

/** Each featured event's story picture (EV-44), kept, stored or fetched as thumbnails are. */
export async function storyFiles(
  snapshot: SnapshotV2,
  live: Pick<LiveSchedule, "hashes"> | null,
  fetchPicture: FetchThumbnail,
  stored = STORED_PICTURES,
): Promise<Map<string, Uint8Array | Kept>> {
  const files = new Map<string, Uint8Array | Kept>();
  const featured = new Set(snapshot.featured ?? []);
  for (const picture of new Set(
    snapshot.events.flatMap((e) => (featured.has(e.id) && e.picture ? [e.picture] : [])),
  )) {
    const file = storyPath(picture);
    const kept = live?.hashes.get(file);
    if (kept) files.set(file, { kept });
    else {
      const bytes = (await storedPicture(stored, file)) ?? (await fetchPicture(picture));
      if (bytes) files.set(file, bytes);
    }
  }
  return files;
}

/** The three files each event has on the site. */
export const eventFiles = (id: string) => [
  `/v2/feed/calendar/${id}.ics`,
  `/e/${id}/index.html`,
  `/${picturePath(id).replace(/^\/+/, "")}`,
];

/**
 * The events whose files on the site are still right: the same event, word for word, in the
 * schedule now published, under the same site settings, with all three files there. Drawing
 * a share picture is most of a publish's work, and a calendar file carries its schedule's
 * time, so without this every event's files would be made and sent again each time.
 */
export function unchangedEvents(snapshot: SnapshotV2, live: LiveSchedule | null): Set<string> {
  const same = new Set<string>();
  if (!live) return same;
  const parsed = (() => {
    try {
      return SnapshotV2.safeParse(JSON.parse(new TextDecoder().decode(live.snapshot)));
    } catch {
      return null;
    }
  })();
  if (!parsed?.success) return same;
  const before = parsed.data;
  if (JSON.stringify(before.site) !== JSON.stringify(snapshot.site)) return same;
  const earlier = new Map(before.events.map((e) => [e.id, JSON.stringify(e)]));
  for (const event of snapshot.events)
    if (
      earlier.get(event.id) === JSON.stringify(event) &&
      eventFiles(event.id).every((file) => live.hashes.has(file))
    )
      same.add(event.id);
  return same;
}

/**
 * Site path → content, for every file the schedule owns; with `live`, an unchanged event's
 * files are kept by their hash.
 */
export async function scheduleFiles(
  source: ScheduleSource,
  live: LiveSchedule | null = null,
  fetchPicture: FetchThumbnail = fetchThumbnail,
  fetchStory: FetchThumbnail = fetchStoryPicture,
): Promise<Map<string, string | Uint8Array | Kept>> {
  const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
  const manifest = ManifestV2.parse(JSON.parse(text(source.manifest)));
  const snapshot = SnapshotV2.parse(JSON.parse(text(source.snapshot)));
  if (snapshot.version !== manifest.version)
    throw new Error("The schedule doesn't match its manifest.");
  const origin = source.origin.replace(/\/+$/, "");
  const unchanged = unchangedEvents(snapshot, live);
  const files = new Map<string, string | Uint8Array | Kept>([
    ["/v2/feed/manifest.json", source.manifest],
    ["/v2/feed/latest.json", source.snapshot],
    [manifest.snapshots["2"], source.snapshot],
  ]);
  for (const [name, ics] of calendarFiles(snapshot, origin)) files.set(`/v2/feed/${name}`, ics);
  const pages = eventPages(source.indexHtml, snapshot, origin);
  for (const [name, page] of pages) files.set(`/${name}`, page);
  for (const event of snapshot.events) {
    if (!pages.has(`e/${event.id}/index.html`)) continue;
    const [, , picture = ""] = eventFiles(event.id);
    if (unchanged.has(event.id)) {
      for (const file of eventFiles(event.id))
        files.set(file, { kept: live?.hashes.get(file) ?? "" });
      continue;
    }
    files.set(picture, await drawPicture(pictureContent(event, snapshot.site)));
  }
  for (const [file, content] of await thumbnailFiles(snapshot, live, fetchPicture))
    files.set(file, content);
  for (const [file, content] of await storyFiles(snapshot, live, fetchStory))
    files.set(file, content);
  return files;
}
