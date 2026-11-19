// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { fillGetPage } from "./get-page.ts";

const template = readFileSync(new URL("../get-app/index.html", import.meta.url), "utf8");
const page = () =>
  fillGetPage(template, {
    site: "https://events.example.org",
    qr: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29"></svg>',
  });

test("/get-app opens the app first, and is where people add it: its name and manifest for the Home Screen (IN-10)", () => {
  const html = page();
  expect(html).toContain("<title>Get KMC DC Events</title>");
  expect(html).toContain("<h1>KMC DC Events</h1>");
  expect(html).toContain('<meta name="apple-mobile-web-app-title" content="%APP_SHORT_NAME%" />');
  expect(html).toContain("<!-- brand-links -->");
  expect(html).toContain('<script type="module" src="/src/get-main.tsx"></script>');
  expect(html).toContain('aria-label="QR code for events.example.org/get-app"');
  expect(html).toContain('<a class="get-open-btn" href="/">Open the app</a>');
  expect(html).not.toMatch(/About a minute|Start here|Why add it/);
  expect(html).not.toMatch(/%GET_/);
});

test("a shared /get-app link previews with the app's icon (IN-10)", () => {
  const html = page();
  expect(html).toContain(
    '<meta property="og:image" content="https://events.example.org/pwa-512x512.png" />',
  );
  expect(html).toContain('<meta property="og:url" content="https://events.example.org/get-app" />');
  expect(html).toContain('<meta name="twitter:card" content="summary" />');
});

test("/get-app loads nothing from another company's servers (C-10, NFR-5)", () => {
  // The QR code's xmlns is a name, and the preview tags and canonical link are for other
  // sites reading the link, not requests the page makes.
  const html = page()
    .replace('xmlns="http://www.w3.org/2000/svg"', "")
    .replace(/<meta property="og:[^>]*>|<link rel="canonical"[^>]*>/g, "");
  expect(html.match(/(?:src|href)="https?:/g)).toBeNull();
});
