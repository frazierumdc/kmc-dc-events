import { easternDate, formatShortDate, formatTime12, multiDayDates } from "./time.ts";
import type { SnapshotV2Event } from "./website.ts";

/**
 * When and where an event is, in words, as the app's rows, a shared event and the staff
 * emails say it (EV-11, EV-35, AN-12). Plain text.
 */

/** What the place needs from the site settings. */
export interface PlaceSite {
  homeCity: string;
  center: { shortName: string };
}

export interface Place {
  name: string;
  /** A city reads "in Richmond"; a place "at KMC DC". */
  city: boolean;
}

/**
 * The center's short name for its own city (Wix names the center several ways), the city
 * for anywhere else, the venue's name when Wix gives no city; nothing for online only.
 */
export function eventPlace({ location }: SnapshotV2Event, site: PlaceSite): Place | null {
  if (location === null || location.online) return null;
  const city = location.city?.trim() ?? "";
  if (city === "") {
    const name = location.name?.trim() ?? "";
    return name === "" ? null : { name, city: false };
  }
  return city.localeCompare(site.homeCity, "en", { sensitivity: "base" }) === 0
    ? { name: site.center.shortName, city: false }
    : { name: city, city: true };
}

/**
 * `Tue, Oct 13, 2026 · 6:00 – 6:30 PM`; all day: `Fri, Oct 9, 2026 – Thu, Oct 15, 2026 ·
 * All day`; over several days: `Fri, Oct 9, 2026, 7:30 PM – Thu, Oct 15, 2026, 12:00 PM`.
 * `zone` follows the time when given (`Eastern`).
 */
export function eventWhen(
  event: Pick<SnapshotV2Event, "start" | "end" | "allDay">,
  options: { zone?: string } = {},
): string {
  const zone = options.zone ? ` ${options.zone}` : "";
  const first = dateWithYear(easternDate(event.start));
  const dates = multiDayDates(event.start, event.end);
  const last = dates?.at(-1);
  if (event.allDay) return `${last ? `${first} – ${dateWithYear(last)}` : first} · All day`;
  const start = formatTime12(event.start);
  if (event.end === null) return `${first} · ${start}${zone}`;
  const end = formatTime12(event.end);
  if (dates) return `${first}, ${start} – ${dateWithYear(easternDate(event.end))}, ${end}${zone}`;
  const sameHalf = start.slice(-2) === end.slice(-2);
  return `${first} · ${sameHalf ? start.slice(0, -3) : start} – ${end}${zone}`;
}

/** `Mon, Oct 19, 2026`. */
export function dateWithYear(date: string): string {
  return `${formatShortDate(date)}, ${date.slice(0, 4)}`;
}
