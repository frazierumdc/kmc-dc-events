/**
 * What changed on the website between two reads of all its events (AN-1, D62): the Schedule
 * changes email's comparison. It knows only the website's own events, matched by their id;
 * the app's schedule, its settings and `scheduleChanges` have no part in it.
 *
 * A read holds every published event in its window, with its status: upcoming, started,
 * ended or cancelled. So an event that ended is still in the next read and isn't a change,
 * a cancelled one is still there as cancelled, and one that is gone was taken off the website.
 *
 * These are the shapes of the result. The comparison itself reads the source's events, so it
 * is beside the adapter: `websiteReadChanges` in packages/sync.
 */

/** A website event as the email names it, from the website's own fields. */
export interface ReadEvent {
  id: string;
  title: string;
  start: string;
  /** Null when the website gives no end, or one equal to the start. */
  end: string | null;
  allDay: boolean;
  /** The place's name, "Online", or null when the website gives none. */
  place: string | null;
  /** Its page on the website; null when it has none. */
  page: string | null;
}

/** What else changed on an event: its title is the only detail the email tells. */
export type ReadField = "title";

export interface ReadChange {
  before: ReadEvent;
  after: ReadEvent;
  fields: ReadField[];
}

export interface WebsiteReadChanges {
  /** The later read's time: when the website was read. */
  readAt: string;
  /** Start or end changed; `fields` is what else changed. */
  moved: ReadChange[];
  /** On the website now and not before. */
  added: ReadEvent[];
  /** Still on the website, now cancelled. */
  cancelled: ReadEvent[];
  /** No longer on the website, before it ended: deleted, or back to a draft. */
  removed: ReadEvent[];
  /** Renamed. */
  edited: ReadChange[];
}

/** True when there is anything to tell. */
export function hasReadChanges(c: WebsiteReadChanges): boolean {
  return (
    c.moved.length + c.added.length + c.cancelled.length + c.removed.length + c.edited.length > 0
  );
}
