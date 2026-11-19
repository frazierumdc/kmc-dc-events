import { expect, test } from "@playwright/test";

// The app can be added to the home screen (EV-22 "feels native"): a web manifest with the
// icons from brand/images, the iPhone icon and start-up images, and theme colours. Every
// file the page names must load.

test("the web manifest names the app and its icons, and each icon loads", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBe("/manifest.webmanifest");
  const manifest = (await (await request.get(href ?? "")).json()) as {
    name: string;
    short_name: string;
    display: string;
    start_url: string;
    icons: { src: string; sizes: string; purpose?: string }[];
  };
  expect([manifest.name, manifest.short_name, manifest.display, manifest.start_url]).toEqual([
    "KMC DC Events",
    "KMC DC Events",
    "standalone",
    "/",
  ]);
  expect(manifest.icons.map((i) => `${i.sizes} ${i.purpose ?? "any"}`)).toEqual([
    "64x64 any",
    "192x192 any",
    "512x512 any",
    "512x512 maskable",
  ]);
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.headers()["content-type"], icon.src).toBe("image/png");
  }
});

test("iPhone gets its icon, home-screen name and a start-up image for every screen", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute(
    "content",
    "KMC DC Events",
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
  const tags = page.locator(
    'link[rel="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-startup-image"]',
  );
  const links: string[] = [];
  for (const tag of await tags.all()) links.push((await tag.getAttribute("href")) ?? "");
  expect(links.filter((l) => l.startsWith("/splash/"))).toHaveLength(44);
  for (const link of links) expect((await request.get(link)).ok(), link).toBe(true);
});

test("Chrome finds nothing stopping it from installing the app", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Only Chrome reports installability");
  await page.goto("/");
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = (await cdp.send("Page.getInstallabilityErrors")) as {
    installabilityErrors: { errorId: string }[];
  };
  expect(installabilityErrors.map((e) => e.errorId)).toEqual([]);
});
