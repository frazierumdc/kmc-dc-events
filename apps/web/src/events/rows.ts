import {
  eventPlace,
  formatTime12,
  thumbnailPath,
  type EventKind,
  type Place,
  type PlaceSite,
} from "@kmcdc/domain";
import type { DayEntry } from "./days.ts";

/**
 * What an event row says (EV-11): the start time or "All day", the kind (shown as a colour
 * bar, D45), the title as the website has it, a second line with the time span, or for a
 * day of a multi-day event which day it is (D31), and a "where" line: the place (the
 * center's short name in its city, otherwise the city) and Online when the event can be
 * attended online (D46), and the event's picture from the website (D7). Text is plain; the
 * screen shows it as text (C-6).
 */

export interface Row {
  /** `7:00 PM` or `All day`. */
  time: string;
  title: string;
  kind: EventKind | null;
  /** A class's own colour: a study program's session or a branch class (D45). */
  tone: DayEntry["tone"];
  /** Where to go in person: `KMC DC`, `Richmond`; null for none or online only. */
  place: string | null;
  online: boolean;
  detail: string | null;
  /** The row's name for screen readers. */
  label: string;
  /** The event's picture, as its thumbnail on the app's own site (D7); null when it has none. */
  picture: string | null;
}

/** What rows need from the site settings. */
export type RowSite = PlaceSite;
export { eventPlace };

/** The kinds' names, as the filter shows them. */
export const KIND_NAMES: Record<EventKind, string> = {
  class: "Classes",
  special: "Special",
  prayer: "Prayers",
};

export function eventRow(entry: DayEntry, site: RowSite): Row {
  const { event, allDay, kind, tone } = entry;
  const where = eventPlace(event, site);
  const online = event.location?.online === true || event.online !== null;
  const time = allDay ? "All day" : formatTime12(event.start);
  const detail = secondLine(entry);
  const label = [
    time,
    event.title,
    kind === null ? null : KIND_NAMES[kind],
    detail,
    spokenWhere(where, online),
  ]
    .filter((part): part is string => part !== null)
    .join(", ");
  return {
    time,
    title: event.title,
    kind,
    tone,
    place: where?.name ?? null,
    online,
    detail,
    label,
    picture: event.picture ? thumbnailPath(event.picture) : null,
  };
}

function spokenWhere(where: Place | null, online: boolean): string | null {
  if (where === null) return online ? "Online" : null;
  const place = `${where.city ? "in" : "at"} ${where.name}`;
  return online ? `${place}, also online` : place;
}

function secondLine({ event, allDay, day }: DayEntry): string | null {
  if (day) return `Day ${String(day.n)} of ${String(day.of)}`;
  // An all-day event on one day has no span worth showing.
  if (event.end !== null && !allDay)
    return `${formatTime12(event.start)} to ${formatTime12(event.end)}`;
  return null;
}
