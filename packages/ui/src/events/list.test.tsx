import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DateStrip, stripTarget, type StripDay } from "./DateStrip.tsx";
import { DayGroup } from "./DayGroup.tsx";
import { firstBelow, listedFrom } from "./day-at-top.ts";
import { EmptyState } from "./EmptyState.tsx";
import { EventRow, type EventRowProps } from "./EventRow.tsx";
import { FilterChoices } from "./FilterChoices.tsx";

afterEach(cleanup);

const row: EventRowProps = {
  time: "7:00 PM",
  title: "Richmond Meditation Class",
  kind: "class",
  place: "Richmond",
  online: false,
  detail: "7:00 PM to 8:00 PM",
  label: "7:00 PM, Richmond Meditation Class, Classes, 7:00 PM to 8:00 PM, in Richmond",
  href: "/e/09ffc1ee-bbce-47f9-ab87-7b147ccf21b7",
  onOpen: () => undefined,
};

const list = (props: EventRowProps) =>
  render(
    <DayGroup id="day-1" heading="Today, October 12, 2026">
      <EventRow {...props} />
    </DayGroup>,
  );

test("a row shows time, title, second line and where line; screen readers hear its label (EV-11)", () => {
  list(row);
  const item = within(screen.getByRole("region", { name: "Today, October 12, 2026" })).getByRole(
    "listitem",
  );
  expect(item.querySelector(".ui-row")?.getAttribute("data-kind")).toBe("class"); // D45
  expect(item.querySelector(".ui-kindbar")?.getAttribute("aria-hidden")).toBe("true");
  expect(item.querySelector(".ui-time")?.textContent).toBe("7:00PM");
  expect(item.querySelector(".ui-sub")?.textContent).toBe("7:00 PM to 8:00 PM");
  // The place with a pin, as quiet text, not a chip (EV-11).
  const where = [...item.querySelectorAll(".ui-where > span")];
  expect(where.map((w) => w.textContent)).toEqual(["Richmond"]);
  expect(where[0]?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  expect(within(item).getByText(row.label).className).toBe("ui-sr");
  expect(item.querySelector(".ui-rowmain")?.getAttribute("aria-hidden")).toBe("true");
});

test("a row is a link to its event; a tap opens the panel in place (EV-36, EV-37)", () => {
  const onOpen = vi.fn();
  list({ ...row, onOpen });
  const link = screen.getByRole("link", { name: row.label });
  expect(link.getAttribute("href")).toBe("/e/09ffc1ee-bbce-47f9-ab87-7b147ccf21b7");
  expect(fireEvent.click(link)).toBe(false);
  expect(onOpen).toHaveBeenCalledWith(link);
  // ⌘-click opens a new tab as links do.
  expect(fireEvent.click(link, { metaKey: true })).toBe(true);
  expect(onOpen).toHaveBeenCalledTimes(1);
});

test("Online beside the place; an all-day row says All day", () => {
  list({ ...row, time: "All day", place: "KMC DC", online: true, detail: null });
  const item = screen.getByRole("listitem");
  expect(item.querySelector(".ui-time")?.className).toBe("ui-time ui-allday");
  expect(item.querySelector(".ui-time")?.textContent).toBe("All day");
  expect(item.querySelector(".ui-sub")?.textContent).toBe("");
  const where = [...item.querySelectorAll(".ui-where > span")];
  expect(where.map((w) => w.textContent)).toEqual(["KMC DC", "Online"]);
  expect(where.every((w) => w.querySelector("svg") !== null)).toBe(true);
});

test("a row with no place, online option or second line keeps their lines empty: every row the same height", () => {
  list({ ...row, place: null, detail: null });
  const item = screen.getByRole("listitem");
  expect(item.querySelector(".ui-where")?.textContent).toBe("");
  expect(item.querySelector(".ui-sub")?.textContent).toBe("");
});

test("the event's picture is decoration on the row, with the start time on it (EV-11, D7)", () => {
  list({ ...row, picture: "/v2/feed/pictures/0123456789abcdef-256.jpg" });
  const pic = screen.getByRole("listitem").querySelector(".ui-pic");
  expect(pic?.getAttribute("aria-hidden")).toBe("true");
  const img = pic?.querySelector("img");
  expect([
    img?.getAttribute("src"),
    img?.getAttribute("alt"),
    img?.getAttribute("loading"),
  ]).toEqual(["/v2/feed/pictures/0123456789abcdef-256.jpg", "", "lazy"]);
  expect(pic?.querySelector(".ui-time")?.textContent).toBe("7:00PM");
  // A picture that can't load leaves the kind's colour.
  if (img) fireEvent.error(img);
  expect(pic?.querySelector("img")).toBeNull();
});

test("an event with no picture shows its kind's colour in the picture's place", () => {
  list(row);
  const pic = screen.getByRole("listitem").querySelector(".ui-pic");
  expect(pic?.querySelector("img")).toBeNull();
  expect(pic?.querySelector(".ui-time")).not.toBeNull();
});

test("with the center's logo given, an event with no picture, or whose picture can't load, shows it on the kind's colour (EV-11)", () => {
  list({ ...row, defaultPicture: "/logo.png" });
  const pic = () => screen.getByRole("listitem").querySelector(".ui-pic");
  const shown = () =>
    [...(pic()?.querySelectorAll("img") ?? [])].map((i) => [i.className, i.getAttribute("src")]);
  expect(shown()).toEqual([["ui-pic-default", "/logo.png"]]);
  expect(pic()?.querySelector(".ui-time")).not.toBeNull();
  cleanup();
  list({
    ...row,
    picture: "/v2/feed/pictures/0123456789abcdef-256.jpg",
    defaultPicture: "/logo.png",
  });
  expect(shown()).toEqual([["", "/v2/feed/pictures/0123456789abcdef-256.jpg"]]);
  const img = pic()?.querySelector("img");
  if (img) fireEvent.error(img);
  expect(shown()).toEqual([["ui-pic-default", "/logo.png"]]);
});

test("a row with no kind keeps the bar's space without a colour (D45)", () => {
  list({ ...row, kind: null });
  const link = screen.getByRole("link");
  expect(link.hasAttribute("data-kind")).toBe(false);
  expect(link.querySelector(".ui-kindbar")).not.toBeNull();
});

test("a study program's session or a branch class takes its own colour (AN-15, D45)", () => {
  list({ ...row, tone: "branch" });
  const link = screen.getByRole("link");
  expect([link.getAttribute("data-kind"), link.getAttribute("data-tone")]).toEqual([
    "class",
    "branch",
  ]);
});

test("any other row has no colour of its own", () => {
  list(row);
  expect(screen.getByRole("link").hasAttribute("data-tone")).toBe(false);
});

test("the kind filter marks one choice as selected (EV-12)", () => {
  const chosen: string[] = [];
  const options = [
    { value: "all", label: "All" },
    { value: "prayer", label: "Prayers", dot: "prayer" as const },
  ];
  render(
    <FilterChoices
      options={options}
      value="all"
      onChange={(v) => {
        chosen.push(v);
      }}
    />,
  );
  const group = screen.getByRole("group", { name: "Show" });
  expect(
    within(group)
      .getAllByRole("button")
      .map((b) => [b.textContent, b.getAttribute("aria-pressed")]),
  ).toEqual([
    ["All", "true"],
    ["Prayers", "false"],
  ]);
  // The kind's dot is the colour key; it isn't read out (D45).
  const dot = screen.getByRole("button", { name: "Prayers" }).querySelector(".ui-kinddot");
  expect([dot?.getAttribute("data-kind"), dot?.getAttribute("aria-hidden")]).toEqual([
    "prayer",
    "true",
  ]);
  expect(
    within(group).getByRole("button", { name: "All" }).querySelector(".ui-kinddot"),
  ).toBeNull();
  // A tap selects at once, before the list has changed; tapping it again asks nothing.
  fireEvent.click(screen.getByRole("button", { name: "Prayers" }));
  expect(chosen).toEqual(["prayer"]);
  expect(screen.getByRole("button", { name: "Prayers" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Prayers" }));
  expect(chosen).toEqual(["prayer"]);
});

const stripDays: StripDay[] = [
  {
    date: "2026-10-31",
    weekday: "Sat",
    day: "31",
    month: "Oct",
    isToday: true,
    dots: ["special", null],
    label: "Saturday, October 31, 2026, 2 events",
  },
  {
    date: "2026-11-01",
    weekday: "Sun",
    day: "1",
    month: "Nov",
    isToday: false,
    dots: [],
    label: "Sunday, November 1, 2026, no events",
  },
];

test("the row of dates: spoken labels, month names, dots, the day at the top (EV-13, EV-14)", () => {
  const picks: string[] = [];
  const { rerender } = render(
    <DateStrip
      days={stripDays}
      current="2026-10-31"
      onPick={(d) => {
        picks.push(d);
      }}
    />,
  );
  const group = screen.getByRole("group", { name: "Choose a day" });
  const saturday = within(group).getByRole("button", {
    name: "Saturday, October 31, 2026, 2 events",
  });
  const sunday = within(group).getByRole("button", { name: "Sunday, November 1, 2026, no events" });
  expect(saturday.className).toBe("ui-date ui-today");
  expect(saturday.getAttribute("aria-current")).toBe("true");
  expect(sunday.getAttribute("aria-current")).toBeNull();
  // One dot per event, in its kind's colour; none for an event with no kind (D45).
  expect(
    [...saturday.querySelectorAll(".ui-dots i")].map((i) => i.getAttribute("data-kind")),
  ).toEqual(["special", null]);
  expect([...group.querySelectorAll(".ui-month")].map((m) => m.textContent)).toEqual([
    "Oct",
    "Nov",
  ]);

  // Tapping a date asks for it, the current one too; the list says which is current.
  fireEvent.click(sunday);
  fireEvent.click(saturday);
  rerender(
    <DateStrip
      days={stripDays}
      current="2026-11-01"
      onPick={(d) => {
        picks.push(d);
      }}
    />,
  );
  expect(sunday.getAttribute("aria-current")).toBe("true");
  expect(saturday.getAttribute("aria-current")).toBeNull();
  expect(picks).toEqual(["2026-11-01", "2026-10-31"]);
});

test("the row scrolls to an absolute place for the marked date, whatever slide is running", () => {
  // A row 300 wide scrolled to 100 shows 100–400; dates are 50 wide.
  expect(stripTarget(100, 300, 200, 50)).toBeNull();
  // Past the end: it goes to the start, 16 in.
  expect(stripTarget(100, 300, 380, 50)).toBe(364);
  // Before the start: it goes to the end, 16 in.
  expect(stripTarget(100, 300, 60, 50)).toBe(-174);
  // The same date gives the same target from any point of a slide.
  expect(stripTarget(0, 300, 1000, 50)).toBe(984);
  expect(stripTarget(600, 300, 1000, 50)).toBe(984);
});

test("the day at the top: the first day still showing below the line, else the last", () => {
  const bottoms = [100, 400, 900, 1500];
  const at = (line: number) => firstBelow(bottoms.length, (i) => bottoms[i] ?? 0, line);
  expect(at(50)).toBe(0);
  expect(at(100)).toBe(1); // the first day has just gone under the controls
  expect(at(399)).toBe(1);
  expect(at(1000)).toBe(3);
  expect(at(5000)).toBe(3);
  expect(firstBelow(0, () => 0, 0)).toBe(0);
});

test("a date leads to itself, the next listed day, or the last (EV-14)", () => {
  const listed = ["2026-10-13", "2026-10-15", "2026-10-18"];
  expect(listedFrom(listed, "2026-10-15")).toBe("2026-10-15");
  expect(listedFrom(listed, "2026-10-14")).toBe("2026-10-15");
  expect(listedFrom(listed, "2026-10-20")).toBe("2026-10-18");
  expect(listedFrom([], "2026-10-13")).toBeNull();
});

test("empty messages: plain, an alert for errors, and loading only after a second (EV-16)", () => {
  render(<EmptyState>No events match this filter</EmptyState>);
  const plain = screen.getByText("No events match this filter");
  expect([plain.getAttribute("role"), plain.className]).toEqual([null, "ui-empty"]);
  cleanup();

  render(<EmptyState alert>The schedule couldn't be reached.</EmptyState>);
  expect(screen.getByRole("alert").textContent).toBe("The schedule couldn't be reached.");
  cleanup();

  render(<EmptyState delayed>Loading the schedule…</EmptyState>);
  expect(screen.getByText("Loading the schedule…").className).toContain("ui-delayed");
});
