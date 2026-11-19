import {
  easternDate,
  eventKind,
  eventPlace,
  formatLongWeekday,
  formatShortMonth,
  formatShortWeekday,
  formatTime12,
  multiDayDates,
  type EventKind,
  type PublishedSite,
  type SnapshotV2Event,
} from "@kmcdc/domain";

/**
 * What an event's share picture shows (EV-35): a calendar page with the month and year, the
 * day and the weekday, coloured by the event's kind; then the kind's name, the event's
 * name, its time and its place. The deploy draws it (share-pictures.ts) at
 * `/e/{id}/share.png`; Share sends it and link previews show it.
 */
export interface PictureContent {
  kind: EventKind | null;
  /** `Class`, `Special event`, `Prayers`; null when the event has no kind. */
  kindName: string | null;
  /** The calendar page's top: `OCT 2026`, `OCT – NOV 2026`, `DEC 2026 – JAN 2027`. */
  month: string;
  /** `19`, or `9–15` over several days. */
  day: string;
  /** `Monday`, or `Fri – Thu` over several days. */
  weekday: string;
  title: string;
  /** `7:00 – 8:15 PM Eastern`, `All day`, `Fri 7:30 PM – Thu 12:00 PM Eastern`. */
  time: string;
  /** `KMC DC`, a city, or Online; null when the website gives no place. */
  place: { name: string; online: boolean } | null;
}

/** Where an event's picture is published, beside its own page (event-pages.ts). */
export function picturePath(id: string): string {
  return `/e/${id}/share.png`;
}

const KIND_NAMES: Record<EventKind, string> = {
  class: "Class",
  special: "Special event",
  prayer: "Prayers",
};

export function pictureContent(event: SnapshotV2Event, site: PublishedSite): PictureContent {
  const kind = eventKind(event.categories, site.categoryKinds);
  const first = easternDate(event.start);
  const last = multiDayDates(event.start, event.end)?.at(-1) ?? null;
  const where = eventPlace(event, site);
  const place = event.location?.online
    ? { name: "Online", online: true }
    : where && { name: where.name, online: false };
  return {
    kind,
    kindName: kind && KIND_NAMES[kind],
    month: last ? monthRange(first, last) : monthYear(first),
    day: last ? `${dayOf(first)}–${dayOf(last)}` : dayOf(first),
    weekday: last ? `${short(first)} – ${short(last)}` : weekday(first),
    title: event.title,
    time: pictureTime(event, last !== null),
    place,
  };
}

function pictureTime(event: SnapshotV2Event, severalDays: boolean): string {
  if (event.allDay) return "All day";
  const start = formatTime12(event.start);
  if (event.end === null) return `${start} Eastern`;
  const end = formatTime12(event.end);
  if (severalDays)
    return `${short(easternDate(event.start))} ${start} – ${short(easternDate(event.end))} ${end} Eastern`;
  const sameHalf = start.slice(-2) === end.slice(-2);
  return `${sameHalf ? start.slice(0, -3) : start} – ${end} Eastern`;
}

/** `OCT 2026` from an Eastern date (`YYYY-MM-DD`). */
const monthYear = (date: string) => formatShortMonth(date).toUpperCase();
const month = (date: string) => monthYear(date).slice(0, 3);
const year = (date: string) => date.slice(0, 4);
const dayOf = (date: string) => String(Number(date.slice(8, 10)));
const weekday = formatLongWeekday;
const short = formatShortWeekday;

function monthRange(first: string, last: string): string {
  if (year(first) !== year(last)) return `${monthYear(first)} – ${monthYear(last)}`;
  if (month(first) !== month(last)) return `${month(first)} – ${monthYear(last)}`;
  return monthYear(first);
}
