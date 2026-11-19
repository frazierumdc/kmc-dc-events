import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

/**
 * The app's icons and start-up images, straight from brand/images (made by
 * brand/generate.ts, D23): icons at the site root and start-up images under /splash/, the
 * dev and test builds' own (with their DEV or TEST label) from images/dev/ and images/test/;
 * the splash's logo in index.html from the same folder; head-links.html's tags in
 * index.html, and the home-screen name there. Served by `pnpm dev` and written by the build, so nothing is
 * copied by hand.
 */

export const BRAND_DIR = fileURLToPath(new URL("../../brand/images/", import.meta.url));
const ICONS = [
  "favicon.ico",
  "apple-touch-icon-180x180.png",
  "pwa-64x64.png",
  "pwa-192x192.png",
  "pwa-512x512.png",
  "maskable-icon-512x512.png",
];

/** The labelled apps (brand/bands.ts); prod is the real app, with the plain logo. */
export type AppEnv = "dev" | "test" | "prod";

/** The folder of brand/images with this environment's icons and start-up images. */
const envDir = (env: AppEnv) => (env === "prod" ? "" : env);

/** Site path → file on disk. */
export function brandFiles(env: AppEnv): Map<string, string> {
  const files = new Map<string, string>();
  const dir = path.join(BRAND_DIR, envDir(env));
  for (const icon of ICONS) files.set(icon, path.join(dir, icon));
  for (const splash of readdirSync(path.join(dir, "splash")))
    files.set(`splash/${splash}`, path.join(dir, "splash", splash));
  return files;
}

/** The web manifest's icons, as brand/generate.ts lists them. */
export function manifestIcons(): { src: string; sizes: string; type: string; purpose?: string }[] {
  return JSON.parse(readFileSync(path.join(BRAND_DIR, "manifest-icons.json"), "utf8")) as {
    src: string;
    sizes: string;
    type: string;
    purpose?: string;
  }[];
}

const TYPES: Record<string, string> = { ".png": "image/png", ".ico": "image/x-icon" };

export function brandAssets({ env, shortName }: { env: AppEnv; shortName: string }): Plugin[] {
  const files = brandFiles(env);
  const headLinks = readFileSync(path.join(BRAND_DIR, "head-links.html"), "utf8")
    .split("\n")
    .filter((line) => line.startsWith("<link"))
    .join("\n");
  const splashLogo = path.posix.join("../../brand/images", envDir(env), "splash-logo.png");
  return [
    {
      // Before Vite bundles index.html's images, so the build takes this logo.
      name: "kmcdc-brand-splash-logo",
      transformIndexHtml: {
        order: "pre",
        handler: (html) => html.replace("../../brand/images/splash-logo.png", splashLogo),
      },
    },
    {
      name: "kmcdc-brand-assets",
      transformIndexHtml(html) {
        return html
          .replace("<!-- brand-links -->", headLinks)
          .replace("%APP_SHORT_NAME%", shortName);
      },
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const file = files.get((req.url ?? "").split("?")[0]?.slice(1) ?? "");
          if (!file) {
            next();
            return;
          }
          res.setHeader("Content-Type", TYPES[path.extname(file)] ?? "application/octet-stream");
          res.end(readFileSync(file));
        });
      },
      generateBundle() {
        for (const [fileName, file] of files)
          this.emitFile({ type: "asset", fileName, source: readFileSync(file) });
      },
    },
  ];
}
