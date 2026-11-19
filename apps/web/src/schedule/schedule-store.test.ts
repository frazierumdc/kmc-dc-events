import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { openDB } from "idb";
import { beforeEach, expect, test } from "vitest";
import { indexedDbStore } from "./schedule-store.ts";
import { golden, newerSchedule, schedule } from "../../test/schedule.ts";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

const putRaw = async (value: unknown) => {
  const db = await openDB("kmc-dc-events", 2, {
    upgrade(db) {
      db.createObjectStore("downloads");
    },
  });
  await db.put("downloads", value, "current");
  db.close();
};

test("keeps the last schedule and reads it back (EV-18)", async () => {
  expect(await indexedDbStore.read()).toBeNull();
  await indexedDbStore.write(golden);
  expect((await indexedDbStore.read())?.manifest.version).toBe(golden.manifest.version);
  await indexedDbStore.write(newerSchedule());
  expect((await indexedDbStore.read())?.snapshot.events[0]?.title).toBe("Newer title");
});

test("keeps the files whole: fields this version doesn't know are still there", async () => {
  const later = schedule({
    manifest: golden.download.manifest,
    snapshot: { ...golden.snapshot, comesLater: { a: 1 } },
  });
  await indexedDbStore.write(later);
  const read = await indexedDbStore.read();
  expect(read?.download.snapshot).toMatchObject({ comesLater: { a: 1 } });
});

test("an older app saved the schedule; a newer app still sees its kinds (D45)", async () => {
  // Version 1 kept the schedule as that app had checked it, without the kinds.
  const old = await openDB("kmc-dc-events", 1, {
    upgrade(db) {
      db.createObjectStore("schedule");
    },
  });
  const oldSite = Object.fromEntries(
    Object.entries(golden.snapshot.site).filter(([key]) => key !== "categoryKinds"),
  );
  await old.put(
    "schedule",
    { manifest: golden.manifest, snapshot: { ...golden.snapshot, site: oldSite } },
    "current",
  );
  old.close();

  // The old copy counts as nothing stored, so the app downloads the schedule again.
  expect(await indexedDbStore.read()).toBeNull();
  await indexedDbStore.write(golden);
  const read = await indexedDbStore.read();
  expect(read?.snapshot.site.categoryKinds["Chanted Prayers"]).toBe("prayer");
});

test("a broken or mismatched stored copy counts as nothing stored", async () => {
  await putRaw({ manifest: golden.manifest, snapshot: { schema: 1 } });
  expect(await indexedDbStore.read()).toBeNull();
  await putRaw({ manifest: newerSchedule().manifest, snapshot: golden.snapshot });
  expect(await indexedDbStore.read()).toBeNull();
  await putRaw("nonsense");
  expect(await indexedDbStore.read()).toBeNull();
});
