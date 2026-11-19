import { useCallback, useEffect, useRef } from "react";
import { DateStrip, listedFrom, useDayAtTop, type StripDay } from "@kmcdc/ui";
import type { KindFilter } from "./days.ts";

/**
 * The row of dates, marking the listed day at the top of the screen; a new filter, or a
 * newer schedule, keeps the marked date at the top (EV-13, EV-14, EV-19).
 */
export function FollowingStrip({
  days,
  listed,
  filter,
  version,
  arrival,
}: {
  days: StripDay[];
  listed: readonly string[];
  filter: KindFilter;
  version: string;
  /** The date a notification opened the app on, shown once (NT-15). */
  arrival: string | null;
}) {
  const { current, jumpTo } = useDayAtTop(listed, `${filter} ${version}`);
  const arrived = useRef(arrival === null);
  useEffect(() => {
    if (arrived.current || arrival === null || listed.length === 0) return;
    arrived.current = true;
    // The date itself, or the next listed day when nothing is left on it.
    const to = listedFrom(listed, arrival);
    if (to !== null) jumpTo(to);
  }, [arrival, listed, jumpTo]);
  const pick = useCallback(
    (date: string) => {
      const to = listedFrom(listed, date);
      if (to !== null) jumpTo(to);
    },
    [listed, jumpTo],
  );
  return <DateStrip days={days} current={current} onPick={pick} slideKey={filter} />;
}
