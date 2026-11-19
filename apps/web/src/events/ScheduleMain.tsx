import type { ReactNode } from "react";
import { easternDate, formatEasternDateTime, formatTime12 } from "@kmcdc/domain";
import { CheckNotice, EmptyState } from "@kmcdc/ui";
import type { useSchedule } from "../schedule/use-schedule.ts";

type ScheduleState = ReturnType<typeof useSchedule>;

/** The website the app copies: where to look when the app couldn't check (NT-6). */
const WEBSITE = { name: "example.org", href: "https://example.org/" };

/**
 * The screen under the header: loading, the error with Try again, or, once the schedule is
 * ready, the "couldn't check" notice (NT-6) and the list (`children`).
 */
export function ScheduleMain({
  state,
  retry,
  staleSince,
  today,
  children,
}: Pick<ScheduleState, "state" | "retry" | "staleSince"> & {
  today: string;
  children: ReactNode;
}) {
  return (
    <main className="ui-wrap ui-main">
      {state.status === "loading" && <EmptyState delayed>Loading the schedule…</EmptyState>}
      {state.status === "error" && (
        <EmptyState alert>
          <p>{state.message}</p>
          <button type="button" onClick={retry}>
            Try again
          </button>
        </EmptyState>
      )}
      {state.status === "ready" && (
        <CheckNotice since={staleSince && sinceWhen(staleSince, today)} website={WEBSITE} />
      )}
      {state.status === "ready" && children}
    </main>
  );
}

/** `9:41 AM` for today in Eastern time; with the date, and its year, for an earlier day. */
function sinceWhen(since: Date, today: string): string {
  const iso = since.toISOString();
  return easternDate(iso) === today ? formatTime12(iso) : formatEasternDateTime(iso);
}
