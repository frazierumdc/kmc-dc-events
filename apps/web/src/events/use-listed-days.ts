import { useMemo } from "react";
import type { SnapshotV2 } from "@kmcdc/domain";
import type { StripDay } from "@kmcdc/ui";
import { dateStrip } from "./date-strip.ts";
import { filterDays, upcomingDays, type Day, type KindFilter } from "./days.ts";

/**
 * The schedule as the screen lists it: every upcoming day, the days left after the kind
 * filter, their dates, and the row of dates. Worked out again only when the schedule, the
 * minute, the filter or the day changes.
 */
export function useListedDays(
  snapshot: SnapshotV2 | null,
  at: Date,
  filter: KindFilter,
  today: string,
): { days: Day[]; listed: Day[]; listedDates: string[]; strip: StripDay[] } {
  // Finished events drop off by the minute (EV-10).
  const minute = Math.floor(at.getTime() / 60_000);
  const days = useMemo(
    () =>
      snapshot
        ? upcomingDays(
            snapshot.events,
            new Date(minute * 60_000),
            snapshot.site.categoryKinds,
            snapshot.site.programs,
          )
        : [],
    [snapshot, minute],
  );
  const listed = useMemo(() => filterDays(days, filter), [days, filter]);
  const listedDates = useMemo(() => listed.map((d) => d.date), [listed]);
  const strip = useMemo(() => dateStrip(days, filter, today), [days, filter, today]);
  return { days, listed, listedDates, strip };
}
