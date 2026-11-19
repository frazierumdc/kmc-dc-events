import {
  easternDate,
  formatLongDate,
  formatTime12,
  multiDayDates,
  type SnapshotV2Event,
} from "@kmcdc/domain";
import { eventWhere } from "@kmcdc/publish";

/**
 * What the details panel says (EV-30 – EV-33), as the website has it (D36). Text is plain;
 * the panel shows it as text (C-6).
 */

export interface SheetText {
  /** The website's categories: `Weekly Meditation Classes`; null when it has none. */
  categories: string | null;
  title: string;
  when: readonly [string, string];
  where: { online: boolean; lines: readonly string[] };
  description: string | null;
}

export function eventSheet(event: SnapshotV2Event): SheetText {
  return {
    categories: event.categories.length > 0 ? event.categories.join(" · ") : null,
    title: event.title,
    when: eventWhen(event),
    where: eventWhere(event),
    description: nonBlank(event.description) ?? nonBlank(event.summary),
  };
}

/**
 * When (EV-31), always in Eastern time: the full date with its year, then the times; a
 * multi-day event says when it ends. "Monday, October 5, 2026" / "7:00 PM to 8:15 PM
 * Eastern"; "Friday, October 9, 2026 at 7:30 PM" / "to Thursday, October 15, 2026 at
 * 12:00 PM Eastern".
 */
export function eventWhen(event: SnapshotV2Event): [string, string] {
  const start = easternDate(event.start);
  const dates = multiDayDates(event.start, event.end);
  if (event.allDay) {
    const last = dates?.at(-1);
    return [
      last ? `${formatLongDate(start)} to ${formatLongDate(last)}` : formatLongDate(start),
      "All day",
    ];
  }
  if (dates && event.end !== null)
    return [
      `${formatLongDate(start)} at ${formatTime12(event.start)}`,
      `to ${formatLongDate(easternDate(event.end))} at ${formatTime12(event.end)} Eastern`,
    ];
  const times =
    event.end === null
      ? formatTime12(event.start)
      : `${formatTime12(event.start)} to ${formatTime12(event.end)}`;
  return [formatLongDate(start), `${times} Eastern`];
}

function nonBlank(text: string | null | undefined): string | null {
  const trimmed = text?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}
