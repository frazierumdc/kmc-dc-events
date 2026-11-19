import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "./App.tsx";
import {
  fakeNetwork,
  golden,
  memoryStore,
  movedSchedule,
  newerSchedule,
} from "../test/schedule.ts";
import { scrollTo, online, now } from "../test/app.tsx";

afterEach(cleanup);

beforeEach(() => {
  scrollTo.mockClear();
  vi.spyOn(window, "scrollTo").mockImplementation(scrollTo);
});

const rows = (region: HTMLElement) =>
  within(region)
    .getAllByRole("listitem")
    .map((li) => li.querySelector(".ui-sr")?.textContent);

test("the Events screen lists events by day; each row has its spoken label", async () => {
  render(<App sync={online()} now={now} />);
  const today = await screen.findByRole("region", { name: "Today, October 13, 2026" });
  expect(rows(today)).toEqual([
    "All day, International Fall Festival, Special, Day 5 of 7, in Málaga",
    "6:00 PM, Tuesday Rest and Reflect, Classes, 6:00 PM to 6:30 PM, at KMC DC",
  ]);
  // Each row has its kind's colour (D45).
  expect(
    within(today)
      .getAllByRole("link")
      .map((a) => a.getAttribute("data-kind")),
  ).toEqual(["special", "class"]);
  expect(screen.getByRole("region", { name: "Tomorrow, October 14, 2026" })).toBeTruthy();
  expect(rows(screen.getByRole("region", { name: "Saturday, October 17, 2026" }))).toEqual([
    "10:00 AM, Online: Silent Saturday: A Heart of Gratitude, Special, 10:00 AM to 1:00 PM, Online",
    "10:00 AM, Silent Saturday Retreat - A Heart of Gratitude, Special, 10:00 AM to 1:00 PM, at KMC DC",
  ]);
  expect(screen.queryByText(/Richmond Meditation Class/)).toBeNull();
  // When the schedule was updated and the version are in Settings (EV-17, EV-41).
  expect(screen.queryByText(/Schedule updated October/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  const info = screen.getByRole("dialog", { name: "Settings" });
  expect(within(info).getByText("Schedule updated October 9, 2026, 11:00 AM")).toBeTruthy();
  expect(within(info).getByText(`Version ${__BUILD_ID__}`)).toBeTruthy();
});

test("a first visit with no connection shows an error that can be retried", async () => {
  const net = fakeNetwork(null);
  render(<App sync={{ fetchFn: net.fetchFn, store: memoryStore() }} now={now} />);
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The schedule couldn't be reached.");
  net.serve(golden);
  fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("region", { name: "Today, October 13, 2026" })).toBeTruthy();
});

test("the kind filter narrows the list and is remembered (EV-12, EV-15)", async () => {
  localStorage.clear();
  render(<App sync={online()} now={now} />);
  await screen.findByRole("region", { name: "Today, October 13, 2026" });
  expect(
    within(screen.getByRole("group", { name: "Show" }))
      .getAllByRole("button")
      .map((b) => b.textContent),
  ).toEqual(["All", "Classes", "Special", "Prayers"]);
  const prayers = screen.getByRole("button", { name: "Prayers" });
  fireEvent.click(prayers);
  expect(prayers.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getAllByRole("region").map((r) => r.getAttribute("aria-labelledby"))).toEqual([
    "day-2026-10-18",
  ]);
  cleanup();

  render(<App sync={online()} now={now} />);
  await screen.findByRole("region", { name: "Sunday, October 18, 2026" });
  expect(screen.getByRole("button", { name: "Prayers" }).getAttribute("aria-pressed")).toBe("true");
  localStorage.clear();
});

test("a remembered choice the app doesn't offer shows All (EV-15)", async () => {
  localStorage.setItem("kmcdc.kindFilter", "Richmond Branch Classes");
  render(<App sync={online()} now={now} />);
  await screen.findByRole("region", { name: "Today, October 13, 2026" });
  expect(screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("true");
  localStorage.clear();
});

test("nothing left to list says so (EV-16)", async () => {
  localStorage.clear();
  const late = new Date("2026-11-09T12:00:00Z"); // after the last event
  render(<App sync={online()} now={() => late} />);
  expect(await screen.findByText("No events match this filter")).toBeTruthy();
});

test("the row of dates marks the day at the top; tapping a date moves the list there (EV-14)", async () => {
  localStorage.clear();
  render(<App sync={online()} now={now} />);
  const strip = await screen.findByRole("group", { name: "Choose a day" });
  const dates = within(strip).getAllByRole("button");
  expect(dates[0]?.getAttribute("aria-label")).toBe("Tuesday, October 13, 2026, 2 events");
  expect(dates.at(-1)?.getAttribute("aria-label")).toBe("Sunday, November 8, 2026, 1 event");
  const current = () =>
    within(strip)
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-current") === "true")
      .map((b) => b.getAttribute("aria-label"));
  expect(current()).toEqual(["Tuesday, October 13, 2026, 2 events"]);

  // The whole list stays; focus goes to the day's heading.
  const regions = screen.getAllByRole("region").length;
  fireEvent.click(
    within(strip).getByRole("button", { name: "Sunday, October 18, 2026, 2 events" }),
  );
  expect(screen.getAllByRole("region")).toHaveLength(regions);
  expect(document.activeElement?.id).toBe("day-2026-10-18");
  expect(current()).toEqual(["Sunday, October 18, 2026, 2 events"]);

  // A new filter keeps the date: the same day, or the next (or last) one it lists.
  fireEvent.click(screen.getByRole("button", { name: "Classes" }));
  expect(current()).toEqual(["Sunday, October 18, 2026, 1 event"]);
  fireEvent.click(screen.getByRole("button", { name: "Special" }));
  expect(current()).toEqual(["Saturday, October 17, 2026, 2 events"]);
  fireEvent.click(screen.getByRole("button", { name: "All" }));
  expect(current()).toEqual(["Saturday, October 17, 2026, 2 events"]);
  fireEvent.click(
    within(strip).getByRole("button", { name: "Sunday, October 18, 2026, 2 events" }),
  );

  // A date with nothing listed moves to the next day that has something.
  fireEvent.click(
    within(strip).getByRole("button", { name: "Friday, October 16, 2026, no events" }),
  );
  expect(current()).toEqual(["Saturday, October 17, 2026, 2 events"]);
  expect(screen.queryByRole("button", { name: "Show all days" })).toBeNull();
  localStorage.clear();
});

// ---- Keeping the schedule on the phone (EV-18, EV-19) ----

const firstTitle = () =>
  screen.getAllByRole("region")[0]?.querySelector("li .ui-sr")?.textContent ?? "";

test("a first visit keeps the schedule on the phone", async () => {
  const store = memoryStore();
  render(<App sync={{ fetchFn: fakeNetwork().fetchFn, store }} now={now} />);
  await screen.findByRole("region", { name: "Today, October 13, 2026" });
  expect(store.saved()?.manifest.version).toBe(golden.manifest.version);
});

test("with no connection, the stored schedule shows", async () => {
  const net = fakeNetwork(null);
  render(<App sync={{ fetchFn: net.fetchFn, store: memoryStore(golden) }} now={now} />);
  expect(await screen.findByRole("region", { name: "Today, October 13, 2026" })).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(net.requests).toEqual(["/v2/feed/manifest.json"]);
});

test("the stored schedule shows at once; a newer one replaces it when it comes (EV-18)", async () => {
  const net = fakeNetwork(newerSchedule("Fresh festival"));
  net.delayMs = 40;
  render(<App sync={{ fetchFn: net.fetchFn, store: memoryStore(golden) }} now={now} />);
  await screen.findByRole("region", { name: "Today, October 13, 2026" });
  expect(firstTitle()).toContain("International Fall Festival");
  await waitFor(() => {
    expect(firstTitle()).toContain("Fresh festival");
  });
});

test("an unchanged version downloads nothing more", async () => {
  const net = fakeNetwork(golden);
  render(<App sync={{ fetchFn: net.fetchFn, store: memoryStore(golden) }} now={now} />);
  await screen.findByRole("region", { name: "Today, October 13, 2026" });
  await act(() => new Promise((r) => setTimeout(r, 20)));
  expect(net.requests).toEqual(["/v2/feed/manifest.json"]);
});

test("a newer schedule is applied silently: no message (EV-19)", async () => {
  const net = fakeNetwork(movedSchedule());
  const store = memoryStore(golden);
  render(<App sync={{ fetchFn: net.fetchFn, store }} now={now} />);
  const today = await screen.findByRole("region", { name: "Today, October 13, 2026" });
  await waitFor(() => {
    expect(rows(today)).toContain(
      "6:30 PM, Tuesday Rest and Reflect, Classes, 6:30 PM to 7:00 PM, at KMC DC",
    );
  });
  expect(store.saved()?.manifest.version).toBe(movedSchedule().manifest.version);
  await act(() => new Promise((r) => setTimeout(r, 20)));
  expect(document.querySelector(".ui-toast")).toBeNull();
  expect(screen.queryByText(/^Schedule updated$/)).toBeNull();
});

test("the splash is told once the schedule shows, or failed to load (EV-42)", async () => {
  const onReady = vi.fn();
  const { unmount } = render(
    <App
      sync={{ fetchFn: fakeNetwork().fetchFn, store: memoryStore() }}
      now={now}
      onReady={onReady}
    />,
  );
  await screen.findByRole("region", { name: "Today, October 13, 2026" });
  await waitFor(() => {
    expect(onReady).toHaveBeenCalledTimes(1);
  });
  unmount();
  const failed = vi.fn();
  render(
    <App
      sync={{ fetchFn: fakeNetwork(null).fetchFn, store: memoryStore() }}
      now={now}
      onReady={failed}
    />,
  );
  await screen.findByRole("alert", {}, { timeout: 3000 });
  await waitFor(() => {
    expect(failed).toHaveBeenCalledTimes(1);
  });
});

test("every return to the app checks again, even after a short break (EV-18)", async () => {
  const net = fakeNetwork(golden);
  const sync = { fetchFn: net.fetchFn, store: memoryStore(golden) };
  render(<App sync={sync} now={now} />);
  await screen.findByRole("region", { name: "Today, October 13, 2026" });
  const visibility = vi.spyOn(document, "visibilityState", "get");
  const away = async (ms: number) => {
    visibility.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    await act(() => new Promise((r) => setTimeout(r, ms)));
    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
  };
  await away(5); // the same version: the manifest only
  await waitFor(() => {
    expect(net.requests).toHaveLength(2);
  });
  net.serve(newerSchedule("Fresh festival"));
  await away(5);
  await screen.findAllByText(/Fresh festival/);
  expect(net.requests).toHaveLength(4); // manifest, then the new snapshot
  visibility.mockRestore();
});
