import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// The splash (EV-42) in the real build: 3 seconds over the app, which loads behind it; a
// shared event's link opens with none. Other specs run with it off (index.html).
const golden = (name: string) =>
  readFileSync(new URL(`../../packages/domain/golden/${name}`, import.meta.url), "utf8");
const manifest = golden("manifest-v2.json");
const snapshotPath = (JSON.parse(manifest) as { snapshots: { "2": string } }).snapshots["2"];

async function serveFeed(page: Page) {
  await page.route("**/v2/feed/manifest.json", (route) => route.fulfill({ body: manifest }));
  await page.route(`**${snapshotPath}`, (route) =>
    route.fulfill({ body: golden("snapshot-v2.json") }),
  );
  await page.route("**/v2/feed/latest.json", (route) =>
    route.fulfill({ body: golden("snapshot-v2.json") }),
  );
}

test.beforeEach(async ({ page }) => {
  // The saved schedule's date, as in the Events specs, so it always has events to come; the
  // clock still runs, for the splash's 3 seconds.
  await page.clock.setSystemTime(new Date("2026-10-13T12:00:00Z"));
  await page.addInitScript(() => {
    localStorage.setItem("kmcdc.splash", "on");
  });
  await serveFeed(page);
});

test("the splash shows for 3 seconds while the list loads behind it, then fades (EV-42)", async ({
  page,
}) => {
  const started = Date.now();
  await page.goto("/");
  const splash = page.getByRole("img", { name: "Kadampa Meditation Center DC. Everyone Welcome." });
  await expect(splash).toBeVisible();
  await expect(page.locator(".splash-welcome")).toHaveText("Everyone Welcome");
  // The list is ready behind it well before the 3 seconds are up.
  await expect(page.locator(".ui-row").first()).toBeAttached({ timeout: 2_000 });
  await expect(page.locator("#root")).toHaveJSProperty("inert", true);
  await expect(splash).toBeHidden({ timeout: 7_000 });
  expect(Date.now() - started).toBeGreaterThanOrEqual(3_400);
  await expect(page.locator("#root")).toHaveJSProperty("inert", false);
  await expect(page.locator(".ui-row").first()).toBeVisible();
});

test("a tap takes the splash away at once (EV-42)", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ui-row").first()).toBeAttached();
  await page.locator("#splash").click();
  await expect(page.locator("#splash")).toBeHidden({ timeout: 1_000 });
});

test("a shared event's link opens with no splash (EV-42)", async ({ page }) => {
  await page.goto("/e/some-event");
  await expect(page.locator("#splash")).toBeHidden();
});

test("/get-app's Open the app opens the app with its welcome; Back to the app with none (EV-42, IN-10)", async ({
  page,
}) => {
  // vite preview needs the slash; Hosting serves /get-app itself.
  await page.goto("/get-app/");
  await page.getByRole("link", { name: "Open the app" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#splash")).toBeVisible();
  await page.goto("/get-app/", { referer: "http://localhost:4173/" });
  await page.getByRole("link", { name: "‹ Back to the app" }).click();
  await expect(page).toHaveURL(/\/$/);
  // Gone at once, not after its 3 seconds.
  await expect(page.locator("#splash")).toBeHidden({ timeout: 1_000 });
});

test("featured posters: the picture's frame, the dots and Register stay where they are from one event to the next (EV-44)", async ({
  page,
}) => {
  // The Home Screen app's screen on an iPhone 15, under its status bar.
  await page.setViewportSize({ width: 390, height: 797 });
  interface Listed {
    id: string;
    title: string;
    start: string;
    end: string | null;
    picture: string | null;
  }
  const snapshot = JSON.parse(golden("snapshot-v2.json")) as {
    events: Listed[];
    featured?: string[];
  };
  const [first, second] = snapshot.events.filter((e) => e.start > "2026-10-14");
  if (!first || !second) throw new Error("The saved schedule has no two events to come.");
  first.picture = "https://static.wixstatic.com/media/first.jpg";
  second.picture = "https://static.wixstatic.com/media/second.jpg";
  // The second has more words: a longer title, and it ends the day after.
  first.title = "Special Sunday Morning Meditation";
  second.title = "Sample Retreat: A Quiet Weekend of Meditation with Guest Teacher G. Example";
  second.end = `${new Date(Date.parse(second.start) + 30 * 3_600_000).toISOString().slice(0, 19)}Z`;
  snapshot.featured = [first.id, second.id];
  const body = JSON.stringify(snapshot);
  await page.route(`**${snapshotPath}`, (route) => route.fulfill({ body }));
  await page.route("**/v2/feed/latest.json", (route) => route.fulfill({ body }));

  const picture = readFileSync(new URL("../../brand/images/pwa-192x192.png", import.meta.url));
  await page.route("**/v2/feed/pictures/*-story.jpg", (route) =>
    route.fulfill({ body: picture, contentType: "image/png" }),
  );

  await page.goto("/");
  const posters = page.getByRole("dialog", { name: "Featured events" });
  await expect(posters).toBeVisible({ timeout: 7_000 });
  await posters.getByRole("button", { name: "Pause" }).click();
  // Every event's picture is there from the start, so none has to load when its turn comes.
  await expect(posters.locator(".ui-poster-pic")).toHaveCount(2);
  const places = async () => ({
    picture: await posters.locator(".ui-poster-media").boundingBox(),
    dots: await posters.locator(".ui-poster-dots").boundingBox(),
    register: await posters.getByRole("link", { name: "Register" }).boundingBox(),
    all: await posters.getByRole("button", { name: "See all events" }).boundingBox(),
  });
  await expect(posters.getByRole("heading", { name: first.title })).toBeVisible();
  const before = await places();
  await posters.press("ArrowRight");
  await expect(posters.getByRole("heading", { name: second.title })).toBeVisible();
  expect(await places()).toEqual(before);
  // Pause has a row of its own beside the dots: the whole 44 pt button sits between the words
  // and Register, with room on both sides (Apple: 44 pt and space around a button).
  const pause = await posters.getByRole("button", { name: "Play" }).boundingBox();
  const where = await posters.locator(".ui-poster-text[data-on] .ui-poster-where").boundingBox();
  if (!pause || !where || !before.register)
    throw new Error("Pause, the place or Register is missing.");
  expect(pause.width).toBe(44);
  expect(pause.height).toBe(44);
  expect(pause.y).toBeGreaterThanOrEqual(where.y + where.height + 8);
  expect(before.register.y).toBeGreaterThanOrEqual(pause.y + pause.height + 8);
  // The template (option C): a set of events with fewer words puts everything in the same
  // places; here the first event alone has a short title and a one-line when.
  const lines = async (words: string) => {
    const height = (await posters.locator(words).first().boundingBox())?.height ?? 0;
    const line = await page.evaluate<string>(
      `getComputedStyle(document.querySelector("${words}")).lineHeight`,
    );
    return Math.round(height / parseFloat(line));
  };
  expect(await lines(".ui-poster-title")).toBe(3);
  expect(await lines(".ui-poster-when")).toBe(2);
  // All of it fits the screen: nothing to scroll to.
  await expect(posters.getByRole("button", { name: "See all events" })).toBeInViewport({
    ratio: 1,
  });
});
