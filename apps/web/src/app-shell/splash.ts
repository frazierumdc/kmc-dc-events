/**
 * The splash (EV-42), drawn by index.html from the first frame. It stays for 3 seconds from
 * the app's start, and longer if the schedule isn't ready yet, then fades. It comes back
 * for 3 seconds on returning to the app after 5 minutes or more away, while the app checks
 * for a newer schedule behind it (EV-18). A tap takes it away once the schedule is ready.
 * A shared event's link, and /get-app's Open the app (IN-10), open with no splash. While it shows, the app behind it can't be
 * reached (`inert`), so screen readers read the splash's name only.
 */

/** How long the splash shows. */
export const SPLASH_MS = 3000;
/** Away from the app this long, it shows again on return. */
export const AWAY_MS = 5 * 60_000;
/** The fade (splash.css), after which it is hidden. */
const FADE_MS = 400;

export interface Splash {
  /** The schedule shows (or failed to load): the splash may go once its 3 seconds are up. */
  ready: () => void;
  /** The splash is showing now. */
  covering: () => boolean;
  /** Called each time the splash shows again (after 5 minutes or more away). */
  onCover: (listener: () => void) => () => void;
  /**
   * Featured events follow the splash (EV-44): once its 3 seconds are up (or it is tapped) it
   * goes and `then` shows them.
   */
  handOff: (then: () => void) => void;
}

export interface SplashEnv {
  doc?: Document;
  /** Wall-clock time, for time away (a sleeping phone's other clocks may stop). */
  clock?: () => number;
  /** Milliseconds since the app started loading. */
  sinceStart?: () => number;
}

export function startSplash({
  doc = document,
  clock = () => Date.now(),
  sinceStart = () => performance.now(),
}: SplashEnv = {}): Splash {
  const el = doc.getElementById("splash");
  const root = doc.getElementById("root");
  const data = doc.documentElement.dataset;
  if (!el || data.nosplash === "off") {
    if (el) el.hidden = true;
    return {
      ready: () => undefined,
      covering: () => false,
      onCover: () => () => undefined,
      handOff: (then) => {
        then();
      },
    };
  }

  let isReady = false;
  let timeUp = false;
  let showing = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let hiddenAt: number | null = null;
  const listeners = new Set<() => void>();
  // What shows once the splash goes, when featured events follow it (EV-44).
  let next: (() => void) | null = null;

  const hide = () => {
    if (!showing) return;
    showing = false;
    const then = next;
    next = null;
    then?.();
    el.classList.add("splash-out");
    if (root) root.inert = false;
    setTimeout(() => {
      if (!showing) el.hidden = true;
    }, FADE_MS);
  };
  const maybeHide = () => {
    if (isReady && timeUp) hide();
  };
  const show = (ms: number) => {
    showing = true;
    timeUp = false;
    el.hidden = false;
    el.classList.remove("splash-out");
    if (root) root.inert = true;
    clearTimeout(timer);
    timer = setTimeout(
      () => {
        timeUp = true;
        maybeHide();
      },
      Math.max(0, ms),
    );
  };

  if (data.nosplash === "link") {
    // Straight to the shared event or the app; later returns show the splash as usual.
    delete data.nosplash;
    el.hidden = true;
  } else {
    show(SPLASH_MS - sinceStart());
  }

  el.addEventListener("click", () => {
    timeUp = true;
    maybeHide();
  });
  doc.addEventListener("visibilitychange", () => {
    if (doc.visibilityState === "hidden") {
      hiddenAt = clock();
      return;
    }
    if (hiddenAt !== null && clock() - hiddenAt >= AWAY_MS) {
      show(SPLASH_MS);
      for (const listener of listeners) listener();
    }
    hiddenAt = null;
  });

  return {
    ready: () => {
      isReady = true;
      maybeHide();
    },
    covering: () => showing,
    onCover: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    handOff: (then) => {
      if (!showing) {
        then();
        return;
      }
      isReady = true;
      next = then;
      maybeHide();
    },
  };
}
