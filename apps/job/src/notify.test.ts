import { expect, test } from "vitest";
import { MAX_NOTICES, type FcmSend, type Notice } from "@kmcdc/domain";
import { sendNotices } from "./notify.ts";

// Sending after a publish (D65): each notice once; a failure is said and the rest still go;
// a burst larger than MAX_NOTICES sends none, in case the website was read short.
const notice = (n: number): Notice => ({
  kind: n % 2 === 0 ? "cancelled" : "moved",
  eventId: `e${String(n)}`,
  title: `Event ${String(n)}`,
  lists: ["type-class", `event-e${String(n)}`],
  send: { message: { topic: `event-e${String(n)}` } } as unknown as FcmSend,
});

test("each notice is sent once and said in the log", async () => {
  const sent: FcmSend[] = [];
  const log: string[] = [];
  const count = await sendNotices(
    [notice(0), notice(1)],
    (body) => {
      sent.push(body);
      return Promise.resolve("projects/p/messages/1");
    },
    (line) => log.push(line),
  );
  expect(count).toBe(2);
  expect(sent).toHaveLength(2);
  expect(log).toEqual([
    "Notified Cancelled: Event 0 (type-class, event-e0)",
    "Notified New time: Event 1 (type-class, event-e1)",
  ]);
});

test("a failed send is said, and the rest still go", async () => {
  const log: string[] = [];
  const count = await sendNotices(
    [notice(0), notice(1)],
    (body) =>
      "topic" in body.message && body.message.topic === "event-e0"
        ? Promise.reject(new Error("Firebase said no"))
        : Promise.resolve("ok"),
    (line) => log.push(line),
  );
  expect(count).toBe(1);
  expect(log[0]).toBe("Not notified Cancelled: Event 0 (type-class, event-e0): Firebase said no");
});

test(`more than ${String(MAX_NOTICES)} at once send none, and say why`, async () => {
  const log: string[] = [];
  let calls = 0;
  const many = Array.from({ length: MAX_NOTICES + 1 }, (_, i) => notice(i));
  expect(
    await sendNotices(
      many,
      () => {
        calls++;
        return Promise.resolve("ok");
      },
      (line) => log.push(line),
    ),
  ).toBe(0);
  expect(calls).toBe(0);
  expect(log[0]).toContain("none sent, in case the website was read short");
  expect(
    await sendNotices(
      many.slice(0, MAX_NOTICES),
      () => Promise.resolve("ok"),
      () => {},
    ),
  ).toBe(MAX_NOTICES);
});
