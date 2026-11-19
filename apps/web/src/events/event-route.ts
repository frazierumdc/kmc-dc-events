import { useCallback, useEffect, useState } from "react";

/**
 * The open details panel lives in the address, `/e/{id}` with the source's own id (EV-37,
 * D39), so a shared link
 * opens it and Back closes it (EV-36). Opening from the list adds a history entry; closing
 * goes back over it. A panel opened from a link has no entry of ours under it, so closing
 * replaces the address with the list's.
 *
 * The iPhone home-screen app adds no entry: there the phone's edge swipes would show the
 * last panel again (forward) or the list under it (back), and iPhone sheets close by
 * swiping down, not back. Opening and closing only replace the address.
 */

const EVENT_PATH = /^\/e\/([A-Za-z0-9_-]{1,64})\/?$/;

/** Marks the history entry the app added when it opened a panel. */
const OPENED = "kmcdc-sheet";

export function eventPath(id: string): string {
  return `/e/${id}`;
}

/** The event id in an address such as `/e/3efe9c7a-d27a-480c-912b-3ba7ed7de483`, if any. */
export function eventIdFromPath(path: string): string | null {
  return EVENT_PATH.exec(path)?.[1] ?? null;
}

/** The app runs from the iPhone home screen (Safari's own flag). */
export function onIphoneHomeScreen(): boolean {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function useEventRoute() {
  const [id, setId] = useState(() => eventIdFromPath(window.location.pathname));

  useEffect(() => {
    const follow = () => {
      setId(eventIdFromPath(window.location.pathname));
    };
    window.addEventListener("popstate", follow);
    return () => {
      window.removeEventListener("popstate", follow);
    };
  }, []);

  const open = useCallback((next: string) => {
    if (onIphoneHomeScreen()) window.history.replaceState(null, "", eventPath(next));
    else window.history.pushState({ [OPENED]: true }, "", eventPath(next));
    setId(next);
  }, []);

  const close = useCallback(() => {
    const state: unknown = window.history.state;
    if (typeof state === "object" && state !== null && OPENED in state) {
      window.history.back();
      return;
    }
    window.history.replaceState(null, "", "/");
    setId(null);
  }, []);

  return { id, open, close };
}
