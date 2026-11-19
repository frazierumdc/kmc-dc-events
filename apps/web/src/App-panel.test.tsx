import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "./App.tsx";
import {
  editedSchedule,
  fakeNetwork,
  golden,
  memoryStore,
  movedSchedule,
} from "../test/schedule.ts";
import { scrollTo, online, now } from "../test/app.tsx";

afterEach(cleanup);

beforeEach(() => {
  scrollTo.mockClear();
  vi.spyOn(window, "scrollTo").mockImplementation(scrollTo);
});

// ---- The details panel (slice 1.3: EV-30 – EV-38) ----

const festivalRow = async () =>
  within(await screen.findByRole("region", { name: "Today, October 13, 2026" })).getByRole("link", {
    name: /^All day, International Fall Festival/,
  });

test("tapping a row opens its panel at the event's address; ✕ closes it (EV-36, EV-37)", async () => {
  window.history.replaceState(null, "", "/");
  render(<App sync={online()} now={now} />);
  const row = await festivalRow();
  fireEvent.click(row);
  const panel = screen.getByRole("dialog", { name: "International Fall Festival" });
  expect(window.location.pathname).toBe("/e/c106c033-66a8-4f03-87eb-d9d4730f84ff");
  expect(document.activeElement?.textContent).toBe("International Fall Festival");
  expect(within(panel).getByText("Friday, October 9, 2026 at 7:30 PM")).toBeTruthy();
  expect(within(panel).getByText("to Thursday, October 15, 2026 at 12:00 PM Eastern")).toBeTruthy();
  fireEvent.click(within(panel).getByRole("button", { name: "Close" }));
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  expect(window.location.pathname).toBe("/");
  expect(document.activeElement).toBe(row);
});

test("Escape, Back and the dimmed background close the panel (EV-36)", async () => {
  window.history.replaceState(null, "", "/");
  render(<App sync={online()} now={now} />);
  const row = await festivalRow();
  const closesWith = async (close: (dialog: HTMLElement) => void) => {
    fireEvent.click(row);
    close(screen.getByRole("dialog"));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(window.location.pathname).toBe("/");
  };
  await closesWith((dialog) => fireEvent(dialog, new Event("cancel", { cancelable: true })));
  await closesWith(() => {
    window.history.back();
  });
  await closesWith((dialog) => fireEvent.click(dialog));
});

test("on the iPhone home screen the panel adds no history, so edge swipes show nothing (EV-36)", async () => {
  window.history.replaceState(null, "", "/");
  Object.defineProperty(navigator, "standalone", { value: true, configurable: true });
  try {
    render(<App sync={online()} now={now} />);
    const row = await festivalRow();
    const entries = window.history.length;
    fireEvent.click(row);
    const panel = screen.getByRole("dialog", { name: "International Fall Festival" });
    expect(window.location.pathname).toBe("/e/c106c033-66a8-4f03-87eb-d9d4730f84ff");
    expect(window.history.length).toBe(entries);
    fireEvent.click(within(panel).getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(window.location.pathname).toBe("/");
    expect(window.history.length).toBe(entries);
  } finally {
    Reflect.deleteProperty(navigator, "standalone");
  }
});

test("a link to an event opens its panel; closing leaves the list (EV-37)", async () => {
  window.history.replaceState(null, "", "/e/75442f2d-3890-4515-a92a-d6043fbe0cb5");
  render(<App sync={online()} now={now} />);
  const panel = await screen.findByRole("dialog", { name: "The Foundation Program" });
  expect(within(panel).getByText("Study Programs")).toBeTruthy();
  // Registration is closed on the website: More info, to the event's page (D36).
  expect(within(panel).queryByRole("link", { name: "Register" })).toBeNull();
  const more = within(panel).getByRole("link", { name: "More info" });
  expect(more.getAttribute("href")).toBe(
    "https://www.example.org/event-details/the-foundation-program-2026-10-18-12-00",
  );
  expect([more.getAttribute("target"), more.getAttribute("rel")]).toEqual(["_blank", "noopener"]);
  fireEvent.click(within(panel).getByRole("button", { name: "Close" }));
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  expect(window.location.pathname).toBe("/");
});

test("an online event's panel says Online and has no Directions (EV-32, EV-35)", async () => {
  const event = golden.snapshot.events.find((e) => e.location?.online);
  window.history.replaceState(null, "", `/e/${event?.id ?? ""}`);
  render(<App sync={online()} now={now} />);
  const panel = await screen.findByRole("dialog", {
    name: "Online: Silent Saturday: A Heart of Gratitude",
  });
  expect(within(panel).getByText("Online")).toBeTruthy();
  expect(within(panel).getByRole("link", { name: "Register" })).toBeTruthy();
  expect(within(panel).queryByRole("link", { name: "Directions" })).toBeNull();
  window.history.replaceState(null, "", "/");
});

test("Share copies the event's link where there is no share menu (EV-35)", async () => {
  const writeText = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  window.history.replaceState(null, "", "/e/4e19342f-344f-43e2-b641-676ce1a90a30");
  render(<App sync={online()} now={now} />);
  const panel = await screen.findByRole("dialog", { name: "Tuesday Rest and Reflect" });
  fireEvent.click(within(panel).getByRole("button", { name: "Share" }));
  expect(await within(panel).findByRole("button", { name: "Link copied" })).toBeTruthy();
  expect(writeText).toHaveBeenCalledWith(
    `${window.location.origin}/e/4e19342f-344f-43e2-b641-676ce1a90a30`,
  );
  window.history.replaceState(null, "", "/");
});

// ---- Quiet and honest (slice 1.11: NT-4 – NT-6) ----

/** The reader leaves the app and comes back, which checks the site. */
function comeBack() {
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

const restRow = async () =>
  within(await screen.findByRole("region", { name: "Today, October 13, 2026" })).getByRole("link", {
    name: /Tuesday Rest and Reflect/,
  });

test("an open event whose time changes says Updated just now, once (NT-5)", async () => {
  window.history.replaceState(null, "", "/");
  const net = fakeNetwork(golden);
  render(<App sync={{ fetchFn: net.fetchFn, store: memoryStore(golden) }} now={now} />);
  fireEvent.click(await restRow());
  const panel = screen.getByRole("dialog", { name: "Tuesday Rest and Reflect" });
  expect(within(panel).getByText("6:00 PM to 6:30 PM Eastern")).toBeTruthy();
  // The live region is there before anything is said.
  expect(within(panel).getByRole("status").textContent).toBe("");
  net.serve(movedSchedule());
  act(comeBack);
  await within(panel).findByText("6:30 PM to 7:00 PM Eastern");
  expect(within(panel).getByRole("status").textContent).toBe("Updated just now");
  expect(within(panel).getByRole("link", { name: /Register|More info/ })).toBeTruthy();
  // Closed and opened again, it is simply the event.
  fireEvent.click(within(panel).getByRole("button", { name: "Close" }));
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  fireEvent.click(await restRow());
  expect(
    within(screen.getByRole("dialog", { name: "Tuesday Rest and Reflect" })).getByRole("status")
      .textContent,
  ).toBe("");
});

test("an open event whose title alone changes says nothing (NT-5, EV-19)", async () => {
  window.history.replaceState(null, "", "/");
  const net = fakeNetwork(golden);
  render(<App sync={{ fetchFn: net.fetchFn, store: memoryStore(golden) }} now={now} />);
  fireEvent.click(await restRow());
  net.serve(
    editedSchedule((events) =>
      events.map((e) =>
        e.title === "Tuesday Rest and Reflect" ? { ...e, title: "Tuesday Rest" } : e,
      ),
    ),
  );
  act(comeBack);
  const panel = await screen.findByRole("dialog", { name: "Tuesday Rest" });
  expect(within(panel).getByRole("status").textContent).toBe("");
});

test("an event cancelled while its panel is open: the panel stays, says so, offers only Close (NT-5)", async () => {
  window.history.replaceState(null, "", "/");
  const net = fakeNetwork(golden);
  render(<App sync={{ fetchFn: net.fetchFn, store: memoryStore(golden) }} now={now} />);
  fireEvent.click(await restRow());
  const panel = screen.getByRole("dialog", { name: "Tuesday Rest and Reflect" });
  net.serve(
    editedSchedule((events) => events.filter((e) => e.title !== "Tuesday Rest and Reflect")),
  );
  act(comeBack);
  await within(panel).findByText("This event is no longer on the schedule");
  expect(within(panel).getByRole("status").textContent).toContain("no longer on the schedule");
  expect(within(panel).queryByText(/Eastern$/)).toBeNull();
  expect(within(panel).queryAllByRole("link")).toEqual([]);
  expect(
    within(panel)
      .getAllByRole("button")
      .map((b) => b.textContent || b.getAttribute("aria-label")),
  ).toEqual(["Close", "Close"]);
  fireEvent.click(within(panel).getByText("Close"));
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  expect(window.location.pathname).toBe("/");
  expect(screen.queryByText(/Tuesday Rest and Reflect/)).toBeNull();
});

test("no check for 10 minutes: the app says so, until one succeeds (NT-6)", async () => {
  const net = fakeNetwork(golden);
  let clock = Date.parse("2026-10-13T13:41:00Z"); // 9:41 AM Eastern
  const sync = { fetchFn: net.fetchFn, store: memoryStore(golden), now: () => clock };
  render(<App sync={sync} now={now} />);
  await screen.findByRole("region", { name: "Today, October 13, 2026" });
  await waitFor(() => {
    expect(net.requests).toHaveLength(1);
  });
  // The region is in the page, empty.
  const notice = () =>
    screen.getAllByRole("status").find((el) => el.parentElement?.tagName === "MAIN");
  expect(notice()?.textContent).toBe("");
  net.serve(null);
  clock += 9 * 60_000;
  act(comeBack);
  await waitFor(() => {
    expect(net.requests).toHaveLength(2);
  });
  expect(notice()?.textContent).toBe("");
  clock += 60_000;
  act(comeBack);
  await waitFor(() => {
    expect(notice()?.textContent).toBe(
      "Couldn’t check for changes since 9:41 AM. Before you go, check example.org.",
    );
  });
  expect(
    within(notice() as HTMLElement)
      .getByRole("link")
      .getAttribute("href"),
  ).toBe("https://example.org/");
  net.serve(golden);
  act(comeBack);
  await waitFor(() => {
    expect(notice()?.textContent).toBe("");
  });
});
