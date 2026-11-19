import { expect, test } from "vitest";
import { installGuide } from "./install-guide.ts";
import { readSafariGuide, saveSafariGuide } from "./install-guide-store.ts";

// Real browsers' user agents. Safari 26 and later freeze the iOS version at 18_x.
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)";
const ANDROID = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko)";

test.each([
  ["Safari on iOS 27", `${IPHONE} Version/27.0 Mobile/15E148 Safari/604.1`, "iPhone", 5, "ios27"],
  ["Safari on iOS 26", `${IPHONE} Version/26.1 Mobile/15E148 Safari/604.1`, "iPhone", 5, "ios26"],
  [
    "Safari on iOS 18",
    `${IPHONE} Version/18.6 Mobile/15E148 Safari/604.1`,
    "iPhone",
    5,
    "share-bar",
  ],
  [
    "an iPad asking for the desktop site",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
    "MacIntel",
    5,
    "ios26",
  ],
  [
    "Chrome on iPhone",
    `${IPHONE} CriOS/141.0.7390.96 Mobile/15E148 Safari/604.1`,
    "iPhone",
    5,
    "ios-other",
  ],
  [
    "Firefox on iPhone",
    `${IPHONE} FxiOS/144.0 Mobile/15E148 Safari/605.1.15`,
    "iPhone",
    5,
    "ios-other",
  ],
  [
    "Edge on iPhone",
    `${IPHONE} Version/26.0 EdgiOS/141.0 Mobile/15E148 Safari/605.1.15`,
    "iPhone",
    5,
    "ios-other",
  ],
  [
    "inside Instagram",
    `${IPHONE} Mobile/15E148 Instagram 400.0.0.0 (iPhone16,2; iOS 18_7; en_US)`,
    "iPhone",
    5,
    "ios-other",
  ],
  ["inside Gmail", `${IPHONE} Mobile/15E148`, "iPhone", 5, "ios-other"],
  ["the Google app", `${IPHONE} GSA/390.0 Mobile/15E148 Safari/604.1`, "iPhone", 5, "ios-other"],
  [
    "Chrome on Android",
    `${ANDROID} Chrome/141.0.0.0 Mobile Safari/537.36`,
    "Linux armv81",
    5,
    "android",
  ],
  [
    "Samsung Internet",
    `${ANDROID} SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36`,
    "Linux armv81",
    5,
    "android-other",
  ],
  [
    "inside an Android app",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0 Mobile Safari/537.36",
    "Linux armv81",
    5,
    "android-other",
  ],
  [
    "Safari on a Mac",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
    "MacIntel",
    0,
    "computer",
  ],
  [
    "Chrome on Windows",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
    "Win32",
    0,
    "computer",
  ],
])("%s gets its own steps (IN-2)", (_, ua, platform, touch, guide) => {
  expect(installGuide(ua, platform, touch)).toBe(guide);
});

test("the Safari bar picked is remembered; storage that throws gives nothing (IN-4)", () => {
  const values = new Map<string, string>();
  const store = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
  };
  expect(readSafariGuide(store)).toBeNull();
  saveSafariGuide("ios26", store);
  expect(readSafariGuide(store)).toBe("ios26");
  values.set("kmcdc.safariGuide", "ios99");
  expect(readSafariGuide(store)).toBeNull();
  const broken = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  expect(readSafariGuide(broken)).toBeNull();
  expect(() => {
    saveSafariGuide("ios27", broken);
  }).not.toThrow();
});
