// The Schedule changes email (AN-1, AN-2), as in the approved mock-up
// (docs/design/mockups/emails/email-changes-phone.png): one numbered sentence per change,
// naming only what changed ("now starts at 6:30 PM (was 6:00 PM)"), date or time changes
// first, then new, cancelled, removed and other changes; the place, "this week" and a link
// under each. Everything it says comes from two reads of the website's own events
// (websiteReadChanges); the app's schedule has no part in it.

import {
  dateWithYear,
  easternDate,
  eventWhen,
  formatShortDate,
  formatTime12,
  type ReadEvent,
  type ReadField,
  type WebsiteReadChanges,
} from "@kmcdc/domain";
import {
  ACCENT,
  count,
  esc,
  groupHeading,
  item,
  link,
  longWhen,
  muted,
  numberedList,
  p,
  page,
  textPage,
  timeSpan,
  titleCase,
  type Email,
} from "./layout.ts";

export interface ScheduleChangesInput {
  changes: WebsiteReadChanges;
  /** The run's page, which lists every change. */
  runUrl: string;
}

/** Changes listed in full; the rest are counted, with a link to the run (email.md). */
export const MAX_LISTED = 30;
/** Above this many, the email gives counts by kind and month only. */
export const MAX_DETAILED = 100;
const WEEK = 7 * 24 * 60 * 60 * 1000;

/** Text with its HTML: new values are bold in HTML. */
interface Rich {
  html: string;
  text: string;
}
const plain = (t: string): Rich => ({ html: esc(t), text: t });
const bold = (t: string): Rich => ({ html: `<b>${esc(t)}</b>`, text: t });
const rich = (...parts: (Rich | string)[]): Rich => {
  const all = parts.map((x) => (typeof x === "string" ? plain(x) : x));
  return { html: all.map((x) => x.html).join(""), text: all.map((x) => x.text).join("") };
};

/** One change as the email lists it. */
interface Listed {
  event: ReadEvent;
  /** The sentence: what changed, and only that. */
  sentence: Rich;
  tag?: "New" | "Cancelled" | "Removed";
  /** Cancelled and removed events have no page to open. */
  linked: boolean;
}

interface Group {
  heading: string;
  key: boolean;
  items: Listed[];
}

export function scheduleChangesEmail(input: ScheduleChangesInput): Email {
  const { changes, runUrl } = input;
  const copiedAt = changes.readAt;
  const byStart = (a: Listed, b: Listed) => Date.parse(a.event.start) - Date.parse(b.event.start);
  const groups: Group[] = [
    {
      heading: "Date or time changed",
      key: true,
      items: changes.moved
        .map(({ before, after, fields }) => ({
          event: after,
          sentence: movedSentence(before, after, fields),
          linked: true,
        }))
        .sort(byStart),
    },
    {
      heading: "New",
      key: false,
      items: changes.added
        .map((event) => ({
          event,
          sentence: rich(bold(event.title), `, ${whenText(event)}.`),
          tag: "New" as const,
          linked: true,
        }))
        .sort(byStart),
    },
    {
      heading: "Cancelled",
      key: false,
      items: changes.cancelled
        .map((event) => ({
          event,
          sentence: rich(bold(event.title), `, ${whenText(event)}.`),
          tag: "Cancelled" as const,
          linked: false,
        }))
        .sort(byStart),
    },
    {
      heading: "Removed",
      key: false,
      items: changes.removed
        .map((event) => ({
          event,
          sentence: rich(bold(event.title), `, ${whenText(event)}.`),
          tag: "Removed" as const,
          linked: false,
        }))
        .sort(byStart),
    },
    {
      heading: "Other changes",
      key: false,
      items: changes.edited
        .map(({ before, after, fields }) => ({
          event: after,
          sentence: rich(
            bold(after.title),
            `, ${dateWithYear(easternDate(after.start))}: `,
            joinRich(fieldPhrases(before, fields)),
            ".",
          ),
          linked: true,
        }))
        .sort(byStart),
    },
  ].filter((g) => g.items.length > 0);

  const n = (g: string) => groups.find((x) => x.heading === g)?.items.length ?? 0;
  const parts = [
    n("Date or time changed") > 0
      ? count(n("Date or time changed"), "date or time", "date or time")
      : null,
    n("New") > 0 ? `${String(n("New"))} new` : null,
    n("Cancelled") > 0 ? `${String(n("Cancelled"))} cancelled` : null,
    n("Removed") > 0 ? `${String(n("Removed"))} removed` : null,
    n("Other changes") > 0 ? `${String(n("Other changes"))} other` : null,
  ].filter((x): x is string => x !== null);
  const subject = titleCase(`Schedule changes: ${parts.join(", ")}`);
  const allItems = groups.reduce((sum, g) => sum + g.items.length, 0);
  const heading = `${count(allItems, "change")} in the website`;
  const lead = `Copied on ${longWhen(copiedAt)}.`;
  const note =
    "Something wrong? Change it in Wix; the next update copies it to the app and sends another email.";
  const footer = ["You get this because you're on the KMC DC management staff list."];
  const soonUntil = Date.parse(copiedAt) + WEEK;
  const isSoon = (e: ReadEvent) => Date.parse(e.start) < soonUntil;

  const html: string[] = [p(esc(lead))];
  const text: string[] = [lead];

  if (allItems > MAX_DETAILED) {
    for (const g of groups) {
      html.push(groupHeading(g.heading, g.items.length, g.key));
      const lines = byMonth(g.items);
      html.push(item(lines.map(esc).join("<br>")));
      text.push(`${g.heading.toUpperCase()} (${String(g.items.length)})\n${lines.join("\n")}`);
    }
    html.push(p(esc(`Every change is listed in the run's summary: ${runUrl}`)));
    text.push(`Every change is listed in the run's summary: ${runUrl}`);
  } else {
    const shown = groups.flatMap((g) => g.items).slice(0, MAX_LISTED);
    html.push(numberedList(shown.map((it) => itemHtml(it, isSoon(it.event)))));
    text.push(...shown.map((it, i) => itemText(it, i + 1, isSoon(it.event))));
    const more = allItems - MAX_LISTED;
    if (more > 0) {
      const line = `And ${count(more, "more change")}, listed in the run's summary:`;
      html.push(p(`${esc(line)} ${link(runUrl, "Update schedule run")}`, "margin-top:14px"));
      text.push(`${line} ${runUrl}`);
    }
  }
  html.push(p(muted(esc(note)), "font-size:12px;margin-top:16px"));
  text.push(note);

  return {
    subject,
    text: textPage(heading, text, footer),
    html: page(heading, html.join("\n"), footer),
  };
}

const TAG_COLOURS = {
  New: { text: "#2e7d32", soft: "#e6f4ea" },
  Cancelled: { text: "#b3261e", soft: "#fbe9e7" },
  Removed: { text: "#b3261e", soft: "#fbe9e7" },
} as const;

function itemHtml(it: Listed, soonNow: boolean): string {
  const tag = it.tag
    ? `<span style="display:inline-block;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;border-radius:999px;padding:1px 8px;margin-right:4px;background:${TAG_COLOURS[it.tag].soft};color:${TAG_COLOURS[it.tag].text}">${it.tag}</span>`
    : "";
  const meta = metaOf(it.event, soonNow);
  const page = it.linked ? it.event.page : null;
  return [
    tag,
    it.sentence.html,
    meta ? `<div style="margin-top:6px">${muted(esc(meta))}</div>` : "",
    page
      ? `<div style="margin-top:4px"><a href="${esc(page)}" style="color:${ACCENT};font-weight:600;text-decoration:underline;display:inline-block;padding:4px 0">See it</a></div>`
      : "",
  ].join("");
}

function itemText(it: Listed, n: number, soonNow: boolean): string {
  const meta = metaOf(it.event, soonNow);
  return [
    `${String(n)}. ${it.tag ? `${it.tag}: ` : ""}${it.sentence.text}`,
    meta ? `   ${meta}` : "",
    it.linked && it.event.page ? `   ${it.event.page}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** `KMC DC · this week`: the place as the website names it. */
function metaOf(e: ReadEvent, soonNow: boolean): string {
  return [e.place ?? "", soonNow ? "this week" : ""].filter(Boolean).join(" · ");
}

/** `Sun, Nov 29, 2026, 10:00 – 11:15 AM`, or the dates of an event over several days. */
const whenText = (e: ReadEvent) => eventWhen(e).replace(" · ", ", ");

/**
 * A date or time change, naming only what changed: `now starts at 6:30 PM (was 6:00 PM)`,
 * `now ends at …`, or `moved to Fri, Nov 13, 2026 (was Fri, Nov 6), 7:00 – 8:15 PM`; then
 * anything else that changed.
 */
function movedSentence(before: ReadEvent, after: ReadEvent, fields: ReadField[]): Rich {
  const dayBefore = easternDate(before.start);
  const dayAfter = easternDate(after.start);
  const other = fieldPhrases(before, fields);
  const also = other.length > 0 ? rich("; ", joinRich(other)) : plain("");
  const span = (e: ReadEvent) => timeSpan(e);
  if (dayBefore !== dayAfter) {
    const was =
      dayBefore.slice(0, 4) === dayAfter.slice(0, 4)
        ? formatShortDate(dayBefore)
        : dateWithYear(dayBefore);
    const sameTime = span(before) === span(after);
    return rich(
      bold(after.title),
      " moved to ",
      bold(sameTime ? dateWithYear(dayAfter) : `${dateWithYear(dayAfter)}, ${span(after)}`),
      sameTime ? ` (was ${was}), ${span(after)}` : ` (was ${was}, ${span(before)})`,
      also,
      ".",
    );
  }
  const date = `, ${dateWithYear(dayAfter)}, `;
  if (before.allDay !== after.allDay || before.start !== after.start) {
    const startText = (e: ReadEvent) => (e.allDay ? "all day" : formatTime12(e.start));
    if (after.allDay || before.allDay)
      return rich(
        bold(after.title),
        date,
        "now ",
        bold(startText(after)),
        ` (was ${startText(before)})`,
        also,
        ".",
      );
    return rich(
      bold(after.title),
      date,
      "now starts at ",
      bold(formatTime12(after.start)),
      ` (was ${formatTime12(before.start)})`,
      also,
      ".",
    );
  }
  const endText = (e: ReadEvent) => (e.end ? formatTime12(e.end) : "no end time");
  return rich(
    bold(after.title),
    date,
    "now ends at ",
    bold(endText(after)),
    ` (was ${endText(before)})`,
    also,
    ".",
  );
}

/** What else changed, as phrases: `renamed (was "…")` (AN-2). */
function fieldPhrases(before: ReadEvent, fields: ReadField[]): Rich[] {
  const out: Rich[] = [];
  if (fields.includes("title")) out.push(rich("renamed (was ", `"${before.title}"`, ")"));
  return out;
}

/** `a`, `a and b`, `a, b and c`. */
function joinRich(parts: Rich[]): Rich {
  if (parts.length <= 2) return rich(...parts.flatMap((x, i) => (i === 0 ? [x] : [" and ", x])));
  return rich(
    ...parts.flatMap((x, i) => (i === 0 ? [x] : [i === parts.length - 1 ? " and " : ", ", x])),
  );
}

/** `40 in Nov 2026, 30 in Dec 2026`, for a very large change. */
function byMonth(items: Listed[]): string[] {
  const months = new Map<string, number>();
  for (const { event } of items) {
    const month = dateWithYear(easternDate(event.start)).replace(
      /^\w+, (\w+) \d+, (\d+)$/,
      "$1 $2",
    );
    months.set(month, (months.get(month) ?? 0) + 1);
  }
  return [[...months].map(([m, k]) => `${String(k)} in ${m}`).join(", ")];
}
