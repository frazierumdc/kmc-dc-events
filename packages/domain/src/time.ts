/**
 * All business time logic, in Eastern time (C-4). Instants are ISO strings in UTC; an
 * Eastern date is `YYYY-MM-DD`. Uses only `Intl`, so it runs the same in Node and browsers.
 */

export const TIME_ZONE = "America/New_York";

const HOUR = 60 * 60 * 1000;

export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const parts = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
});

interface EasternParts {
  date: string;
  hour: number;
  minute: number;
  second: number;
  weekday: Weekday;
  /** Offset from UTC in minutes: -240 in summer, -300 in winter. */
  offset: number;
}

function easternParts(instant: string | Date): EasternParts {
  const ms = typeof instant === "string" ? Date.parse(instant) : instant.getTime();
  if (Number.isNaN(ms)) throw new RangeError(`Not an instant: ${String(instant)}`);
  const p: Record<string, string> = {};
  for (const { type, value } of parts.formatToParts(ms)) p[type] = value;
  const [year, month, day] = [Number(p.year), Number(p.month), Number(p.day)];
  const [hour, minute, second] = [Number(p.hour), Number(p.minute), Number(p.second)];
  const wallMs = Date.UTC(year, month - 1, day, hour, minute, second);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour,
    minute,
    second,
    weekday: (p.weekday ?? "").toLowerCase() as Weekday,
    offset: Math.round((wallMs - Math.floor(ms / 1000) * 1000) / 60000),
  };
}

/** The Eastern calendar date of an instant, `YYYY-MM-DD`. */
export function easternDate(instant: string | Date): string {
  return easternParts(instant).date;
}

/** The Eastern weekday of an instant (`mon`, `tue`, …). */
export function easternWeekday(instant: string | Date): Weekday {
  return easternParts(instant).weekday;
}

/** Minutes after Eastern midnight, for start-time windows. */
export function easternMinutes(instant: string | Date): number {
  const { hour, minute } = easternParts(instant);
  return hour * 60 + minute;
}

function ymd(date: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new RangeError(`Not a date: ${date}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** `YYYY-MM-DD` plus `days` calendar days. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = ymd(date);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The instant of midnight Eastern at the start of `date` (`YYYY-MM-DD`). */
export function easternMidnight(date: string): string {
  const [y, m, d] = ymd(date);
  // Midnight is never inside a US clock change (they happen at 2 AM), so one of the two
  // Eastern offsets always lands on it.
  for (const hoursBehind of [4, 5]) {
    const candidate = new Date(Date.UTC(y, m - 1, d, hoursBehind));
    const p = easternParts(candidate);
    if (p.date === date && p.hour === 0) return candidate.toISOString();
  }
  throw new RangeError(`No Eastern midnight for ${date}`);
}

/** The instant at which today (Eastern) began. */
export function startOfTodayEastern(now: Date): string {
  return easternMidnight(easternDate(now));
}

/** An instant as ISO with the Eastern offset: `2026-10-12T19:00:00-04:00`. */
export function toEasternIso(instant: string): string {
  const { date, hour, minute, second, offset } = easternParts(instant);
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date}T${pad(hour)}:${pad(minute)}:${pad(second)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** Eastern time of day in 12-hour form: `7:00 PM`, `12:30 AM`. */
export function formatTime12(instant: string): string {
  const { hour, minute } = easternParts(instant);
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A short Eastern date and time for reviewers: `Tue 13 Oct, 6:00 PM`. */
export function formatEasternShort(instant: string): string {
  const { date, weekday } = easternParts(instant);
  const [, m, d] = ymd(date);
  const day = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${day} ${String(d)} ${MONTHS[m - 1] ?? ""}, ${formatTime12(instant)}`;
}

const LONG_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const LONG_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function weekdayIndex(date: string): number {
  const [y, m, d] = ymd(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** An Eastern date (`YYYY-MM-DD`) in full: `Friday, October 9, 2026`. */
export function formatLongDate(date: string): string {
  return `${formatLongWeekday(date)}, ${formatMonthDay(date)}`;
}

/** The weekday of an Eastern date in full: `Friday`. */
export function formatLongWeekday(date: string): string {
  return LONG_WEEKDAYS[weekdayIndex(date)] ?? "";
}

/** An instant as an Eastern date and time for "Schedule updated" (EV-17): `October 9, 2026, 2:15 PM`. */
export function formatEasternDateTime(instant: string): string {
  return `${formatMonthDay(easternDate(instant))}, ${formatTime12(instant)}`;
}

/** An Eastern date without its weekday: `October 9, 2026`. */
export function formatMonthDay(date: string): string {
  const [y, m, d] = ymd(date);
  return `${LONG_MONTHS[m - 1] ?? ""} ${String(d)}, ${String(y)}`;
}

/** An Eastern date in short form: `Fri, Oct 9`. */
export function formatShortDate(date: string): string {
  const [, m, d] = ymd(date);
  return `${formatShortWeekday(date)}, ${MONTHS[m - 1] ?? ""} ${String(d)}`;
}

/** An Eastern date as a short month and day, without weekday or year: `Oct 9`. */
export function formatShortMonthDay(date: string): string {
  const [, m, d] = ymd(date);
  return `${MONTHS[m - 1] ?? ""} ${String(d)}`;
}

/** The short weekday of an Eastern date: `Fri`. */
export function formatShortWeekday(date: string): string {
  const day = WEEKDAYS[weekdayIndex(date)] ?? "";
  return day.charAt(0).toUpperCase() + day.slice(1);
}

/** The short month and year of an Eastern date: `Oct 2026`. */
export function formatShortMonth(date: string): string {
  const [y, m] = ymd(date);
  return `${MONTHS[m - 1] ?? ""} ${String(y)}`;
}

/** The end used for "has it finished?": the real end, or one hour after the start. */
export function effectiveEnd(startsAt: string, endsAt: string | null): string {
  return endsAt ?? new Date(Date.parse(startsAt) + HOUR).toISOString();
}

/** True when the event ended before today (Eastern) began (EV-2, EV-10). */
export function endedBeforeToday(startsAt: string, endsAt: string | null, now: Date): boolean {
  return Date.parse(effectiveEnd(startsAt, endsAt)) <= Date.parse(startOfTodayEastern(now));
}

/**
 * All-day events: Wix has no all-day flag, but stores them as starting at midnight Eastern
 * and ending at midnight or 11:59 PM on the same or a later day.
 */
export function isAllDay(startsAt: string, endsAt: string | null): boolean {
  if (endsAt === null || Date.parse(endsAt) <= Date.parse(startsAt)) return false;
  const start = easternParts(startsAt);
  const end = easternParts(endsAt);
  const startsAtMidnight = start.hour === 0 && start.minute === 0;
  const endsAtMidnight = end.hour === 0 && end.minute === 0;
  const endsAt2359 = end.hour === 23 && end.minute === 59;
  return startsAtMidnight && (endsAtMidnight || endsAt2359);
}

/** Before this hour, an end on a later day still belongs to the evening before. */
const LATE_NIGHT_END_HOUR = 6;

/**
 * The Eastern dates of an event that runs over several days (D31): from its start date to
 * its last date, where an end before 6 AM (such as midnight) counts for the day before.
 * Null when the event is on one day, including an evening that runs past midnight.
 */
export function multiDayDates(startsAt: string, endsAt: string | null): string[] | null {
  if (endsAt === null) return null;
  const first = easternDate(startsAt);
  const end = easternParts(endsAt);
  const last = end.hour < LATE_NIGHT_END_HOUR ? addDays(end.date, -1) : end.date;
  if (last <= first) return null;
  const dates = [first];
  while (dates[dates.length - 1] !== last) dates.push(addDays(dates[dates.length - 1] ?? last, 1));
  return dates;
}
