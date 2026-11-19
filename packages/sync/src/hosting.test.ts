import { gunzipSync } from "node:zlib";
import { expect, test } from "vitest";
import {
  compareFiles,
  firebaseHosting,
  hostedFile,
  keptFile,
  nextFiles,
  ownedBySchedule,
  publishSchedule,
  type HostedFile,
  type Hosting,
} from "./hosting.ts";

// Publishing a schedule through Hosting's API (D63, EV-21): the app's files are kept by
// name, the schedule's are replaced, and nothing is live until the last call.

const app = new Map([
  ["/index.html", "h-index"],
  ["/assets/main.js", "h-main"],
  ["/__/firebase/init.js", "h-init"],
  ["/v2/feed/manifest.json", "h-old-manifest"],
  ["/v2/feed/snapshots/old.json", "h-old-snapshot"],
  ["/e/gone/index.html", "h-old-page"],
]);
const schedule = (): Map<string, HostedFile> =>
  new Map([
    ["/v2/feed/manifest.json", hostedFile('{"version":"new"}')],
    ["/v2/feed/snapshots/new.json", hostedFile("{}")],
    ["/e/abc/index.html", hostedFile("<html>abc</html>")],
  ]);

test("a hosted file is gzipped, named by its hash, the same on every machine", () => {
  const file = hostedFile("hello");
  expect(new TextDecoder().decode(gunzipSync(file.gzipped))).toBe("hello");
  expect(file.hash).toMatch(/^[0-9a-f]{64}$/);
  expect(file.gzipped[9]).toBe(3);
  expect(hostedFile("hello").hash).toBe(file.hash);
  expect(hostedFile("hello!").hash).not.toBe(file.hash);
});

test("the schedule owns /v2/feed/ and /e/, nothing else", () => {
  expect(ownedBySchedule("/v2/feed/latest.json")).toBe(true);
  expect(ownedBySchedule("/e/abc/share.png")).toBe(true);
  expect(ownedBySchedule("/index.html")).toBe(false);
  expect(ownedBySchedule("/events.html")).toBe(false);
});

test("the next version keeps the app's files, drops the old schedule and Hosting's own, adds the new", () => {
  const next = nextFiles(app, schedule());
  expect([...next.keys()].sort()).toEqual([
    "/assets/main.js",
    "/e/abc/index.html",
    "/index.html",
    "/v2/feed/manifest.json",
    "/v2/feed/snapshots/new.json",
  ]);
  expect(next.get("/index.html")).toBe("h-index");
  expect(next.get("/v2/feed/manifest.json")).not.toBe("h-old-manifest");
});

test("a schedule can never replace a file of the app's", () => {
  expect(() => nextFiles(app, new Map([["/index.html", hostedFile("x")]]))).toThrow("is the app's");
});

test("compares two sets of files by path", () => {
  const before = new Map([
    ["/a", "1"],
    ["/b", "2"],
    ["/c", "3"],
  ]);
  const after = new Map([
    ["/a", "1"],
    ["/b", "9"],
    ["/d", "4"],
  ]);
  expect(compareFiles(before, after)).toEqual({
    added: ["/d"],
    removed: ["/c"],
    changed: ["/b"],
    same: 1,
  });
});

/** A Hosting that records what it is asked, and already holds `held` hashes. */
function fakeHosting(held: string[] = []) {
  const calls: string[] = [];
  const hosting: Hosting = {
    live: () => {
      calls.push("live");
      return Promise.resolve({ version: "sites/s/versions/live", config: { headers: [1] } });
    },
    files: (version) => {
      calls.push(`files ${version}`);
      return Promise.resolve(app);
    },
    createVersion: (config) => {
      calls.push(`create ${JSON.stringify(config)}`);
      return Promise.resolve("sites/s/versions/new");
    },
    populate: (version, files) => {
      calls.push(`populate ${version} ${String(files.size)}`);
      const have = new Set([...app.values(), ...held]);
      return Promise.resolve({
        uploadUrl: "https://upload.example/files",
        required: [...files.values()].filter((h) => !have.has(h)),
      });
    },
    upload: (url, file) => {
      calls.push(`upload ${url} ${file.hash.slice(0, 6)}`);
      return Promise.resolve();
    },
    finalize: (version) => {
      calls.push(`finalize ${version}`);
      return Promise.resolve();
    },
    release: (version, message) => {
      calls.push(`release ${version} ${message}`);
      return Promise.resolve();
    },
  };
  return { hosting, calls };
}

test("publishes: the live version's settings, only the new files sent, released last", async () => {
  const { hosting, calls } = fakeHosting();
  const files = schedule();
  const done = await publishSchedule(hosting, files, "schedule new");
  expect(done).toEqual({ version: "sites/s/versions/new", uploaded: 3, kept: 2 });
  expect(calls.slice(0, 4)).toEqual([
    "live",
    "files sites/s/versions/live",
    'create {"headers":[1]}',
    "populate sites/s/versions/new 5",
  ]);
  expect(calls.filter((c) => c.startsWith("upload"))).toHaveLength(3);
  expect(calls.slice(-2)).toEqual([
    "finalize sites/s/versions/new",
    "release sites/s/versions/new schedule new",
  ]);
});

test("a file Hosting already holds is not sent again", async () => {
  const files = schedule();
  const { hosting, calls } = fakeHosting([files.get("/v2/feed/snapshots/new.json")?.hash ?? ""]);
  expect((await publishSchedule(hosting, files, "m")).uploaded).toBe(2);
  expect(calls.filter((c) => c.startsWith("upload"))).toHaveLength(2);
});

test("a file kept from the live version is named, never sent", async () => {
  const files = schedule();
  files.set("/e/kept/share.png", keptFile("h-old-page"));
  const { hosting, calls } = fakeHosting();
  const done = await publishSchedule(hosting, files, "m");
  expect(done).toEqual({ version: "sites/s/versions/new", uploaded: 3, kept: 3 });
  expect(calls.filter((c) => c.startsWith("upload"))).toHaveLength(3);
});

test("Hosting asking for a kept file it should hold stops the publish", async () => {
  const files = schedule();
  files.set("/e/kept/share.png", keptFile("h-lost"));
  const { hosting } = fakeHosting();
  await expect(publishSchedule(hosting, files, "m")).rejects.toThrow("no longer holds");
});

test("a failed upload releases nothing: the site stays as it was", async () => {
  const { hosting, calls } = fakeHosting();
  hosting.upload = () => Promise.reject(new Error("upload failed"));
  await expect(publishSchedule(hosting, schedule(), "m")).rejects.toThrow("upload failed");
  expect(calls.some((c) => c.startsWith("finalize") || c.startsWith("release"))).toBe(false);
});

test("Hosting asking for one of the app's files stops the publish", async () => {
  const { hosting } = fakeHosting();
  hosting.populate = () => Promise.resolve({ uploadUrl: "u", required: ["h-main"] });
  await expect(publishSchedule(hosting, schedule(), "m")).rejects.toThrow("isn't the schedule's");
});

test("Hosting's API: the calls it makes, with the account's token", async () => {
  const calls: { method: string; url: string; body: unknown; auth: string | null }[] = [];
  const answers: unknown[] = [
    { release: { version: { name: "sites/s/versions/v1", config: { rewrites: [] } } } },
    { files: [{ path: "/a", hash: "h1" }], nextPageToken: "p2" },
    { files: [{ path: "/b", hash: "h2" }] },
    { name: "sites/s/versions/v2" },
    { uploadUrl: "https://upload.example/v2/files", uploadRequiredHashes: ["h9"] },
    null,
    {},
    {},
  ];
  const fetch = (input: string | URL | Request, init?: RequestInit) => {
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : init?.body;
    calls.push({
      method: init?.method ?? "GET",
      url: input instanceof Request ? input.url : input.toString(),
      body,
      auth: new Headers(init?.headers).get("authorization"),
    });
    return Promise.resolve(Response.json(answers.shift() ?? {}));
  };
  const hosting = firebaseHosting({ site: "s", token: () => Promise.resolve("t0ken"), fetch });
  const base = "https://firebasehosting.googleapis.com/v1beta1";
  expect(await hosting.live()).toEqual({
    version: "sites/s/versions/v1",
    config: { rewrites: [] },
  });
  expect([...(await hosting.files("sites/s/versions/v1"))]).toEqual([
    ["/a", "h1"],
    ["/b", "h2"],
  ]);
  expect(await hosting.createVersion({ rewrites: [] })).toBe("sites/s/versions/v2");
  expect(await hosting.populate("sites/s/versions/v2", new Map([["/a", "h1"]]))).toEqual({
    uploadUrl: "https://upload.example/v2/files",
    required: ["h9"],
  });
  const file = hostedFile("x");
  await hosting.upload("https://upload.example/v2/files", file);
  await hosting.finalize("sites/s/versions/v2");
  await hosting.release("sites/s/versions/v2", "schedule v2");
  expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
    `GET ${base}/sites/s/channels/live`,
    `GET ${base}/sites/s/versions/v1/files?pageSize=1000`,
    `GET ${base}/sites/s/versions/v1/files?pageSize=1000&pageToken=p2`,
    `POST ${base}/sites/s/versions`,
    `POST ${base}/sites/s/versions/v2:populateFiles`,
    `POST https://upload.example/v2/files/${file.hash}`,
    `PATCH ${base}/sites/s/versions/v2?update_mask=status`,
    `POST ${base}/sites/s/releases?versionName=sites%2Fs%2Fversions%2Fv2`,
  ]);
  expect(calls[3]?.body).toEqual({ config: { rewrites: [] } });
  expect(calls[4]?.body).toEqual({ files: { "/a": "h1" } });
  expect(calls[6]?.body).toEqual({ status: "FINALIZED" });
  expect(calls[7]?.body).toEqual({ message: "schedule v2" });
  expect(calls.every((c) => c.auth === "Bearer t0ken")).toBe(true);
});

test("Hosting's API: an error names the call, never the token", async () => {
  const fetch = () => Promise.resolve(new Response("", { status: 403 }));
  const hosting = firebaseHosting({ site: "s", token: () => Promise.resolve("t0ken"), fetch });
  const error = await hosting.live().catch((e: unknown) => e);
  expect(String(error)).toContain("answered 403");
  expect(String(error)).not.toContain("t0ken");
});
