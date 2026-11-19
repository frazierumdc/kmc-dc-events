// The Duplicate events email (AN-13, D51), as in the approved mock-up
// (docs/design/mockups/emails/email-duplicates-phone.png): one numbered item per event the
// website lists more than once and per set of events at the same time and place, each with
// only what the update found (title, dates, time, place, a link to every listing) and a
// possible fix that is the same for every item of its kind. It never says why; staff decide.

import {
  dateWithYear,
  easternDate,
  eventPlace,
  formatLongWeekday,
  formatTime12,
  type Duplicates,
  type PlaceSite,
  type SameTimeAndPlace,
  type SnapshotV2Event,
} from "@kmcdc/domain";
import {
  ACCENT,
  count,
  esc,
  isOnline,
  longWhen,
  monthDayYear,
  muted,
  numberedList,
  p,
  page,
  textPage,
  titleCase,
  type Email,
} from "./layout.ts";

export interface DuplicatesInput {
  duplicates: Duplicates;
  site: PlaceSite;
  /** When the update copied the website. */
  copiedAt: string;
}

export const LISTED_FIX = "keep one listing and remove the other, unless people registered for it.";
export const OVERLAP_FIX = "if one replaces the other, cancel the one that isn't happening.";
const NOTE =
  "The app shows what the website shows; changes made in Wix reach it at the next update.";

/** More than this many dates are said as a range. */
const DATES_BY_NAME = 3;

const ORDINALS = ["First", "Second", "Third", "Fourth", "Fifth"];
const ordinal = (i: number) => ORDINALS[i] ?? `Listing ${String(i + 1)}`;

interface Item {
  /** The sentence, with the titles in bold in HTML. */
  html: string;
  text: string;
  fix: string;
  /** A label and its listings, in order. */
  links: { label: string; events: SnapshotV2Event[] }[];
}

export function duplicatesEmail(input: DuplicatesInput): Email {
  const { duplicates, clashes } = input.duplicates;
  const site = input.site;
  const groups = byEvent(duplicates, site);
  const items = [
    ...groups.map((g) => listedItem(g, site)),
    ...clashes.map((c) => overlapItem(c, site)),
  ];

  const listed =
    groups.length > 0 ? `${String(groups.length)} listed ${timesWord(groups.flat())}` : null;
  const overlaps = clashes.length > 0 ? count(clashes.length, "overlap") : null;
  const subject = titleCase(`Duplicate events: ${[listed, overlaps].filter(Boolean).join(", ")}`);
  const heading = `${count(items.length, "thing")} to check in Wix`;
  const lead = `Found by the update on ${longWhen(input.copiedAt)}.`;
  const footer = ["You get this because you're on the KMC DC management staff list."];

  const html = [
    p(esc(lead)),
    numberedList(items.map(itemHtml)),
    p(muted(esc(NOTE)), "font-size:12px;margin-top:16px"),
  ];
  const text = [
    lead,
    ...items.map((it, i) =>
      [
        `${String(i + 1)}. ${it.text}`,
        `   Possible fix: ${it.fix}`,
        ...it.links.map(
          (l) =>
            `   ${l.label}\n${l.events.map((e, j) => `     ${ordinal(j)}: ${e.page}`).join("\n")}`,
        ),
      ].join("\n"),
    ),
    NOTE,
  ];
  return {
    subject,
    text: textPage(heading, text, footer),
    html: page(heading, html.join("\n"), footer),
  };
}

function itemHtml(it: Item): string {
  const links = it.links
    .map(
      (l) =>
        `<div style="margin-top:6px">${muted(`<span style="display:inline-block;min-width:56px;font-size:13px;margin-right:10px">${esc(l.label)}</span>`)}${l.events
          .map(
            (e, j) =>
              `<a href="${esc(e.page)}" style="color:${ACCENT};font-weight:600;text-decoration:underline;display:inline-block;padding:4px 0;margin-right:14px">${ordinal(j)}</a>`,
          )
          .join("")}</div>`,
    )
    .join("");
  return `${it.html}<div style="margin-top:6px"><b>Possible fix:</b> ${muted(esc(it.fix))}</div>${links}`;
}

/** One event listed more than once: its dates, its time and place, a link to every listing. */
function listedItem(same: SameTimeAndPlace[], site: PlaceSite): Item {
  const first = same[0]?.events[0];
  if (!first) throw new Error("A duplicate with no events");
  const dates = same.map((d) => easternDate(d.start));
  const at = `${timeOf(first)}${placeOf(first, site)}`;
  const rest = `is listed ${timesWord(same)} ${datesPhrase(dates)}, ${at}.`;
  return {
    html: `<b>${esc(first.title)}</b> ${esc(rest)}`,
    text: `${first.title} ${rest}`,
    fix: LISTED_FIX,
    // Every date's listings, however many dates.
    links: same.map((d) => ({
      label: `${shortDate(easternDate(d.start))}:`,
      events: d.events,
    })),
  };
}

/** Different events at the same time and place. */
function overlapItem(c: SameTimeAndPlace, site: PlaceSite): Item {
  const first = c.events[0];
  if (!first) throw new Error("A clash with no events");
  const titles = c.events.map((e) => e.title);
  const date = easternDate(c.start);
  const both = c.events.length === 2 ? "both" : "all";
  const rest = `are ${both} at ${timeOf(first)} on ${dateWithYear(date)}${placeOf(first, site, ", at")}.`;
  return {
    html: `${joinAnd(titles.map((t) => `<b>${esc(t)}</b>`))} ${esc(rest)}`,
    text: `${joinAnd(titles)} ${rest}`,
    fix: OVERLAP_FIX,
    links: [{ label: `${shortDate(date)} events:`, events: c.events }],
  };
}

/** `twice`, `3 times`, or `more than once` when the dates differ. */
function timesWord(same: SameTimeAndPlace[]): string {
  const counts = new Set(same.map((d) => d.events.length));
  if (counts.size > 1) return "more than once";
  const n = [...counts][0] ?? 2;
  return n === 2 ? "twice" : `${String(n)} times`;
}

/** `on Nov 22, 2026`, `on Nov 22 and Dec 6, 2026`, `on 8 Wednesdays (Dec 2, 2026 – Feb 3, 2027)`. */
export function datesPhrase(dates: string[]): string {
  const [first = "", ...others] = dates;
  const last = others.at(-1) ?? first;
  if (dates.length <= DATES_BY_NAME) {
    const sameYear = dates.every((d) => d.slice(0, 4) === first.slice(0, 4));
    const named = dates.map((d, i) =>
      sameYear && i < dates.length - 1 ? shortDate(d) : monthDayYear(d),
    );
    return `on ${joinAnd(named)}`;
  }
  const days = new Set(dates.map(formatLongWeekday));
  const what = days.size === 1 ? `${[...days][0] ?? ""}s` : "dates";
  return `on ${String(dates.length)} ${what} (${monthDayYear(first)} – ${monthDayYear(last)})`;
}

/** The same event's duplicates together (same title, time and place), by first date. */
function byEvent(duplicates: SameTimeAndPlace[], site: PlaceSite): SameTimeAndPlace[][] {
  const groups = new Map<string, SameTimeAndPlace[]>();
  for (const d of duplicates) {
    const e = d.events[0];
    if (!e) continue;
    const key = JSON.stringify([
      e.title.trim().replace(/\s+/g, " ").toLowerCase(),
      timeOf(e),
      placeOf(e, site),
    ]);
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  return [...groups.values()];
}

const timeOf = (e: SnapshotV2Event) => (e.allDay ? "all day" : formatTime12(e.start));

/** ` at KMC DC`, ` online`, or nothing. */
function placeOf(e: SnapshotV2Event, site: PlaceSite, lead = " at"): string {
  const place = eventPlace(e, site)?.name;
  if (place) return `${lead} ${place}`;
  return isOnline(e) ? " online" : "";
}

/** `Nov 22`. */
const shortDate = (date: string) => monthDayYear(date).replace(/, \d{4}$/, "");

/** `A`, `A and B`, `A, B and C`. */
function joinAnd(parts: string[]): string {
  if (parts.length <= 2) return parts.join(" and ");
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1) ?? ""}`;
}
