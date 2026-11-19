// @vitest-environment node
import { expect, test } from "vitest";
import { drawPicture, HEIGHT, WIDTH } from "./share-pictures.ts";
import { pictureContent } from "./share-picture.ts";
import { golden, goldenEvent } from "../test/schedule.ts";

// The share picture is drawn as a PNG of the size link previews use (EV-35).

test("a 1200 × 630 PNG, the same every time it is drawn", async () => {
  const content = pictureContent(goldenEvent("International Fall Festival"), golden.snapshot.site);
  const png = await drawPicture(content);
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([WIDTH, HEIGHT]);
  // Unchanged events give unchanged files, so a publish uploads only what changed.
  expect((await drawPicture(content)).equals(png)).toBe(true);
});
