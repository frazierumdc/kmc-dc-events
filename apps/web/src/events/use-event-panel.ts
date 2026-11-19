import { useCallback, useRef, useState } from "react";
import { returnFocus } from "@kmcdc/ui";
import { findListed, type Day, type DayEntry } from "./days.ts";
import { eventPath, useEventRoute } from "./event-route.ts";
import { eventSheet } from "./sheet.ts";

export interface EventPanelState {
  /** The event the panel shows; the last one opened stays while the panel slides away. */
  shown: DayEntry | null;
  open: boolean;
  /** What to tell the reader: it changed, or left the schedule, while its panel was open (NT-5). */
  change: "gone" | "updated" | null;
  /** A row was tapped: opens its event at the event's own address (EV-37). */
  openRow: (row: HTMLAnchorElement, id: string) => void;
  close: () => void;
  /** After the panel has gone: focus goes back to the row it was opened from (EV-36). */
  closed: () => void;
}

/**
 * The details panel (EV-36, EV-37): which event it shows, by the address, and what changed
 * under it while it was open (NT-5).
 */
export function useEventPanel(days: Day[]): EventPanelState {
  const route = useEventRoute();
  const opener = useRef<HTMLAnchorElement | null>(null);
  const opened = route.id === null ? null : findListed(days, route.id);
  // The last event opened stays in the panel while it slides away.
  const [shown, setShown] = useState(opened);
  // Its date, time or place changed while its panel was open (NT-5).
  const [updated, setUpdated] = useState(false);
  if (opened !== null && opened.event !== shown?.event) {
    if (shown?.event.id !== opened.event.id) setUpdated(false);
    else if (whenAndWhere(shown.event) !== whenAndWhere(opened.event)) setUpdated(true);
    setShown(opened);
  }
  // It left the schedule while its panel was open: the panel stays and says so (NT-5).
  const gone = route.id !== null && opened === null && shown?.event.id === route.id;
  const openRoute = route.open;
  const openRow = useCallback(
    (row: HTMLAnchorElement, id: string) => {
      opener.current = row;
      openRoute(id);
    },
    [openRoute],
  );
  const closed = () => {
    const row =
      opener.current?.isConnected === true
        ? opener.current
        : shown && document.querySelector<HTMLElement>(`a[href="${eventPath(shown.event.id)}"]`);
    opener.current = null;
    setUpdated(false);
    // A panel closed on an event that is gone has nothing to open again.
    if (shown && !findListed(days, shown.event.id)) setShown(null);
    if (row) returnFocus(row);
  };
  return {
    shown,
    open: opened !== null || gone,
    change: gone ? "gone" : updated ? "updated" : null,
    openRow,
    close: route.close,
    closed,
  };
}

/** What the panel says of an event's date, time and place: a change in it is told (NT-5). */
function whenAndWhere(event: Parameters<typeof eventSheet>[0]): string {
  const { when, where } = eventSheet(event);
  return [...when, ...where.lines].join("\n");
}
