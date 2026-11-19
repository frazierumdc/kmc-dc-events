import { DayGroup, EmptyState, EventRow, FooterCard, dayId } from "@kmcdc/ui";
import logoLarge from "../../../../brand/images/splash-logo.png";
import type { Schedule } from "../schedule/schedule.ts";
import { dayHeading, EMPTY_MESSAGE, type Day } from "./days.ts";
import { eventPath } from "./event-route.ts";
import { eventRow } from "./rows.ts";

/** The days left after the kind filter (EV-12). */
export function EventList({
  schedule,
  days,
  today,
  onOpen,
}: {
  schedule: Schedule;
  days: Day[];
  today: string;
  onOpen: (row: HTMLAnchorElement, id: string) => void;
}) {
  return (
    <>
      {days.length === 0 && <EmptyState>{EMPTY_MESSAGE}</EmptyState>}
      {days.map((day) => (
        <DayGroup key={day.date} id={dayId(day.date)} heading={dayHeading(day.date, today)}>
          {day.entries.map((entry) => (
            <EventRow
              key={entry.event.id}
              {...eventRow(entry, schedule.snapshot.site)}
              defaultPicture={logoLarge}
              href={eventPath(entry.event.id)}
              onOpen={(row) => {
                onOpen(row, entry.event.id);
              }}
            />
          ))}
        </DayGroup>
      ))}
      <FooterCard membership={schedule.snapshot.site.membership} />
    </>
  );
}
