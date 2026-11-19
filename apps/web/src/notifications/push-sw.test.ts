// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, test } from "vitest";

// The service worker's notifications (public/push-sw.js; NT-14, NT-15): every push shows
// one, a later change to an event replaces it, and tapping opens the list at its date.
const source = readFileSync(new URL("../../public/push-sw.js", import.meta.url), "utf8");

interface Shown {
  title: string;
  options: { body: string; tag?: string; data: { url: string } };
}

function worker(
  windows: {
    url: string;
    focus: () => Promise<void>;
    navigate?: (u: string) => Promise<void>;
  }[] = [],
) {
  const listeners: Record<string, (event: unknown) => void> = {};
  const shown: Shown[] = [];
  const opened: string[] = [];
  const waits: Promise<unknown>[] = [];
  const self = {
    location: { origin: "https://events.dev.example.org" },
    addEventListener: (type: string, fn: (event: unknown) => void) => (listeners[type] = fn),
    registration: {
      showNotification: (title: string, options: Shown["options"]) => {
        shown.push({ title, options });
        return Promise.resolve();
      },
    },
    clients: {
      matchAll: () => Promise.resolve(windows),
      openWindow: (url: string) => {
        opened.push(url);
        return Promise.resolve(null);
      },
    },
  };
  runInNewContext(source, { self, URL });
  const fire = async (type: string, event: object) => {
    listeners[type]?.({ ...event, waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
  };
  return { fire, shown, opened };
}

const push = (data: unknown) => ({ data: { json: () => ({ data, from: "1", priority: "high" }) } });
const NOTE = {
  title: "Cancelled: Wednesday Step by Step Meditation",
  body: "Wednesday, November 18, 2026, 7:00 PM Eastern",
  url: "/?day=2026-11-18",
  tag: "5bc3acb9-1372-4bd1-a658-21b6b8276668",
};

test("a message shows as a notification, tagged by its event (NT-14, NT-15)", async () => {
  const { fire, shown } = worker();
  await fire("push", push(NOTE));
  expect(shown).toHaveLength(1);
  expect(shown[0]?.title).toBe(NOTE.title);
  expect(shown[0]?.options).toMatchObject({
    body: NOTE.body,
    tag: NOTE.tag,
    data: { url: NOTE.url },
  });
});

test("every push shows something, as iPhone requires; only the app's own pages open", async () => {
  const { fire, shown } = worker();
  await fire("push", { data: { json: () => ({}) } });
  await fire("push", push({ ...NOTE, url: "https://elsewhere.example/" }));
  await fire("push", push({ ...NOTE, url: "//elsewhere.example/" }));
  expect(shown.map((s) => s.options.data.url)).toEqual(["/", "/", "/"]);
  expect(shown[0]?.title).toBe("KMC DC Events");
});

test("tapping opens the list at the event's date, or brings an open app there (NT-15)", async () => {
  const closed = worker();
  const notification = { close: () => undefined, data: { url: NOTE.url } };
  await closed.fire("notificationclick", { notification });
  expect(closed.opened).toEqual([`https://events.dev.example.org${NOTE.url}`]);

  const went: string[] = [];
  const open = worker([
    {
      url: "https://events.dev.example.org/",
      focus: () => Promise.resolve(),
      navigate: (u) => {
        went.push(u);
        return Promise.resolve();
      },
    },
  ]);
  await open.fire("notificationclick", { notification });
  expect(went).toEqual([`https://events.dev.example.org${NOTE.url}`]);
  expect(open.opened).toEqual([]);
});
