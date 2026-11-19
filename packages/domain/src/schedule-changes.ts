import { stableStringify } from "./stable-json.ts";
import { effectiveEnd, endedBeforeToday } from "./time.ts";
import type { SnapshotV2, SnapshotV2Event } from "./website.ts";

/**
 * What changed between two schedules, compared by event id: the update job's summary
 * (data-pipeline.md step 6) and what the phone tells the reader (EV-19). A date or time
 * change is its own group, so a later alert can go out for those alone.
 */

export interface Moved {
  before: SnapshotV2Event;
  after: SnapshotV2Event;
  /** Other fields that changed too. */
  fields: string[];
}

export interface Edited {
  before: SnapshotV2Event;
  after: SnapshotV2Event;
  fields: string[];
}

export interface ScheduleChanges {
  /** No schedule was published before. */
  first: boolean;
  added: SnapshotV2Event[];
  /** Taken off the website before they ended. */
  removed: SnapshotV2Event[];
  /** Start, end or all day changed. */
  moved: Moved[];
  edited: Edited[];
  /** Dropped because they ended before today: not a change on the website. */
  finished: number;
  siteChanged: boolean;
}

/** Fields that are the date or time. `classId` follows the title and city, so it isn't listed. */
const TIME_FIELDS = new Set(["start", "end", "allDay"]);
const IGNORED_FIELDS = new Set(["id", "classId"]);

export function scheduleChanges(
  before: SnapshotV2 | null,
  after: SnapshotV2,
  now: Date,
): ScheduleChanges {
  const old = new Map((before?.events ?? []).map((e) => [e.id, e]));
  const changes: ScheduleChanges = {
    first: before === null,
    added: [],
    removed: [],
    moved: [],
    edited: [],
    finished: 0,
    siteChanged: before !== null && stableStringify(before.site) !== stableStringify(after.site),
  };
  for (const event of after.events) {
    const was = old.get(event.id);
    old.delete(event.id);
    if (!was) {
      if (before) changes.added.push(event);
      continue;
    }
    const fields = changedFields(was, event);
    const time = fields.filter((f) => TIME_FIELDS.has(f));
    const other = fields.filter((f) => !TIME_FIELDS.has(f));
    if (time.length > 0) changes.moved.push({ before: was, after: event, fields: other });
    else if (other.length > 0) changes.edited.push({ before: was, after: event, fields: other });
  }
  for (const was of old.values()) {
    if (endedBeforeToday(was.start, was.end, now)) changes.finished++;
    else changes.removed.push(was);
  }
  return changes;
}

/** True when the website changed, not only the day. */
export function hasWebsiteChanges(c: ScheduleChanges): boolean {
  return (
    c.first ||
    c.siteChanged ||
    c.added.length + c.removed.length + c.moved.length + c.edited.length > 0
  );
}

function changedFields(a: SnapshotV2Event, b: SnapshotV2Event): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys]
    .filter((k) => !IGNORED_FIELDS.has(k))
    .filter(
      (k) =>
        stableStringify((a as Record<string, unknown>)[k]) !==
        stableStringify((b as Record<string, unknown>)[k]),
    )
    .sort();
}

/**
 * What the reader is told about (EV-19): changes to when events still to come happen, a
 * new date or time (an end time too), a removed event, a new event. Edits to an event's
 * details aren't told.
 */
export interface UpcomingChanges {
  moved: Moved[];
  removed: SnapshotV2Event[];
  added: SnapshotV2Event[];
}

/**
 * The changes between the schedule the phone had and a newer one that concern when events
 * still to come at `now` happen, as the list shows them (EV-10). Finished events dropping
 * off, site settings and edits to details aren't news to the reader.
 */
export function upcomingChanges(before: SnapshotV2, after: SnapshotV2, now: Date): UpcomingChanges {
  const all = scheduleChanges(before, after, now);
  const upcoming = (e: SnapshotV2Event) => Date.parse(effectiveEnd(e.start, e.end)) > now.getTime();
  return {
    moved: all.moved.filter((m) => upcoming(m.after)),
    removed: all.removed.filter(upcoming),
    added: all.added.filter(upcoming),
  };
}

/** How many upcoming events changed when they happen; 0 means nothing to tell. */
export function changeCount(c: UpcomingChanges): number {
  return c.moved.length + c.removed.length + c.added.length;
}
