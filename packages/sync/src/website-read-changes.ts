import {
  isAllDay,
  type FeedEnvelope,
  type ReadEvent,
  type ReadField,
  type WebsiteReadChanges,
} from "@kmcdc/domain";
import { WixEvent } from "./wix-event.ts";

// What changed on the website between two reads of all its events (AN-1, D62): the Schedule
// changes email's comparison. It reads the source's own events, so it is here, beside the
// adapter; the result's shapes are in the contract (packages/domain).

/** Statuses of an event people can still come to. */
const LISTED = new Set(["UPCOMING", "STARTED"]);
const CANCELLED = "CANCELED";

interface Read {
  event: ReadEvent;
  listed: boolean;
  cancelled: boolean;
}

/** Null without an earlier read: the first one is only kept. */
export function websiteReadChanges(
  earlier: FeedEnvelope | null,
  later: FeedEnvelope,
): WebsiteReadChanges | null {
  if (!earlier) return null;
  const before = readEvents(earlier);
  const after = readEvents(later);
  const readAt = Date.parse(later.generatedAt);
  const coveredBefore = Date.parse(earlier.window.to);
  const changes: WebsiteReadChanges = {
    readAt: later.generatedAt,
    moved: [],
    added: [],
    cancelled: [],
    removed: [],
    edited: [],
  };

  for (const [id, now] of after) {
    const was = before.get(id);
    before.delete(id);
    if (!was || was.cancelled) {
      // New, or on again after a cancellation. One that only came into the window as the
      // days went by was on the website all along.
      const cameIntoWindow = !was && Date.parse(now.event.start) > coveredBefore;
      if (now.listed && !cameIntoWindow) changes.added.push(now.event);
      continue;
    }
    if (now.cancelled) {
      if (was.listed) changes.cancelled.push(was.event);
      continue;
    }
    // An event that has ended is the past: nothing about it is news.
    if (!was.listed || !now.listed) continue;
    const fields: ReadField[] = [];
    if (was.event.title !== now.event.title) fields.push("title");
    const change = { before: was.event, after: now.event, fields };
    if (
      Date.parse(was.event.start) !== Date.parse(now.event.start) ||
      endOf(was.event) !== endOf(now.event)
    )
      changes.moved.push(change);
    else if (fields.length > 0) changes.edited.push(change);
  }

  for (const was of before.values()) {
    // Gone because its time passed (it left the read's window), not because it was taken off.
    const over = (endOf(was.event) ?? Date.parse(was.event.start)) <= readAt;
    if (was.listed && !over) changes.removed.push(was.event);
  }
  return changes;
}

const endOf = (e: ReadEvent) => (e.end === null ? null : Date.parse(e.end));

/** Each readable event of a read that has a date, by id; the first of a repeated id. */
function readEvents(read: FeedEnvelope): Map<string, Read> {
  const events = new Map<string, Read>();
  for (const raw of read.events) {
    const parsed = WixEvent.safeParse(raw);
    if (!parsed.success) continue;
    const e = parsed.data;
    const dt = e.dateAndTimeSettings;
    if (!dt?.startDate || dt.dateAndTimeTbd || events.has(e.id)) continue;
    const start = dt.startDate;
    const end = dt.endDate && Date.parse(dt.endDate) !== Date.parse(start) ? dt.endDate : null;
    const page =
      e.eventPageUrl?.base && e.eventPageUrl.path
        ? e.eventPageUrl.base.replace(/\/+$/, "") + e.eventPageUrl.path
        : null;
    events.set(e.id, {
      event: {
        id: e.id,
        title: oneLine(e.title) || "(no title)",
        start,
        end,
        allDay: isAllDay(start, end),
        place: e.location?.type === "ONLINE" ? "Online" : oneLine(e.location?.name) || null,
        page: page?.startsWith("https://") ? page : null,
      },
      // A read made before statuses other than these were sent has only listed events.
      listed: e.status === undefined || LISTED.has(e.status),
      cancelled: e.status === CANCELLED,
    });
  }
  return events;
}

function oneLine(text: string | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}
