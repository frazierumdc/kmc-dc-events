import {
  addDays,
  formatLongDate,
  formatShortMonth,
  formatShortWeekday,
  type EventKind,
} from "@kmcdc/domain";
import { matchesFilter, type Day, type KindFilter } from "./days.ts";

/**
 * The row of dates (EV-13): every date from today to the last listed day, with one dot for
 * each kind (D45) among the events that match the filter, in the filter's order, and the
 * month and year above the first date and each 1st ("Oct 2026"). Events with no kind give a
 * grey dot only when the day has nothing else. Each date is read as "Monday, October 5, 2026,
 * 3 events" (NFR-2).
 */

export interface StripDate {
  /** `YYYY-MM-DD`, Eastern. */
  date: string;
  /** `Mon`. */
  weekday: string;
  /** `5`. */
  day: string;
  /** `Oct 2026` above the first date and each 1st, otherwise null. */
  month: string | null;
  isToday: boolean;
  /** One dot per kind on the day, in the order Classes, Special, Prayers; `null` is grey. */
  dots: (EventKind | null)[];
  count: number;
  label: string;
}

const DOT_ORDER: readonly EventKind[] = ["class", "special", "prayer"];

export function dateStrip(days: readonly Day[], filter: KindFilter, today: string): StripDate[] {
  const last = days.at(-1)?.date;
  if (last === undefined) return [];
  const byDate = new Map(days.map((d) => [d.date, d]));
  const strip: StripDate[] = [];
  for (let date = today; date <= last; date = addDays(date, 1)) {
    const matching = (byDate.get(date)?.entries ?? []).filter((e) => matchesFilter(e, filter));
    const count = matching.length;
    strip.push({
      date,
      weekday: formatShortWeekday(date),
      day: String(Number(date.slice(8))),
      month: date === today || date.endsWith("-01") ? formatShortMonth(date) : null,
      isToday: date === today,
      dots: kindDots(matching.map((e) => e.kind)),
      count,
      label: `${formatLongDate(date)}, ${count === 0 ? "no events" : `${String(count)} ${count === 1 ? "event" : "events"}`}`,
    });
  }
  return strip;
}

function kindDots(kinds: readonly (EventKind | null)[]): (EventKind | null)[] {
  const found = DOT_ORDER.filter((k) => kinds.includes(k));
  return found.length > 0 ? found : kinds.length > 0 ? [null] : [];
}
