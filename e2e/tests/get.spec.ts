import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// The page for people new to the app, /get-app (IN-10): Open the app first, then the steps to add
// it, as Settings shows them. vite preview needs the slash; Hosting serves /get-app itself.

test("/get-app shows Open the app, then Settings' steps for this phone, from this site only (IN-10)", async ({
  page,
  baseURL,
}, info) => {
  const outside: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith(baseURL ?? "")) outside.push(r.url());
  });
  await page.goto("/get-app/");
  await expect(page.getByRole("heading", { level: 1, name: "KMC DC Events" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the app" })).toBeVisible();
  const home = info.project.name === "android" ? "home screen" : "Home Screen";
  await expect(
    page.getByRole("heading", { level: 2, name: `Add it to your ${home}` }),
  ).toBeVisible();
  await expect(page.getByText(`The app works best from your ${home}.`)).toBeVisible();
  await expect(page.getByText("Classes and events at KMC DC", { exact: true })).toBeVisible();
  // The headline and the highlight each on one line, never cut off, also with the phone's
  // larger text sizes (owner): the text's own width fits inside its box.
  const fits = (selector: string) =>
    page.evaluate(`(() => {
      const e = document.querySelector(${JSON.stringify(selector)});
      const css = getComputedStyle(e);
      const room = e.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
      const range = document.createRange();
      range.selectNodeContents(e);
      return range.getBoundingClientRect().width <= room + 0.5;
    })()`);
  for (const size of [null, "24px"]) {
    if (size) await page.evaluate(`document.documentElement.style.fontSize = "${size}"`);
    for (const selector of [".get-tagline", "#get-best"])
      expect(await fits(selector), `${selector} at ${size ?? "the default size"}`).toBe(true);
  }
  // And on the narrowest phone, 320 points wide.
  await page.setViewportSize({ width: 320, height: 640 });
  for (const selector of [".get-tagline", "#get-best"])
    expect(await fits(selector), `${selector} at 320 points`).toBe(true);
  await expect(page.getByText(/in the app to see these steps again/)).toBeVisible();
  await expect(page.getByRole("img", { name: "Settings" })).toBeVisible();
  const taps = info.project.name === "android" ? 3 : 5;
  await expect(page.locator(".ui-steps > li, .ui-play-row")).toHaveCount(taps);
  // No count of taps, no time, no pointer at the browser's bar.
  await expect(page.getByText(/taps|About a minute|Start here/)).toHaveCount(0);
  // The QR code is for computers only.
  await expect(page.getByRole("img", { name: /QR code/ })).toBeHidden();
  // The menu picture's faded row, and Safari's blue Add and the page's address in the last
  // picture, are parts of pictures in Apple's own colours (WCAG 1.4.3, text in a picture).
  const { violations } = await new AxeBuilder({ page })
    .exclude(".ui-pic-row[data-dim]")
    .exclude(".ui-pic-add")
    .exclude(".ui-pic-field small")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
  ).toEqual([]);
  expect(outside).toEqual([]);
});

test("Not what you see? on /get-app picks Safari's bar, as in Settings (IN-4, IN-10)", async ({
  page,
}, info) => {
  test.skip(info.project.name === "android", "Safari only");
  await page.goto("/get-app/");
  await page.getByRole("button", { name: "Not what you see?" }).click();
  await page.getByRole("radio", { name: "A Share button in the bar" }).click();
  await expect(page.locator(".ui-steps > li")).toHaveCount(4);
  expect(await page.evaluate(() => localStorage.getItem("kmcdc.safariGuide"))).toBe("share-bar");
});

test("Open the app, the first thing on /get-app, opens the app (IN-10)", async ({ page }) => {
  await page.goto("/get-app/");
  await page.getByRole("link", { name: "Open the app" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
});

test("on a computer /get-app leads with the QR code for this page (IN-10)", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  await page.goto("http://localhost:4173/get-app/");
  await expect(page.getByRole("img", { name: /QR code for .*\/get-app/ })).toBeVisible();
  await expect(page.locator(".ui-steps")).toHaveCount(0);
  await context.close();
});

test.describe("Safari on iOS 27", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1",
  });

  test("the Page Menu steps; a picked bar is remembered (IN-3, IN-4, IN-5, IN-10)", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "iphone", "iPhone's Safari");
    await page.goto("/get-app/");
    await expect(page.getByText("Safari on iOS 27")).toBeVisible();
    await expect(page.locator(".ui-play-row").nth(2)).toContainText("Tap View More");
    await expect(page.getByRole("img", { name: "Page Menu" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Not what you see?" }).click();
    await page.getByRole("radio", { name: "Round buttons, with More at the right" }).click();
    await expect(page.getByText("Safari on iOS 26")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Safari on iOS 26")).toBeVisible();
  });

  test("the steps fit one screen and play by themselves; Pause holds, a tap shows the next (IN-10)", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "iphone", "iPhone's Safari");
    await page.setViewportSize({ width: 393, height: 659 });
    await page.goto("/get-app/");
    const rows = page.locator(".ui-play-row");
    await expect(rows).toHaveCount(5);
    // Everything down to the scene on the first screen, with no sideways scroll.
    const fits = await page.evaluate(`(() => {
      const scene = document.querySelector(".ui-play-scene").getBoundingClientRect();
      return scene.bottom <= innerHeight && document.documentElement.scrollWidth <= innerWidth;
    })()`);
    expect(fits).toBe(true);
    // It starts on step 1 and moves on by itself.
    await expect(rows.nth(0)).toHaveAttribute("aria-current", "step");
    await expect(rows.nth(1)).toHaveAttribute("aria-current", "step", { timeout: 8000 });
    // Pause holds the step; its button is a full-size target.
    const pause = page.getByRole("button", { name: "Pause" });
    const box = await pause.boundingBox();
    expect(Math.min(box?.width ?? 0, box?.height ?? 0)).toBeGreaterThanOrEqual(44);
    await pause.click();
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
    await page.waitForTimeout(5000);
    await expect(rows.nth(1)).toHaveAttribute("aria-current", "step");
    // A tap on the scene shows the next step, and after the last, the Home Screen.
    const next = page.getByRole("button", { name: "Next step" });
    for (const n of [2, 3, 4]) {
      await next.click();
      await expect(rows.nth(n)).toHaveAttribute("aria-current", "step");
    }
    await next.click();
    await expect(page.locator(".ui-play-home")).toHaveAttribute("data-on", "true");
    await expect(page.locator(".ui-play-row[aria-current]")).toHaveCount(0);
    // Stopped at the end, the button says Replay and starts again at step 1.
    await page.getByRole("button", { name: "Replay" }).click();
    await expect(rows.nth(0)).toHaveAttribute("aria-current", "step");
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  });

  test("with Reduce Motion nothing plays: no Pause, a tap shows the next step (IN-10)", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "iphone", "iPhone's Safari");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/get-app/");
    const rows = page.locator(".ui-play-row");
    await expect(rows.nth(0)).toHaveAttribute("aria-current", "step");
    await expect(page.getByRole("button", { name: /Pause|Play/ })).toHaveCount(0);
    await page.waitForTimeout(5500);
    await expect(rows.nth(0)).toHaveAttribute("aria-current", "step");
    await page.getByRole("button", { name: "Next step" }).click();
    await expect(rows.nth(1)).toHaveAttribute("aria-current", "step");
  });

  for (const scheme of ["light", "dark"] as const)
    test(`no WCAG 2.2 AA problems on /get-app or its chooser, ${scheme}`, async ({
      page,
    }, info) => {
      test.skip(info.project.name !== "iphone", "iPhone's Safari");
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/get-app/");
      const check = async () =>
        (
          await new AxeBuilder({ page })
            .exclude(".ui-pic-row[data-dim]")
            .exclude(".ui-pic-add")
            .exclude(".ui-pic-field small")
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations.map((v) => v.id);
      expect(await check()).toEqual([]);
      await page.getByRole("button", { name: "Not what you see?" }).click();
      await expect(page.getByRole("radiogroup")).toBeVisible();
      expect(await check()).toEqual([]);
    });
});
