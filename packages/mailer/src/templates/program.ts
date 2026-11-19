// The program emails (AN-16, AN-19, AN-20), as in the approved mock-ups
// (docs/design/mockups/emails/email-program-phone.png, email-reminder-phone.png,
// email-reminder-break-phone.png): a program's dates, with what changed since the last
// email and its class days without a session; and the No class reminder. A class day that
// holds a prayer instead (AN-21) shows the prayer, linked to its page when the schedule lists it.

import {
  dateWithYear,
  easternDate,
  formatLongDate,
  formatLongWeekday,
  type NoClass,
  type PlaceSite,
  type Program,
  type SessionChange,
  type SnapshotV2Event,
} from "@kmcdc/domain";
import {
  ACCENT,
  esc,
  monthDayYear,
  monthHeading,
  monthName,
  muted,
  p,
  page,
  RULE,
  textPage,
  titleCase,
  timeSpan,
  where,
  type Email,
} from "./layout.ts";

const GOLD = "#8a5d0c";
const GOLD_SOFT = "#fbf0da";
const TEAL_SOFT = "#e3f3f4";
const TEAL_TEXT = "#08707a";

export interface ProgramDatesInput {
  program: Program;
  /** The program's sessions still ahead. */
  sessions: SnapshotV2Event[];
  /** Its class days without a session, still ahead. */
  noClass: NoClass[];
  changes: SessionChange[];
  site: PlaceSite;
  /** The prayer's event on each prayer day the schedule lists it, by date (AN-21). */
  prayers?: ReadonlyMap<string, SnapshotV2Event>;
}

export function programDatesEmail(input: ProgramDatesInput): Email {
  const { program, sessions, noClass, changes, site, prayers } = input;
  const name = program.shortName;
  const first = sessions[0];
  const last = sessions.at(-1);
  // "TTP Dates: Oct 20, 2026 – Feb 28, 2027": the next class to the last (AN-16).
  const subject =
    first && last
      ? `${name} Dates: ${monthDayYear(easternDate(first.start))} – ${monthDayYear(easternDate(last.start))}`
      : `${name} Dates`;
  // A greeting, not a heading; a linked prayer day says where its date leads (AN-21).
  const greeting = `Dear ${name} Sangha,`;
  const intro = introLines(input);
  const html = [
    p(esc(greeting), "font-size:15px"),
    p(intro.map(esc).join("<br>"), "font-size:15px"),
  ];
  const text = [greeting, intro.join("\n")];

  if (changes.length > 0) {
    const lines = changes.map(changeLine);
    html.push(
      `<div style="background:${GOLD_SOFT};border-radius:10px;padding:12px 14px;margin:0 0 14px"><b style="display:block;margin-bottom:2px">Changed since the last email</b>${lines.map(esc).join("<br>")}</div>`,
    );
    text.push(`CHANGED SINCE THE LAST EMAIL\n${lines.map((l) => `  ${l}`).join("\n")}`);
  }

  const marks = sessionMarks(changes);
  const rows: Row[] = [
    ...sessions.map((s) => ({ date: easternDate(s.start), session: s })),
    ...noClass.map((g) => ({ date: g.from, gap: g })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  let month = "";
  let block: string[] = [];
  for (const row of rows) {
    const name = monthName(row.date);
    if (name !== month) {
      if (block.length > 0) text.push(block.join("\n"));
      month = name;
      html.push(monthHeading(name));
      block = [name.toUpperCase()];
    }
    const line = rowLine(row, marks, site, prayers);
    if (line) {
      html.push(line.html);
      block.push(line.text);
    }
  }
  if (block.length > 0) text.push(block.join("\n"));

  return {
    subject,
    text: textPage(null, text),
    html: page(null, html.join("\n")),
  };
}

/** A day of the list: a session, or a class day without one. */
interface Row {
  date: string;
  session?: SnapshotV2Event;
  gap?: NoClass;
}
/** A row in both forms of the email. */
interface Line {
  html: string;
  text: string;
}
type Mark = "New" | "Changed";

/** What the email opens with: the schedule follows, or there is none; and what prayer dates link to. */
function introLines({ program, sessions, prayers }: ProgramDatesInput): string[] {
  const name = program.shortName;
  const any = sessions.length > 0;
  const intro = any
    ? [`Below is the ${name} schedule.`]
    : [`No ${name} classes are on the schedule now.`];
  const prayer = program.prayerDays?.prayer;
  if (any && prayer && prayers && prayers.size > 0)
    intro.push(`${prayer} dates link to the chanted prayers.`);
  return intro;
}

/** The sessions to mark in the list, by id: new, or changed since the last email. */
function sessionMarks(changes: readonly SessionChange[]): Map<string, Mark> {
  return new Map(
    changes.flatMap((c) =>
      c.kind === "removed" ? [] : [[c.after.id, c.kind === "added" ? "New" : "Changed"] as const],
    ),
  );
}

function rowLine(
  row: Row,
  marks: ReadonlyMap<string, Mark>,
  site: PlaceSite,
  prayers: ProgramDatesInput["prayers"],
): Line | null {
  if (row.session) return sessionLine(row.date, row.session, marks.get(row.session.id), site);
  if (row.gap?.prayer) return prayerLine(row.gap, row.gap.prayer, prayers?.get(row.gap.from), site);
  if (row.gap) return noClassLine(row.gap);
  return null;
}

function sessionLine(
  date: string,
  s: SnapshotV2Event,
  mark: Mark | undefined,
  site: PlaceSite,
): Line {
  const detail = [timeSpan(s), where(s, site)].filter(Boolean).join(" · ");
  const tag = mark
    ? `<td align="right" style="font-size:11px;font-weight:700;color:${GOLD};white-space:nowrap;padding-right:8px">${mark === "New" ? "New" : "Time changed"}</td>`
    : "";
  return {
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;${mark ? `background:${GOLD_SOFT};` : `border-bottom:1px solid ${RULE};`}"><tr><td style="padding:10px ${mark ? "8px" : "0"}"><a href="${esc(s.page)}" style="color:${ACCENT};font-weight:600;text-decoration:underline">${esc(dateWithYear(date))}</a><div style="font-size:13px">${muted(esc(detail))}</div></td>${tag}</tr></table>`,
    text: `  ${dateWithYear(date)} · ${detail}${mark ? ` (${mark === "New" ? "new" : "time changed"})` : ""}\n    ${s.page}`,
  };
}

/** A class day holding a prayer instead (AN-21), linked when the schedule lists the prayer. */
function prayerLine(
  g: NoClass,
  prayer: string,
  event: SnapshotV2Event | undefined,
  site: PlaceSite,
): Line {
  const detail = event ? [timeSpan(event), where(event, site)].filter(Boolean).join(" · ") : "";
  const name = event
    ? `<a href="${esc(event.page)}" style="color:${ACCENT};text-decoration:underline">${esc(prayer)}</a>`
    : esc(prayer);
  return {
    html: `<div style="padding:10px 0;border-bottom:1px solid ${RULE}"><div style="font-weight:600;color:#6c6c70">${esc(dateWithYear(g.from))}</div><div style="font-size:13px;font-weight:600">${name}</div>${detail ? `<div style="font-size:13px">${muted(esc(detail))}</div>` : ""}</div>`,
    text: `  ${dateWithYear(g.from)} · ${[prayer, detail].filter(Boolean).join(" · ")}${event ? `\n    ${event.page}` : ""}`,
  };
}

function noClassLine(g: NoClass): Line {
  const one = g.days.length === 1;
  const when = one ? dateWithYear(g.from) : `${dateWithYear(g.from)} – ${dateWithYear(g.to)}`;
  const what = one ? "No class" : `No classes (${daysCount(g)})`;
  return {
    html: `<div style="padding:10px 0;border-bottom:1px solid ${RULE}"><div style="font-weight:600;color:#6c6c70">${esc(when)}</div><div style="font-size:13px;font-weight:600">${esc(what)}</div></div>`,
    text: `  ${when} · ${what}`,
  };
}

export interface NoClassInput {
  program: Program;
  gap: NoClass;
  /** When classes start again; null when no later session is on the schedule. */
  next: SnapshotV2Event | null;
  site: PlaceSite;
  /** On a prayer day (AN-21), the prayer's event when the schedule lists it. */
  prayer?: SnapshotV2Event | null;
}

export function noClassEmail(input: NoClassInput): Email {
  const { program, gap, next, site } = input;
  if (gap.prayer) return prayerDayEmail(input, gap.prayer);
  const one = gap.days.length === 1;
  const subject = titleCase(
    one
      ? `${program.name}: no class on ${formatLongWeekday(gap.from)}, ${monthDayYear(gap.from)}`
      : `${program.name}: no classes ${monthDayYear(gap.from)} – ${monthDayYear(gap.to)}`,
  );
  const weeks = Math.round((Date.parse(gap.to) - Date.parse(gap.from)) / (7 * 86_400_000)) + 1;
  const heading = one
    ? `No class on ${formatLongWeekday(gap.from)}`
    : weeks > 1
      ? `No classes for ${String(weeks)} weeks`
      : `No classes on ${gap.days.map(formatLongWeekday).join(" and ")}`;
  const statement = one
    ? `There's no ${program.name} class on ${formatLongDate(gap.from)}.`
    : `No ${program.name} classes from ${formatLongDate(gap.from)} to ${formatLongDate(gap.to)}.`;
  const label = one ? "Next class" : "Classes start again";

  const html = [p(esc(statement), "font-size:17px;font-weight:600")];
  const text = [statement];
  nextClass(html, text, label, next, site);
  return {
    subject,
    text: textPage(heading, text),
    html: page(heading, html.join("\n")),
  };
}

/** The reminder for a class day holding a prayer instead (AN-21): no class, the prayer, the next class. */
function prayerDayEmail(input: NoClassInput, prayer: string): Email {
  const { program, gap, next, site } = input;
  const weekday = formatLongWeekday(gap.from);
  const subject = titleCase(
    `${program.name}: ${prayer} instead of class on ${weekday}, ${monthDayYear(gap.from)}`,
  );
  const heading = `${prayer} on ${weekday}`;
  const statement = `There's no ${program.name} class on ${formatLongDate(gap.from)}; we're doing ${prayer} instead.`;
  const html = [p(esc(statement), "font-size:17px;font-weight:600")];
  const text = [statement];
  const event = input.prayer;
  if (event) {
    const detail = [timeSpan(event), where(event, site)].filter(Boolean).join(" · ");
    html.push(
      `<div style="background:${GOLD_SOFT};border-radius:10px;padding:12px 14px;margin:0 0 14px"><b style="display:block;font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:${GOLD};margin-bottom:2px">Instead</b><a href="${esc(event.page)}" style="color:${ACCENT};font-weight:700;text-decoration:underline">${esc(event.title)}</a><br>${esc(detail)}</div>`,
    );
    text.push(`Instead: ${event.title} · ${detail}\n  ${event.page}`);
  }
  nextClass(html, text, "Next class", next, site);
  return {
    subject,
    text: textPage(heading, text),
    html: page(heading, html.join("\n")),
  };
}

function nextClass(
  html: string[],
  text: string[],
  label: string,
  next: SnapshotV2Event | null,
  site: PlaceSite,
): void {
  if (next) {
    const date = formatLongDate(easternDate(next.start));
    const detail = [timeSpan(next), where(next, site)].filter(Boolean).join(" · ");
    html.push(
      `<div style="background:${TEAL_SOFT};border-radius:10px;padding:12px 14px;margin:0 0 14px"><b style="display:block;font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:${TEAL_TEXT};margin-bottom:2px">${esc(label)}</b><a href="${esc(next.page)}" style="color:${ACCENT};font-weight:700;text-decoration:underline">${esc(date)}</a><br>${esc(detail)}</div>`,
    );
    text.push(`${label}: ${date} · ${detail}\n  ${next.page}`);
  } else {
    const none = "No later session is on the schedule yet.";
    html.push(p(esc(none)));
    text.push(none);
  }
}

/** `Sunday, November 22, 2026: now 1:00 – 3:00 PM (was 12:00 – 2:00 PM)`. */
function changeLine(c: SessionChange): string {
  if (c.kind === "added")
    return `${formatLongDate(easternDate(c.after.start))}: a new session, ${timeSpan(c.after)}.`;
  const beforeDate = easternDate(c.before.start);
  const was = timeSpan({ ...c.before, allDay: false });
  if (c.kind === "removed") return `${formatLongDate(beforeDate)}: no longer on the schedule.`;
  const afterDate = easternDate(c.after.start);
  return afterDate === beforeDate
    ? `${formatLongDate(afterDate)}: now ${timeSpan(c.after)} (was ${was}).`
    : `${formatLongDate(beforeDate)}: moved to ${formatLongDate(afterDate)}, ${timeSpan(c.after)} (was ${was}).`;
}

/** `4 Sundays`, or `5 class days` when they fall on different weekdays. */
function daysCount(g: NoClass): string {
  const weekdays = new Set(g.days.map(formatLongWeekday));
  const [only] = weekdays;
  return weekdays.size === 1 && only
    ? `${String(g.days.length)} ${only}s`
    : `${String(g.days.length)} class days`;
}
