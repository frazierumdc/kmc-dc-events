import {
  PublishedSite,
  samePage,
  type CategoryKinds,
  scheduleChanges,
  type ScheduleChanges,
  type FeedEnvelope,
  type OtherCenterEvent,
  type SiteSettings,
  type SnapshotV2,
  type WebsiteEvent,
} from "@kmcdc/domain";
import { onlineOptions } from "./online-options.ts";
import { changesMarkdown } from "./schedule-changes.ts";
import { buildSnapshotV2, toUtcSeconds, versionHash, type SnapshotV2Files } from "./snapshot-v2.ts";
import { adaptWixEvent } from "./wix-adapter.ts";
import { WixEvent } from "./wix-event.ts";

/**
 * One copy run after the source is read (data-pipeline.md steps 2–5): adapter → checks →
 * snapshot → compare with the published schedule. Pure; `copy-cli.ts` reads and writes.
 */

/** The source's answer must be from within this long of now. */
export const MAX_FEED_AGE_MS = 10 * 60 * 1000;
/** More unreadable events than this share means the source's format may have changed. */
export const MAX_UNREADABLE_SHARE = 0.1;
/** No events while the published schedule has at least this many is a broken source. */
export const EMPTY_GUARD = 20;

export interface Note {
  id: string | null;
  title: string | null;
  message: string;
}

export type CopyResult =
  | { status: "failed"; problem: string; summary: string }
  | {
      status: "same" | "changed";
      files: SnapshotV2Files;
      changes: ScheduleChanges;
      leftOut: Note[];
      warnings: Note[];
      /** Where Wix and the online schedule disagree (D46). */
      online: Note[];
      /** Website categories the site settings give no kind, with their event counts (D45). */
      kindless: Map<string, number>;
      summary: string;
    };

export interface CopyInput {
  feed: FeedEnvelope;
  site: SiteSettings;
  /** The schedule on the site now, or null before the first publish. */
  published: SnapshotV2 | null;
  now: Date;
  /** Skipped for a saved capture. */
  checkFreshness: boolean;
  /**
   * The featured events' pages from `featured.json` (EV-44); null when it wasn't read, so the
   * published schedule's featured events are kept.
   */
  featured?: readonly string[] | null;
}

export function copyWebsite({
  feed,
  site,
  published,
  now,
  checkFreshness,
  featured = null,
}: CopyInput): CopyResult {
  const failed = (problem: string): CopyResult => ({
    status: "failed",
    problem,
    summary: failureSummary(problem),
  });

  const malformed = feedProblem(feed, now, checkFreshness);
  if (malformed) return failed(malformed);

  const read = readWebsite(feed, site);
  const { leftOut, warnings } = read;
  if (read.unreadable > feed.events.length * MAX_UNREADABLE_SHARE)
    return failed(
      `Malformed: ${String(read.unreadable)} of ${String(feed.events.length)} events can't be read; the source's format may have changed.`,
    );

  const online = onlineOptions(read.events, site, now);
  const chosen = featuredIds(featured, published, online.events);
  const built = buildSnapshotV2(
    online.events,
    PublishedSite.parse(site),
    now,
    toUtcSeconds(now.toISOString()),
    undefined,
    online.options,
    chosen.ids,
  );
  if (!built.ok) return failed(`The snapshot build stopped: ${built.error}.`);
  const { snapshot } = built.files;
  const publishedCount = published?.events.length ?? 0;
  if (snapshot.events.length === 0 && publishedCount >= EMPTY_GUARD)
    return failed(
      `Empty: the source has no events, while the published schedule has ${String(publishedCount)}.`,
    );

  const same =
    published !== null && versionHash(published.version) === versionHash(snapshot.version);
  const changes = scheduleChanges(published, snapshot, now);
  const kindless = categoriesWithoutKind(snapshot.events, site.categoryKinds);
  const lines = [
    ...headSection(same ? published : null, snapshot, changes, now),
    ...notesSection("Left out", leftOut),
    ...notesSection("Warnings", warnings),
    ...onlineSection(online.warnings),
    ...featuredSection(snapshot, chosen.unmatched),
    ...kindlessSection(kindless),
  ];
  return {
    status: same ? "same" : "changed",
    files: built.files,
    changes,
    leftOut,
    warnings,
    online: online.warnings,
    kindless,
    summary: `${lines.join("\n")}\n`,
  };
}

/** What is wrong with the source's answer itself, before any event is read; null when nothing. */
function feedProblem(feed: FeedEnvelope, now: Date, checkFreshness: boolean): string | null {
  if (feed.count !== feed.events.length)
    return `Malformed: the source says ${String(feed.count)} events but sent ${String(feed.events.length)}.`;
  if (checkFreshness && Math.abs(now.getTime() - Date.parse(feed.generatedAt)) > MAX_FEED_AGE_MS)
    return `Malformed: the source's answer is from ${feed.generatedAt}, not from now.`;
  return null;
}

// The run's summary, section by section: each gives its lines, none when it has nothing to say.

/** The heading and the count; `same` is the published schedule when the copy matches it. */
function headSection(
  same: SnapshotV2 | null,
  snapshot: SnapshotV2,
  changes: ScheduleChanges,
  now: Date,
): string[] {
  const count = String(snapshot.events.length);
  if (same)
    return [
      "## Update schedule: no change",
      "",
      `${count} events, the same as the published schedule (${same.version}).`,
    ];
  return [
    "## Update schedule: published",
    "",
    `${count} events; version ${snapshot.version}.`,
    "",
    ...changesMarkdown(changes, snapshot, now),
  ];
}

function notesSection(heading: string, notes: readonly Note[]): string[] {
  if (notes.length === 0) return [];
  return [
    "",
    `### ${heading}`,
    "",
    ...notes.map((n) => `- ${n.title ?? "(no title)"} (${n.id ?? "no id"}): ${n.message}`),
  ];
}

function onlineSection(notes: readonly Note[]): string[] {
  if (notes.length === 0) return [];
  return [
    "",
    "### Online schedule",
    "",
    ...notes.map((n) =>
      n.title === null ? `- ${n.message}` : `- ${n.title} (${n.id ?? "no id"}): ${n.message}`,
    ),
  ];
}

function featuredSection(snapshot: SnapshotV2, unmatched: readonly string[]): string[] {
  const titles = (snapshot.featured ?? []).map(
    (id) => snapshot.events.find((e) => e.id === id)?.title ?? id,
  );
  if (titles.length === 0 && unmatched.length === 0) return [];
  return [
    "",
    "### Featured",
    "",
    ...titles.map((title) => `- ${title}`),
    ...unmatched.map((page) => `- Not shown: no event on the schedule has the page ${page}`),
  ];
}

function kindlessSection(kindless: ReadonlyMap<string, number>): string[] {
  if (kindless.size === 0) return [];
  return [
    "",
    "### Categories without a kind",
    "",
    ...[...kindless].map(
      ([name, count]) =>
        `- ${name} (${String(count)} ${count === 1 ? "event" : "events"}): shown under All without colour until it is added to \`categoryKinds\` in \`data/site.json\``,
    ),
  ];
}

/** The website's events as the app reads them, with what it left out and why. */
function readWebsite(feed: FeedEnvelope, site: SiteSettings) {
  const events: WebsiteEvent[] = [];
  const leftOut: Note[] = [];
  const warnings: Note[] = [];
  const ids = new Set<string>();
  let unreadable = 0;
  for (const raw of feed.events) {
    const r = adaptWixEvent(raw, site.allowedHosts);
    if (!r.ok) {
      if (!WixEvent.safeParse(raw).success) unreadable++;
      leftOut.push({ id: r.id, title: r.title, message: r.reason });
      continue;
    }
    if (ids.has(r.event.id)) {
      leftOut.push({
        id: r.event.id,
        title: r.event.title,
        message: "the same id as an event before it",
      });
      continue;
    }
    ids.add(r.event.id);
    events.push(r.event);
    warnings.push(
      ...r.warnings.map((message) => ({ id: r.event.id, title: r.event.title, message })),
    );
  }
  // Other centers' events the owner asked for (D67), listed with the website's.
  for (const e of site.otherCenterEvents) {
    if (ids.has(e.id)) {
      leftOut.push({ id: e.id, title: e.title, message: "the same id as a website event" });
      continue;
    }
    ids.add(e.id);
    events.push(otherCenterEvent(e));
  }
  return { events, leftOut, warnings, unreadable };
}

/**
 * The featured events' ids (EV-44): each page in `featured.json` matched to an event on the
 * schedule by its page (or its id), in the file's order; an event that has ended drops out
 * with the schedule's. Without the file, the published schedule's are kept.
 */
function featuredIds(
  pages: readonly string[] | null,
  published: SnapshotV2 | null,
  events: readonly WebsiteEvent[],
): { ids: string[]; unmatched: string[] } {
  if (pages === null) return { ids: published?.featured ?? [], unmatched: [] };
  const ids: string[] = [];
  const unmatched: string[] = [];
  for (const page of pages) {
    const event = events.find((e) => e.id === page.trim() || samePage(e.page, page));
    if (event) ids.push(event.id);
    else unmatched.push(page);
  }
  return { ids, unmatched };
}

/** Another center's event as a website event (D67): Register opens its page. */
function otherCenterEvent(e: OtherCenterEvent): WebsiteEvent {
  return {
    id: e.id,
    title: e.title,
    summary: null,
    description: e.description,
    categories: e.categories,
    page: e.page,
    registrationOpen: true,
    picture: e.picture,
    start: toUtcSeconds(e.start),
    end: toUtcSeconds(e.end),
    location: { online: false, ...e.location, geo: null },
    otherCenter: true,
  };
}

/**
 * The schedule a copy of the website gives with today's site settings and code, or null when
 * it can't be built. Two copies built this way differ only where the website did (D62).
 */
export function websiteSchedule(
  feed: FeedEnvelope,
  site: SiteSettings,
  now: Date,
): SnapshotV2 | null {
  const online = onlineOptions(readWebsite(feed, site).events, site, now);
  const built = buildSnapshotV2(
    online.events,
    PublishedSite.parse(site),
    now,
    toUtcSeconds(now.toISOString()),
    undefined,
    online.options,
  );
  return built.ok ? built.files.snapshot : null;
}

/**
 * How long the website's newest edit waited for this copy (NT-7): a line for the run's
 * summary, from the newest `updatedDate` among the source's events. Null when none has one,
 * or when the newest edit is over a day old, which says nothing about this copy. A removed
 * event leaves no date behind, so a copy after a cancellation shows the edit before it.
 */
export function deliveryLine(feed: FeedEnvelope, now: Date): string | null {
  let newest = 0;
  for (const e of feed.events) {
    const updated = (e as { updatedDate?: unknown } | null)?.updatedDate;
    const at = typeof updated === "string" ? Date.parse(updated) : 0;
    if (at > newest) newest = at;
  }
  const waited = now.getTime() - newest;
  if (newest === 0 || waited < 0 || waited > 24 * 60 * 60_000) return null;
  const minutes = Math.round(waited / 6_000) / 10;
  return `Newest edit on the website: ${new Date(newest).toISOString()}, ${String(minutes)} minutes before this copy.`;
}

/** Each website category with no kind in the site settings, and how many events have it. */
export function categoriesWithoutKind(
  events: readonly { categories: readonly string[] }[],
  categoryKinds: CategoryKinds,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of events)
    for (const c of e.categories)
      if (!(c in categoryKinds)) counts.set(c, (counts.get(c) ?? 0) + 1);
  return new Map([...counts].sort(([a], [b]) => a.localeCompare(b)));
}

/** The run's summary page when nothing is published. */
export function failureSummary(problem: string): string {
  return `## Update schedule: nothing published\n\n${problem}\n\nThe app keeps the last published schedule.\n`;
}
