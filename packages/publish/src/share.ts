import { eventPlace, eventWhen, type PlaceSite, type SnapshotV2Event } from "@kmcdc/domain";

/**
 * What a shared event says (EV-35): its name, then when and where in one line, as the
 * website has them: `Tue, Oct 13, 2026 · 6:00 – 6:30 PM Eastern · KMC DC`. The event's
 * own page (event-pages.ts) gives it to link previews, so a shared link reads as the event,
 * not the app.
 */
export interface EventShare {
  title: string;
  text: string;
}

export function eventShare(event: SnapshotV2Event, site: PlaceSite): EventShare {
  return {
    title: event.title,
    text: [eventWhen(event, { zone: "Eastern" }), shareWhere(event, site)]
      .filter(Boolean)
      .join(" · "),
  };
}

/** The row's place (`KMC DC`, a city), or Online; nothing when the website gives none. */
function shareWhere(event: SnapshotV2Event, site: PlaceSite): string {
  if (event.location?.online) return "Online";
  return eventPlace(event, site)?.name ?? "";
}
