import { expect, test } from "vitest";
import { leaveRetired } from "./notifications.ts";
import { TOKEN, phone, screen, settle, held } from "../../test/notifications.ts";

// Choosing (NT-12, NT-13): a type's switch, Notify me of changes, Remove.
const FOLLOW = { title: "Richmond Meditation Class", detail: "Every Monday, 7:00 PM" } as const;

const CLASS = "class-c_VVCAEVFKWNB3";

test("with notifications on, a choice shows at once and joins or leaves its list", async () => {
  const { env, log, saved } = phone({}, { on: true, token: TOKEN, lists: [], follows: [] });
  const { n, seen } = screen(env);
  n.choose("type-class", true);
  n.choose(CLASS, true, { list: CLASS, ...FOLLOW });
  expect(saved()?.lists).toEqual(["type-class", CLASS]);
  expect(seen.changed).toBe(2);
  await settle();
  n.choose("type-class", false);
  await settle();
  expect(log).toEqual([
    "join [type-class] leave []",
    `join [${CLASS}] leave []`,
    "join [] leave [type-class]",
  ]);
  expect(saved()).toEqual({
    on: true,
    token: TOKEN,
    lists: [CLASS],
    follows: [{ list: CLASS, ...FOLLOW }],
  });
});

test("Remove leaves the list and forgets the event (NT-17)", async () => {
  const { env, log, saved } = phone(
    {},
    { on: true, token: TOKEN, lists: [CLASS], follows: [{ list: CLASS, ...FOLLOW }] },
  );
  screen(env).n.choose(CLASS, false);
  expect(saved()).toEqual({ on: true, token: TOKEN, lists: [], follows: [] });
  await settle();
  expect(log).toEqual([`join [] leave [${CLASS}]`]);
});

test("quick taps on one list go one at a time, and the last choice wins", async () => {
  const calls = held();
  const { env, log, saved } = phone(
    { changeLists: (body) => (log.push(`join [${body.join.join(" ")}]`), calls.changeLists()) },
    { on: true, token: TOKEN, lists: [], follows: [] },
  );
  const { n } = screen(env);
  n.choose("type-class", true);
  n.choose("type-class", false);
  n.choose("type-class", true);
  n.choose("type-class", false);
  expect(calls.waiting()).toBe(1);
  await calls.answer(200);
  // Joined; the last choice was off, so it leaves.
  expect(log).toEqual(["join [type-class]", "join []"]);
  await calls.answer(200);
  expect(calls.waiting()).toBe(0);
  expect(saved()?.lists).toEqual([]);
});

test("a choice the service refused flips back and says so", async () => {
  const { env, saved } = phone(
    { changeLists: () => Promise.resolve(502) },
    { on: true, token: TOKEN, lists: [], follows: [] },
  );
  const { n, seen } = screen(env);
  n.choose(CLASS, true, { list: CLASS, ...FOLLOW });
  expect(saved()?.lists).toEqual([CLASS]);
  await settle();
  expect(saved()).toEqual({ on: true, token: TOKEN, lists: [], follows: [] });
  expect(seen).toEqual({ changed: 2, failed: 1 });
});

test("a Remove the service refused brings the event back", async () => {
  const { env, saved } = phone(
    { changeLists: () => Promise.reject(new Error("offline")) },
    { on: true, token: TOKEN, lists: [CLASS], follows: [{ list: CLASS, ...FOLLOW }] },
  );
  const { n, seen } = screen(env);
  n.choose(CLASS, false);
  await settle();
  expect(saved()?.follows).toEqual([{ list: CLASS, ...FOLLOW }]);
  expect(seen.failed).toBe(1);
});

test("with notifications off a choice is only kept, and joined when they're turned on", async () => {
  const { env, log } = phone();
  const { n } = screen(env);
  n.choose("type-special", true);
  await settle();
  expect(log).toEqual([]);
  await n.turnOn();
  await settle();
  expect(log).toEqual(["asked", "library", "join [type-special] leave []"]);
});

test("the event types' old lists are left and forgotten; events followed stay (owner, 13 November)", async () => {
  const { env, log, saved } = phone(
    {},
    { on: true, token: TOKEN, lists: ["type-program", "type-class", "event-abc"], follows: [] },
  );
  const { n, seen } = screen(env);
  leaveRetired(env, n);
  expect(saved()?.lists).toEqual(["event-abc"]);
  expect(seen.changed).toBe(2);
  await settle();
  expect(log).toEqual(["join [] leave [type-class]", "join [] leave [type-program]"]);
  // Nothing more to do the next time the app opens.
  leaveRetired(env, n);
  await settle();
  expect(log).toHaveLength(2);
});

test("with notifications off the old list is only forgotten", async () => {
  const { env, log, saved } = phone(
    {},
    { on: false, token: null, lists: ["type-program"], follows: [] },
  );
  leaveRetired(env, screen(env).n);
  await settle();
  expect(saved()?.lists).toEqual([]);
  expect(log).toEqual([]);
});
