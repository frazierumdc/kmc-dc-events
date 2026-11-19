import { expect, test } from "vitest";
import manifestV2 from "../golden/manifest-v2.json" with { type: "json" };
import snapshotV2 from "../golden/snapshot-v2.json" with { type: "json" };
import { ManifestV2, SnapshotV2 } from "./website.ts";

// Golden copies of published schema 2 files (D36 – D39), built once from the adapter
// fixtures. Schema 2 only grows (C-7): if a schema change breaks these tests, it needs a
// new schema instead. Never edit these files to make a test pass.

test("schema 2 still reads the golden snapshot and manifest", () => {
  expect(SnapshotV2.safeParse(snapshotV2).error).toBeUndefined();
  expect(ManifestV2.safeParse(manifestV2).error).toBeUndefined();
});

test("schema 2 readers drop fields they don't know", () => {
  const [first] = snapshotV2.events;
  const later = {
    ...snapshotV2,
    notice: "new",
    site: { ...snapshotV2.site, install: { title: "Add to Home Screen" } },
    events: [{ ...first, colour: "teal", location: { ...first?.location, room: "Shrine" } }],
  };
  const read = SnapshotV2.parse(later);
  expect(read).not.toHaveProperty("notice");
  expect(read.site).not.toHaveProperty("install");
  expect(read.events[0]).not.toHaveProperty("colour");
  expect(read.events[0]?.location).not.toHaveProperty("room");
  expect(
    ManifestV2.safeParse({
      ...manifestV2,
      snapshots: { "2": "/v2/feed/snapshots/x.json", "3": "/v3/x.json" },
    }).success,
  ).toBe(true);
});
