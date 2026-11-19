import { expect, test } from "vitest";
import { thumbnailPath, thumbnailSource } from "./thumbnail.ts";

// An event's picture as a thumbnail on the app's own site (slice 1.13); a real picture's
// address from the Wix feed of 13 November 2026.
const PICTURE =
  "https://static.wixstatic.com/media/7399f8_97e14fcb0db643238b516beb9f20839f~mv2.jpg";

test("a picture's thumbnail has one short path on the site, a new picture a new one", () => {
  expect(thumbnailPath(PICTURE)).toMatch(/^\/v2\/feed\/pictures\/[0-9a-f]{16}-256\.jpg$/);
  expect(thumbnailPath(PICTURE)).toBe(thumbnailPath(PICTURE));
  expect(thumbnailPath(PICTURE.replace("97e1", "97e2"))).not.toBe(thumbnailPath(PICTURE));
});

test("the thumbnail is asked of Wix's media server as a small square JPEG", () => {
  expect(thumbnailSource(PICTURE)).toBe(`${PICTURE}/v1/fill/w_256,h_256,al_c,q_80/thumb.jpg`);
  // Another center's picture, from Squarespace (D67): 500 pixels wide; the list crops it.
  const other = "https://images.squarespace-cdn.com/content/v1/example/sample-retreat.jpg";
  expect(thumbnailSource(other)).toBe(`${other}?format=500w`);
});
