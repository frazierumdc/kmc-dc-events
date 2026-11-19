import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import {
  fakeNetwork,
  golden,
  memoryStore,
  movedSchedule,
  newerSchedule,
} from "../../test/schedule.ts";
import type { LiveSource } from "./live-version.ts";
import { CHECK_EVERY_MS, useSchedule, type ScheduleSync } from "./use-schedule.ts";

// Keeping the schedule fresh (EV-18, EV-19): the stored schedule shows at once, a newer one
// is applied silently as soon as it comes.

async function ready(sync: ScheduleSync) {
  const hook = renderHook(() => useSchedule(sync));
  await waitFor(() => {
    expect(hook.result.current.state.status).toBe("ready");
  });
  return hook;
}

/** The version shown. */
const shown = (hook: Awaited<ReturnType<typeof ready>>) => {
  const { state } = hook.result.current;
  return state.status === "ready" ? state.schedule.manifest.version : undefined;
};

/** The reader comes back to the app. */
function returnToApp() {
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

test("a first visit loads the schedule and stores it", async () => {
  const store = memoryStore();
  const hook = await ready({ fetchFn: fakeNetwork().fetchFn, store });
  expect(shown(hook)).toBe(golden.manifest.version);
  await waitFor(() => {
    expect(store.saved()?.manifest.version).toBe(golden.manifest.version);
  });
});

test("the stored schedule shows at once, without waiting for the network (EV-18, NFR-1)", async () => {
  const net = fakeNetwork(movedSchedule());
  net.delayMs = 5_000;
  const hook = await ready({ fetchFn: net.fetchFn, store: memoryStore(golden) });
  expect(shown(hook)).toBe(golden.manifest.version);
  hook.unmount();
});

test("a newer schedule on opening is stored and applied silently (EV-19)", async () => {
  const net = fakeNetwork(movedSchedule());
  const store = memoryStore(golden);
  const hook = await ready({ fetchFn: net.fetchFn, store });
  await waitFor(() => {
    expect(shown(hook)).toBe(movedSchedule().manifest.version);
  });
  expect(store.saved()?.manifest.version).toBe(movedSchedule().manifest.version);
  expect(Object.keys(hook.result.current.state)).toEqual(["status", "schedule"]);
});

test("offline, or the same schedule: the stored one stays", async () => {
  for (const files of [null, golden]) {
    const net = fakeNetwork(files);
    const hook = await ready({ fetchFn: net.fetchFn, store: memoryStore(golden) });
    await waitFor(() => {
      expect(net.requests.some((r) => r.endsWith("manifest.json"))).toBe(true);
    });
    expect(shown(hook)).toBe(golden.manifest.version);
    hook.unmount();
  }
});

test("every return to the app checks again and applies a newer schedule", async () => {
  const net = fakeNetwork(golden);
  const hook = await ready({ fetchFn: net.fetchFn, store: memoryStore(golden) });
  await waitFor(() => {
    expect(net.requests.filter((r) => r.endsWith("manifest.json")).length).toBe(1);
  });
  net.serve(newerSchedule());
  act(returnToApp);
  await waitFor(() => {
    expect(shown(hook)).toBe(newerSchedule().manifest.version);
  });
});

// On screen (D64): the live connection, the check every minute and the connection returning
// all end in the same check of the site.

const manifestChecks = (net: ReturnType<typeof fakeNetwork>) =>
  net.requests.filter((r) => r.endsWith("manifest.json")).length;

/** A stand-in for the live connection. */
function fakeLive() {
  let listener: ((event: { data: string }) => void) | null = null;
  const live = {
    opened: 0,
    closed: 0,
    open: (): LiveSource => {
      live.opened++;
      return {
        addEventListener: (type, l) => {
          if (type === "put") listener = l;
        },
        close: () => {
          live.closed++;
          listener = null;
        },
      };
    },
    publish: (version: string) =>
      listener?.({ data: JSON.stringify({ path: "/", data: version }) }),
  };
  return live;
}

test("a publish heard over the live connection loads the site's schedule at once (NT-1, NT-3)", async () => {
  const net = fakeNetwork(golden);
  const live = fakeLive();
  const hook = await ready({
    fetchFn: net.fetchFn,
    store: memoryStore(golden),
    liveUrl: "https://db.example/live/version.json",
    openLive: live.open,
  });
  await waitFor(() => {
    expect(live.opened).toBe(1);
    expect(manifestChecks(net)).toBe(1);
  });
  // The version already shown: nothing to fetch.
  act(() => live.publish(golden.manifest.version));
  expect(manifestChecks(net)).toBe(1);
  // A new one: the schedule comes from the site, whatever the record said.
  net.serve(newerSchedule());
  act(() => live.publish("anything-new"));
  await waitFor(() => {
    expect(shown(hook)).toBe(newerSchedule().manifest.version);
  });
  hook.unmount();
  expect(live.closed).toBe(1);
});

test("off screen nothing listens; the return listens again (NT-1)", async () => {
  const live = fakeLive();
  const hook = await ready({
    fetchFn: fakeNetwork(golden).fetchFn,
    store: memoryStore(golden),
    liveUrl: "https://db.example/live/version.json",
    openLive: live.open,
  });
  await waitFor(() => {
    expect(live.opened).toBe(1);
  });
  act(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(live.closed).toBe(1);
  act(returnToApp);
  expect(live.opened).toBe(2);
  hook.unmount();
});

test("on screen the site is checked every 60 seconds (NT-2)", async () => {
  const timers = vi.spyOn(globalThis, "setInterval");
  try {
    const net = fakeNetwork(golden);
    const hook = await ready({ fetchFn: net.fetchFn, store: memoryStore(golden), liveUrl: "" });
    await waitFor(() => {
      expect(manifestChecks(net)).toBe(1);
    });
    const every = timers.mock.calls.filter(([, ms]) => ms === CHECK_EVERY_MS);
    expect(every).toHaveLength(1);
    net.serve(newerSchedule());
    // The minute passes.
    act(() => {
      (every[0]?.[0] as () => void)();
    });
    await waitFor(() => {
      expect(shown(hook)).toBe(newerSchedule().manifest.version);
    });
    hook.unmount();
  } finally {
    timers.mockRestore();
  }
});

test("the connection returning checks at once (NT-2)", async () => {
  const net = fakeNetwork(golden);
  const hook = await ready({ fetchFn: net.fetchFn, store: memoryStore(golden), liveUrl: "" });
  await waitFor(() => {
    expect(manifestChecks(net)).toBe(1);
  });
  net.serve(newerSchedule());
  act(() => {
    window.dispatchEvent(new Event("online"));
  });
  await waitFor(() => {
    expect(shown(hook)).toBe(newerSchedule().manifest.version);
  });
  hook.unmount();
});
