// iPhone and iPad start-up images: screenshots of the app's own splash (EV-42), taken from
// apps/web/index.html and apps/web/src/splash.css, so the picture iPhone shows while the app
// opens is exactly the splash the app then draws, with nothing jumping between the two.
//
//   pnpm --filter @kmcdc/brand generate      (runs generate.ts, then this)
//
// Output: images/splash/apple-splash-{light,dark}-W×H.png, for every screen in screens.ts, and
// the same in images/dev/splash/ and images/test/splash/ with those apps' labelled logos.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { BANDS } from "./bands.ts";
import { SCREENS } from "./screens.ts";

const HTML = "../apps/web/index.html";
const CSS = "../apps/web/src/splash.css";
const html = await readFile(HTML, "utf8");
const start = html.indexOf('<div\n      id="splash"');
const end = html.indexOf('<div id="root">');
if (start < 0 || end < 0) throw new Error("No splash found in apps/web/index.html");
const css = await readFile(CSS, "utf8");

const browser = await chromium.launch();
// The real app's images, then each labelled app's, from its own logo.
for (const dir of ["images", ...Object.keys(BANDS).map((band) => `images/${band}`)]) {
  const splash = html
    .slice(start, end)
    .replace(
      "../../brand/images/splash-logo.png",
      `data:image/png;base64,${(await readFile(`${dir}/splash-logo.png`)).toString("base64")}`,
    );
  // data-still: the dots as the animation starts.
  const page = `<!doctype html><html data-still><head><meta charset="utf-8"><style>${css}
html, body { margin: 0; }</style></head><body>${splash}</body></html>`;
  await mkdir(`${dir}/splash`, { recursive: true });
  for (const [w, h, dpr] of SCREENS) {
    for (const theme of ["light", "dark"] as const) {
      const context = await browser.newContext({
        viewport: { width: w, height: h },
        deviceScaleFactor: dpr,
        colorScheme: theme,
      });
      const tab = await context.newPage();
      await tab.setContent(page, { waitUntil: "load" });
      await tab.waitForFunction("document.querySelector('.splash-logo').complete");
      const png = await tab.screenshot();
      const file = `${dir}/splash/apple-splash-${theme}-${String(w * dpr)}x${String(h * dpr)}.png`;
      // Full colour: the sky's gradient bands as a palette image.
      await writeFile(file, await sharp(png).png({ compressionLevel: 9, effort: 10 }).toBuffer());
      await context.close();
    }
  }
  console.log(`Wrote ${String(SCREENS.length * 2)} start-up images in ${dir}/splash/.`);
}
await browser.close();
