# Brand images

Every image the app uses, generated from one logo picture (D23).

The logo in this repository is a **placeholder**: a calendar page and the words "Events app", drawn for this copy.
The center's own logo is not kept here. A deployment supplies it: put the picture at `source/logo.png` (the same size, the subject where the crop in `generate.ts` expects it, or change `CROP`), regenerate, and build.

| Path | What |
|---|---|
| `source/logo.png` | The logo picture, 4797 × 3200. The only input. Here, the placeholder |
| `generate.ts` | Makes everything in `images/` except the start-up images |
| `startup-images.ts` | Makes the start-up images: screenshots of the app's splash (EV-42) from `apps/web/index.html` and `apps/web/src/splash.css`, so the two match, for each app with its own logo |
| `bands.ts` | The DEV and TEST labels and their colours (D53) |
| `screens.ts` | The iPhone and iPad screens the start-up images are made for |
| `images/` | The output, committed. Don't edit by hand; change `generate.ts` and rerun |

## The logo

The picture's subject in a circle with a maroon ring.
The circle reaches slightly above the picture, so the script extends the sky with a mirrored copy of its top band and deepens the faded sky near the top to match the blue lower down (written for the center's illustration; harmless on the placeholder's plain sky).

## What's in `images/`

| File | Size | Used for |
|---|---|---|
| `logo-circle-1024.png` | 1024 | Master circle, transparent outside |
| `favicon.ico` | 16, 32, 48 | Browser tab |
| `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png` | | Web manifest icons (`purpose: any`) |
| `maskable-icon-512x512.png` | 512 | Android icon shapes; the circle fills the middle 80% (the safe zone) on white |
| `apple-touch-icon-180x180.png` | 180 | iPhone home screen; on white, since iOS adds rounded corners |
| `header-logo.png`, `@2x`, `@3x` | 48 pt | Beside the center's name at the top of the Events screen |
| `splash-logo.png` | 184 pt | The logo on the splash (EV-42) |
| `splash/apple-splash-{light,dark}-W×H.png` | 22 screens × 2 | iPhone and iPad start-up images, portrait, light and dark: pictures of the splash |
| `dev/`, `test/` | | The same icons, splash logo and start-up images with a green **DEV** or blue **TEST** label, for the dev and test apps (D53); the real app's have none |
| `head-links.html` | | The `<link>` tags for the app's `<head>` (favicon, iPhone icon, start-up images with their media queries) |
| `manifest-icons.json` | | The `icons` array for the web manifest |

The app takes these straight from here: `apps/web/brand-assets.ts` puts the icons at the site root and the start-up images under `/splash/` (the `dev/` or `test/` ones in a build with `APP_ENV=dev` or `test`), the splash's logo in `index.html` from the same folder, and `head-links.html`'s tags in `index.html`; the web manifest's icons come from `manifest-icons.json`.
Regenerating is all it takes to change them in the app.

PNGs are saved as 8-bit palette images (about a quarter of the size, no visible loss), except the master and the start-up images, whose sky gradient would band.

## Regenerate

From the repository root:

```sh
pnpm install
pnpm --filter @kmcdc/brand generate
```

Takes about a minute: the start-up images are taken in Playwright's Chromium (`pnpm --filter @kmcdc/e2e exec playwright install chromium` once).
Run it again after changing the splash.
To add a new iPhone or iPad, add its CSS size and pixel ratio to `SCREENS` in `screens.ts`.
