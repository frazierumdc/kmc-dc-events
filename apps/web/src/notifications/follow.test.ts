import { expect, test } from "vitest";
import type { SnapshotV2Event } from "@kmcdc/domain";
import { eventChoices, followFor, goneFollows, isWeekly, remindersLine } from "./follow.ts";
import { golden } from "../../test/schedule.ts";

// Following an event (NT-13, NT-22), on the golden schedule's real events: an event held more
// than once is followed every time it is held, a one-time event only itself.
const snapshot = golden.snapshot;
const byTitle = (title: string) =>
  snapshot.events.find((e) => e.title === title) as SnapshotV2Event;
/** The same class a week later: what a weekly class looks like on the schedule. */
const weekLater = (e: SnapshotV2Event): SnapshotV2Event => ({
  ...e,
  id: `${e.id}-next`,
  start: new Date(Date.parse(e.start) + 7 * 86_400_000).toISOString(),
});

test("a one-time event is followed by itself, with its date", () => {
  const festival = byTitle("International Fall Festival");
  expect(followFor(festival, snapshot.events)).toEqual({
    list: `event-${festival.id}`,
    title: "International Fall Festival",
    detail: "One time · Friday, October 9, 2026",
    panel: "A reminder a week and a day before, and if it changes",
  });
});

test("a weekly class is followed every week, by its class id (NT-13)", () => {
  const richmond = byTitle("Richmond Meditation Class");
  const events = [...snapshot.events, weekLater(richmond)];
  expect(followFor(richmond, events)).toEqual({
    list: `class-${richmond.classId}`,
    title: "Richmond Meditation Class",
    detail: "Weekly · Mondays, 7:00 PM",
    panel: "A reminder the day before each session, and if one changes",
  });
});

test("the panel says what an event sends, in the app's word for one session (NT-48)", () => {
  const richmond = byTitle("Richmond Meditation Class");
  const events = [richmond, weekLater(richmond)];
  expect(followFor(richmond, events, [], "class").panel).toBe(
    "A reminder the day before each class, and if one changes",
  );
  expect(isWeekly(followFor(richmond, events))).toBe(true);
  expect(remindersLine(followFor(richmond, events))).toBe("Day before");
  // Held more than once with no usual days: a week before each date too.
  const twice = [richmond, { ...weekLater(weekLater(weekLater(richmond))), id: "later" }];
  expect(followFor(richmond, twice, [], "class").panel).toBe(
    "A reminder a week and a day before each date, and if one changes",
  );
  expect(remindersLine(followFor(richmond, twice))).toBe("Week before and day before");
  expect(remindersLine(followFor(richmond, [richmond]))).toBe("Week before and day before");
});

test("an event held on different weekdays is followed every time it's held too", () => {
  const richmond = byTitle("Richmond Meditation Class");
  const otherDay = { ...weekLater(richmond), start: "2026-10-14T19:00:00-04:00" };
  expect(followFor(richmond, [richmond, otherDay]).list).toBe(`class-${richmond.classId}`);
});

// Add events (NT-22): each series once, followed by its class id, then one-time events.
const prayer = (title: string, classId: string, starts: string[]): SnapshotV2Event[] =>
  starts.map((start, i) => ({
    ...byTitle("Richmond Meditation Class"),
    id: `${classId}-${String(i)}`,
    classId,
    title,
    summary: `About ${title}.`,
    categories: ["Chanted Prayers"],
    start,
  }));
const site = {
  ...golden.snapshot.site,
  categoryKinds: { "Chanted Prayers": "prayer" as const },
  programs: [],
};
const heart = prayer("Heart Jewel", "c_BE3A0GKMEXTW", [
  "2026-11-17T08:00:00-05:00",
  "2026-11-18T08:00:00-05:00",
  "2026-11-19T08:00:00-05:00",
  "2026-11-20T08:00:00-05:00",
  "2026-11-24T08:00:00-05:00",
  "2026-11-25T08:00:00-05:00",
  "2026-11-26T08:00:00-05:00",
  "2026-11-27T08:00:00-05:00",
]);
const dakini = prayer("Dakini Yoga", "c_F90B0ZVH6NWK", [
  "2026-11-17T17:00:00-05:00",
  "2026-11-24T17:00:00-05:00",
]);
const tsog = prayer("Wishfulfilling Jewel with Tsog", "c_0EP710PSBWX9", [
  "2026-12-06T14:30:00-05:00",
  "2026-11-22T17:00:00-05:00",
]);

test("each series once, by name, with when it is held; then one-time events by date (NT-22)", () => {
  const festival = byTitle("International Fall Festival");
  const choices = eventChoices([...tsog, festival, ...heart, ...dakini], site);
  expect(choices.map(({ title, detail, series }) => [title, detail, series])).toEqual([
    ["Dakini Yoga", "Weekly · Tuesdays, 5:00 PM", true],
    ["Heart Jewel", "Weekly · Tuesdays to Fridays, 8:00 AM", true],
    ["Wishfulfilling Jewel with Tsog", "2 times · Nov 22 and Dec 6, 2026", true],
    ["International Fall Festival", "One time · Friday, October 9, 2026", false],
  ]);
  expect(choices[0]?.list).toBe("class-c_F90B0ZVH6NWK");
  expect(choices[0]?.kind).toBe("prayer");
  expect(choices[3]?.list).toBe(`event-${festival.id}`);
});

test("Add events and the panel give the same follow for an event (NT-22)", () => {
  const thursday = heart[2] as SnapshotV2Event;
  const choice = eventChoices(heart, site)[0];
  expect(followFor(thursday, heart).list).toBe(choice?.list);
  expect(followFor(thursday, heart).detail).toBe(choice?.detail);
});

test("a prayer held once on each of two days shows its next date", () => {
  expect(eventChoices(heart.slice(0, 2), site)[0]?.detail).toBe(
    "2 times · Nov 17 and Nov 18, 2026",
  );
});

// Heart Jewel's days change most (owner, 12 November): its line names the days it is held on
// most, so an odd week doesn't change it.
const weeks = (starts: string[], count: number) =>
  Array.from({ length: count }, (_, week) =>
    starts.map((start) => new Date(Date.parse(start) + week * 7 * 86_400_000).toISOString()),
  ).flat();
const usual = [
  "2026-11-17T08:00:00-05:00",
  "2026-11-18T08:00:00-05:00",
  "2026-11-19T08:00:00-05:00",
  "2026-11-20T08:00:00-05:00",
];
const detailOf = (starts: string[]) =>
  eventChoices(prayer("Heart Jewel", "c_BE3A0GKMEXTW", starts), site)[0]?.detail;

test("a week without one of its days, or with an extra day or time, keeps the usual days", () => {
  const month = weeks(usual, 4);
  // Every session on its usual days at its usual time: no "usually".
  expect(detailOf(month)).toBe("Weekly · Tuesdays to Fridays, 8:00 AM");
  expect(detailOf(month.slice(1))).toBe("Weekly · Tuesdays to Fridays, 8:00 AM");
  expect(detailOf([...month, "2026-11-21T08:00:00-05:00"])).toBe(
    "Weekly · Tuesdays to Fridays, usually 8:00 AM",
  );
  expect(detailOf([...month.slice(1), "2026-11-17T10:30:00-05:00"])).toBe(
    "Weekly · Tuesdays to Fridays, usually 8:00 AM",
  );
});

test("usual days that don't run on are each named", () => {
  expect(detailOf(weeks([usual[0], usual[2]] as string[], 3))).toBe(
    "Weekly · Tuesdays and Thursdays, 8:00 AM",
  );
  expect(detailOf(weeks(["2026-11-16T08:00:00-05:00", usual[1], usual[3]] as string[], 3))).toBe(
    "Weekly · Mondays, Wednesdays and Fridays, 8:00 AM",
  );
});

test("a weekly prayer with one session moved is usually on its day; with none moved, every", () => {
  const tuesdays = weeks(["2026-11-17T17:00:00-05:00"], 4);
  expect(detailOf(tuesdays)).toBe("Weekly · Tuesdays, 5:00 PM");
  expect(detailOf([...tuesdays.slice(1), "2026-11-18T17:00:00-05:00"])).toBe(
    "Weekly · Tuesdays, usually 5:00 PM",
  );
});

test("a prayer with no usual days shows the date of its next session", () => {
  expect(
    detailOf([
      "2026-11-22T17:00:00-05:00",
      "2026-12-01T14:00:00-05:00",
      "2026-12-09T16:00:00-05:00",
    ]),
  ).toBe("3 times · Nov 22, Dec 1 and Dec 9, 2026");
});

test("a prayer held on several days is followed every time it's held, from its panel (NT-13)", () => {
  const thursday = heart[2] as SnapshotV2Event;
  expect(followFor(thursday, heart)).toEqual({
    list: "class-c_BE3A0GKMEXTW",
    title: "Heart Jewel",
    detail: "Weekly · Tuesdays to Fridays, 8:00 AM",
    panel: "A reminder the day before each session, and if one changes",
  });
});

// An event followed by itself that has left the schedule can never change again: its follow
// is dropped (NT-17). A class or prayer followed every time stays, as it may be held again.
test("follows of events no longer on the schedule are the ones to drop (NT-17)", () => {
  const festival = byTitle("International Fall Festival");
  expect(
    goneFollows(
      ["type-class", `event-${festival.id}`, "event-gone", "class-c_BE3A0GKMEXTW"],
      snapshot.events,
    ),
  ).toEqual(["event-gone"]);
});

// Each choice says where it is, as the list's row does (EV-11): the place and Online.
test("each choice has its place and whether it can be attended online, as the list says them", () => {
  const festival = byTitle("International Fall Festival");
  const [choice] = eventChoices([festival], site);
  expect([choice?.place, choice?.online]).toEqual(["Málaga", false]);
  expect(eventChoices(heart, site)[0]?.place).toBe("Richmond");
});

test("a special event the website also lists as a class is a choice under Classes too (D45)", () => {
  const festival = byTitle("International Fall Festival");
  const both = {
    ...festival,
    categories: ["Weekly Meditation Classes", "Retreats & Special Events"],
  };
  const withKinds = { ...site, categoryKinds: golden.snapshot.site.categoryKinds };
  expect(eventChoices([both], withKinds)[0]).toMatchObject({ kind: "special", alsoClass: true });
  expect(eventChoices([festival], withKinds)[0]?.alsoClass).toBe(false);
});

test("another center's special event is a slate choice under Special Events (D67)", () => {
  const festival = byTitle("International Fall Festival");
  const withKinds = { ...site, categoryKinds: golden.snapshot.site.categoryKinds };
  const other = { ...festival, otherCenter: true as const };
  expect(eventChoices([other], withKinds)[0]?.kind).toBe("elsewhere");
  expect(eventChoices([festival], withKinds)[0]?.kind).toBe("special");
});

test("TTP's Sunday and Tuesday classes are one choice, whatever the form of their title (owner, 13 November)", () => {
  const ttpSite = {
    ...site,
    programs: [
      {
        id: "ttp" as const,
        shortName: "TTP",
        category: "Study Programs",
        titles: ["Teacher Training Program", "Teacher Training Program (TTP)"],
      },
    ],
  };
  // As on the dev schedule of 13 November 2026: two class ids, each on both days.
  const session = (title: string, classId: string, start: string, i: number) => ({
    ...byTitle("Richmond Meditation Class"),
    id: `ttp-${String(i)}`,
    classId,
    title,
    categories: ["Study Programs"],
    start,
  });
  const ttp = [
    session("Teacher Training Program", "c_3T77XDRNXNZH", "2026-11-17T19:00:00-05:00", 1),
    session("Teacher Training Program", "c_3T77XDRNXNZH", "2026-11-22T19:00:00-05:00", 2),
    session("Teacher Training Program (TTP)", "c_P7G9AT02RVGE", "2026-11-24T19:00:00-05:00", 3),
    // Times differ from day to day: only the days are said.
    session("Teacher Training Program (TTP)", "c_P7G9AT02RVGE", "2026-11-29T15:00:00-05:00", 4),
  ];
  const choices = eventChoices(ttp, ttpSite);
  expect(choices).toHaveLength(1);
  expect(choices[0]).toMatchObject({
    list: "program-ttp",
    title: "Teacher Training Program",
    detail: "Weekly · Sundays and Tuesdays",
    series: true,
  });
  // Either day's panel follows the same choice.
  for (const event of [ttp[0], ttp[3]] as SnapshotV2Event[])
    expect(followFor(event, ttp, ttpSite.programs)).toMatchObject({
      list: "program-ttp",
      panel: "A reminder the day before each TTP class, and if one changes",
    });
});

test("the Foundation Program meets on Sundays at its one start time (owner, 13 November)", () => {
  const fpSite = {
    ...site,
    programs: [
      {
        id: "fp" as const,
        shortName: "FP",
        category: "Study Programs",
        titles: ["The Foundation Program", "Foundation Program"],
      },
    ],
  };
  // As on the dev schedule of 13 November 2026: noon to 2 PM.
  const fp = ["2026-11-22", "2026-12-06", "2027-01-10"].map((date, i) => ({
    ...byTitle("Richmond Meditation Class"),
    id: `fp-${String(i)}`,
    classId: "c_N6XSQ11C0WTP",
    title: "The Foundation Program",
    categories: ["Study Programs"],
    start: `${date}T12:00:00-05:00`,
    end: `${date}T14:00:00-05:00`,
  }));
  expect(eventChoices(fp, fpSite)[0]).toMatchObject({
    list: "program-fp",
    title: "The Foundation Program",
    detail: "Weekly · Sundays, 12:00 PM",
  });
});
