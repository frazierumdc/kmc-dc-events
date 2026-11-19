import { afterEach, expect, test, vi } from "vitest";
import { applyWaitingVersion, startAppUpdate, type AppUpdateEnv } from "./app-update.ts";

// The update rules (EV-21) with a fake service-worker container; the real thing runs in
// e2e/tests/sw.spec.ts.

afterEach(() => {
  vi.useRealTimers();
});

function fakeEnv({ waiting = false, controlled = true } = {}) {
  const container = new EventTarget();
  const doc = Object.assign(new EventTarget(), {
    visibilityState: "visible",
  });
  const posted: unknown[] = [];
  const workbox = { register: vi.fn() };
  const registration = Object.assign(new EventTarget(), {
    installing: null as EventTarget | null,
    waiting: waiting ? { postMessage: (m: unknown) => posted.push(m) } : null,
    update: vi.fn(() => Promise.resolve()),
  });
  workbox.register.mockResolvedValue(registration);
  let clock = 0;
  const env = {
    container: Object.assign(container, {
      getRegistration: () => Promise.resolve(registration),
      controller: controlled ? {} : null,
    }),
    createWorkbox: () => workbox,
    reload: vi.fn(),
    now: () => clock,
    document: doc,
  } as unknown as AppUpdateEnv;
  return {
    env,
    posted,
    registration,
    workbox,
    takeOver: () => container.dispatchEvent(new Event("controllerchange")),
    away: (ms: number) => {
      doc.visibilityState = "hidden";
      doc.dispatchEvent(new Event("visibilitychange"));
      clock += ms;
      doc.visibilityState = "visible";
      doc.dispatchEvent(new Event("visibilitychange"));
    },
    tick: (ms: number) => {
      clock += ms;
    },
    waitingNow: (yes: boolean) => {
      registration.waiting = yes ? { postMessage: (m: unknown) => posted.push(m) } : null;
    },
    /** The browser finds a new version, downloads it, and it waits. */
    found: () => {
      const worker = Object.assign(new EventTarget(), { state: "installing" });
      registration.installing = worker;
      registration.dispatchEvent(new Event("updatefound"));
      worker.state = "installed";
      registration.installing = null;
      registration.waiting = { postMessage: (m: unknown) => posted.push(m) };
      worker.dispatchEvent(new Event("statechange"));
    },
  };
}

test("opening with nothing waiting shows the app", async () => {
  const f = fakeEnv();
  expect(await applyWaitingVersion(f.env)).toBe(false);
  expect(f.posted).toEqual([]);
});

test("opening with a version waiting switches to it and reloads before showing the app", async () => {
  const f = fakeEnv({ waiting: true });
  const applied = applyWaitingVersion(f.env);
  await vi.waitFor(() => {
    expect(f.posted).toEqual([{ type: "SKIP_WAITING" }]);
  });
  f.takeOver();
  expect(await applied).toBe(true);
  expect(f.env.reload).toHaveBeenCalledOnce();
});

test("a waiting version that doesn't take over in time doesn't block the app", async () => {
  vi.useFakeTimers();
  const f = fakeEnv({ waiting: true });
  const applied = applyWaitingVersion(f.env);
  await vi.advanceTimersByTimeAsync(3_000);
  expect(await applied).toBe(false);
  expect(f.env.reload).not.toHaveBeenCalled();
});

test("every return applies a waiting version, or looks for one", async () => {
  const f = fakeEnv();
  startAppUpdate(f.env);
  await vi.waitFor(() => {
    expect(f.workbox.register).toHaveBeenCalled();
  });

  f.away(2_000); // nothing waiting, even after a short break: look for a new version
  await vi.waitFor(() => {
    expect(f.registration.update).toHaveBeenCalledOnce();
  });

  f.waitingNow(true);
  f.away(2_000); // one waiting: apply it
  await vi.waitFor(() => {
    expect(f.posted).toEqual([{ type: "SKIP_WAITING" }]);
  });
  f.takeOver();
  await vi.waitFor(() => {
    expect(f.env.reload).toHaveBeenCalledOnce();
  });
});

test("a version found just after opening or returning applies at once; later, it waits", async () => {
  const f = fakeEnv();
  startAppUpdate(f.env);
  await vi.waitFor(() => {
    expect(f.workbox.register).toHaveBeenCalled();
  });
  await Promise.resolve();

  f.tick(11_000); // well into reading: it waits
  f.found();
  await new Promise((r) => setTimeout(r, 0));
  expect(f.posted).toEqual([]);

  f.waitingNow(false);
  f.away(5_000); // back: it looks, and a version arrives a few seconds later: applied
  await vi.waitFor(() => {
    expect(f.registration.update).toHaveBeenCalledOnce();
  });
  f.tick(4_000);
  f.found();
  await vi.waitFor(() => {
    expect(f.posted).toEqual([{ type: "SKIP_WAITING" }]);
  });
});

test("however long the app has been loaded, each version found just after a return applies", async () => {
  const f = fakeEnv();
  startAppUpdate(f.env);
  await vi.waitFor(() => {
    expect(f.workbox.register).toHaveBeenCalled();
  });
  await Promise.resolve();
  for (const n of [1, 2, 3]) {
    f.waitingNow(false);
    f.away(3_600_000); // an hour away, the app still loaded
    await vi.waitFor(() => {
      expect(f.registration.update).toHaveBeenCalledTimes(n);
    });
    f.found();
    await vi.waitFor(() => {
      expect(f.posted).toHaveLength(n);
    });
    f.takeOver();
    await vi.waitFor(() => {
      expect(f.env.reload).toHaveBeenCalledTimes(n);
    });
    await new Promise((r) => setTimeout(r, 0));
  }
});

test("the first install, with nothing controlling the page, doesn't reload", async () => {
  const f = fakeEnv({ controlled: false });
  startAppUpdate(f.env);
  await vi.waitFor(() => {
    expect(f.workbox.register).toHaveBeenCalled();
  });
  await Promise.resolve();
  f.found();
  await new Promise((r) => setTimeout(r, 0));
  expect(f.posted).toEqual([]);
});
