import { expect, test } from "vitest";
import { readSyncSettings } from "./config.ts";
import { ALL_EVENTS_URL, FEED_PROJECT } from "./deployment.ts";

test("with nothing set, the defaults: the process's directory, no addresses, the default project", () => {
  expect(readSyncSettings({}, "/work")).toEqual({
    cwd: "/work",
    publishedUrl: "",
    feedUrl: undefined,
    allEventsUrl: ALL_EVENTS_URL,
    feedToken: "",
    feedProject: FEED_PROJECT,
  });
});

test("relative paths start where pnpm was run", () => {
  expect(readSyncSettings({ INIT_CWD: "/repo/sub" }, "/work").cwd).toBe("/repo/sub");
});

test("all the website's events are read beside the feed, wherever that is", () => {
  const feed = "https://site.example.org/_functions/appEvents";
  expect(readSyncSettings({ WIX_FEED_URL: feed }, "/").allEventsUrl).toBe(
    "https://site.example.org/_functions/allEvents",
  );
  expect(
    readSyncSettings(
      { WIX_FEED_URL: feed, WIX_ALL_EVENTS_URL: "https://other.example.org/all" },
      "/",
    ).allEventsUrl,
  ).toBe("https://other.example.org/all");
});

test("an empty setting counts as unset", () => {
  const settings = readSyncSettings(
    {
      PUBLISHED_URL: "",
      WIX_FEED_URL: "",
      WIX_ALL_EVENTS_URL: "",
      WIX_FEED_TOKEN: "",
      FEED_PROJECT: "",
    },
    "/",
  );
  expect(settings).toMatchObject({
    publishedUrl: "",
    feedUrl: undefined,
    allEventsUrl: ALL_EVENTS_URL,
    feedToken: "",
    feedProject: FEED_PROJECT,
  });
});

test("the settings that are set are read as they are", () => {
  expect(
    readSyncSettings(
      { PUBLISHED_URL: "https://events.example.org", WIX_FEED_TOKEN: "t", FEED_PROJECT: "p" },
      "/",
    ),
  ).toMatchObject({ publishedUrl: "https://events.example.org", feedToken: "t", feedProject: "p" });
});
