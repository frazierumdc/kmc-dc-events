import {
  addDays,
  easternDate,
  effectiveEnd,
  multiDayDates,
  type SnapshotV2,
  type SnapshotV2Event,
} from "@kmcdc/domain";
import { eventWhere } from "./event-where.ts";
import { onlineLink } from "./online-link.ts";

// An event's address in the app and its calendar entry: the calendar file published beside
// the schedule (calendar-files.ts) and the Google Calendar link. Pure; the app's details
// panel and the publisher both use it.

/** Where an event's calendar file is published: `/v2/feed/calendar/{id}.ics`. */
export function calendarFilePath(id: string): string {
  return `/v2/feed/calendar/${id}.ics`;
}

/** The address an event's panel opens at, `{origin}/e/{id}` (EV-37). */
export function eventUrl(id: string, origin: string): string {
  return `${origin}/e/${id}`;
}

/** `20261012T230000Z`. */
const icsInstant = (iso: string) =>
  new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
/** `20261012`. */
const icsDate = (date: string) => date.replace(/-/g, "");

/** First and day-after-last Eastern dates of an all-day event. */
function allDayRange(event: SnapshotV2Event): [string, string] {
  const dates = multiDayDates(event.start, event.end);
  const first = easternDate(event.start);
  return [first, addDays(dates?.at(-1) ?? first, 1)];
}

function placeText(event: SnapshotV2Event): string {
  return eventWhere(event).lines.join(", ");
}

/** The notes: the event in the app first, then its page on the website and online. */
function details(event: SnapshotV2Event, url: string): string {
  const online = onlineLink(event);
  return [url, event.page, online && `Online: ${online.href}`]
    .filter((line) => line !== null)
    .join("\n");
}

/** A one-event calendar file (RFC 5545), times in UTC, long lines folded. */
export function icsFile(event: SnapshotV2Event, snapshot: SnapshotV2, url: string): string {
  const text = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");
  const [first, after] = allDayRange(event);
  const when = event.allDay
    ? [`DTSTART;VALUE=DATE:${icsDate(first)}`, `DTEND;VALUE=DATE:${icsDate(after)}`]
    : [
        `DTSTART:${icsInstant(event.start)}`,
        `DTEND:${icsInstant(effectiveEnd(event.start, event.end))}`,
      ];
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KMC DC Events//EN",
    "BEGIN:VEVENT",
    `UID:${event.id}@kmc-dc-events`,
    `DTSTAMP:${icsInstant(snapshot.publishedAt)}`,
    ...when,
    `SUMMARY:${text(event.title)}`,
    `LOCATION:${text(placeText(event))}`,
    `DESCRIPTION:${text(details(event, url))}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n")
    .concat("\r\n");
}

/** Splits a line longer than 75 bytes, each further part starting with a space (RFC 5545). */
function fold(line: string): string {
  const parts: string[] = [];
  let part = "";
  let bytes = 0;
  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    if (bytes + size > (parts.length === 0 ? 75 : 74)) {
      parts.push(part);
      part = "";
      bytes = 0;
    }
    part += char;
    bytes += size;
  }
  parts.push(part);
  return parts.join("\r\n ");
}

export function googleCalendarUrl(event: SnapshotV2Event, url: string): string {
  const [first, after] = allDayRange(event);
  const dates = event.allDay
    ? `${icsDate(first)}/${icsDate(after)}`
    : `${icsInstant(event.start)}/${icsInstant(effectiveEnd(event.start, event.end))}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates,
    details: details(event, url),
    location: placeText(event),
    ctz: "America/New_York",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** The ids an event's address can carry (event-route.ts), so a file name is always safe. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Every listed event's calendar file, by its path under the schedule's folder:
 * `calendar/{id}.ics`. Published with each schedule (calendar-files.ts).
 */
export function calendarFiles(snapshot: SnapshotV2, origin: string): Map<string, string> {
  return new Map(
    snapshot.events
      .filter((event) => SAFE_ID.test(event.id))
      .map((event) => [
        `calendar/${event.id}.ics`,
        icsFile(event, snapshot, eventUrl(event.id, origin)),
      ]),
  );
}
