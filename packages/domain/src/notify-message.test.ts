import { expect, test } from "vitest";
import { fcmSend, MAX_TTL_SECONDS } from "./notify-message.ts";

// A notification to one list (NT-14 – NT-16): data only, replaced by the event's later
// change, and waiting for a phone that is off until the event starts.
const note = {
  title: "Cancelled: Wednesday Step by Step Meditation",
  body: "Wednesday, November 18, 2026, 7:00 PM Eastern",
  url: "/e/5bc3acb9-1372-4bd1-a658-21b6b8276668",
  tag: "5bc3acb9-1372-4bd1-a658-21b6b8276668",
};
const now = new Date("2026-11-12T12:00:00Z");

test("one list, data only, waiting until the event starts (NT-16)", () => {
  expect(fcmSend("class-c_0EP710PSBWX9", note, new Date("2026-11-13T00:00:00Z"), now)).toEqual({
    message: {
      topic: "class-c_0EP710PSBWX9",
      webpush: { headers: { TTL: "43200", Urgency: "high" }, data: note },
    },
  });
});

test("never less than a minute, never more than web push's 4 weeks", () => {
  const ttl = (expires: string) =>
    fcmSend("type-class", note, new Date(expires), now).message.webpush.headers.TTL;
  expect(ttl("2026-11-12T11:00:00Z")).toBe("60");
  expect(ttl("2027-06-01T00:00:00Z")).toBe(String(MAX_TTL_SECONDS));
});

test("several lists are one condition, so a phone on two gets it once (NT-14)", () => {
  const body = fcmSend(
    ["type-class", "class-c_0EP710PSBWX9", "event-5bc3acb9"],
    note,
    new Date("2026-11-13T00:00:00Z"),
    now,
  );
  expect(body.message).toMatchObject({
    condition:
      "'type-class' in topics || 'class-c_0EP710PSBWX9' in topics || 'event-5bc3acb9' in topics",
  });
  expect("topic" in body.message).toBe(false);
  expect(fcmSend(["type-class"], note, now, now).message).toMatchObject({ topic: "type-class" });
  expect(() => fcmSend([], note, now, now)).toThrow("1 – 5 lists");
});
