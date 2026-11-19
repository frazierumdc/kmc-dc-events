import type { SafariGuide } from "@kmcdc/ui";

/**
 * The Safari bar picked in Settings' "Not what you see?" is remembered on the phone (IN-4).
 * Storage can be missing or throw, so reading gives nothing and saving fails quietly.
 */

const KEY = "kmcdc.safariGuide";
const GUIDES: readonly SafariGuide[] = ["ios27", "ios26", "share-bar"];

type Store = Pick<Storage, "getItem" | "setItem">;

function defaultStore(): Store | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function readSafariGuide(store: Store | null = defaultStore()): SafariGuide | null {
  try {
    const value = store?.getItem(KEY);
    return GUIDES.find((g) => g === value) ?? null;
  } catch {
    return null;
  }
}

export function saveSafariGuide(guide: SafariGuide, store: Store | null = defaultStore()): void {
  try {
    store?.setItem(KEY, guide);
  } catch {
    // Not remembered this time; the steps still show.
  }
}
