import { dayFromSearch } from "@kmcdc/domain";

/**
 * The date a notification opened the app on (NT-15), read once from an address such as
 * `/?day=2026-11-18` and then taken out of it, so a reload or a shared link doesn't jump
 * there again. Null when the app was opened any other way.
 */
export function takeArrivalDay(
  location: Pick<Location, "pathname" | "search" | "hash"> = window.location,
  history: Pick<History, "replaceState" | "state"> = window.history,
): string | null {
  const day = dayFromSearch(location.search);
  if (new URLSearchParams(location.search).has("day"))
    history.replaceState(history.state, "", `${location.pathname}${location.hash}`);
  return day;
}
