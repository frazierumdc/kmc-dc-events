import { expect, test } from "vitest";
import { notifyState, type NotifyEnv } from "./notifications.ts";
import { TOKEN, phone, screen, settle, held } from "../../test/notifications.ts";

test("off until the reader turns them on; nothing is asked or loaded before (NT-10)", () => {
  const { env, log } = phone();
  expect(notifyState(env)).toBe("off");
  expect(log).toEqual([]);
});

test("the screen's other states: refused, iPhone in Safari, not possible (NT-18, NT-19)", () => {
  const refused = phone();
  refused.setPermission("denied");
  expect(notifyState(refused.env)).toBe("refused");
  expect(notifyState(phone({ iphoneSafari: true }).env)).toBe("home-screen");
  expect(notifyState(phone({ configured: false }).env)).toBe("unavailable");
  expect(notifyState(phone({ permission: () => null }).env)).toBe("unavailable");
});

test("on only when chosen here and still allowed by the phone", () => {
  const { env, setPermission } = phone({}, { on: true, token: TOKEN, lists: [], follows: [] });
  expect(notifyState(env)).toBe("off");
  setPermission("granted");
  expect(notifyState(env)).toBe("on");
  setPermission("denied");
  expect(notifyState(env)).toBe("refused");
});

// Turn on (owner, 12 November): on its yes the phone shows on at once, and the library, the
// code and the lists follow behind, so the switch never waits for the network.
test("turning on asks the phone and shows on at once; the code and lists follow behind", async () => {
  const calls = held();
  const { env, log, saved } = phone(
    { changeLists: calls.changeLists },
    { on: false, token: null, lists: ["type-class"], follows: [] },
  );
  const { n, seen } = screen(env);
  expect(await n.turnOn()).toBe("on");
  // On already, with no code yet and nothing joined.
  expect(notifyState(env)).toBe("on");
  expect(saved()).toEqual({ on: true, token: null, lists: ["type-class"], follows: [] });
  expect(seen.changed).toBe(1);
  await settle();
  expect(log).toEqual(["asked", "library"]);
  expect(calls.waiting()).toBe(1);
  await calls.answer(200);
  expect(saved()).toEqual({ on: true, token: TOKEN, lists: ["type-class"], follows: [] });
  expect(seen.failed).toBe(0);
});

test("with no lists chosen yet, turning on joins nothing", async () => {
  const { env, log, saved } = phone();
  const { n } = screen(env);
  expect(await n.turnOn()).toBe("on");
  await settle();
  expect(log).toEqual(["asked", "library"]);
  expect(saved()).toEqual({ on: true, token: TOKEN, lists: [], follows: [] });
});

test("the phone's no is kept, and the app asks nothing more (NT-18)", async () => {
  const { env, log, saved } = phone({
    requestPermission: () => Promise.resolve("denied"),
  });
  expect(await screen(env).n.turnOn()).toBe("refused");
  await settle();
  expect(log).toEqual([]);
  expect(saved()).toBeNull();
  const dismissed = phone({ requestPermission: () => Promise.resolve("default") });
  expect(await screen(dismissed.env).n.turnOn()).toBe("off");
  expect(dismissed.saved()).toBeNull();
});

test("a failed code or list call flips back to off and says so, keeping the choices", async () => {
  const noCode = phone({ messenger: () => Promise.reject(new Error("offline")) });
  const first = screen(noCode.env);
  expect(await first.n.turnOn()).toBe("on");
  await settle();
  expect(noCode.saved()).toEqual({ on: false, token: null, lists: [], follows: [] });
  expect(first.seen.failed).toBe(1);
  const down = phone(
    { changeLists: () => Promise.resolve(502) },
    { on: false, token: null, lists: ["type-class"], follows: [] },
  );
  const second = screen(down.env);
  await second.n.turnOn();
  await settle();
  expect(down.saved()).toEqual({ on: false, token: null, lists: ["type-class"], follows: [] });
  expect(second.seen.failed).toBe(1);
});

test("a choice made before the code arrives is joined with the rest", async () => {
  const calls = held();
  const { env, saved } = phone(
    { changeLists: calls.changeLists },
    { on: false, token: null, lists: ["type-class"], follows: [] },
  );
  const sent: unknown[] = [];
  const changeLists = env.changeLists.bind(env);
  env.changeLists = (body) => {
    sent.push([body.join, body.leave]);
    return changeLists(body);
  };
  const { n } = screen(env);
  await n.turnOn();
  await settle();
  // While the first lists are being joined, one more is chosen and one dropped.
  n.choose("type-special", true);
  n.choose("type-class", false);
  await calls.answer(200);
  await calls.answer(200);
  expect(sent).toEqual([
    [["type-class"], []],
    [["type-special"], ["type-class"]],
  ]);
  expect(saved()).toEqual({ on: true, token: TOKEN, lists: ["type-special"], follows: [] });
});

test("turned off before the code arrives: nothing is joined and the code is given up", async () => {
  let give: (m: Awaited<ReturnType<NotifyEnv["messenger"]>>) => void = () => {};
  const { env, log, saved } = phone(
    {},
    { on: false, token: null, lists: ["type-class"], follows: [] },
  );
  const real = env.messenger.bind(env);
  let asked = 0;
  env.messenger = () =>
    asked++ === 0
      ? new Promise((resolve) => {
          give = resolve;
        })
      : real();
  const { n, seen } = screen(env);
  await n.turnOn();
  n.turnOff();
  expect(notifyState(env)).toBe("off");
  // The library is still loading when Turn off is tapped; then it arrives.
  await settle();
  const library = await real();
  give(library);
  for (let i = 0; i < 5; i++) await settle();
  expect(log.filter((l) => l.startsWith("join"))).toEqual([]);
  expect(log.at(-1)).toBe("code given up");
  expect(saved()).toEqual({ on: false, token: null, lists: ["type-class"], follows: [] });
  expect(seen.failed).toBe(0);
});

test("opening the Notifications screen loads the library, asking and sending nothing", async () => {
  const { env, log, saved } = phone();
  screen(env).n.warm();
  await settle();
  expect(log).toEqual(["library"]);
  expect(saved()).toBeNull();
});

test("turning off shows off at once, then leaves every list and gives up the code (NT-20)", async () => {
  const { env, log, saved, setPermission } = phone(
    {},
    { on: true, token: TOKEN, lists: ["type-class", "event-abc"], follows: [] },
  );
  setPermission("granted");
  const { n, seen } = screen(env);
  n.turnOff();
  expect(notifyState(env)).toBe("off");
  expect(seen.changed).toBe(1);
  // The choices stay, so turning on again brings them back.
  expect(saved()).toEqual({
    on: false,
    token: null,
    lists: ["type-class", "event-abc"],
    follows: [],
  });
  await settle();
  expect(log).toEqual(["join [] leave [type-class event-abc]", "library", "code given up"]);
  expect(seen.failed).toBe(0);
});

test("turning off still gives up the code when leaving the lists fails", async () => {
  const { env, log } = phone(
    { changeLists: () => Promise.resolve(502) },
    { on: true, token: TOKEN, lists: ["type-class"], follows: [] },
  );
  const { n, seen } = screen(env);
  n.turnOff();
  await settle();
  expect(log).toEqual(["library", "code given up"]);
  // A code given up reaches nothing, so there is nothing to tell the reader.
  expect(seen.failed).toBe(0);
});

test("turning on again shows on at once, and gets its code only after the old one is given up", async () => {
  const calls = held();
  const { env, log } = phone(
    { changeLists: calls.changeLists },
    { on: true, token: TOKEN, lists: ["type-class"], follows: [] },
  );
  const { n } = screen(env);
  n.turnOff();
  expect(await n.turnOn()).toBe("on");
  expect(notifyState(env)).toBe("on");
  await settle();
  // Still leaving the lists: the new code isn't asked for yet.
  expect(log).toEqual(["asked"]);
  await calls.answer(200);
  expect(log).toEqual(["asked", "library", "code given up", "library"]);
  await calls.answer(200);
  expect(env.read()?.token).toBe(TOKEN);
});
