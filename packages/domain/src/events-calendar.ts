import { classTone, eventProgram } from "./programs.ts";
import { addDays, easternDate, easternMinutes, easternWeekday, multiDayDates } from "./time.ts";
import {
  eventKind,
  type CategoryKinds,
  type EmailNames,
  type ProgramMatch,
  type SnapshotV2Event,
} from "./website.ts";

/**
 * The KMC DC Events email's content (AN-14): every event in the schedule from today to 4
 * months ahead, as a calendar for each month, Sunday to Saturday. Each event sits in its day
 * with its kind (D45; study programs and branch classes each their own) and a short name. Pure.
 */

/** The email's kinds: the app's three, with the study programs' sessions apart from classes. */
export type CalendarKind = "class" | "program" | "branch" | "prayer" | "special";

/** One event on one day; `cont` on the later days of an event over several days. */
export interface CalendarItem {
  /** Null for an event whose categories have no kind. */
  kind: CalendarKind | null;
  event: SnapshotV2Event;
  cont: boolean;
  /** A prayer's code from the key, a program's short name, or a one-word label. */
  short: string;
}

export interface CalendarDay {
  /** `YYYY-MM-DD`. */
  date: string;
  /** In the month of its calendar; days of other months are drawn empty. */
  inMonth: boolean;
  /** Between `from` and `to`; the month's days outside are drawn greyed. */
  inRange: boolean;
  items: CalendarItem[];
}

export interface CalendarMonth {
  /** `YYYY-MM`. */
  month: string;
  /** Sunday to Saturday; only the weeks with a day in range. */
  weeks: CalendarDay[][];
}

export interface EventsCalendar {
  /** Today and the last day, Eastern, `YYYY-MM-DD`. */
  from: string;
  to: string;
  /** Events that start in range. */
  count: number;
  /** The prayer codes the calendar uses, in the key's order; unknown titles last, by title. */
  key: { code: string; name: string }[];
  months: CalendarMonth[];
}

export interface CalendarSite {
  categoryKinds: CategoryKinds;
  programs: readonly ProgramMatch[];
  emailNames: EmailNames;
}

/** How far ahead the email looks (owner, 7 November 2026). */
export const CALENDAR_MONTHS = 4;

/** An event's kind in the email: its D45 kind, or a class's own colour group (classTone). */
export function calendarKind(
  event: SnapshotV2Event,
  site: Pick<CalendarSite, "categoryKinds" | "programs">,
): CalendarKind | null {
  const kind = eventKind(event.categories, site.categoryKinds);
  if (kind !== "class") return kind;
  return classTone(event, site.programs) ?? "class";
}

export function eventsCalendar(
  events: readonly SnapshotV2Event[],
  site: CalendarSite,
  now: Date,
  months = CALENDAR_MONTHS,
): EventsCalendar {
  const from = easternDate(now);
  const to = addDays(addMonths(from, months), -1);
  const { prayers, classes, special } = site.emailNames;
  const extra = new Map<string, string>();
  const used = new Set<string>();
  const label = (list: readonly { label: string; startsWith: string }[], title: string) =>
    list.find((l) => title.startsWith(l.startsWith))?.label ?? title.split(/\s+/)[0] ?? "";
  const shortName = (event: SnapshotV2Event, kind: CalendarKind | null): string => {
    if (kind === "program") return eventProgram(event, site.programs)?.shortName ?? event.title;
    if (kind === "prayer") {
      const known = prayers.find((n) => event.title.startsWith(n.startsWith));
      const code = known?.code ?? initials(event.title);
      if (!known) extra.set(event.title, code);
      used.add(code);
      return code;
    }
    if (kind === "special") return label(special, event.title);
    return label(classes, event.title);
  };

  const byDay = new Map<string, CalendarItem[]>();
  let count = 0;
  const sorted = [...events].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  for (const event of sorted) {
    const dates = multiDayDates(event.start, event.end) ?? [easternDate(event.start)];
    if ((dates[0] ?? "") > to || (dates.at(-1) ?? "") < from) continue;
    if ((dates[0] ?? "") >= from) count++;
    const kind = calendarKind(event, site);
    const short = shortName(event, kind);
    dates.forEach((date, i) => {
      if (date < from || date > to) return;
      const list = byDay.get(date) ?? [];
      list.push({ kind, event, cont: i > 0, short });
      byDay.set(date, list);
    });
  }
  // A day's continuing events first, as the app lists them under All day.
  for (const list of byDay.values()) list.sort((a, b) => Number(b.cont) - Number(a.cont));

  const result: CalendarMonth[] = [];
  for (let first = `${from.slice(0, 7)}-01`; first <= to; first = addMonths(first, 1)) {
    const month = first.slice(0, 7);
    const weeks: CalendarDay[][] = [];
    for (
      let sunday = addDays(first, -weekday(first));
      sunday.slice(0, 7) <= month;
      sunday = addDays(sunday, 7)
    ) {
      const week = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(sunday, i);
        const inMonth = date.slice(0, 7) === month;
        const inRange = inMonth && date >= from && date <= to;
        return { date, inMonth, inRange, items: inRange ? (byDay.get(date) ?? []) : [] };
      });
      if (week.some((d) => d.inRange)) weeks.push(week);
    }
    result.push({ month, weeks });
  }

  const key = [
    ...prayers.filter((n) => used.has(n.code)).map(({ code, name }) => ({ code, name })),
    ...[...extra].sort(([a], [b]) => a.localeCompare(b)).map(([name, code]) => ({ code, name })),
  ].filter((k, i, all) => all.findIndex((x) => x.code === k.code && x.name === k.name) === i);
  return { from, to, count, key, months: result };
}

/** Sunday 0 to Saturday 6. */
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** Up to three letters or digits: each word's first. */
const initials = (title: string) =>
  title
    .split(/[^A-Za-z0-9]+/)
    .filter(
      (w) =>
        w.length > 0 &&
        !["a", "an", "and", "for", "from", "in", "of", "on", "the", "to", "with"].includes(w),
    )
    .slice(0, 3)
    .map((w) => (w[0] ?? "").toUpperCase())
    .join("");

/** `YYYY-MM-DD` plus whole months, clamped to the month's last day. */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0));
  target.setUTCDate(Math.min(d, last.getUTCDate()));
  return target.toISOString().slice(0, 10);
}

/** From 4 AM Eastern, as the program emails (D51). */
const SEND_FROM = 4 * 60;

/** The days the KMC DC Events email goes out (owner, 7 November 2026; D51). */
export const EVENTS_EMAIL_DAYS = ["mon", "wed", "fri"] as const;

/**
 * KMC DC Events goes out by its timer at 4:30 AM on Mondays, Wednesdays and Fridays (D51):
 * once a day, so a second start of the timer that day sends nothing.
 */
export function eventsEmailDue(now: Date, lastSent: string | null): boolean {
  return (
    (EVENTS_EMAIL_DAYS as readonly string[]).includes(easternWeekday(now)) &&
    easternMinutes(now) >= SEND_FROM &&
    (lastSent === null || easternDate(lastSent) !== easternDate(now))
  );
}
