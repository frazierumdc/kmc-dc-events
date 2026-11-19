import { z } from "zod";
import { addDays, easternDate, easternMinutes, easternWeekday, WEEKDAYS } from "./time.ts";
import type { SnapshotV2Event } from "./website.ts";

/**
 * The study programs' emails (AN-15, AN-16, AN-19, AN-20, AN-21, D49, D51): each program's
 * sessions in the schedule, its class days without a session (and those holding a prayer
 * instead), what changed since its last dates email, and when each email is due after a
 * copy. Pure.
 */

/** `data/site.json` `programs[]`: how a program is found in the schedule (AN-15, D49). */
export const Program = z.strictObject({
  /** `fp`, `ttp`: the email list and the Send email choice (`program-fp`). */
  id: z.enum(["fp", "ttp"]),
  name: z.string().min(1),
  /** What its members call it (`TTP`): the dates email's subject and greeting (AN-16). */
  shortName: z.string().min(1),
  /** The website category its sessions are in. */
  category: z.string().min(1),
  /** Every form of the title the website uses; compared ignoring capitals and spacing. */
  titles: z.array(z.string().min(1)).min(1),
  /** The weekdays it meets (D49). */
  classDays: z.array(z.enum(WEEKDAYS)).min(1),
  /** A class day on one of these days of the month without a session holds this prayer instead (AN-21). */
  prayerDays: z
    .strictObject({
      monthDays: z.array(z.number().int().min(1).max(31)).min(1),
      prayer: z.string().min(1),
    })
    .optional(),
});
export type Program = z.infer<typeof Program>;

const norm = (title: string) => title.trim().replace(/\s+/g, " ").toLowerCase();

/** The program's sessions in the schedule, in start order. */
export function programSessions(
  events: readonly SnapshotV2Event[],
  program: Program,
): SnapshotV2Event[] {
  const titles = new Set(program.titles.map(norm));
  return events
    .filter((e) => e.categories.includes(program.category) && titles.has(norm(e.title)))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

/** The program whose session this is, by category and title (AN-15), or null. */
export function eventProgram<P extends Pick<Program, "category" | "titles">>(
  event: Pick<SnapshotV2Event, "categories" | "title">,
  programs: readonly P[],
): P | null {
  const title = norm(event.title);
  return (
    programs.find(
      (p) => event.categories.includes(p.category) && p.titles.some((t) => norm(t) === title),
    ) ?? null
  );
}

/**
 * A class's own colour in place of the kind's emerald (D45): a study program's session, FP and
 * TTP alike (AN-15), or a class at a branch, in a website category named "… Branch Classes"
 * (owner, 8 November 2026). Null for any other class.
 */
export type ClassTone = "program" | "branch";

export function classTone(
  event: Pick<SnapshotV2Event, "categories" | "title">,
  programs: readonly Pick<Program, "category" | "titles">[],
): ClassTone | null {
  if (eventProgram(event, programs)) return "program";
  if (event.categories.some((c) => /\bbranch classes\b/i.test(c))) return "branch";
  return null;
}

/**
 * An event's own colour in place of its kind's (D45): a class's (classTone), or slate for
 * another center's special event (D67, owner, 15 November 2026). Null for any other event.
 */
export type EventTone = ClassTone | "elsewhere";

export function eventTone(
  event: Pick<SnapshotV2Event, "categories" | "title" | "otherCenter">,
  kind: string | null,
  programs: readonly Pick<Program, "category" | "titles">[],
): EventTone | null {
  if (kind === "class") return classTone(event, programs);
  if (kind === "special" && event.otherCenter) return "elsewhere";
  return null;
}

/** Class days in a row without a session: one day, or a break. Eastern dates. */
export interface NoClass {
  from: string;
  to: string;
  days: string[];
  /** The prayer held instead on this one day (AN-21); it splits a break. */
  prayer?: string;
}

/**
 * The class days between the first and last session that have no session, grouped; a
 * prayer day (AN-21) stands on its own. The schedule drops a session once it has ended, so
 * `heldBefore`, the date of a session already gone (remembered from the last dates email),
 * starts the count there: the class days before the schedule's first session count too.
 */
export function classDaysWithout(
  sessions: readonly SnapshotV2Event[],
  program: Program,
  heldBefore?: string | null,
): NoClass[] {
  const first = sessions[0];
  const last = sessions.at(-1);
  if (!first || !last) return [];
  const held = new Set(sessions.map((s) => easternDate(s.start)));
  const start =
    heldBefore && heldBefore < easternDate(first.start) ? heldBefore : easternDate(first.start);
  held.add(start);
  const gaps: NoClass[] = [];
  let open: NoClass | null = null;
  for (let date = start; date <= easternDate(last.start); date = addDays(date, 1)) {
    if (!program.classDays.includes(weekdayOf(date))) continue;
    if (held.has(date)) {
      open = null;
      continue;
    }
    const prayer = prayerOn(program, date);
    if (prayer) {
      open = null;
      gaps.push({ from: date, to: date, days: [date], prayer });
      continue;
    }
    if (open) {
      open.to = date;
      open.days.push(date);
    } else {
      open = { from: date, to: date, days: [date] };
      gaps.push(open);
    }
  }
  return gaps;
}

function prayerOn(program: Program, date: string): string | undefined {
  const days = program.prayerDays;
  return days?.monthDays.includes(Number(date.slice(8, 10))) ? days.prayer : undefined;
}

/** The prayer's event on a prayer day (AN-21), when the schedule lists it. */
export function prayerEvent(
  events: readonly SnapshotV2Event[],
  gap: NoClass,
): SnapshotV2Event | null {
  const prayer = gap.prayer;
  if (!prayer) return null;
  return (
    events.find(
      (e) => easternDate(e.start) === gap.from && norm(e.title).startsWith(norm(prayer)),
    ) ?? null
  );
}

/** The first session after a gap: when classes start again. */
export function sessionAfter(
  sessions: readonly SnapshotV2Event[],
  gap: NoClass,
): SnapshotV2Event | null {
  return sessions.find((s) => easternDate(s.start) > gap.to) ?? null;
}

/** A session as the last dates email listed it (`mail-state`). */
export const SessionRecord = z.object({
  id: z.string(),
  start: z.string(),
  end: z.string().nullable(),
});
export type SessionRecord = z.infer<typeof SessionRecord>;

export const sessionRecord = (e: SnapshotV2Event): SessionRecord => ({
  id: e.id,
  start: e.start,
  end: e.end,
});

export type SessionChange =
  | { kind: "moved"; before: SessionRecord; after: SnapshotV2Event }
  | { kind: "added"; after: SnapshotV2Event }
  | { kind: "removed"; before: SessionRecord };

/**
 * The net change since the last dates email (AN-19): a session added, removed (not one
 * that has simply passed) or whose date or time changed; a session moved and moved back is
 * no change. Nothing before the first email.
 */
export function sessionChanges(
  last: readonly SessionRecord[] | null,
  current: readonly SnapshotV2Event[],
  now: Date,
): SessionChange[] {
  if (last === null) return [];
  const today = easternDate(now);
  const before = new Map(last.map((s) => [s.id, s]));
  const ids = new Set(current.map((s) => s.id));
  const changes: SessionChange[] = [];
  for (const after of current) {
    const was = before.get(after.id);
    if (!was) changes.push({ kind: "added", after });
    else if (Date.parse(was.start) !== Date.parse(after.start) || !sameEnd(was.end, after.end))
      changes.push({ kind: "moved", before: was, after });
  }
  for (const was of last)
    if (!ids.has(was.id) && easternDate(was.start) >= today)
      changes.push({ kind: "removed", before: was });
  const at = (c: SessionChange) =>
    Date.parse(c.kind === "removed" ? c.before.start : c.after.start);
  return changes.sort((a, b) => at(a) - at(b));
}

const sameEnd = (a: string | null, b: string | null) =>
  a === null || b === null ? a === b : Date.parse(a) === Date.parse(b);

/** From this time Eastern, a copy sends what is due that day (D51): 4 AM. */
export const SEND_FROM_MINUTES = 4 * 60;

/** Program dates go out on Mondays with the first good copy from 4 AM, once (D51). */
export function programDatesDue(now: Date, lastSent: string | null): boolean {
  return (
    easternWeekday(now) === "mon" &&
    easternMinutes(now) >= SEND_FROM_MINUTES &&
    (lastSent === null || easternDate(lastSent) !== easternDate(now))
  );
}

/**
 * The Schedule changes email is due (AN-1, D62): with the first good copy from 4 AM Eastern
 * each day, so the 4:07 AM copy sends it and later copies that day don't.
 */
export function scheduleChangesDue(now: Date, lastSent: string | null): boolean {
  return (
    easternMinutes(now) >= SEND_FROM_MINUTES &&
    (lastSent === null || easternDate(lastSent) !== easternDate(now))
  );
}

/** The No class reminders due now: 2 days before the first day, from 4 AM, once (D51). */
export function remindersDue(
  gaps: readonly NoClass[],
  reminded: readonly string[],
  now: Date,
): NoClass[] {
  if (easternMinutes(now) < SEND_FROM_MINUTES) return [];
  const today = easternDate(now);
  return gaps.filter((g) => addDays(g.from, -2) === today && !reminded.includes(g.from));
}

/** The next No class reminder, for Send email: the first gap still ahead. */
export function nextNoClass(gaps: readonly NoClass[], now: Date): NoClass | null {
  const today = easternDate(now);
  return gaps.find((g) => g.from >= today) ?? null;
}

function weekdayOf(date: string): (typeof WEEKDAYS)[number] {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? "sun";
}
