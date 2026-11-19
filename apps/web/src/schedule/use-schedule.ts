import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchManifest,
  fetchSnapshot,
  loadSchedule,
  ScheduleError,
  type Schedule,
} from "./schedule.ts";
import { indexedDbStore, type ScheduleStore } from "./schedule-store.ts";
import { browserSource, listenLive, type OpenLiveSource } from "./live-version.ts";

/**
 * Keeps the schedule fresh (EV-18, EV-19). On opening the stored schedule shows at once,
 * with no wait for the network (NFR-1); then, and on every return to the app, the small
 * manifest is fetched, and only a new version downloads the snapshot, which is stored and
 * applied at once, silently. On opening and after a long time away the splash covers this
 * (EV-42), so the list doesn't change under the reader.
 *
 * While the app is on screen (D64): a live connection, started once the list shows, says
 * when a schedule is published (NT-1); behind it the manifest is checked every 60 seconds,
 * and at once when the connection returns (NT-2). Every route ends in the same check, which
 * loads the schedule the site names, so none can apply an older one (NT-3).
 */

/** How often an app on screen checks the site (NT-2). */
export const CHECK_EVERY_MS = 60_000;
/** After this long without a successful check, the app says so (NT-6). */
export const STALE_AFTER_MS = 10 * 60_000;

export interface ScheduleSync {
  fetchFn?: typeof fetch;
  store?: ScheduleStore;
  /** The live record's address; empty where a stage has none. */
  liveUrl?: string;
  openLive?: OpenLiveSource | null;
  /** The clock, in milliseconds; tests move it. */
  now?: () => number;
}

export type ScheduleState =
  | { status: "loading" }
  | { status: "ready"; schedule: Schedule }
  | { status: "error"; message: string };

export function useSchedule({
  fetchFn = fetch,
  store = indexedDbStore,
  liveUrl = __LIVE_URL__,
  openLive = browserSource,
  now = Date.now,
}: ScheduleSync = {}) {
  const [state, setState] = useState<ScheduleState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  // The schedule shown.
  const current = useRef<Schedule | null>(null);
  // Since when no check has succeeded, once that is 10 minutes (NT-6); null while all is well.
  const [staleSince, setStaleSince] = useState<Date | null>(null);
  // The last check that reached the site; before the first, when this visit began checking.
  const lastChecked = useRef<number | null>(null);

  /** Shows `schedule`; nothing changes if it already shows. */
  const show = useCallback((schedule: Schedule) => {
    current.current = schedule;
    setState((s) =>
      s.status === "ready" && s.schedule === schedule ? s : { status: "ready", schedule },
    );
  }, []);

  /** Looks for a newer schedule than `shown` and applies it as soon as it comes. */
  const check = useCallback(
    async (shown: Schedule, alive: () => boolean) => {
      let newer: Schedule | null = null;
      lastChecked.current ??= now();
      try {
        const manifest = await fetchManifest(fetchFn);
        if (manifest.manifest.version !== shown.manifest.version)
          newer = await fetchSnapshot(manifest, fetchFn);
        lastChecked.current = now();
        if (alive()) setStaleSince(null);
      } catch {
        // Offline or a bad file: keep the stored schedule (NFR-4), and say so once no
        // check has succeeded for 10 minutes (NT-6).
        const since = lastChecked.current;
        if (alive() && now() - since >= STALE_AFTER_MS) setStaleSince((s) => s ?? new Date(since));
        return;
      }
      if (!newer) return;
      await store.write(newer);
      if (!alive() || current.current !== shown) return;
      show(newer);
    },
    [fetchFn, store, show, now],
  );

  useEffect(() => {
    const life = { alive: true };
    const isAlive = () => life.alive;
    void (async () => {
      const stored = await store.read();
      if (!isAlive()) return;
      if (stored) {
        show(stored);
        await check(stored, isAlive);
        return;
      }
      try {
        const loaded = await loadSchedule(fetchFn);
        // A first visit's download is a check that succeeded (NT-6).
        lastChecked.current = now();
        if (!isAlive()) return;
        show(loaded);
        await store.write(loaded);
      } catch (error) {
        if (!isAlive()) return;
        const message =
          error instanceof ScheduleError ? error.message : "The schedule couldn't be loaded.";
        setState({ status: "error", message });
      }
    })();
    return () => {
      life.alive = false;
    };
  }, [attempt, fetchFn, store, check, show, now]);

  // Every return to the app checks again, and so does every minute on screen, the
  // connection coming back, and a publish heard over the live connection.
  const ready = state.status === "ready";
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const isAlive = () => alive;
    const checkNow = () => {
      const shown = current.current;
      if (shown) void check(shown, isAlive);
    };
    let stopWatching: (() => void) | null = null;
    const watch = () => {
      if (stopWatching) return;
      const timer = setInterval(checkNow, CHECK_EVERY_MS);
      const stopLive = listenLive(
        liveUrl,
        (version) => {
          if (current.current && version !== current.current.manifest.version) checkNow();
        },
        openLive,
      );
      stopWatching = () => {
        clearInterval(timer);
        stopLive();
      };
    };
    const onChange = () => {
      if (document.visibilityState !== "visible") {
        // Off screen nothing listens or polls: the return checks at once.
        stopWatching?.();
        stopWatching = null;
        return;
      }
      checkNow();
      watch();
    };
    const onOnline = () => {
      if (document.visibilityState === "visible") checkNow();
    };
    if (document.visibilityState === "visible") watch();
    document.addEventListener("visibilitychange", onChange);
    window.addEventListener("online", onOnline);
    return () => {
      alive = false;
      stopWatching?.();
      document.removeEventListener("visibilitychange", onChange);
      window.removeEventListener("online", onOnline);
    };
  }, [ready, check, liveUrl, openLive]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry, staleSince };
}
