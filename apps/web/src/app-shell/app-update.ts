import { Workbox } from "workbox-window";

/**
 * Keeps the app itself up to date (EV-21). The service worker keeps the app's files on the
 * phone, so it opens with no connection. Nothing asks the reader:
 *
 * - opening the app, or coming back to it, applies a version that is waiting (one quick
 *   reload), or looks for one;
 * - a version that finishes downloading within a few seconds of that is applied at once;
 * - one that finishes later, while the reader is reading, waits for the next return.
 *
 * The reload says nothing: only a newer schedule is told (EV-19).
 *
 * New versions are watched on the registration itself: Workbox reports only the first
 * version found more than a minute after the page loaded, and a home-screen app can stay
 * loaded for days.
 *
 * Without the reload on opening, an iPhone home-screen app would keep the old version
 * until it was fully closed.
 */

/** The parts of the browser this needs; tests pass fakes. */
export interface AppUpdateEnv {
  container: Pick<ServiceWorkerContainer, "getRegistration" | "addEventListener" | "controller">;
  createWorkbox: (url: string) => Pick<Workbox, "register">;
  reload: () => void;
  now: () => number;
  document: Pick<Document, "addEventListener" | "visibilityState">;
}

/** How soon after opening or returning a new version may still be applied at once. */
const FRESH_MS = 10_000;
/** How long opening waits for a waiting version to take over before showing the app. */
const TAKEOVER_MS = 3_000;

export function browserEnv(): AppUpdateEnv | null {
  if (!("serviceWorker" in navigator)) return null;
  return {
    container: navigator.serviceWorker,
    createWorkbox: (url) => new Workbox(url),
    reload: () => {
      location.reload();
    },
    now: () => Date.now(),
    document,
  };
}

/**
 * Applies a version that was already waiting; resolves true once it has taken over and the
 * page is reloading (don't show the app), false when there was none or it didn't take over
 * in time (show the app anyway).
 */
export async function applyWaitingVersion(env: AppUpdateEnv): Promise<boolean> {
  const registration = await env.container.getRegistration();
  const waiting = registration?.waiting;
  if (!waiting) return false;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(false);
    }, TAKEOVER_MS);
    env.container.addEventListener(
      "controllerchange",
      () => {
        clearTimeout(timer);
        env.reload();
        resolve(true);
      },
      { once: true },
    );
    waiting.postMessage({ type: "SKIP_WAITING" });
  });
}

/** Registers the service worker and watches for new versions. */
export function startAppUpdate(env: AppUpdateEnv, url = "/sw.js"): void {
  const workbox = env.createWorkbox(url);
  let registration: ServiceWorkerRegistration | undefined;
  let arrived = env.now();
  let applying: Promise<boolean> | null = null;
  const apply = () => {
    applying ??= applyWaitingVersion(env).finally(() => {
      applying = null;
    });
    return applying;
  };

  // A version found on opening (the browser looks then) or just after a return. The first
  // install, with no version controlling the page yet, needs no reload.
  const installed = () => {
    if (
      env.container.controller &&
      env.document.visibilityState === "visible" &&
      env.now() - arrived <= FRESH_MS
    )
      void apply();
  };
  const track = (worker: ServiceWorker | null) => {
    worker?.addEventListener("statechange", () => {
      if (worker.state === "installed") installed();
    });
  };
  void workbox.register().then((r) => {
    if (!r) return;
    registration = r;
    r.addEventListener("updatefound", () => {
      track(r.installing);
    });
    track(r.installing);
    if (r.waiting) installed();
  });

  // Coming back counts as opening: apply a waiting version, or look for one (home-screen
  // apps rarely look by themselves).
  env.document.addEventListener("visibilitychange", () => {
    if (env.document.visibilityState !== "visible") return;
    arrived = env.now();
    void apply().then((applied) => {
      if (!applied) void registration?.update().catch(() => undefined);
    });
  });
}
