import { notifier, type NotifyEnv, type NotifySaved } from "../src/notifications/notifications.ts";

// Shared by the tests split from notifications.test.ts.

// Notifications on this phone (D65, NT-10, NT-17 – NT-20): nothing asks until the reader
// taps, the phone's code joins the chosen lists, and turning off leaves them.
export const TOKEN = "fK3x9AbC_dEf:APA91bH-0123456789abcdefABCDEF";

export function phone(over: Partial<NotifyEnv> = {}, saved: NotifySaved | null = null) {
  const log: string[] = [];
  let kept = saved;
  let permission: NotificationPermission = "default";
  const env: NotifyEnv = {
    configured: true,
    permission: () => permission,
    requestPermission: () => {
      log.push("asked");
      permission = "granted";
      return Promise.resolve(permission);
    },
    iphoneSafari: false,
    read: () => kept,
    write: (next) => {
      kept = next;
    },
    messenger: () => {
      log.push("library");
      return Promise.resolve({
        getToken: () => Promise.resolve(TOKEN),
        deleteToken: () => {
          log.push("code given up");
          return Promise.resolve();
        },
      });
    },
    changeLists: (body) => {
      log.push(`join [${body.join.join(" ")}] leave [${body.leave.join(" ")}]`);
      return Promise.resolve(200);
    },
    ...over,
  };
  return {
    env,
    log,
    saved: () => kept,
    setPermission: (p: NotificationPermission) => (permission = p),
  };
}

// Choices and Turn off show at once; notifyLists hears in the background (owner, 12 Nov).
/** A notifier whose changes and failures are counted. */
export function screen(env: NotifyEnv) {
  const seen = { changed: 0, failed: 0 };
  const n = notifier(
    env,
    () => seen.changed++,
    () => seen.failed++,
  );
  return { n, seen };
}

/** Lets the background calls run. */
export const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** notifyLists calls that wait until the test answers them, in order. */
export function held() {
  const answers: ((status: number) => void)[] = [];
  return {
    changeLists: () =>
      new Promise<number>((resolve) => {
        answers.push(resolve);
      }),
    answer: async (status: number) => {
      answers.shift()?.(status);
      await settle();
    },
    waiting: () => answers.length,
  };
}
