import { expect, test } from "vitest";
import { listenLive, liveVersion, type LiveSource } from "./live-version.ts";

// The live connection (NT-1): the database's messages, read for the version alone.

/** A stand-in for EventSource that the test sends messages through. */
function fakeSource() {
  const listeners = new Map<string, (event: { data: string }) => void>();
  const opened: string[] = [];
  let closed = 0;
  const source: LiveSource = {
    addEventListener: (type, listener) => listeners.set(type, listener),
    close: () => {
      closed++;
    },
  };
  return {
    open: (url: string) => {
      opened.push(url);
      return source;
    },
    send: (type: string, data: string) => listeners.get(type)?.({ data }),
    opened,
    closed: () => closed,
  };
}

test("reads the version from a message for the record itself", () => {
  expect(liveVersion('{"path":"/","data":"abc123"}')).toBe("abc123");
});

test("anything else carries no version", () => {
  expect(liveVersion('{"path":"/","data":null}')).toBeNull();
  expect(liveVersion('{"path":"/","data":""}')).toBeNull();
  expect(liveVersion('{"path":"/other","data":"abc"}')).toBeNull();
  expect(liveVersion('{"path":"/","data":{"version":"abc"}}')).toBeNull();
  expect(liveVersion("null")).toBeNull();
  expect(liveVersion("not json")).toBeNull();
});

test("tells each version heard, and stops when asked", () => {
  const fake = fakeSource();
  const heard: string[] = [];
  const stop = listenLive("https://db.example/live/version.json", (v) => heard.push(v), fake.open);
  expect(fake.opened).toEqual(["https://db.example/live/version.json"]);
  fake.send("put", '{"path":"/","data":"v1"}');
  fake.send("keep-alive", "null");
  fake.send("put", '{"path":"/","data":"v2"}');
  expect(heard).toEqual(["v1", "v2"]);
  stop();
  expect(fake.closed()).toBe(1);
});

test("no address, or a browser without EventSource: nothing opens", () => {
  const fake = fakeSource();
  listenLive("", () => undefined, fake.open)();
  listenLive("https://db.example/x.json", () => undefined, null)();
  expect(fake.opened).toEqual([]);
});

test("a source that can't open never breaks the app", () => {
  const stop = listenLive(
    "https://db.example/x.json",
    () => undefined,
    () => {
      throw new Error("blocked");
    },
  );
  expect(stop).not.toThrow();
});
