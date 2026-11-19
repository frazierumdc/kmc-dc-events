import { readFile } from "node:fs/promises";
import path from "node:path";
import { SiteSettings, type SnapshotV2 } from "@kmcdc/domain";
import fixtures from "@kmcdc/sync/fixtures/wix-events.json" with { type: "json" };
import { copyWebsite, type CopyResult } from "@kmcdc/sync";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { App } from "./App.tsx";
import { fakeNetwork, memoryStore, schedule } from "../test/schedule.ts";

// The whole path in memory (data-pipeline.md): the real-feed fixtures → the copy run
// (adapter, checks, snapshot) with the repository's site settings → the page; then a
// website edit, the same website again, and a broken source, each through the next copy
// run to the phone.

afterEach(cleanup);

const NOW = new Date("2026-10-09T15:00:00Z"); // Friday 9 October, 11 AM Eastern
// The website's events only: other centers' events (D67) are tested with the copy.
const site = {
  ...SiteSettings.parse(
    JSON.parse(
      await readFile(path.resolve(import.meta.dirname, "../../../data/site.json"), "utf8"),
    ),
  ),
  otherCenterEvents: [],
};
const events = Object.entries(fixtures)
  .filter(([name]) => name !== "empty-address") // the "prayer" event with its address blanked
  .map(([, e]) => e);

/** One copy run on `list`, compared with `published`. */
function copy(
  list: unknown[] = events,
  published: SnapshotV2 | null = null,
  count = list.length,
): CopyResult {
  return copyWebsite({
    feed: {
      generatedAt: "2026-10-09T14:58:00Z",
      window: { from: "2026-10-08T14:58:00Z", to: "2027-11-12T14:58:00Z" },
      access: "visitor",
      count,
      events: list,
    },
    site,
    published,
    now: NOW,
    checkFreshness: true,
  });
}

function published(result: CopyResult) {
  if (result.status !== "changed") throw new Error(`expected a change, got ${result.status}`);
  return result.files;
}

/** Tuesday Rest and Reflect moved in Wix from 6:00 to 6:30 PM. */
const moved = events.map((e) =>
  e === fixtures["weekly-class"]
    ? {
        ...fixtures["weekly-class"],
        dateAndTimeSettings: {
          ...fixtures["weekly-class"].dateAndTimeSettings,
          startDate: "2026-10-13T22:30:00.000Z",
          endDate: "2026-10-13T23:00:00.000Z",
        },
      }
    : e,
);

const notice = () => document.querySelector<HTMLElement>(".ui-toast:not(.ui-leaving *)");

test("fixture feed → copy → snapshot → the page lists the events", async () => {
  const { snapshot, manifest } = published(copy());
  // Ids are Wix's own (EV-7).
  const wixIds = new Set(events.map((e) => (e as { id: string }).id));
  expect(snapshot.events.every((e) => wixIds.has(e.id))).toBe(true);

  const net = fakeNetwork({ snapshot, manifest });
  render(<App sync={{ fetchFn: net.fetchFn, store: memoryStore() }} now={() => NOW} />);
  await screen.findByRole("heading", { level: 2, name: "Today, October 9, 2026" });
  const days = screen
    .getAllByRole("region")
    .map((region) => [
      region.querySelector("h2")?.textContent,
      [...region.querySelectorAll("li .ui-sr")].map((label) => label.textContent),
    ]);
  expect(days).toMatchInlineSnapshot(`
    [
      [
        "Today, October 9, 2026",
        [
          "7:30 PM, International Fall Festival, Special, Day 1 of 7, in Málaga, also online",
        ],
      ],
      [
        "Tomorrow, October 10, 2026",
        [
          "All day, International Fall Festival, Special, Day 2 of 7, in Málaga, also online",
        ],
      ],
      [
        "Sunday, October 11, 2026",
        [
          "All day, International Fall Festival, Special, Day 3 of 7, in Málaga, also online",
        ],
      ],
      [
        "Monday, October 12, 2026",
        [
          "All day, International Fall Festival, Special, Day 4 of 7, in Málaga, also online",
          "7:00 PM, Richmond Meditation Class, Classes, 7:00 PM to 8:00 PM, in Richmond",
        ],
      ],
      [
        "Tuesday, October 13, 2026",
        [
          "All day, International Fall Festival, Special, Day 5 of 7, in Málaga, also online",
          "6:00 PM, Tuesday Rest and Reflect, Classes, 6:00 PM to 6:30 PM, at KMC DC, also online",
        ],
      ],
      [
        "Wednesday, October 14, 2026",
        [
          "All day, International Fall Festival, Special, Day 6 of 7, in Málaga, also online",
        ],
      ],
      [
        "Thursday, October 15, 2026",
        [
          "All day, International Fall Festival, Special, Day 7 of 7, in Málaga, also online",
        ],
      ],
      [
        "Saturday, October 17, 2026",
        [
          "10:00 AM, Silent Saturday Retreat - A Heart of Gratitude, Special, 10:00 AM to 1:00 PM, at KMC DC, also online",
        ],
      ],
      [
        "Sunday, October 18, 2026",
        [
          "12:00 PM, The Foundation Program, Classes, 12:00 PM to 2:00 PM, at KMC DC",
          "5:00 PM, Wishfulfilling Jewel with Tsog, Prayers, 5:00 PM to 6:15 PM, at KMC DC, also online",
        ],
      ],
      [
        "Wednesday, October 21, 2026",
        [
          "8:00 AM, Heart Jewel Prayers & Silent Meditation, Prayers, 8:00 AM to 9:00 AM, at KMC DC, also online",
        ],
      ],
      [
        "Sunday, November 8, 2026",
        [
          "2:00 PM, Center Cherishing, 2:00 PM to 5:00 PM, at KMC DC",
        ],
      ],
      [
        "Thursday, December 31, 2026",
        [
          "5:30 PM, New Years Eve Compassion Prayers by Candlelight, Special, 5:30 PM to 6:30 PM, at KMC DC, also online",
        ],
      ],
      [
        "You belong here",
        [],
      ],
    ]
  `);
});

test("a website edit: the next copy publishes it; the phone applies it silently (EV-8, EV-19)", async () => {
  const first = published(copy());
  const next = copy(moved, first.snapshot);
  const files = published(next);
  expect(next.summary).toContain("Tuesday Rest and Reflect");

  const net = fakeNetwork(files);
  net.delayMs = 40;
  const store = memoryStore(schedule(first));
  render(<App sync={{ fetchFn: net.fetchFn, store }} now={() => NOW} />);
  await screen.findByRole("heading", { level: 2, name: "Today, October 9, 2026" });
  await waitFor(() => {
    expect(screen.getByText(/^6:30 PM, Tuesday Rest and Reflect/)).toBeTruthy();
  });
  expect(document.querySelector(".ui-toast")).toBeNull();
  expect(store.saved()?.manifest.version).toBe(files.manifest.version);
});

test("the same website again: nothing published; the phone downloads nothing more (EV-8)", async () => {
  const first = published(copy());
  expect(copy(events, first.snapshot).status).toBe("same");

  const net = fakeNetwork(first);
  render(
    <App sync={{ fetchFn: net.fetchFn, store: memoryStore(schedule(first)) }} now={() => NOW} />,
  );
  await screen.findByRole("heading", { level: 2, name: "Today, October 9, 2026" });
  await act(() => new Promise((r) => setTimeout(r, 20)));
  expect(net.requests).toEqual(["/v2/feed/manifest.json"]);
  expect(notice()).toBeNull();
});

test("a broken source: nothing published; the phone keeps the last schedule (EV-9, NFR-4)", async () => {
  const first = published(copy());
  const broken = copy(moved, first.snapshot, 99);
  expect(broken.status).toBe("failed");
  expect(broken.summary).toContain("The app keeps the last published schedule.");

  // The site still serves the first schedule, or can't be reached at all.
  for (const net of [fakeNetwork(first), fakeNetwork(null)]) {
    render(
      <App sync={{ fetchFn: net.fetchFn, store: memoryStore(schedule(first)) }} now={() => NOW} />,
    );
    await screen.findByRole("heading", { level: 2, name: "Today, October 9, 2026" });
    expect(screen.getByText(/^6:00 PM, Tuesday Rest and Reflect/)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    cleanup();
  }
});
