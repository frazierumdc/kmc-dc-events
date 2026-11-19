import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import type { EventChoiceRow, NotificationsProps } from "./NotificationsScreen.tsx";
import { sheet, info, notifications } from "../../test/settings.tsx";

afterEach(cleanup);

// Notifications (NT-17 – NT-19, NT-30): the first row of Settings and its own screen.
const CHOICES: EventChoiceRow[] = [
  {
    list: "class-c_F90B0ZVH6NWK",
    title: "Dakini Yoga",
    detail: "Weekly · Tuesdays, 5:00 PM",
    series: true,
    kind: "prayer",
    on: false,
  },
  {
    list: "class-c_0EP710PSBWX9",
    title: "Heart Jewel",
    detail: "Weekly · Tuesdays to Fridays, usually 8:00 AM",
    series: true,
    kind: "prayer",
    on: true,
  },
  {
    list: "event-abc",
    title: "International Fall Festival",
    detail: "Friday, October 9, 2026",
    series: false,
    kind: "special",
    on: false,
  },
  {
    list: "class-c_VVCAEVFKWNB3",
    title: "Richmond Meditation Class",
    detail: "Weekly · Mondays, 7:00 PM",
    series: true,
    kind: "branch",
    place: "Richmond",
    online: false,
    on: true,
  },
];

function openNotifications(over: Partial<NotificationsProps> = {}) {
  info({ notifications: notifications(over) });
  fireEvent.click(screen.getByRole("button", { name: /^Notifications/ }));
  expect(screen.getByRole("heading", { level: 2, name: "Notifications" })).toBeTruthy();
}

test("Notifications is Settings' first row, saying Off or On; left out where not possible (NT-30)", () => {
  info({ notifications: notifications() });
  const rows = screen.getAllByRole("button").map((b) => b.textContent);
  expect(rows.findIndex((t) => t.startsWith("Notifications"))).toBeLessThan(
    rows.findIndex((t) => t === "Privacy"),
  );
  expect(screen.getByRole("button", { name: /^Notifications/ }).textContent).toContain("Off");
  cleanup();
  info({ notifications: notifications({ state: "on" }) });
  expect(screen.getByRole("button", { name: /^Notifications/ }).textContent).toContain("On");
  cleanup();
  info();
  expect(screen.queryByRole("button", { name: /^Notifications/ })).toBeNull();
});

test("before they are on: the same screen, its switch off, saying what they are for (NT-10, NT-17)", () => {
  let asked = 0;
  openNotifications({ onTurnOn: () => (asked += 1), choices: CHOICES });
  expect(screen.queryByRole("button", { name: "Turn on notifications" })).toBeNull();
  expect(screen.getByText(/reminded before them and told if they change/)).toBeTruthy();
  expect(screen.getByText(/Your phone will ask you to allow notifications/)).toBeTruthy();
  // The events followed are kept and counted; off, the kinds don't open, so no event can be
  // chosen until notifications are on (owner, 13 November 2026).
  const classes = screen.getByRole<HTMLButtonElement>("button", { name: /^Classes/ });
  expect(classes.textContent).toContain("Following 1 of 1");
  for (const name of [/^Classes/, /^Special Events/, /^Prayers/])
    expect(screen.getByRole<HTMLButtonElement>("button", { name }).disabled).toBe(true);
  fireEvent.click(classes);
  expect(screen.queryByRole("heading", { name: "At KMC DC" })).toBeNull();
  // Your events shows them, dimmed, and their switches don't move (NT-47).
  expect(
    screen.getByRole<HTMLButtonElement>("switch", { name: "Richmond Meditation Class" }).disabled,
  ).toBe(true);
  expect(document.querySelector(".ui-follow-off")).toBeTruthy();
  const main = screen.getByRole("switch", { name: "Notifications" });
  expect(main.getAttribute("aria-checked")).toBe("false");
  fireEvent.click(main);
  expect(asked).toBe(1);
  expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
});

test("while turning on the switch waits; a failure is said (NT-17)", () => {
  openNotifications({ busy: true, failed: true });
  expect(screen.getByRole<HTMLButtonElement>("switch", { name: "Notifications" }).disabled).toBe(
    true,
  );
  expect(screen.getByRole("alert").textContent).toContain("Couldn’t change notifications");
});

test("on: a switch for this phone that turns them off (NT-17, NT-20)", () => {
  let off = 0;
  openNotifications({ state: "on", onTurnOff: () => (off += 1) });
  const toggle = screen.getByRole("switch", { name: "Notifications" });
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  fireEvent.click(toggle);
  expect(off).toBe(1);
});

test("refused in the phone's settings: how to allow them there, no button (NT-18)", () => {
  openNotifications({ state: "refused" });
  expect(screen.getByText("Notifications are off for this app")).toBeTruthy();
  expect(screen.getByRole("list").textContent).toContain("Allow Notifications");
  expect(screen.queryByRole("button", { name: "Turn on notifications" })).toBeNull();
  cleanup();
  openNotifications({ state: "refused", android: true });
  expect(screen.getByRole("list").textContent).toContain("Apps");
});

test("iPhone in Safari: add the app to the Home Screen first, no switch (NT-19)", () => {
  openNotifications({ state: "home-screen" });
  expect(screen.getByRole("link", { name: "Add to Home Screen" }).getAttribute("href")).toBe(
    "https://example.web.app/get-app",
  );
  expect(screen.queryByRole("switch")).toBeNull();
  expect(screen.queryByRole("button", { name: "Turn on notifications" })).toBeNull();
});

test("on: no switch per event type; events are followed one by one (owner, 13 November)", () => {
  openNotifications({ state: "on" });
  expect(screen.getAllByRole("switch").map((s) => s.getAttribute("aria-label"))).toEqual([
    "Notifications",
  ]);
  expect(screen.queryByText(/next 7 days/)).toBeNull();
});

// Add events (NT-17, NT-22): a row for each of the list's kinds, each opening its events.

test("Add events: Classes, Special Events and Prayers, as the list's kinds, each saying how many are followed (NT-22)", () => {
  openNotifications({ state: "on", choices: CHOICES });
  expect(screen.getByRole("heading", { name: "Add events" })).toBeTruthy();
  const kinds = ["Classes", "Special", "Prayers"].map(
    (name) => screen.getByRole("button", { name: new RegExp(`^${name}`) }).textContent,
  );
  // A branch class is a class, as in the list's filter.
  expect(kinds).toEqual([
    "ClassesFollowing 1 of 1",
    "Special EventsFollowing 0 of 1",
    "PrayersFollowing 1 of 2",
  ]);
});

// Your events (NT-47, option B, owner, 17 November 2026): the events followed, each saying
// which reminders it sends, with its switch.
const WITH_REMINDERS = CHOICES.map((c) => ({
  ...c,
  reminders: c.detail.startsWith("Weekly") ? "Day before" : "Week before and day before",
}));

test("Your events: each event followed, with the reminders it sends beside a bell (NT-47)", () => {
  openNotifications({
    state: "on",
    choices: WITH_REMINDERS.map((c) => (c.list === "event-abc" ? { ...c, on: true } : c)),
  });
  expect(screen.getByRole("heading", { name: "Your events" })).toBeTruthy();
  const cards = [...document.querySelectorAll(".ui-follow-row")];
  expect(
    cards.map((card) => [
      card.querySelector(".ui-follow-title")?.textContent,
      card.querySelector(".ui-follow-reminders")?.textContent,
    ]),
  ).toEqual([
    ["Heart Jewel", "Day before"],
    ["International Fall Festival", "Week before and day before"],
    ["Richmond Meditation Class", "Day before"],
  ]);
  expect(
    screen.getByText("You’ll be reminded before each event below, and told if it changes."),
  ).toBeTruthy();
  expect(screen.getByText("Turn an event off to stop its notifications.")).toBeTruthy();
});

test("Your events: an event switched off stays, switched off, until the screen is left (NT-47)", () => {
  const picked: [string, boolean][] = [];
  const props = (choices: EventChoiceRow[]) =>
    notifications({ state: "on", choices, onFollow: (list, on) => picked.push([list, on]) });
  const view = info({ notifications: props(WITH_REMINDERS) });
  fireEvent.click(screen.getByRole("button", { name: /^Notifications/ }));
  fireEvent.click(screen.getByRole("switch", { name: "Heart Jewel" }));
  expect(picked).toEqual([["class-c_0EP710PSBWX9", false]]);
  // The app answers with the event no longer followed: its card is still there, switched off.
  const off = WITH_REMINDERS.map((c) => (c.title === "Heart Jewel" ? { ...c, on: false } : c));
  view.rerender(sheet({ notifications: props(off) }));
  const heart = screen.getByRole("switch", { name: "Heart Jewel" });
  expect(heart.getAttribute("aria-checked")).toBe("false");
  fireEvent.click(heart);
  expect(picked.at(-1)).toEqual(["class-c_0EP710PSBWX9", true]);
});

test("Your events: with none followed it says how to add them (NT-47)", () => {
  openNotifications({ state: "on", choices: CHOICES.map((c) => ({ ...c, on: false })) });
  expect(
    screen.getByText("No events yet. Add them below, or turn on Notify me in any event."),
  ).toBeTruthy();
  expect(document.querySelector(".ui-follow-row")).toBeNull();
});

test("a kind opens its events, each with its switch, the same as its panel's; back is Notifications (NT-22)", () => {
  const picked: [string, boolean][] = [];
  openNotifications({
    state: "on",
    choices: CHOICES,
    onFollow: (list, on) => picked.push([list, on]),
  });
  fireEvent.click(screen.getByRole("button", { name: /^Prayers/ }));
  expect(screen.getByRole("heading", { level: 2, name: "Prayers" })).toBeTruthy();
  expect(screen.getAllByRole("switch").map((s) => s.getAttribute("aria-label"))).toEqual([
    "Dakini Yoga",
    "Heart Jewel",
  ]);
  expect(screen.getByRole("switch", { name: "Heart Jewel" }).getAttribute("aria-checked")).toBe(
    "true",
  );
  fireEvent.click(screen.getByRole("switch", { name: "Dakini Yoga" }));
  expect(picked).toEqual([["class-c_F90B0ZVH6NWK", true]]);
  fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
  expect(screen.getByRole("heading", { level: 2, name: "Notifications" })).toBeTruthy();
});

test("each event says where and when, as the list does (EV-11, NT-22)", () => {
  openNotifications({ state: "on", choices: CHOICES });
  fireEvent.click(screen.getByRole("button", { name: /^Classes/ }));
  const row = screen.getByRole("listitem");
  expect(row.querySelector(".ui-follow-where")?.textContent).toBe("Richmond");
  expect(row.querySelector(".ui-follow-when")?.textContent).toBe("Weekly · Mondays, 7:00 PM");
  expect(row.getAttribute("data-kind")).toBe("branch");
});

test("a special event the website also lists as a class is under Classes and Special, in its special colour (D45)", () => {
  const special: EventChoiceRow = {
    list: "event-special-sunday",
    title: "Special Sunday Morning Meditation",
    detail: "One time · Sunday, November 29, 2026",
    series: false,
    kind: "special",
    alsoClass: true,
    on: true,
  };
  openNotifications({ state: "on", choices: [...CHOICES, special] });
  const counts = ["Classes", "Special"].map(
    (name) => screen.getByRole("button", { name: new RegExp(`^${name}`) }).textContent,
  );
  expect(counts).toEqual(["ClassesFollowing 2 of 2", "Special EventsFollowing 1 of 2"]);
  fireEvent.click(screen.getByRole("button", { name: /^Classes/ }));
  const atCenter = screen.getByRole("region", { name: "At KMC DC" });
  const row = atCenter.querySelector(".ui-follow-row");
  expect(row?.querySelector(".ui-follow-title")?.textContent).toBe(special.title);
  expect(row?.getAttribute("data-kind")).toBe("special");
  // The same follow under both: one switch, one list.
  fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
  fireEvent.click(screen.getByRole("button", { name: /^Special/ }));
  expect(screen.getByRole("switch", { name: special.title }).getAttribute("aria-checked")).toBe(
    "true",
  );
});

test("another center's special event is under Special Events, in slate (D67)", () => {
  const retreat: EventChoiceRow = {
    list: "event-kmc-maryland",
    title: "Sample Retreat",
    detail: "One time · Saturday, December 5, 2026",
    series: false,
    kind: "elsewhere",
    on: false,
  };
  openNotifications({ state: "on", choices: [...CHOICES, retreat] });
  fireEvent.click(screen.getByRole("button", { name: /^Special/ }));
  const row = screen.getByRole("switch", { name: retreat.title }).closest("li");
  expect(row?.getAttribute("data-kind")).toBe("elsewhere");
});

test("Classes are grouped like with like: the temple's, the branches', the study programs' (owner, 13 November)", () => {
  const classes: EventChoiceRow[] = [
    ...CHOICES,
    {
      list: "program-ttp",
      title: "Teacher Training Program",
      detail: "Weekly · Sundays and Tuesdays",
      series: true,
      kind: "program",
      on: false,
    },
    {
      list: "class-c_BD70DGDE94GW",
      title: "Monday Meditation Class",
      detail: "Weekly · Mondays, 7:00 PM",
      series: true,
      kind: "class",
      on: false,
    },
  ];
  openNotifications({ state: "on", choices: classes });
  fireEvent.click(screen.getByRole("button", { name: /^Classes/ }));
  const groups = screen.getAllByRole("region");
  expect(groups.map((g) => g.getAttribute("aria-label"))).toEqual([
    "At KMC DC",
    "Branch classes",
    "Study programs",
  ]);
  expect(groups.map((g) => g.querySelector(".ui-follow-title")?.textContent)).toEqual([
    "Monday Meditation Class",
    "Richmond Meditation Class",
    "Teacher Training Program",
  ]);
  // What turning an event on does is said once, above the cards (owner, 13 November).
  expect(document.querySelector(".ui-follow-lead")?.textContent).toBe(
    "Turn an event on to be reminded and kept up to date. We’ll remind you the day before, and a week before too for events that aren’t weekly.",
  );
  expect(screen.queryByRole("status")).toBeNull();
  // Each card's when line starts with what following covers, in bold.
  const when = groups[2]?.querySelector(".ui-follow-when");
  expect(when?.querySelector("b")?.textContent).toBe("Weekly");
  expect(when?.textContent).toBe("Weekly · Sundays and Tuesdays");
});

test("a kind with no groups of its own shows no headings (NT-22)", () => {
  openNotifications({ state: "on", choices: CHOICES });
  fireEvent.click(screen.getByRole("button", { name: /^Prayers/ }));
  expect(screen.queryAllByRole("region")).toEqual([]);
});

test("each event shows its picture, or its kind's colour when it has none (slice 1.13)", () => {
  const withPicture = CHOICES.map((c, i) =>
    i === 0 ? { ...c, picture: "/v2/feed/pictures/0123456789abcdef-256.jpg" } : c,
  );
  openNotifications({ state: "on", choices: withPicture });
  fireEvent.click(screen.getByRole("button", { name: /^Prayers/ }));
  const rows = screen.getAllByRole("listitem");
  expect(rows[0]?.querySelector("img")?.getAttribute("src")).toBe(
    "/v2/feed/pictures/0123456789abcdef-256.jpg",
  );
  expect(rows[0]?.querySelector("img")?.getAttribute("alt")).toBe("");
  expect(rows[1]?.querySelector("img")).toBeNull();
  expect(rows[1]?.querySelector(".ui-notify-ph")?.getAttribute("data-kind")).toBe("prayer");
});

test("refused or in Safari, the kinds can't be reached: Notifications says why", () => {
  openNotifications({ state: "refused", choices: CHOICES });
  expect(screen.queryByRole("button", { name: /^Classes/ })).toBeNull();
});

test("opening Notifications tells the app, so it can get ready before the switch is tapped", () => {
  let opened = 0;
  info({ notifications: notifications({ onOpen: () => (opened += 1) }) });
  expect(opened).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: /^Notifications/ }));
  expect(opened).toBe(1);
});
