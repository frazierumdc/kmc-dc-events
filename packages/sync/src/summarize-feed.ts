// What `pnpm feed:check` reports about a feed response: the checks in
// docs/architecture/wix-feed.md §Test, as data.

import type { FeedEnvelope } from "@kmcdc/domain";
import { WixEvent } from "./wix-event.ts";

export interface FeedSummary {
  generatedAt: string;
  access: FeedEnvelope["access"];
  window: { from: string; to: string };
  count: number;
  statuses: Record<string, number>;
  venues: number;
  venuesWithAddress: number;
  online: number;
  withCategories: number;
  /** Events that fail the `WixEvent` schema; the sync would skip them. */
  unreadable: { id: string | undefined; reason: string }[];
  /** Failures make the check fail; warnings are printed. */
  problems: string[];
  warnings: string[];
}

const LISTED = new Set(["UPCOMING", "STARTED"]);

export function summarizeFeed(feed: FeedEnvelope): FeedSummary {
  const counts = countEvents(feed.events);
  return {
    generatedAt: feed.generatedAt,
    access: feed.access,
    window: { from: feed.window.from, to: feed.window.to },
    count: feed.events.length,
    ...counts,
    problems: feedProblems(feed, counts.unreadable.length),
    warnings: feedWarnings(feed, counts),
  };
}

type Counts = Pick<
  FeedSummary,
  "statuses" | "venues" | "venuesWithAddress" | "online" | "withCategories" | "unreadable"
>;

/** What the events are, counted; those that fail the schema are listed, not counted. */
function countEvents(events: readonly unknown[]): Counts {
  const counts: Counts = {
    statuses: {},
    venues: 0,
    venuesWithAddress: 0,
    online: 0,
    withCategories: 0,
    unreadable: [],
  };
  for (const raw of events) {
    const parsed = WixEvent.safeParse(raw);
    if (parsed.success) countEvent(counts, parsed.data);
    else
      counts.unreadable.push({ id: idOf(raw), reason: unreadableReason(parsed.error.issues[0]) });
  }
  return counts;
}

function countEvent(counts: Counts, event: WixEvent): void {
  const status = event.status ?? "(none)";
  counts.statuses[status] = (counts.statuses[status] ?? 0) + 1;
  if (event.location?.type === "ONLINE") counts.online++;
  if (event.location?.type === "VENUE") {
    counts.venues++;
    if (Object.keys(event.location.address ?? {}).length > 0) counts.venuesWithAddress++;
  }
  if ((event.categories ?? []).length > 0) counts.withCategories++;
}

function unreadableReason(issue: { path: PropertyKey[]; message: string } | undefined): string {
  const where = issue?.path.join(".") || "(root)";
  return `${where} ${issue?.message ?? ""}`.trim();
}

/** What makes the check fail. */
function feedProblems(feed: FeedEnvelope, unreadable: number): string[] {
  const problems: string[] = [];
  if (feed.count !== feed.events.length) {
    problems.push(`count says ${feed.count} but ${feed.events.length} events were sent`);
  }
  if (feed.events.length === 0) {
    problems.push("no events: the feed's filter or field names may differ");
  }
  if (unreadable > 0) problems.push(`${unreadable} events fail the schema`);
  return problems;
}

/** What is printed without failing the check. */
function feedWarnings(feed: FeedEnvelope, counts: Counts): string[] {
  const warnings: string[] = [];
  if (feed.access !== "visitor") warnings.push(`access is ${feed.access}, not visitor`);
  for (const status of Object.keys(counts.statuses)) {
    if (!LISTED.has(status))
      warnings.push(`${counts.statuses[status]} events have status ${status}`);
  }
  if (counts.venuesWithAddress < counts.venues) {
    warnings.push(`${counts.venues - counts.venuesWithAddress} in-person events have no address`);
  }
  return warnings;
}

function idOf(raw: unknown): string | undefined {
  if (typeof raw === "object" && raw !== null && "id" in raw && typeof raw.id === "string") {
    return raw.id;
  }
  return undefined;
}
