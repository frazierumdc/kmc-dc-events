import type { ReactNode } from "react";

/**
 * One day's heading and its events, each its own rounded block (EV-22). The heading takes
 * focus when the row of dates moves the list to the day (EV-14).
 */
export function DayGroup({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="ui-day" aria-labelledby={id}>
      <h2 id={id} tabIndex={-1}>
        {heading}
      </h2>
      <ul className="ui-group">{children}</ul>
    </section>
  );
}
