// The address a notification opens (NT-15): the list at the event's date, `/?day=2026-11-18`,
// an Eastern calendar date. The update job writes it; the app reads it on opening. Pure.

import { easternDate } from "./time.ts";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The list at the Eastern date of `start`. */
export function dayAddress(start: string | Date): string {
  return `/?day=${easternDate(start)}`;
}

/** The date an address such as `?day=2026-11-18` asks for; null when it asks for none. */
export function dayFromSearch(search: string): string | null {
  const day = new URLSearchParams(search).get("day");
  if (day === null || !DAY.test(day)) return null;
  // A real date: 2026-02-31 isn't one.
  const date = new Date(`${day}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(day) ? day : null;
}
