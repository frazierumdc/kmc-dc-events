// Notifications on this phone (D65, NT-10, NT-17 – NT-20): whether they can be on, turning
// them on and off, and the choices kept on the phone. Nothing asks for permission until the
// reader turns the Notifications switch on (NT-10). Firebase's messaging library is downloaded
// only when the Notifications screen opens (owner, D65), and the phone's code joins and leaves its lists through notifyLists.

import { RETIRED_LISTS, type NotifyList } from "@kmcdc/domain";
import type { Follow } from "./follow.ts";

/**
 * What the Notifications screen shows: on or off; refused in the phone's settings (NT-18);
 * iPhone in Safari, where they need the Home Screen app (NT-19); or not possible at all (a
 * stage without notifications, or a browser without web push).
 */
export type NotifyState = "off" | "on" | "refused" | "home-screen" | "unavailable";

/**
 * What the phone keeps (NT-20): whether they are on, its code, the lists chosen (types and
 * events followed), and each followed event's title and when, for Events you follow.
 */
export interface NotifySaved {
  on: boolean;
  token: string | null;
  lists: NotifyList[];
  follows: Follow[];
}

/** The messaging service, once its library is loaded. */
export interface Messenger {
  getToken(): Promise<string>;
  deleteToken(): Promise<void>;
}

/** Everything notifications touch on the phone and the network, so tests can stand in. */
export interface NotifyEnv {
  /** False where the stage has no notifications. */
  configured: boolean;
  /** The browser's permission; null where it has no notifications or web push. */
  permission(): NotificationPermission | null;
  /** Asks the phone, as the reader turned the Notifications switch on. */
  requestPermission(): Promise<NotificationPermission>;
  /** Safari on an iPhone, not the Home Screen app (NT-19). */
  iphoneSafari: boolean;
  read(): NotifySaved | null;
  write(saved: NotifySaved): void;
  /** Downloads the library and starts it; only from the Notifications screen. */
  messenger(): Promise<Messenger>;
  /** notifyLists: its HTTP status. */
  changeLists(body: { token: string; join: NotifyList[]; leave: NotifyList[] }): Promise<number>;
}

export const NOTHING_SAVED: NotifySaved = { on: false, token: null, lists: [], follows: [] };

/** What the screen shows now; read again whenever the app comes back (NT-18). */
export function notifyState(env: NotifyEnv): NotifyState {
  if (!env.configured) return "unavailable";
  if (env.iphoneSafari) return "home-screen";
  const permission = env.permission();
  if (permission === null) return "unavailable";
  if (permission === "denied") return "refused";
  return permission === "granted" && env.read()?.on === true ? "on" : "off";
}

/** Thrown when the network or the messaging service failed; the screen says so. */
export class NotifyError extends Error {}

/** What the screen does when the reader changes something: shown at once (owner, 12 Nov). */
export interface Notifier {
  /** A type's switch, Notify me of changes or Remove (NT-12, NT-13). */
  choose(list: NotifyList, on: boolean, follow?: Follow): void;
  /** Turn off (NT-20). */
  turnOff(): void;
  /**
   * Turn on notifications: asks the phone, and on its yes they are on at once (owner, 12
   * November); the phone's code and its lists follow in the background. Resolves with the
   * state once the phone has answered: "off" when the reader dismissed its question.
   */
  turnOn(): Promise<NotifyState>;
  /**
   * Loads the library as the Notifications screen opens, so turning on doesn't wait for it.
   * Nothing is asked and nothing is sent.
   */
  warm(): void;
}

/**
 * Choices and Turn off show at once: the phone keeps the change straight away and notifyLists
 * hears of it in the background, so no switch waits for the network. Calls for one list go
 * one at a time and the last choice wins; one that fails puts the choice back as the service
 * has it, then calls `changed` and `failed`. `changed` is called whenever the kept choices
 * change.
 *
 * Turn on shows at once too. The phone is on with no code yet, and choices made then are
 * only kept; behind it the library loads, the code is fetched and every kept list is joined,
 * and only then is the code kept. If that fails, notifications go back to off and `failed`
 * is called. A Turn off meanwhile wins: nothing more is joined, and the code is given up.
 */
export function notifier(env: NotifyEnv, changed: () => void, failed: () => void): Notifier {
  const sending = new Map<NotifyList, Promise<void>>();
  let leaving: Promise<void> = Promise.resolve();
  let registering: Promise<void> = Promise.resolve();

  /** Gets the phone's code and joins the kept lists, until they match the reader's choices. */
  async function register(after: Promise<void>) {
    // A Turn off still finishing gives up the old code first, so it can't take the new one.
    // Only the ones before this Turn on: a later Turn off waits for this to end.
    await after;
    try {
      let token: string;
      try {
        token = await (await env.messenger()).getToken();
      } catch (error) {
        throw new NotifyError("No code from the messaging service", { cause: error });
      }
      let has: NotifyList[] = [];
      for (;;) {
        const now = env.read() ?? NOTHING_SAVED;
        // Turned off meanwhile: its own Turn off gives up the code.
        if (!now.on) return;
        const join = now.lists.filter((list) => !has.includes(list));
        const leave = has.filter((list) => !now.lists.includes(list));
        if (join.length + leave.length === 0) {
          env.write({ ...now, token });
          changed();
          return;
        }
        await lists(env, { token, join, leave });
        has = now.lists;
      }
    } catch {
      const now = env.read() ?? NOTHING_SAVED;
      if (now.on && now.token === null) env.write({ ...now, on: false });
      changed();
      failed();
    }
  }

  /** Tells notifyLists until it has the reader's last choice for `list`; `has` is its own. */
  async function send(list: NotifyList, token: string, has: boolean, follow?: Follow) {
    for (;;) {
      const now = env.read() ?? NOTHING_SAVED;
      const wants = now.lists.includes(list);
      if (!now.on || now.token !== token || wants === has) return;
      try {
        await lists(env, { token, join: wants ? [list] : [], leave: wants ? [] : [list] });
      } catch {
        const latest = env.read() ?? NOTHING_SAVED;
        if (latest.on && latest.token === token) env.write(withChoice(latest, list, has, follow));
        changed();
        failed();
        return;
      }
      has = wants;
      follow = now.follows.find((f) => f.list === list);
    }
  }

  return {
    choose(list, on, follow) {
      const saved = env.read() ?? NOTHING_SAVED;
      env.write(withChoice(saved, list, on, follow));
      changed();
      const has = saved.lists.includes(list);
      if (!saved.on || saved.token === null || sending.has(list) || has === on) return;
      const kept = saved.follows.find((f) => f.list === list);
      sending.set(
        list,
        send(list, saved.token, has, kept).finally(() => sending.delete(list)),
      );
    },

    turnOff() {
      const saved = env.read() ?? NOTHING_SAVED;
      env.write({ ...saved, on: false, token: null });
      changed();
      const busy = [...sending.values(), registering];
      leaving = leaving.then(async () => {
        await Promise.allSettled(busy);
        let left = true;
        if (saved.token !== null && saved.lists.length > 0)
          left = await lists(env, { token: saved.token, join: [], leave: saved.lists }).then(
            () => true,
            () => false,
          );
        try {
          await (await env.messenger()).deleteToken();
        } catch {
          // A code that left every list reaches nothing; one that didn't may still be reached.
          if (!left) failed();
        }
      });
    },

    async turnOn() {
      // Asked first, while the tap still counts as the reader's own.
      const answer = await env.requestPermission();
      if (answer === "denied") return "refused";
      if (answer !== "granted") return "off";
      const saved = env.read() ?? NOTHING_SAVED;
      env.write({ ...saved, on: true, token: null });
      changed();
      const after = leaving;
      registering = registering.then(() => register(after));
      return "on";
    },

    warm() {
      void env.messenger().catch(() => undefined);
    },
  };
}

/** `saved` with `list` chosen or not; `follow` names a followed event (NT-17). */
function withChoice(
  saved: NotifySaved,
  list: NotifyList,
  on: boolean,
  follow?: Follow,
): NotifySaved {
  return {
    ...saved,
    lists: [...saved.lists.filter((l) => l !== list), ...(on ? [list] : [])],
    follows: [
      ...saved.follows.filter((f) => f.list !== list),
      ...(on && follow ? [{ list, title: follow.title, detail: follow.detail }] : []),
    ],
  };
}

async function lists(
  env: NotifyEnv,
  body: { token: string; join: NotifyList[]; leave: NotifyList[] },
): Promise<void> {
  let status: number;
  try {
    status = await env.changeLists(body);
  } catch (error) {
    throw new NotifyError("notifyLists didn't answer", { cause: error });
  }
  // 410: the service no longer knows the code, so leaving is already done.
  if (status === 410 && body.join.length === 0) return;
  if (status !== 200) throw new NotifyError(`notifyLists answered ${String(status)}`);
}

/**
 * Forgets a list no phone joins any more and leaves it: a phone that had the two study
 * programs' one switch on starts with both of their own switches off (NT-12).
 */
export function leaveRetired(env: NotifyEnv, notify: Pick<Notifier, "choose">): void {
  const saved = env.read() ?? NOTHING_SAVED;
  for (const list of RETIRED_LISTS) if (saved.lists.includes(list)) notify.choose(list, false);
}
