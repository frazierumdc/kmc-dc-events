import type { SnapshotV2Event } from "@kmcdc/domain";

// An event's online link (D46, EV-40): the details panel's second button, and a line in the
// calendar file's notes.

export interface SheetLink {
  label: string;
  href: string;
}

export interface OnlineLink extends SheetLink {
  /** A short line under the button. */
  caption: string | null;
}

/**
 * The livestream's page, where members log in for the link, or the online event's page;
 * none when the event only shows the list's online icon.
 */
export function onlineLink({ online }: SnapshotV2Event): OnlineLink | null {
  if (online === null || online.type === "iconOnly") return null;
  if (online.type === "livestream")
    return {
      label: "Join online",
      href: online.page,
      caption: "Log in on the website to get the livestream link",
    };
  return {
    label: online.registrationOpen ? "Register online" : "More info online",
    href: online.page,
    caption: null,
  };
}
