import type { SnapshotV2Event } from "@kmcdc/domain";
import {
  calendarFilePath,
  eventUrl,
  googleCalendarUrl,
  onlineLink,
  type OnlineLink,
  type SheetLink,
} from "@kmcdc/publish";

/**
 * The details panel's buttons (EV-35, D36): what each says and where it goes. Links leave
 * the app for the event's page, a map or a calendar; nothing is fetched (NFR-5). An event
 * that can also be attended online has a second button (D46, EV-40). On iPhone,
 * Add to calendar offers Apple Calendar or Google Calendar, and Directions offers Apple Maps
 * or Google Maps; the choice isn't remembered. Apple Calendar opens the
 * event's calendar file, published beside the schedule (calendar-files.ts), in the app's
 * own window, where iPhone offers to add it: a home-screen app can't open a file made on
 * the phone, and a new view doesn't hand the file to Calendar.
 */

export type { OnlineLink, SheetLink };

export interface Choice extends SheetLink {
  /** A website opens in a new view; the calendar file opens in the app's own window. */
  newView: boolean;
}

/** One button; with more than one choice it opens an action sheet to choose from. */
export interface ChoiceAction {
  label: string;
  choices: Choice[];
}

export interface SheetActions {
  /**
   * Register while registration is open on the website, otherwise More info; "Register in
   * person" when the event also has an online button.
   */
  main: SheetLink;
  /** Join online (the livestream) or Register online (the online event); null for none. */
  online: OnlineLink | null;
  /** Apple Calendar or Google Calendar on iPhone; Google Calendar elsewhere. */
  calendar: ChoiceAction;
  /**
   * Apple Maps or Google Maps on iPhone; Google Maps elsewhere. Null for online events and
   * places without an address or map point.
   */
  directions: ChoiceAction | null;
  /** The event's link; its preview shows the event's picture (event-pages.ts). */
  share: { url: string };
}

export type Platform = "ios" | "android";

export function sheetActions(
  event: SnapshotV2Event,
  platform: Platform,
  origin: string,
): SheetActions {
  const url = eventUrl(event.id, origin);
  const google = { label: "Google Calendar", href: googleCalendarUrl(event, url), newView: true };
  const apple = {
    label: "Apple Calendar",
    href: `${origin}${calendarFilePath(event.id)}`,
    newView: false,
  };
  const online = onlineLink(event);
  return {
    main: {
      label: event.registrationOpen ? (online ? "Register in person" : "Register") : "More info",
      href: event.page,
    },
    online,
    calendar: {
      label: "Add to calendar",
      choices: platform === "ios" ? [apple, google] : [google],
    },
    directions: directions(event, platform),
    share: { url },
  };
}

/**
 * Directions from where the person is to the address, or to the map point when there is no
 * address. Apple Maps takes its directions link (iOS 18.4 and later). Google's link opens
 * the Google Maps app when it's installed, otherwise Google Maps on the web.
 */
function directions(event: SnapshotV2Event, platform: Platform): ChoiceAction | null {
  const place = event.location;
  if (!place || place.online) return null;
  const { geo, address } = place;
  const to = address ?? (geo ? `${String(geo.lat)},${String(geo.lng)}` : null);
  if (!to) return null;
  const destination = encodeURIComponent(to);
  const google = {
    label: "Google Maps",
    href: `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
    newView: true,
  };
  const apple = {
    label: "Apple Maps",
    href: `https://maps.apple.com/directions?destination=${destination}`,
    newView: true,
  };
  return { label: "Directions", choices: platform === "ios" ? [apple, google] : [google] };
}
