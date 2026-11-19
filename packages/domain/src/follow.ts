// Following an event (NT-13, NT-22): in its panel's Notify me or on Settings' Add
// events screen, the same choice. An event held more than once on the schedule (a weekly
// class, a prayer) is followed every time it is held, by its class id; a study program's
// sessions, whatever their day or the form of their title, are one choice, by the program
// (owner, 13 November 2026); anything else is that one event. Pure.

import { calendarKind, type CalendarKind, type CalendarSite } from "./events-calendar.ts";
import { eventPlace, type PlaceSite } from "./event-text.ts";
import { classList, eventList, programList, type NotifyList } from "./notify-lists.ts";
import { eventProgram } from "./programs.ts";
import { thumbnailPath } from "./thumbnail.ts";
import {
  easternDate,
  easternWeekday,
  formatLongDate,
  formatLongWeekday,
  formatShortMonthDay,
  formatTime12,
  type Weekday,
} from "./time.ts";
import { alsoAClass, type ProgramMatch, type SnapshotV2Event } from "./website.ts";

/** An event followed, as the phone keeps it and Events you follow shows it (NT-17). */
export interface Follow {
  list: NotifyList;
  title: string;
  /**
   * When it is held, starting with what following it covers (owner, 13 November 2026):
   * "Weekly · Wednesdays, 7:00 PM", "One time · Sunday, November 15, 2026" or
   * "2 times · Nov 29 and Dec 29, 2026".
   */
  detail: string;
}

/**
 * Held weekly, as its card says (NT-22): reminded a day before each time it is held, and not a
 * week before, which is the day of last week's session (NT-42, D69). The app and the server
 * share this one rule.
 */
export const isWeekly = (follow: Pick<Follow, "detail">): boolean =>
  follow.detail.startsWith("Weekly");

/** Which reminders an event followed sends, as its card says beside the bell (NT-47). */
export const remindersLine = (follow: Pick<Follow, "detail">): string =>
  isWeekly(follow) ? "Day before" : "Week before and day before";

/** What following `event` means, and how the panel's switch says it. */
export interface FollowChoice extends Follow {
  /**
   * Under Notify me, what this event sends (NT-48): "A reminder the day before each class,
   * and if one changes", or "A reminder a week and a day before, and if it changes".
   */
  panel: string;
}

/** What an event followed sends, under the panel's Notify me (NT-48). */
function sends(detail: string, each: string | null): string {
  const before = isWeekly({ detail })
    ? "A reminder the day before"
    : "A reminder a week and a day before";
  return each ? `${before} each ${each}, and if one changes` : `${before}, and if it changes`;
}

/**
 * A series: more than one of its sessions on the schedule. Followed, it notifies for every
 * session, whatever its date (NT-13), and the panel says so: "A reminder the day before each
 * class, …" for one held weekly, "A reminder a week and a day before each date, …" for one
 * with no usual days. A study
 * program's session follows the whole program, Sunday's and Tuesday's: "… each TTP class".
 * `each` is what one session of a weekly series is called: a class, a prayer, a session.
 */
export function followFor(
  event: SnapshotV2Event,
  events: readonly SnapshotV2Event[],
  programs: readonly ProgramMatch[] = [],
  each = "session",
): FollowChoice {
  const program = eventProgram(event, programs);
  if (program) {
    const sessions = events.filter((e) => eventProgram(e, programs) === program);
    // Its classes' times differ from day to day and term to term: only its days.
    const detail = meets(sessions);
    return {
      list: programList(program.id),
      title: program.titles[0] ?? event.title,
      detail,
      panel: sends(detail, `${program.shortName} class`),
    };
  }
  const sessions = events.filter((e) => e.classId === event.classId);
  if (sessions.length > 1) {
    const detail = held(sessions);
    return {
      list: classList(event.classId),
      title: event.title,
      detail,
      panel: sends(detail, isWeekly({ detail }) ? each : "date"),
    };
  }
  const once = `One time · ${formatLongDate(easternDate(event.start))}`;
  return { list: eventList(event.id), title: event.title, detail: once, panel: sends(once, null) };
}

const WEEK: readonly Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** A day counts as usual with at least half the sessions of the day held on most. */
const USUAL_SHARE = 0.5;
/** The usual days and time must cover at least this share of the sessions to be said. */
const USUAL_COVER = 2 / 3;

/** "Tuesday", "Tuesday and Thursday", "Tuesday to Friday", "Monday, Wednesday and Friday". */
function dayNames(names: readonly string[], running: boolean): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0] ?? ""} and ${names[1] ?? ""}`;
  if (running) return `${names[0] ?? ""} to ${names.at(-1) ?? ""}`;
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1) ?? ""}`;
}

/**
 * A series with no usual days (owner, 13 November 2026): how many times it is held and its
 * dates, "2 times · Nov 29 and Dec 29, 2026", or from its first one when there are more than
 * three, "5 times · from Nov 29, 2026". Every date says its year.
 */
function onDates(sorted: readonly SnapshotV2Event[]): string {
  const dates = sorted.map((e) => easternDate(e.start));
  const year = (date: string) => date.slice(0, 4);
  const first = dates[0] ?? "";
  if (dates.length > 3)
    return `${String(dates.length)} times · from ${formatShortMonthDay(first)}, ${year(first)}`;
  const oneYear = dates.every((date) => year(date) === year(first));
  const parts = dates.map((date) =>
    oneYear ? formatShortMonthDay(date) : `${formatShortMonthDay(date)}, ${year(date)}`,
  );
  const joined =
    parts.length <= 2
      ? parts.join(" and ")
      : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1) ?? ""}`;
  return `${String(dates.length)} times · ${oneYear ? `${joined}, ${year(first)}` : joined}`;
}

/**
 * When a class is held, from its sessions on the schedule, starting with Weekly (owner, 13
 * November 2026). Held on one weekday at one time every time: "Weekly · Tuesdays, 5:00 PM".
 * Otherwise the days it is held on most and its usual time, so a week that drops a day or
 * moves a session doesn't change the line (owner, 12 November): "Weekly · Tuesdays to
 * Fridays, usually 8:00 AM". With no usual days, how many times and when (onDates).
 */
function held(sessions: readonly SnapshotV2Event[]): string {
  const sorted = [...sessions].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const first = sorted[0];
  if (!first) return "";
  const dates = onDates(sorted);

  const count = <T>(values: readonly T[]) => {
    const counts = new Map<T, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    return counts;
  };
  const times = count(sorted.map((e) => formatTime12(e.start)));
  const [time = "", atTime = 0] = [...times].sort((a, b) => b[1] - a[1])[0] ?? [];
  const perDay = count(sorted.map((e) => WEEK.indexOf(easternWeekday(e.start))));
  const most = Math.max(...perDay.values());
  // One session on each of its days says nothing about a usual week.
  if (most < 2 || atTime < 2) return dates;
  const days = [...perDay]
    .filter(([, sessionsOn]) => sessionsOn >= most * USUAL_SHARE)
    .map(([day]) => day)
    .sort((a, b) => a - b);
  const usual = sorted.filter(
    (e) => days.includes(WEEK.indexOf(easternWeekday(e.start))) && formatTime12(e.start) === time,
  );
  if (usual.length < sorted.length * USUAL_COVER) return dates;

  const names = days.map((day) => {
    const on = sorted.find((e) => WEEK.indexOf(easternWeekday(e.start)) === day);
    return on ? `${formatLongWeekday(easternDate(on.start))}s` : "";
  });
  const running = days.every((day, i) => i === 0 || day === (days[i - 1] ?? 0) + 1);
  const always = usual.length === sorted.length;
  return `Weekly · ${dayNames(names, running)}, ${always ? time : `usually ${time}`}`;
}

const SUNDAY_FIRST: readonly Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * When a study program meets, from its sessions on the schedule (owner, 13 November 2026):
 * Weekly, the days it is held on most, Sunday first, and its start time when every session on
 * them starts at the same time: "Weekly · Sundays, 12:00 PM", "Weekly · Sundays and
 * Tuesdays". With no usual days, how many times and when (onDates).
 */
function meets(sessions: readonly SnapshotV2Event[]): string {
  const sorted = [...sessions].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const first = sorted[0];
  if (!first) return "";
  const perDay = new Map<number, SnapshotV2Event[]>();
  for (const event of sorted) {
    const day = SUNDAY_FIRST.indexOf(easternWeekday(event.start));
    perDay.set(day, [...(perDay.get(day) ?? []), event]);
  }
  const most = Math.max(...[...perDay.values()].map((on) => on.length));
  if (most < 2) return onDates(sorted);
  const days = [...perDay.keys()]
    .filter((day) => (perDay.get(day)?.length ?? 0) >= most * USUAL_SHARE)
    .sort((a, b) => a - b);
  const usual = days.flatMap((day) => perDay.get(day) ?? []);
  const names = days.map((day) => {
    const on = perDay.get(day)?.[0];
    return on ? `${formatLongWeekday(easternDate(on.start))}s` : "";
  });
  const starts = new Set(usual.map((e) => formatTime12(e.start)));
  const [time] = starts;
  return `Weekly · ${dayNames(names, false)}${starts.size === 1 && time ? `, ${time}` : ""}`;
}

/** An event on the Add events screen (NT-22): its follow, and how the screen groups it. */
export interface EventChoice extends Follow {
  /** Held more than once on the schedule: under Every week, followed whenever it is held. */
  series: boolean;
  /** Its kind, for the colour beside its name (D45); slate for another center's special event (D67). */
  kind: CalendarKind | "elsewhere" | null;
  /** A special event the website also lists as a class: under Classes too (D45). */
  alsoClass: boolean;
  /** Its picture's thumbnail on the site (slice 1.13); null when the website has none. */
  picture: string | null;
  /** Where to go in person, as the list says it (EV-11): `KMC DC`, `Richmond`; null for none. */
  place: string | null;
  /** Can be attended online (EV-40). */
  online: boolean;
}

/**
 * The Add events screen's rows (NT-22): each series once, by name, then each one-time event
 * by date; the same follow as the event's panel gives (followFor).
 */
export function eventChoices(
  events: readonly SnapshotV2Event[],
  site: Pick<CalendarSite, "categoryKinds" | "programs"> & PlaceSite,
): EventChoice[] {
  const where = (event: SnapshotV2Event) => ({
    place: eventPlace(event, site)?.name ?? null,
    online: event.location?.online === true || event.online !== null,
  });
  // A study program's sessions are one choice, whatever their class (followFor).
  const key = (event: SnapshotV2Event) => eventProgram(event, site.programs)?.id ?? event.classId;
  const byClass = new Map<string, SnapshotV2Event[]>();
  for (const event of events) byClass.set(key(event), [...(byClass.get(key(event)) ?? []), event]);
  const choices: (EventChoice & { start: string })[] = [];
  for (const sessions of byClass.values()) {
    const sorted = [...sessions].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    if (sorted.length > 1) {
      const first = sorted[0] as SnapshotV2Event;
      const { list, title, detail } = followFor(first, events, site.programs);
      choices.push({
        list,
        title,
        detail,
        series: true,
        kind: choiceKind(first, site),
        alsoClass: alsoAClass(first.categories, site.categoryKinds),
        picture: thumbnailOf(sorted),
        ...where(first),
        start: first.start,
      });
    } else
      for (const event of sorted) {
        const { list, title, detail } = followFor(event, events, site.programs);
        choices.push({
          list,
          title,
          detail,
          series: false,
          kind: choiceKind(event, site),
          alsoClass: alsoAClass(event.categories, site.categoryKinds),
          picture: thumbnailOf([event]),
          ...where(event),
          start: event.start,
        });
      }
  }
  return choices
    .sort((a, b) =>
      a.series !== b.series
        ? Number(b.series) - Number(a.series)
        : a.series
          ? a.title.localeCompare(b.title, "en")
          : Date.parse(a.start) - Date.parse(b.start),
    )
    .map(({ list, title, detail, series, kind, alsoClass, picture, place, online }) => ({
      list,
      title,
      detail,
      series,
      kind,
      alsoClass,
      picture,
      place,
      online,
    }));
}

/** The colour beside a choice's name: its kind's, or slate for another center's special event (D67). */
function choiceKind(
  event: SnapshotV2Event,
  site: Pick<CalendarSite, "categoryKinds" | "programs">,
): CalendarKind | "elsewhere" | null {
  const kind = calendarKind(event, site);
  return kind === "special" && event.otherCenter ? "elsewhere" : kind;
}

/** The first session's picture that has one, as its thumbnail on the site. */
function thumbnailOf(sessions: readonly SnapshotV2Event[]): string | null {
  const picture = sessions.find((e) => e.picture)?.picture;
  return picture ? thumbnailPath(picture) : null;
}

/**
 * The followed events that are no longer on the schedule (NT-17): each was cancelled or has
 * ended, so it can't change again and its follow is dropped. A class or a prayer followed
 * every time it is held stays: it may be on the schedule again.
 */
export function goneFollows(
  lists: readonly NotifyList[],
  events: readonly SnapshotV2Event[],
): NotifyList[] {
  const listed = new Set(events.map((e) => eventList(e.id)));
  return lists.filter((list) => list.startsWith("event-") && !listed.has(list));
}
