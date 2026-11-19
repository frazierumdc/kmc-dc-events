import { ALL, currentFilter, type KindFilter } from "./days.ts";

/**
 * The kind filter is remembered on the phone between launches (EV-15); the place in the list
 * is not. A remembered value the app no longer offers reads as All. Storage can be missing or
 * throw (private browsing, blocked site data), so reading falls back to All and saving
 * fails quietly.
 */

const KEY = "kmcdc.kindFilter";

type Store = Pick<Storage, "getItem" | "setItem">;

function defaultStore(): Store | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function readKindFilter(store: Store | null = defaultStore()): KindFilter {
  try {
    return currentFilter(store?.getItem(KEY) ?? ALL);
  } catch {
    return ALL;
  }
}

export function saveKindFilter(filter: KindFilter, store: Store | null = defaultStore()): void {
  try {
    store?.setItem(KEY, filter);
  } catch {
    // Not remembered this time; the filter still works.
  }
}
