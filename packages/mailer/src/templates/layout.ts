// What every staff email shares: the result's shape, the look of the approved mock-ups
// (docs/design/mockups/emails/) as inline styles, and plain-text helpers. HTML is simple:
// no images, no tracking, no external CSS; all text is escaped. Emails come from the center
// (D56): its name is the sender's, so the body starts at its heading.

import {
  dateWithYear,
  escapeHtml,
  easternDate,
  eventPlace,
  formatLongDate,
  formatTime12,
  type PlaceSite,
  type SnapshotV2Event,
} from "@kmcdc/domain";

export interface Email {
  subject: string;
  text: string;
  html: string;
}

const MINOR_WORDS = new Set(
  "a an and as at but by for from in into nor of on or per the to via vs with".split(" "),
);

/**
 * A subject in title case (AN-11): each word capitalised except short joining words, unless
 * first or after `:` or `–`; words with a capital or a digit stay as they are.
 */
export function titleCase(text: string): string {
  let start = true;
  return text
    .split(" ")
    .map((word) => {
      const first = start;
      start = /[:–]$/.test(word) || word === "–";
      if (/[A-Z0-9]/.test(word) || word === "" || word === "–") return word;
      if (!first && MINOR_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export const ACCENT = "#7a1f2b";
const MUTED = "#6c6c70";
const LINE = "#d9d9de";

/** HTML-escapes text: the contract's one helper, under the short name the templates use. */
export const esc = escapeHtml;

/** `Friday, October 16, 2026, at 4:07 PM`. */
export function longWhen(instant: string): string {
  return `${formatLongDate(easternDate(instant))}, at ${formatTime12(instant)}`;
}

/** `1 new`, `2 other changes`: a count and a word, plural with `s` unless given. */
export function count(n: number, one: string, many = `${one}s`): string {
  return `${String(n)} ${n === 1 ? one : many}`;
}

export const p = (html: string, style = "") => `<p style="margin:0 0 12px;${style}">${html}</p>`;

export const muted = (html: string) => `<span style="color:${MUTED}">${html}</span>`;

export function link(url: string, text: string, style = ""): string {
  return `<a href="${esc(url)}" style="color:${ACCENT};text-decoration:underline;${style}">${esc(text)}</a>`;
}

/** A group's heading with its count; `key` marks the group to read first. */
export function groupHeading(title: string, n: number, key = false): string {
  const colour = key ? ACCENT : "#1c1c1e";
  const rule = key ? ACCENT : LINE;
  return `<h2 style="font-size:16px;margin:24px 0 0;padding-bottom:6px;border-bottom:2px solid ${rule};color:${colour}">${esc(title)} <span style="font-size:13px;font-weight:600;color:${MUTED}">${String(n)}</span></h2>`;
}

/** One listed item, with a line under it. */
export const item = (html: string) =>
  `<div style="padding:12px 0;border-bottom:1px solid ${LINE}">${html}</div>`;

export const title = (text: string) =>
  `<div style="font-weight:700;font-size:15px;line-height:1.3">${esc(text)}</div>`;

export const soon = () =>
  `<div style="font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:${ACCENT};margin-bottom:2px">In the next 7 days</div>`;

/** A `Now` or `Was` line; Now is bold, Was muted. */
export function nowWas(label: "Now" | "Was", text: string): string {
  const value = label === "Now" ? `<b>${esc(text)}</b>` : muted(esc(text));
  return `<div style="margin-top:3px"><span style="display:inline-block;width:42px;color:${MUTED};font-size:13px">${label}</span>${value}</div>`;
}

export const box = (heading: string, html: string) =>
  `<div style="background:#f6f6f8;border-radius:10px;padding:12px 14px;margin:0 0 12px"><b style="display:block;margin-bottom:2px">${esc(heading)}</b>${html}</div>`;

/** A numbered list, one item per row: a maroon number, the item, a line between items. */
export function numberedList(items: string[], start = 1): string {
  const rows = items.map((html, i) => {
    const line = i === items.length - 1 ? "" : `border-bottom:1px solid ${LINE};`;
    return `<tr><td style="vertical-align:top;width:32px;padding:12px 0;${line}"><span style="display:inline-block;width:22px;height:22px;line-height:22px;border-radius:11px;background:${ACCENT};color:#fff;font-size:12px;font-weight:700;text-align:center">${String(start + i)}</span></td><td style="vertical-align:top;padding:12px 0;line-height:1.45;${line}">${html}</td></tr>`;
  });
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rows.join("")}</table>`;
}

/** The whole email: the heading (none when it opens with a greeting), the body and a muted footer, when it has one. */
export function page(heading: string | null, body: string, footer: string[] = []): string {
  return [
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#1c1c1e;max-width:600px">`,
    ...(heading === null
      ? []
      : [`<h1 style="font-size:20px;line-height:1.25;margin:0 0 8px">${esc(heading)}</h1>`]),
    body,
    ...(footer.length > 0
      ? [
          `<div style="color:${MUTED};font-size:12px;margin-top:18px;border-top:1px solid ${LINE};padding-top:10px">${footer.map(esc).join("<br>")}</div>`,
        ]
      : []),
    `</div>`,
  ].join("\n");
}

/** The plain-text version: heading, paragraphs and lists, then the footer, if any, after `--`. */
export function textPage(heading: string | null, blocks: string[], footer: string[] = []): string {
  const end = footer.length > 0 ? ["--", ...footer, ""] : [];
  const top = heading === null ? [] : [heading, ""];
  return [...top, ...blocks.flatMap((b) => [b, ""]), ...end].join("\n");
}

/** Online too, as the app's rows say it. */
export const isOnline = (e: SnapshotV2Event) => e.location?.online === true || e.online !== null;

/** `KMC DC · also online`, `Richmond`, or `Online`, as the app's rows say it. */
export function where(e: SnapshotV2Event, site: PlaceSite): string {
  const place = eventPlace(e, site)?.name ?? null;
  if (place === null) return isOnline(e) ? "Online" : "";
  return isOnline(e) ? `${place} · also online` : place;
}

/** `5:00 – 6:15 PM`, `8:30 AM – 5:00 PM`, or `All day`: the time of day, without the date. */
export function timeSpan(e: Pick<SnapshotV2Event, "start" | "end" | "allDay">): string {
  if (e.allDay) return "All day";
  const start = formatTime12(e.start);
  if (e.end === null) return start;
  const end = formatTime12(e.end);
  return `${start.slice(-2) === end.slice(-2) ? start.slice(0, -3) : start} – ${end}`;
}

/** `Oct 17, 2026`: a date without its weekday. */
export const monthDayYear = (date: string) => dateWithYear(date).slice(5);

/** A month heading: `October 2026`. */
export function monthHeading(text: string): string {
  return `<h2 style="font-size:17px;margin:24px 0 4px;padding-bottom:6px;border-bottom:2px solid ${LINE}">${esc(text)}</h2>`;
}

/**
 * The app's colours for each kind (D45), study programs (FP and TTP) and branch classes each
 * their own: the bar, the tint behind
 * a block, and text in the kind's colour (4.5:1 or more on white and on the tint).
 */
export const KIND_COLOURS = {
  class: { bar: "#00836e", soft: "#e0f0ee", text: "#007965" },
  program: { bar: "#9621a2", soft: "#f2e4f4", text: "#9621a2" },
  branch: { bar: "#0460cb", soft: "#e1ecf9", text: "#0460cb" },
  prayer: { bar: "#3734cc", soft: "#e7e7f9", text: "#3734cc" },
  special: { bar: "#c7310e", soft: "#f8e6e2", text: "#c3300e" },
} as const;

/** A kind's heading: a bar in its colour, its name and its count. */
export function kindHeading(kind: keyof typeof KIND_COLOURS, name: string, n: number): string {
  const c = KIND_COLOURS[kind];
  return `<h3 style="font-size:13px;margin:14px 0 2px;color:${c.text}"><span style="display:inline-block;width:4px;height:14px;border-radius:2px;background:${c.bar};vertical-align:-2px;margin-right:8px"></span>${esc(name)} <span style="font-weight:600;color:${MUTED}">${String(n)}</span></h3>`;
}

const MONTH_NAMES = [
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

/** `2026-10` (or a date in it) → `October 2026`. */
export const monthName = (date: string) =>
  `${MONTH_NAMES[Number(date.slice(5, 7)) - 1] ?? ""} ${date.slice(0, 4)}`;

export { LINE as RULE };
