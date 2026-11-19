import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * `pnpm dev` only: serves /v2/feed/ as the deploy publishes it (data-pipeline.md), with
 * each event's calendar file, from the saved feed in .capture/feed.json, or the golden
 * schema 2 copy without one.
 * Built on every request, so a new capture shows on reload.
 */
export function websiteFeedDevServer(captureFile: string): Plugin {
  return {
    name: "kmcdc-website-feed-dev-server",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/v2/feed/", (req, res, next) => {
        void (async () => {
          const { manifest, json } = await v2Files(captureFile);
          const file = req.url?.split("?")[0] ?? "";
          if (file.startsWith("/calendar/")) {
            const { SnapshotV2 } = await import("@kmcdc/domain");
            const { calendarFiles } = await import("@kmcdc/publish");
            const host = req.headers.host ?? "localhost";
            const files = calendarFiles(SnapshotV2.parse(JSON.parse(json)), `http://${host}`);
            const ics = files.get(file.slice(1));
            res.statusCode = ics === undefined ? 404 : 200;
            res.setHeader("Content-Type", ics === undefined ? "text/plain" : "text/calendar");
            res.end(ics ?? "Not found\n");
            return;
          }
          // Each build is stamped with the time, so any snapshot name gets the current one.
          const body =
            file === "/manifest.json"
              ? JSON.stringify(manifest)
              : file === "/latest.json" || /^\/snapshots\/[^/]+\.json$/.test(file)
                ? json
                : null;
          if (body === null) {
            res.statusCode = 404;
            res.end("Not found\n");
            return;
          }
          res.setHeader("Content-Type", "application/json");
          res.end(body);
        })().catch(next);
      });
    },
  };
}

async function v2Files(
  captureFile: string,
): Promise<{ manifest: { version: string }; json: string }> {
  if (!existsSync(captureFile)) {
    const golden = path.resolve(import.meta.dirname, "../../packages/domain/golden");
    return {
      manifest: JSON.parse(await readFile(path.join(golden, "manifest-v2.json"), "utf8")) as {
        version: string;
      },
      json: await readFile(path.join(golden, "snapshot-v2.json"), "utf8"),
    };
  }
  const { FeedEnvelope, SiteSettings } = await import("@kmcdc/domain");
  const { copyWebsite } = await import("@kmcdc/sync");
  const read = async (file: string): Promise<unknown> => JSON.parse(await readFile(file, "utf8"));
  const result = copyWebsite({
    feed: FeedEnvelope.parse(await read(captureFile)),
    site: SiteSettings.parse(await read(path.join(DATA_DIR, "site.json"))),
    published: null,
    now: new Date(),
    checkFreshness: false,
  });
  if (result.status === "failed") throw new Error(result.problem);
  return result.files;
}

export const DATA_DIR = path.resolve(import.meta.dirname, "../../data");

export const CAPTURE_FILE = path.resolve(import.meta.dirname, "../../.capture/feed.json");
