// The KMC DC Events email (AN-14), as in the approved mock-up
// (docs/design/mockups/emails/email-events-phone.png): every event of the next 4 months, a
// calendar for each month, Sunday to Saturday; each event a block in its kind's colour with
// its start time and a short name; a colour key and the prayers' key at the top. In plain
// text by month and day, each event in full with its link.

import {
  formatLongDate,
  formatShortDate,
  formatTime12,
  type CalendarItem,
  type CalendarKind,
  type EventsCalendar,
  type PlaceSite,
} from "@kmcdc/domain";
import {
  esc,
  KIND_COLOURS,
  longWhen,
  monthDayYear,
  monthName,
  p,
  page,
  RULE,
  textPage,
  timeSpan,
  titleCase,
  where,
  type Email,
} from "./layout.ts";

export interface EventsEmailInput {
  calendar: EventsCalendar;
  site: PlaceSite;
  /** When the schedule was last copied; or, before any copy was remembered, last published. */
  asOf: { kind: "copy" | "published"; at: string };
}

const MUTED = "#6c6c70";
const FADED = "#c7c7cc";
const OFF = "#f6f6f8";
const INK = "#1c1c1e";
/** An event with no kind: grey, as the app shows it. */
const NONE = { bar: "#8e8e93", soft: "#f2f2f7" };

/** The key's names, in its order. */
const KEY: { kind: CalendarKind; name: string }[] = [
  { kind: "class", name: "Classes" },
  { kind: "branch", name: "Branch classes" },
  { kind: "program", name: "FP & TTP" },
  { kind: "prayer", name: "Prayers" },
  { kind: "special", name: "Special events" },
];

/** The kind's name after each event in the plain text. */
const KIND_WORD: Record<CalendarKind, string> = {
  class: "Class",
  branch: "Branch class",
  program: "Study program",
  prayer: "Prayer",
  special: "Special event",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** `7:00p`, `10:30a`: a start time that fits a phone's narrow day. */
const shortTime = (instant: string) =>
  formatTime12(instant).replace(" AM", "a").replace(" PM", "p");

function chip(item: CalendarItem): string {
  const c = item.kind ? KIND_COLOURS[item.kind] : NONE;
  const time = item.cont
    ? `<b style="color:${MUTED};font-weight:600">cont.</b>`
    : `<b>${esc(item.event.allDay ? "All day" : shortTime(item.event.start))}</b>`;
  return `<div style="border-left:3px solid ${c.bar};background:${c.soft};border-radius:3px;padding:1px 2px;margin:0 0 2px;font-size:10px;line-height:1.2;color:${INK};overflow:hidden">${time} ${esc(item.short)}</div>`;
}

function monthTable(weeks: EventsCalendar["months"][number]["weeks"]): string {
  const th = WEEKDAYS.map(
    (d) =>
      `<th style="font-size:10px;font-weight:600;color:${MUTED};text-align:left;padding:2px 3px;text-transform:uppercase">${d}</th>`,
  ).join("");
  const rows = weeks.map((week) => {
    const cells = week.map((day) => {
      const cell = `vertical-align:top;border:1px solid ${RULE};padding:3px 2px;height:46px;`;
      if (!day.inMonth) return `<td style="${cell}background:${OFF}"></td>`;
      const n = String(Number(day.date.slice(8)));
      if (!day.inRange)
        return `<td style="${cell}background:${OFF}"><div style="font-size:12px;font-weight:700;color:${FADED}">${n}</div></td>`;
      return `<td style="${cell}"><div style="font-size:12px;font-weight:700;margin:0 0 2px">${n}</div>${day.items.map(chip).join("")}</td>`;
    });
    return `<tr>${cells.join("")}</tr>`;
  });
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;table-layout:fixed"><tr>${th}</tr>${rows.join("")}</table>`;
}

function colourKey(): string {
  return `<div style="margin:0 0 6px;font-size:12px">${KEY.map(
    ({ kind, name }) =>
      `<span style="display:inline-block;margin:0 12px 4px 0;white-space:nowrap"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${KIND_COLOURS[kind].bar};vertical-align:-1px;margin-right:5px"></span>${esc(name)}</span>`,
  ).join("")}</div>`;
}

function prayersKey(key: EventsCalendar["key"]): string {
  if (key.length === 0) return "";
  const c = KIND_COLOURS.prayer;
  return [
    `<div style="background:${c.soft};border-radius:8px;padding:8px 10px;margin:10px 0 0;font-size:12px;line-height:1.5">`,
    `<div style="font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:${c.text}">Prayers</div>`,
    key
      .map(
        (k) =>
          `<span style="display:inline-block;white-space:nowrap;margin-right:14px"><b style="color:${c.text};margin-right:4px">${esc(k.code)}</b>${esc(k.name)}</span>`,
      )
      .join(" "),
    `</div>`,
  ].join("\n");
}

/** One event in the plain text: time, title and kind; then where, and its page. */
function textItem(item: CalendarItem, site: PlaceSite): string {
  const e = item.event;
  const time = item.cont ? "Continues" : timeSpan(e);
  // A study program's session by its own name (FP, TTP); everything else by its kind.
  const word = item.kind === "program" ? item.short : item.kind ? KIND_WORD[item.kind] : null;
  const kind = word ? ` (${word})` : "";
  const place = where(e, site);
  return [`  ${time}  ${e.title}${kind}`, ...(place ? [`    ${place}`] : []), `    ${e.page}`].join(
    "\n",
  );
}

/** KMC DC Events (AN-14): Mondays, Wednesdays and Fridays at 4:30 AM (D51), and on request. */
export function eventsEmail(input: EventsEmailInput): Email {
  const { calendar, site, asOf } = input;
  const subject = titleCase(
    `KMC DC Events, ${monthDayYear(calendar.from)} – ${monthDayYear(calendar.to)}`,
  );
  const heading = "KMC DC Events";
  const counts = `${String(calendar.count)} ${calendar.count === 1 ? "event" : "events"}`;
  const range = `from ${formatLongDate(calendar.from)} to ${formatLongDate(calendar.to)}`;
  const alive =
    asOf.kind === "copy"
      ? `Copied on ${longWhen(asOf.at)}.`
      : `The schedule in the app was last updated on ${longWhen(asOf.at)}.`;
  const footer = [
    "This email comes on Mondays, Wednesdays and Fridays at 4:30 AM. Something wrong? Fix it in Wix; the next update copies the fix.",
    "You get this because you're in the KMC DC Events group.",
  ];

  const html = [
    p(`<b>${esc(counts)}</b> ${esc(`${range}.`)}`, "font-size:15px"),
    colourKey(),
    prayersKey(calendar.key),
  ];
  const text = [`${counts} ${range}.`];
  if (calendar.key.length > 0)
    text.push(["Prayers", ...calendar.key.map((k) => `  ${k.code}  ${k.name}`)].join("\n"));
  for (const month of calendar.months) {
    const name = monthName(month.month);
    html.push(
      `<h2 style="font-size:19px;font-weight:800;margin:26px 0 8px;padding-bottom:4px;border-bottom:2px solid ${INK}">${esc(name)}</h2>`,
      monthTable(month.weeks),
    );
    const days = month.weeks.flat().filter((d) => d.inRange && d.items.length > 0);
    text.push(
      [
        name.toUpperCase(),
        ...days.map(
          (d) =>
            `\n${formatShortDate(d.date)}\n${d.items.map((i) => textItem(i, site)).join("\n")}`,
        ),
      ].join("\n"),
    );
  }
  html.push(p(esc(alive), "margin-top:16px"));
  text.push(alive);
  return {
    subject,
    text: textPage(heading, text, footer),
    html: page(heading, html.join("\n"), footer),
  };
}
