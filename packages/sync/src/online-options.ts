import {
  addDays,
  easternDate,
  easternMidnight,
  easternMinutes,
  easternWeekday,
  endedBeforeToday,
  type IconOnly,
  type Livestream,
  type OnlineOption,
  type SiteSettings,
  type WebsiteEvent,
} from "@kmcdc/domain";

/**
 * Each event's online option (D46, EV-40; data-pipeline.md step 4). An online event in the
 * source belongs to the in-person event that starts at the same time and shares the most
 * title words with it (a tie, or none shared, joins nothing): it becomes that event's
 * option and isn't listed on its own. An event at the center that the online
 * schedule (`site.online`) says is livestreamed gets the livestream. Any other event that an
 * `iconOnly` rule matches, wherever it is held, gets only the list's online icon. Pure.
 */

/** How far ahead the online schedule is compared with the classes. */
export const CHECK_DAYS = 28;

export interface OnlineNote {
  id: string | null;
  title: string | null;
  message: string;
}

export interface OnlineOptions {
  /** The events to list: all but the online events joined to an in-person event. */
  events: WebsiteEvent[];
  /** Event id → its online option; events without one aren't in it. */
  options: Map<string, OnlineOption>;
  /** Where Wix and the online schedule disagree, for the run's summary. */
  warnings: OnlineNote[];
}

export function onlineOptions(
  events: readonly WebsiteEvent[],
  site: SiteSettings,
  now: Date,
): OnlineOptions {
  const twins = onlineTwins(events);
  const joined = new Set([...twins.values()].map((e) => e.id));
  const options = new Map<string, OnlineOption>();
  for (const [id, twin] of twins)
    options.set(id, {
      type: "event",
      id: twin.id,
      page: twin.page,
      registrationOpen: twin.registrationOpen,
    });

  const atCenter = events.filter((e) => isAtCenter(e, site.homeCity));
  for (const e of atCenter)
    if (!options.has(e.id) && site.online.livestreams.some((l) => isStreamed(e, l)))
      options.set(e.id, { type: "livestream", page: site.links.onlineClasses });
  for (const e of events)
    if (
      !options.has(e.id) &&
      e.location?.online !== true &&
      site.online.iconOnly.some((rule) => isMarked(e, rule))
    )
      options.set(e.id, { type: "iconOnly" });

  const warnings: OnlineNote[] = [];
  for (const e of events)
    if (e.location?.online === true && !joined.has(e.id) && !endedBeforeToday(e.start, e.end, now))
      warnings.push({
        id: e.id,
        title: e.title,
        message:
          "an online event with no in-person event starting at the same time; listed on its own",
      });
  warnings.push(...scheduleWarnings(atCenter, site.online.livestreams, now));

  return { events: events.filter((e) => !joined.has(e.id)), options, warnings };
}

/** In-person event id → the online event that belongs to it. */
function onlineTwins(events: readonly WebsiteEvent[]): Map<string, WebsiteEvent> {
  const twins = new Map<string, WebsiteEvent>();
  for (const online of events) {
    if (online.location?.online !== true) continue;
    const scored = events
      .filter(
        (e) =>
          e.location?.online !== true &&
          !twins.has(e.id) &&
          Date.parse(e.start) === Date.parse(online.start),
      )
      .map((e) => ({ event: e, score: sharedWords(e.title, online.title) }))
      .sort((a, b) => b.score - a.score);
    const [best, next] = scored;
    if (best && best.score > 0 && (!next || best.score > next.score))
      twins.set(best.event.id, online);
  }
  return twins;
}

/** In person and not in another city than the center's. */
function isAtCenter(e: WebsiteEvent, homeCity: string): boolean {
  const place = e.location;
  if (place === null || place.online) return false;
  return place.city === null || sameText(place.city, homeCity);
}

function isStreamed(e: WebsiteEvent, l: Livestream): boolean {
  if (!e.categories.includes(l.category)) return false;
  if (l.except?.some((title) => sameText(title, e.title))) return false;
  return l.times === undefined || l.times.some((t) => isAt(e.start, t));
}

function isMarked(e: WebsiteEvent, rule: IconOnly): boolean {
  return e.categories.includes(rule.category) && words(e.title).has(rule.titleWord.toLowerCase());
}

function isAt(start: string, time: { day: string; start: string }): boolean {
  const [hours, minutes] = time.start.split(":").map(Number);
  return (
    easternWeekday(start) === time.day &&
    easternMinutes(start) === (hours ?? 0) * 60 + (minutes ?? 0)
  );
}

/**
 * Within the next `CHECK_DAYS`: an event in a livestreamed category at a time the online
 * schedule doesn't list, and a listed time with no event.
 */
function scheduleWarnings(
  atCenter: readonly WebsiteEvent[],
  livestreams: readonly Livestream[],
  now: Date,
): OnlineNote[] {
  const until = Date.parse(easternMidnight(addDays(easternDate(now), CHECK_DAYS)));
  const soon = atCenter.filter(
    (e) => !endedBeforeToday(e.start, e.end, now) && Date.parse(e.start) < until,
  );
  const warnings: OnlineNote[] = [];
  for (const l of livestreams) {
    const { times } = l;
    if (times === undefined) continue;
    const inCategory = soon.filter((e) => e.categories.includes(l.category));
    const unlisted = new Map<string, WebsiteEvent[]>();
    for (const e of inCategory) {
      if (times.some((t) => isAt(e.start, t))) continue;
      const key = `${e.title}\n${easternWeekday(e.start)} ${String(easternMinutes(e.start))}`;
      unlisted.set(key, [...(unlisted.get(key) ?? []), e]);
    }
    for (const [first, ...more] of unlisted.values())
      if (first)
        warnings.push({
          id: first.id,
          title: first.title,
          message: `${l.category} at a time not in the online schedule in data/site.json, so not livestreamed${more.length > 0 ? ` (${String(more.length + 1)} events)` : ""}`,
        });
    for (const t of times)
      if (!inCategory.some((e) => isAt(e.start, t)))
        warnings.push({
          id: null,
          title: null,
          // The page's table is the weekly timetable, so this is normal while a class is off
          // the calendar; nothing in site.json needs changing for it.
          message: `${l.category} on ${WEEKDAY_NAMES[t.day]} at ${time12(t.start)} is on the online timetable in data/site.json but not on the website's calendar in the next ${String(CHECK_DAYS)} days (paused, or not added in Wix); nothing to change in the app`,
        });
  }
  return warnings;
}

const WEEKDAY_NAMES = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
} as const;

/** `19:15` → `7:15 PM`. */
function time12(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return `${String(h % 12 === 0 ? 12 : h % 12)}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function sameText(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ");
  return norm(a).localeCompare(norm(b), "en", { sensitivity: "base" }) === 0;
}

function words(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w !== "" && w !== "online"),
  );
}

function sharedWords(a: string, b: string): number {
  const other = words(b);
  return [...words(a)].filter((w) => other.has(w)).length;
}
