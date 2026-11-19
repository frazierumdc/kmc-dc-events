import { expect, test } from "vitest";
import { escapeHtml } from "./html.ts";

test("escapes the four characters, every time they appear, the ampersand first", () => {
  expect(escapeHtml(`<a href="x">Tom & Jerry</a> & "more" &amp;`)).toBe(
    "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&lt;/a&gt; &amp; &quot;more&quot; &amp;amp;",
  );
  expect(escapeHtml("plain text, it's fine")).toBe("plain text, it's fine");
});
