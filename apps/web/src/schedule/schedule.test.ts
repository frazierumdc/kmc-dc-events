import manifest from "@kmcdc/domain/golden/manifest-v2.json" with { type: "json" };
import snapshot from "@kmcdc/domain/golden/snapshot-v2.json" with { type: "json" };
import { expect, test } from "vitest";
import { LATEST_PATH, loadSchedule, MANIFEST_PATH, ScheduleError } from "./schedule.ts";

// The golden copies are published schema 2 files: this app must keep reading them (C-7).
function fakeFetch(files: Record<string, unknown>): typeof fetch {
  return (input) => {
    const path = typeof input === "string" ? input : "";
    const body = files[path];
    return Promise.resolve(
      body === undefined
        ? new Response("Not found", { status: 404 })
        : new Response(typeof body === "string" ? body : JSON.stringify(body)),
    );
  };
}
const golden = { [MANIFEST_PATH]: manifest, [manifest.snapshots["2"]]: snapshot };

test("reads the golden schema 2 manifest and snapshot", async () => {
  const schedule = await loadSchedule(fakeFetch(golden));
  expect(schedule.manifest.version).toBe(manifest.version);
  expect(schedule.snapshot.events).toHaveLength(snapshot.events.length);
});

test("a missing, broken or mismatched file is a clear error", async () => {
  await expect(loadSchedule(fakeFetch({}))).rejects.toThrow("couldn't be loaded (404)");
  await expect(loadSchedule(fakeFetch({ ...golden, [MANIFEST_PATH]: "{" }))).rejects.toThrow(
    "isn't valid",
  );
  const other = { ...snapshot, version: "20261009T000000Z-00000000" };
  await expect(
    loadSchedule(fakeFetch({ ...golden, [manifest.snapshots["2"]]: other })),
  ).rejects.toThrow("doesn't match its manifest");
  const reject: typeof fetch = () => Promise.reject(new TypeError("offline"));
  await expect(loadSchedule(reject)).rejects.toThrow("couldn't be reached");
  await expect(loadSchedule(reject)).rejects.toMatchObject({ offline: true });
  await expect(loadSchedule(fakeFetch({}))).rejects.toMatchObject({ offline: false });
});

test("if the named snapshot can't be fetched, latest.json is used (first visit)", async () => {
  const schedule = await loadSchedule(
    fakeFetch({ [MANIFEST_PATH]: manifest, [LATEST_PATH]: snapshot }),
  );
  expect(schedule.snapshot.version).toBe(manifest.version);
  // latest.json must still match the manifest.
  const other = { ...snapshot, version: "20261009T000000Z-00000000" };
  await expect(
    loadSchedule(fakeFetch({ [MANIFEST_PATH]: manifest, [LATEST_PATH]: other })),
  ).rejects.toBeInstanceOf(ScheduleError);
});

test("a schema 1 schedule is not read (D37)", async () => {
  const v1 = {
    [MANIFEST_PATH]: { ...manifest, schema: 1, snapshots: { "1": "/v1/feed/x.json" } },
  };
  await expect(loadSchedule(fakeFetch(v1))).rejects.toThrow("manifest isn't valid");
});

test("a first visit fetches the manifest and latest.json side by side (NFR-1)", async () => {
  const asked: string[] = [];
  const fetchFn: typeof fetch = (input) => {
    asked.push(typeof input === "string" ? input : "");
    return fakeFetch({ ...golden, [LATEST_PATH]: snapshot })(input);
  };
  const schedule = await loadSchedule(fetchFn);
  expect(schedule.snapshot.version).toBe(schedule.manifest.version);
  expect(asked.sort()).toEqual([LATEST_PATH, MANIFEST_PATH].sort());
});
