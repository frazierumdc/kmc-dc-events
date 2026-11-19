import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { BUILDS, type Variant } from "./build-variants.ts";

// A static server for one build of the app at a time, like Hosting: unknown paths get
// index.html, and /v2/feed/ serves the golden schedule. `use` switches build, as a deploy
// would; the service worker then finds the new version.
const GOLDEN = new URL("../packages/domain/golden/", import.meta.url);
const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
};

export async function startSwServer(first: Variant) {
  let variant: Variant = first;
  /** Pictures the publish has put on the site, by path. */
  const pictures = new Map<string, Buffer>();
  const manifest = await readFile(new URL("manifest-v2.json", GOLDEN), "utf8");
  const snapshot = await readFile(new URL("snapshot-v2.json", GOLDEN), "utf8");
  const snapshotPath = (JSON.parse(manifest) as { snapshots: { "2": string } }).snapshots["2"];

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://localhost").pathname;
      const feed =
        url === "/v2/feed/manifest.json"
          ? manifest
          : url === snapshotPath || url === "/v2/feed/latest.json"
            ? snapshot
            : null;
      const picture = pictures.get(url);
      if (picture) {
        res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-cache" });
        res.end(picture);
        return;
      }
      if (feed !== null) {
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
        res.end(feed);
        return;
      }
      const root = path.join(BUILDS, variant);
      const file = path.join(root, path.normalize(url === "/" ? "/index.html" : url));
      let body: Buffer;
      let type = TYPES[path.extname(file)] ?? "application/octet-stream";
      try {
        body = await readFile(file);
      } catch {
        body = await readFile(path.join(root, "index.html"));
        type = TYPES[".html"] ?? "text/html";
      }
      res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
      res.end(body);
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, "localhost", resolve));
  return {
    url: `http://localhost:${String((server.address() as AddressInfo).port)}`,
    use(next: Variant) {
      variant = next;
    },
    /** Puts a picture on the site, as a publish would. */
    addPicture(at: string, body: Buffer) {
      pictures.set(at, body);
    },
    /** Takes the site down, like losing the connection. */
    close: () =>
      new Promise<void>((resolve) => {
        if (!server.listening) {
          resolve();
          return;
        }
        server.closeAllConnections();
        server.close(() => {
          resolve();
        });
      }),
  };
}
