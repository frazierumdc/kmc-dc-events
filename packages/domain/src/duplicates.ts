import type { SnapshotV2Event } from "./website.ts";

/**
 * Events the website lists twice, and different events at the same time and place (AN-13):
 * what the Duplicate events email lists for staff to fix in Wix. The app keeps listing
 * them as the website does (D36).
 */

/** Events at one start and place: the same event twice, or different events (a clash). */
export interface SameTimeAndPlace {
  start: string;
  events: SnapshotV2Event[];
}

export interface Duplicates {
  /** Two or more events with the same title at the same start and place. */
  duplicates: SameTimeAndPlace[];
  /** Different titles at the same start and place: one event for each title. */
  clashes: SameTimeAndPlace[];
}

/** Titles match ignoring capitals and spacing. */
const titleKey = (title: string) => title.trim().replace(/\s+/g, " ").toLowerCase();

/** The place is the address, since the website names one venue several ways; null when none. */
function placeKey(e: SnapshotV2Event): string | null {
  const place = e.location?.address ?? e.location?.name ?? null;
  return place === null ? null : titleKey(place);
}

const byTitle = (a: SnapshotV2Event, b: SnapshotV2Event) =>
  a.title.localeCompare(b.title, "en") || a.page.localeCompare(b.page, "en");

export function findDuplicates(events: readonly SnapshotV2Event[]): Duplicates {
  const atOnce = new Map<string, SnapshotV2Event[]>();
  for (const e of events) {
    const place = placeKey(e);
    if (place === null) continue;
    const key = `${String(Date.parse(e.start))}\n${place}`;
    atOnce.set(key, [...(atOnce.get(key) ?? []), e]);
  }

  const result: Duplicates = { duplicates: [], clashes: [] };
  for (const group of atOnce.values()) {
    if (group.length < 2) continue;
    const byName = new Map<string, SnapshotV2Event[]>();
    for (const e of group) {
      const key = titleKey(e.title);
      byName.set(key, [...(byName.get(key) ?? []), e]);
    }
    const start = group[0]?.start ?? "";
    for (const same of byName.values())
      if (same.length > 1) result.duplicates.push({ start, events: same.sort(byTitle) });
    if (byName.size > 1) {
      const one = [...byName.values()].flatMap((same) => same.slice(0, 1));
      result.clashes.push({ start, events: one.sort(byTitle) });
    }
  }
  const byStart = (a: SameTimeAndPlace, b: SameTimeAndPlace) =>
    Date.parse(a.start) - Date.parse(b.start) ||
    (a.events[0]?.title ?? "").localeCompare(b.events[0]?.title ?? "", "en");
  result.duplicates.sort(byStart);
  result.clashes.sort(byStart);
  return result;
}
