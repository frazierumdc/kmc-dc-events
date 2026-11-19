import { expect, test } from "vitest";
import { buildMime } from "./mime.ts";

const message = {
  from: "KMC DC Events App <app@example.com>",
  to: ["one@example.com", "two@example.com"],
  subject: "[KMC DC app] 3 changes",
  text: "Plain text",
  html: "<p>HTML</p>",
};
const options = { boundary: "BOUNDARY", date: new Date("2026-10-08T12:00:00Z") };

/** The decoded body of each part, in order. */
function bodies(mime: string): string[] {
  return mime
    .split("--BOUNDARY")
    .slice(1, -1)
    .map((part) => {
      const [, body = ""] = part.split("\r\n\r\n");
      return Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8");
    });
}

test("builds headers and a plain-text and HTML version", () => {
  const mime = buildMime(message, options);
  expect(mime).toContain("From: KMC DC Events App <app@example.com>\r\n");
  expect(mime).toContain("To: one@example.com, two@example.com\r\n");
  expect(mime).toContain("Subject: [KMC DC app] 3 changes\r\n");
  expect(mime).toContain("Date: Thu, 08 Oct 2026 12:00:00 GMT\r\n");
  expect(mime).toContain('Content-Type: multipart/alternative; boundary="BOUNDARY"');
  expect(bodies(mime)).toEqual(["Plain text", "<p>HTML</p>"]);
});

test("encodes a subject and body that aren't plain ASCII", () => {
  const mime = buildMime(
    { ...message, subject: "Retreat in Málaga — 2 changes", text: "Málaga" },
    options,
  );
  const encoded = Buffer.from("Retreat in Málaga — 2 changes", "utf8").toString("base64");
  expect(mime).toContain(`Subject: =?UTF-8?B?${encoded}?=\r\n`);
  expect(bodies(mime)[0]).toBe("Málaga");
});

test("text only when there's no HTML", () => {
  const mime = buildMime({ ...message, html: undefined }, options);
  expect(mime).not.toContain("multipart");
  expect(mime).toContain("Content-Type: text/plain; charset=UTF-8");
});

test("refuses line breaks in headers and an empty recipient list", () => {
  expect(() => buildMime({ ...message, subject: "Hi\r\nBcc: x@example.com" })).toThrow();
  expect(() => buildMime({ ...message, to: [] })).toThrow();
});

test("adds a Bcc header for hidden recipients", () => {
  const mime = buildMime(
    { ...message, to: ["app@example.com"], bcc: ["a@example.com", "b@example.com"] },
    options,
  );
  expect(mime).toContain("To: app@example.com\r\nBcc: a@example.com, b@example.com\r\n");
});
