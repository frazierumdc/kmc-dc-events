import type { SnapshotV2Event } from "@kmcdc/domain";
import { EventSheet, Sheet, type FollowSwitch } from "@kmcdc/ui";
import { sheetActions, type Platform } from "./actions.ts";
import { eventSheet } from "./sheet.ts";
import type { EventPanelState } from "./use-event-panel.ts";

/** An event's details panel (slice 1.3, EV-36): nothing until an event has been opened. */
export function EventPanel({
  panel,
  follow,
}: {
  panel: EventPanelState;
  /** Notify me, where notifications can be on (NT-13). */
  follow: (event: SnapshotV2Event) => FollowSwitch | null;
}) {
  const { shown } = panel;
  if (!shown) return null;
  return (
    <Sheet open={panel.open} onClose={panel.close} onClosed={panel.closed} labelledBy="sheet-title">
      <EventSheet
        titleId="sheet-title"
        {...eventSheet(shown.event)}
        kind={shown.kind}
        tone={shown.tone}
        change={panel.change}
        follow={follow(shown.event)}
        actions={sheetActions(shown.event, platform(), window.location.origin)}
        onClose={panel.close}
      />
    </Sheet>
  );
}

/** Set on <html> at start-up (main.tsx); iPhone styles unless it says Android. */
function platform(): Platform {
  return document.documentElement.dataset.platform === "android" ? "android" : "ios";
}
