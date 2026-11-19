import {
  addDays,
  alsoAClass,
  easternDate,
  effectiveEnd,
  eventKind,
  eventTone,
  type EventTone,
  formatLongDate,
  formatMonthDay,
  multiDayDates,
  type CategoryKinds,
  type EventKind,
  type ProgramMatch,
  type SnapshotV2Event,
} from "@kmcdc/domain";

/**
 * The events still to come, grouped by Eastern date (EV-10): finished events drop off (no
 * end counts as one hour), all-day events come first, then by start time and title. Every
 * event is listed as the website lists it, online ones included (D36). An event that runs
 * over several days is listed on each of its days from today: its first day at its start
 * time, the others as all-day (D31). Any other event that began on an earlier day and is
 * still on is listed under today. Each entry carries the event's kind (D45), and a class its
 * own colour group, a study program's session or a branch class (classTone).
 */

export interface DayEntry {
  event: SnapshotV2Event;
  /** Shown as "All day": an all-day event, or a later day of a multi-day event. */
  allDay: boolean;
  /** Which day of a multi-day event this is: `{ n: 2, of: 7 }`. */
  day: { n: number; of: number } | null;
  kind: EventKind | null;
  /** A special event the website also lists as a class: under Classes too, in its special colour (D45). */
  alsoClass: boolean;
  /** Its own colour in place of the kind's: a study program's session, a branch class (D45), another center's special event (D67). */
  tone: EventTone | null;
}

export interface Day {
  /** `YYYY-MM-DD`, Eastern. */
  date: string;
  entries: DayEntry[];
}

export function upcomingDays(
  events: readonly SnapshotV2Event[],
  now: Date,
  categoryKinds: CategoryKinds,
  programs: readonly ProgramMatch[] = [],
): Day[] {
  const today = easternDate(now);
  const byDate = new Map<string, DayEntry[]>();
  const add = (date: string, entry: DayEntry) => {
    const day = byDate.get(date) ?? [];
    day.push(entry);
    byDate.set(date, day);
  };
  for (const event of events) {
    if (Date.parse(effectiveEnd(event.start, event.end)) <= now.getTime()) continue;
    const kind = eventKind(event.categories, categoryKinds);
    const tone = eventTone(event, kind, programs);
    const alsoClass = alsoAClass(event.categories, categoryKinds);
    const dates = multiDayDates(event.start, event.end);
    if (dates) {
      dates.forEach((date, i) => {
        if (date >= today)
          add(date, {
            event,
            allDay: i > 0 || event.allDay,
            day: { n: i + 1, of: dates.length },
            kind,
            alsoClass,
            tone,
          });
      });
      continue;
    }
    const start = easternDate(event.start);
    add(start < today ? today : start, {
      event,
      allDay: event.allDay,
      day: null,
      kind,
      alsoClass,
      tone,
    });
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entries]) => ({
      date,
      entries: entries.sort(
        (a, b) =>
          Number(b.allDay) - Number(a.allDay) ||
          Date.parse(a.event.start) - Date.parse(b.event.start) ||
          a.event.title.localeCompare(b.event.title),
      ),
    }));
}

/**
 * A day heading (EV-10): "Today, October 13, 2026", "Tomorrow, October 14, 2026",
 * "Thursday, October 15, 2026".
 */
export function dayHeading(date: string, today: string): string {
  if (date === today) return `Today, ${formatMonthDay(date)}`;
  if (date === addDays(today, 1)) return `Tomorrow, ${formatMonthDay(date)}`;
  return formatLongDate(date);
}

/** The kind filter (EV-12): `all`, or one kind (D45). */
export type KindFilter = "all" | EventKind;

export const ALL = "all";

/** The filter's choices (EV-12): always these four; each kind with a dot of its colour. */
export const KIND_FILTERS: readonly { value: KindFilter; label: string; dot?: EventKind }[] = [
  { value: ALL, label: "All" },
  { value: "class", label: "Classes", dot: "class" },
  { value: "special", label: "Special", dot: "special" },
  { value: "prayer", label: "Prayers", dot: "prayer" },
];

/** The filter to show: a remembered choice the app no longer offers is All (EV-15). */
export function currentFilter(chosen: string): KindFilter {
  return KIND_FILTERS.find((f) => f.value === chosen)?.value ?? ALL;
}

export function matchesFilter(entry: DayEntry, filter: KindFilter): boolean {
  return filter === ALL || entry.kind === filter || (filter === "class" && entry.alsoClass);
}

/** The days left after the filter; days with no matching event are dropped. */
export function filterDays(days: readonly Day[], filter: KindFilter): Day[] {
  if (filter === ALL) return [...days];
  return days
    .map((day) => ({ ...day, entries: day.entries.filter((e) => matchesFilter(e, filter)) }))
    .filter((day) => day.entries.length > 0);
}

/** The message when nothing matches the filter (EV-16). */
export const EMPTY_MESSAGE = "No events match this filter";

/** The listed event an id opens (EV-37); null when it isn't on the list. */
export function findListed(days: readonly Day[], id: string): DayEntry | null {
  const entries = days.flatMap((day) => day.entries);
  return (
    entries.find((entry) => entry.event.id === id) ??
    // An online event isn't listed on its own: its link opens the event it belongs to (D46).
    entries.find(({ event: { online } }) => online?.type === "event" && online.id === id) ??
    null
  );
}
