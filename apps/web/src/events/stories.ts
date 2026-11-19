// The featured events as stories on the splash (EV-44): those in the schedule's `featured`,
// in its order, that haven't ended. Pure.

import {
  effectiveEnd,
  eventKind,
  eventTone,
  eventPlace,
  eventWhen,
  storyPath,
  type SnapshotV2,
} from "@kmcdc/domain";
import type { Story } from "@kmcdc/ui";

/** The tag above a featured event's title, by its kind (D45). */
const TAGS = { class: "Class", special: "Special event", prayer: "Prayers" } as const;

export function featuredStories(snapshot: SnapshotV2 | null, now: Date): Story[] {
  if (!snapshot) return [];
  const byId = new Map(snapshot.events.map((e) => [e.id, e]));
  return (snapshot.featured ?? []).flatMap((id) => {
    const event = byId.get(id);
    // An event that has ended isn't shown (owner, 15 November 2026).
    if (!event || Date.parse(effectiveEnd(event.start, event.end)) <= now.getTime()) return [];
    const online = event.location?.online === true;
    const kind = eventKind(event.categories, snapshot.site.categoryKinds);
    return [
      {
        id: event.id,
        title: event.title,
        when: eventWhen(event),
        where: eventPlace(event, snapshot.site)?.name ?? (online ? "Online" : null),
        picture: event.picture ? storyPath(event.picture) : null,
        link: { label: event.registrationOpen ? "Register" : "More info", href: event.page },
        kind,
        tone: eventTone(event, kind, snapshot.site.programs),
        tag: kind ? TAGS[kind] : null,
      },
    ];
  });
}
