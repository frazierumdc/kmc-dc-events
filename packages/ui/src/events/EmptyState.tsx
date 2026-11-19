import type { ReactNode } from "react";

/**
 * A message in place of the list (EV-16), or while loading or after an error. `delayed`
 * shows it only after a second, so a quick load doesn't flash "Loading…".
 */
export function EmptyState({
  children,
  alert = false,
  delayed = false,
}: {
  children: ReactNode;
  alert?: boolean;
  delayed?: boolean;
}) {
  return (
    <div
      className={delayed ? "ui-empty ui-delayed" : "ui-empty"}
      role={alert ? "alert" : undefined}
    >
      {children}
    </div>
  );
}
