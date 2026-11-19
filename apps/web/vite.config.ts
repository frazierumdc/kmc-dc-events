/// <reference types="vitest/config" />
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { brandAssets, manifestIcons } from "./brand-assets.ts";
import { buildConfig } from "./build-config.ts";
import { CAPTURE_FILE, websiteFeedDevServer } from "./feed-dev-server.ts";
import { fillGetPage } from "./src/get-page.ts";
import { privacyPage } from "./src/privacy-page.ts";

// The deploy sets BUILD_ID; local builds show "local". KILL_SWITCH=1 builds the app with the
// kill-switch service worker instead of the real one (docs/workflow/runbooks.md).
const config = buildConfig();
const { buildId, killSwitch } = config;
// The home-screen name is "KMC DC Events" on every site; the dev and test sites' apps have
// DEV or TEST on their logo (icons and splash) and "(dev)" or "(test)" in their full name, so
// they can sit beside the real one (D53).
const env = config.appEnv;
const name = env === "prod" ? "KMC DC Events" : `KMC DC Events (${env})`;
const shortName = "KMC DC Events";

export default defineConfig({
  plugins: [
    react(),
    websiteFeedDevServer(CAPTURE_FILE),
    brandAssets({ env, shortName }),
    emitPrivacyPage(),
    getPageHtml(config.site),
    killSwitch
      ? emitKillSwitch()
      : VitePWA({
          // The app registers the worker itself (src/app-update.ts).
          injectRegister: false,
          registerType: "prompt",
          manifest: {
            id: "/",
            name,
            short_name: shortName,
            description: "Classes, retreats and chanted prayers at Kadampa Meditation Center DC.",
            lang: "en",
            start_url: "/",
            scope: "/",
            display: "standalone",
            // The light theme's bars; the background is the splash's sky (EV-42), behind
            // Android's own start-up icon.
            theme_color: "#f9f9f9",
            background_color: "#eef6fd",
            icons: manifestIcons(),
          },
          workbox: {
            // The app's own files only; the schedule lives in IndexedDB (EV-18, EV-21).
            globPatterns: ["**/*.{js,css,html,png,ico,svg,webmanifest}"],
            // Icons and start-up images are fetched by the phone itself when the app is
            // added, and the link preview's picture by whoever reads a shared link; keeping
            // them here would only slow the first visit (NFR-1).
            globIgnores: [
              "splash/**",
              "pwa-*.png",
              "maskable-*.png",
              "apple-touch-*.png",
              "og-*.png",
              // Only phones that turn notifications on download the library (D65).
              "assets/firebase-*.js",
            ],
            navigateFallback: "/index.html",
            // /privacy (IN-9) and /get-app and /app (IN-10) are their own pages, not
            // the app, also with something after a ? (a shared link's tracking): the address
            // is matched with its query.
            navigateFallbackDenylist: [
              /^\/v2\//,
              /^\/privacy(\/|\?|$)/,
              /^\/(get-app|app)(\/|\?|$)/i,
            ],
            cleanupOutdatedCaches: true,
            // The first visit is covered at once, not only after a reload.
            clientsClaim: true,
            inlineWorkboxRuntime: true,
            // Shows notifications and opens the event when one is tapped (D65, NT-15).
            importScripts: ["/push-sw.js"],
            // The events' pictures (EV-11, D7): each kept once seen, so the list shows them with
            // no connection; a picture never changes at its address, a new one gets a new address.
            // Only a picture is kept: a missing one is a 404 (firebase.json), and before that it
            // was the app's page with status 200, which phones then showed in its place. A kept
            // answer that isn't a picture is thrown away and asked for again, past the phone's own
            // cache, which may hold that page for a year.
            runtimeCaching: [
              {
                urlPattern: ({ sameOrigin, url }) =>
                  sameOrigin && url.pathname.startsWith("/v2/feed/pictures/"),
                handler: "CacheFirst",
                options: {
                  cacheName: "event-pictures",
                  expiration: { maxEntries: 200, maxAgeSeconds: 90 * 24 * 60 * 60 },
                  cacheableResponse: { statuses: [200] },
                  fetchOptions: { cache: "no-cache" },
                  plugins: [
                    {
                      cacheWillUpdate: ({ response }) =>
                        Promise.resolve(
                          response.headers.get("content-type")?.startsWith("image/")
                            ? response
                            : null,
                        ),
                      cachedResponseWillBeUsed: ({ cachedResponse }) =>
                        Promise.resolve(
                          cachedResponse?.headers.get("content-type")?.startsWith("image/")
                            ? cachedResponse
                            : null,
                        ),
                    },
                  ],
                },
              },
            ],
          },
        }),
  ],
  build: {
    // The app, and the page for people new to it at /get-app (IN-10).
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("index.html", import.meta.url)),
        get: fileURLToPath(new URL("get-app/index.html", import.meta.url)),
      },
      output: {
        // Firebase's messaging library in files of its own, downloaded only when someone
        // turns notifications on (D65), and kept out of the service worker's store below.
        manualChunks: (id) =>
          /node_modules\/(\.pnpm\/)?(@?firebase)/.test(id) ? "firebase" : undefined,
      },
    },
  },
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
    __SERVICE_WORKER__: JSON.stringify(!killSwitch),
    // The deploy sets LIVE_URL where the stage has a live record (scripts/setup-live-version.sh).
    __LIVE_URL__: JSON.stringify(config.liveUrl),
    // The deploy reads WEB_APP_CONFIG and PUSH_PUBLIC_KEY from the stage's project where it
    // has notifications (publish-site.yml); without them the app has none (D65).
    __PUSH_CONFIG__: JSON.stringify(config.push),
  },
  test: {
    environment: "jsdom",
    // One jsdom per worker, each file still in its own context: no test here needs a process
    // of its own (docs/refactor-log.md, refactor 11).
    pool: "vmThreads",
  },
});

/** Puts kill-switch/sw.js at /sw.js. */
function emitKillSwitch(): Plugin {
  return {
    name: "kmcdc-kill-switch",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: readFileSync(new URL("kill-switch/sw.js", import.meta.url), "utf8"),
      });
    },
  };
}

/** The stand-alone privacy page at /privacy (IN-9). */
function emitPrivacyPage(): Plugin {
  return {
    name: "kmcdc-privacy-page",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "privacy/index.html",
        source: privacyPage("/apple-touch-icon-180x180.png"),
      });
    },
  };
}

/** /get-app's site address, QR code and link preview, filled in before the page is built (IN-10). */
function getPageHtml(site: string): Plugin {
  return {
    name: "kmcdc-get-page",
    transformIndexHtml: {
      order: "pre",
      async handler(html, ctx) {
        if (!ctx.path.startsWith("/get-app/")) return html;
        const qr = await QRCode.toString(new URL("/get-app", site).href, {
          type: "svg",
          errorCorrectionLevel: "M",
          margin: 1,
        });
        return fillGetPage(html, { site, qr: qr.trim() });
      },
    },
  };
}
