import { expect, test } from "vitest";
import {
  classList,
  eventList,
  isNotifyList,
  MAX_LISTS,
  parseListsRequest,
  programList,
  RETIRED_LISTS,
} from "./notify-lists.ts";

// The lists a phone joins (D65, NT-13): only the app's own names, so the messaging
// service holds nothing else. Ids as on the dev schedule of 12 November 2026.
const TOKEN = "fK3x9AbC_dEf:APA91bH-0123456789abcdefABCDEF";
const EVENT = "5bc3acb9-1372-4bd1-a658-21b6b8276668";
const CLASS = "c_0EP710PSBWX9";

test("a list for each series and each event (NT-13)", () => {
  expect(classList(CLASS)).toBe(`class-${CLASS}`);
  expect(eventList(EVENT)).toBe(`event-${EVENT}`);
  for (const name of [classList(CLASS), eventList(EVENT)]) expect(isNotifyList(name)).toBe(true);
});

test("a list for each study program, every session of it (owner, 13 November)", () => {
  expect(programList("ttp")).toBe("program-ttp");
  expect(isNotifyList(programList("ttp"))).toBe(true);
  expect(isNotifyList(programList("fp"))).toBe(true);
  expect(isNotifyList("program-xyz")).toBe(false);
});

test("anything else isn't a list", () => {
  for (const name of [
    "type-favorite",
    "class-c_lowercase0000",
    "class-c_0EP710PSBWX",
    "event-",
    "event-a b",
    `event-${"x".repeat(101)}`,
    "all",
    "",
    7,
    null,
  ])
    expect(isNotifyList(name)).toBe(false);
});

test("a request to join and leave lists, for a phone's code", () => {
  expect(
    parseListsRequest({
      token: TOKEN,
      join: [`class-${CLASS}`, `class-${CLASS}`],
      leave: [eventList(EVENT)],
    }),
  ).toEqual({ token: TOKEN, join: [`class-${CLASS}`], leave: [`event-${EVENT}`] });
  expect(parseListsRequest({ token: TOKEN, leave: ["type-prayer"] })).toEqual({
    token: TOKEN,
    join: [],
    leave: ["type-prayer"],
  });
});

test("a request that isn't one says why", () => {
  const cases: [unknown, string][] = [
    [null, "not an object"],
    [{ join: [`class-${CLASS}`] }, "no phone code"],
    [{ token: "short", join: [`class-${CLASS}`] }, "no phone code"],
    [{ token: `${TOKEN}<`, join: [`class-${CLASS}`] }, "no phone code"],
    [{ token: TOKEN, join: `class-${CLASS}` }, "join and leave are lists"],
    [{ token: TOKEN }, "nothing to join or leave"],
    [{ token: TOKEN, join: [`class-${CLASS}`, "news"] }, "not a list: news"],
    [
      { token: TOKEN, join: [`class-${CLASS}`], leave: [`class-${CLASS}`] },
      "a list to join and leave",
    ],
    [
      { token: TOKEN, join: Array.from({ length: MAX_LISTS + 1 }, () => `class-${CLASS}`) },
      `more than ${MAX_LISTS} lists`,
    ],
  ];
  for (const [body, error] of cases) expect(parseListsRequest(body)).toEqual({ error });
});

// The two study programs each have their own list (NT-12); their sessions are told as in
// the list of events, by category and title (AN-15).
test("the event types' lists can only be left: events are followed one by one", () => {
  for (const list of RETIRED_LISTS.filter((l) => l !== "type-program" && l !== "type-prayer")) {
    expect(isNotifyList(list)).toBe(false);
    expect(parseListsRequest({ token: TOKEN, join: [list] })).toEqual({
      error: `not a list: ${list}`,
    });
    expect(parseListsRequest({ token: TOKEN, leave: [list] })).toEqual({
      token: TOKEN,
      join: [],
      leave: [list],
    });
  }
});

test("the one list both programs shared can only be left (NT-12)", () => {
  expect(isNotifyList("type-program")).toBe(false);
  expect(parseListsRequest({ token: TOKEN, leave: ["type-program"] })).toEqual({
    token: TOKEN,
    join: [],
    leave: ["type-program"],
  });
  expect(parseListsRequest({ token: TOKEN, join: ["type-program"] })).toEqual({
    error: "not a list: type-program",
  });
});

test("the list of every prayer can only be left (NT-22)", () => {
  expect(isNotifyList("type-prayer")).toBe(false);
  expect(parseListsRequest({ token: TOKEN, join: ["type-prayer"] })).toEqual({
    error: "not a list: type-prayer",
  });
  expect(parseListsRequest({ token: TOKEN, leave: ["type-prayer"] })).toEqual({
    token: TOKEN,
    join: [],
    leave: ["type-prayer"],
  });
});
