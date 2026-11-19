import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { eventPages, withHead } from "./event-pages.ts";
import { golden } from "../test/schedule.ts";

// Each event's own page (EV-35, EV-37): the app's page, naming the event for link previews.

const ORIGIN = "https://your-project-id-dev.web.app";
const html = readFileSync(
  path.resolve(import.meta.dirname, "../../../apps/web/index.html"),
  "utf8",
);

test("one page per event, at e/{id}/index.html, with its title, when and where", () => {
  const pages = eventPages(html, golden.snapshot, ORIGIN);
  expect(pages.size).toBe(golden.snapshot.events.length);
  const page = pages.get("e/4e19342f-344f-43e2-b641-676ce1a90a30/index.html") ?? "";
  expect(page).toContain("<title>Tuesday Rest and Reflect</title>");
  expect(page).toContain(
    '<meta name="description" content="Tue, Oct 13, 2026 · 6:00 – 6:30 PM Eastern · KMC DC" />',
  );
  expect(page).toContain('<meta property="og:title" content="Tuesday Rest and Reflect" />');
  expect(page).toContain(
    `<meta property="og:url" content="${ORIGIN}/e/4e19342f-344f-43e2-b641-676ce1a90a30" />`,
  );
  expect(page).toContain(
    `<meta property="og:image" content="${ORIGIN}/e/4e19342f-344f-43e2-b641-676ce1a90a30/share.png" />`,
  );
  expect(page).toContain(
    '<meta property="og:image:alt" content="Tuesday Rest and Reflect. Tue, Oct 13, 2026 · 6:00 – 6:30 PM Eastern · KMC DC" />',
  );
  expect(page).toContain('<meta property="og:site_name" content="Kadampa Meditation Center DC" />');
  // Still the app: the same script.
  expect(page).toContain('<script type="module" src="/src/main.tsx"></script>');
  expect(page.match(/<title>/g)).toHaveLength(1);
});

test("the website's words can't break the page", () => {
  const page = withHead(html, {
    title: 'Talk & Q&A: "Joy" <now>',
    description: "a < b",
    url: `${ORIGIN}/e/x`,
    image: `${ORIGIN}/og.png`,
    siteName: "KMC DC",
  });
  expect(page).toContain('<title>Talk &amp; Q&amp;A: "Joy" &lt;now&gt;</title>');
  expect(page).toContain(
    '<meta property="og:title" content="Talk &amp; Q&amp;A: &quot;Joy&quot; &lt;now&gt;" />',
  );
});

test("a page without a title to replace stops the publish", () => {
  expect(() =>
    withHead("<html><head></head></html>", {
      title: "x",
      description: "y",
      url: "u",
      image: "i",
      siteName: "s",
    }),
  ).toThrow(/no <title>/);
});
