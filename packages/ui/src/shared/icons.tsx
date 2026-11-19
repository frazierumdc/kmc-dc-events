// Line icons in one style: 24-unit box, 1.7 stroke, the current text colour.

const LINE = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

/** A map pin; `filled` for a place that should stand out (the rows' where line). */
export function PinIcon({ filled = false }: { filled?: boolean }) {
  if (filled)
    return (
      <svg {...LINE} fill="currentColor" stroke="none">
        <path
          fillRule="evenodd"
          d="M12 21.6s-7.3-6.2-7.3-11.6a7.3 7.3 0 0 1 14.6 0c0 5.4-7.3 11.6-7.3 11.6zM12 7.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z"
        />
      </svg>
    );
  return (
    <svg {...LINE}>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  );
}

export function ScreenIcon() {
  return (
    <svg {...LINE}>
      <rect x="3" y="4" width="18" height="12.5" rx="2" />
      <path d="M8.5 20.5h7M12 16.5v4" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg {...LINE}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg {...LINE}>
      <rect x="3" y="4.5" width="18" height="16" rx="3" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg {...LINE}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </svg>
  );
}

/** The top bar's Settings button, a gear (EV-41, NT-30). */
export function SettingsIcon() {
  return (
    <svg {...LINE}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg {...LINE}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function LinkIcon() {
  return (
    <svg {...LINE}>
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
    </svg>
  );
}

// The browsers' own buttons, drawn as Apple's and Google's help pages show them (IN-5).

/** Safari's Page Menu (iOS 27): three lines, the last shorter. */
export function PageMenuIcon() {
  return (
    <svg {...LINE}>
      <path d="M4 6.5h16M4 12h16M4 17.5h9" />
    </svg>
  );
}

/** Safari's page button in the address bar on iOS 26 (not a step, only in the picture). */
export function PageIcon() {
  return (
    <svg {...LINE}>
      <rect x="4" y="4" width="16" height="9" rx="2" />
      <path d="M4 16.5h16M4 20h10" />
    </svg>
  );
}

export function ShieldIcon() {
  return (
    <svg {...LINE}>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
    </svg>
  );
}

export function ShareIcon() {
  return (
    <svg {...LINE}>
      <path d="M12 3.5v11M8.2 7.2 12 3.5l3.8 3.7" />
      <path d="M8.8 10.5H7.2A2.2 2.2 0 0 0 5 12.7v6.1A2.2 2.2 0 0 0 7.2 21h9.6a2.2 2.2 0 0 0 2.2-2.2v-6.1a2.2 2.2 0 0 0-2.2-2.2h-1.6" />
    </svg>
  );
}

export function AddHomeIcon() {
  return (
    <svg {...LINE}>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}

export function TabsIcon() {
  return (
    <svg {...LINE}>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2.6" />
      <path d="M15.5 5.6A2.6 2.6 0 0 0 13 3.5H6.1a2.6 2.6 0 0 0-2.6 2.6V13a2.6 2.6 0 0 0 2.1 2.5" />
    </svg>
  );
}

export function ReloadIcon() {
  return (
    <svg {...LINE}>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4v4.3h-4.3" />
    </svg>
  );
}

/** ⋯: Safari's More button (iOS 26). */
export function MoreIcon() {
  return (
    <svg {...LINE} fill="currentColor" stroke="none">
      <circle cx="5.5" cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="18.5" cy="12" r="1.9" />
    </svg>
  );
}

/** ⋮: Chrome's More button on Android. */
export function MenuDotsIcon() {
  return (
    <svg {...LINE} fill="currentColor" stroke="none">
      <circle cx="12" cy="5.5" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="12" cy="18.5" r="1.9" />
    </svg>
  );
}

// Safari's Share sheet and menus (IN-5), drawn as iOS 27 shows them.

export function CopyIcon() {
  return (
    <svg {...LINE}>
      <rect x="8" y="8" width="12" height="12" rx="2.5" />
      <path d="M16 5.5A2.5 2.5 0 0 0 13.5 3h-6A2.5 2.5 0 0 0 5 5.5v6A2.5 2.5 0 0 0 7.5 14" />
    </svg>
  );
}

export function BookmarkIcon() {
  return (
    <svg {...LINE}>
      <path d="M7 4h10v16l-5-3.5L7 20z" />
    </svg>
  );
}

export function BookPlusIcon() {
  return (
    <svg {...LINE}>
      <path d="M3 5.5c3-1.3 6-1.3 9 0v14c-3-1.3-6-1.3-9 0zM12 5.5c3-1.3 6-1.3 9 0v8" />
      <path d="M18 16v5M15.5 18.5h5" />
    </svg>
  );
}

export function GlassesIcon() {
  return (
    <svg {...LINE}>
      <circle cx="6.5" cy="13" r="3.8" />
      <circle cx="17.5" cy="13" r="3.8" />
      <path d="M10.3 13h3.4M2.7 12.5 2 11.5M21.3 12.5l.7-1" />
    </svg>
  );
}

export function FindIcon() {
  return (
    <svg {...LINE}>
      <path d="M6 3h9l4 4v6" />
      <path d="M6 3v18h7" />
      <circle cx="16.5" cy="17" r="2.6" />
      <path d="M18.5 19l2 2" />
    </svg>
  );
}

export function StarIcon() {
  return (
    <svg {...LINE}>
      <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8z" />
    </svg>
  );
}

export function ChevronDownIcon() {
  return (
    <svg {...LINE}>
      <path d="M6 9.5l6 6 6-6" />
    </svg>
  );
}

export function ChevronUpIcon() {
  return (
    <svg {...LINE}>
      <path d="M6 14.5l6-6 6 6" />
    </svg>
  );
}

export function ChevronRightIcon() {
  return (
    <svg {...LINE}>
      <path d="M9.5 6l6 6-6 6" />
    </svg>
  );
}

/** A turning arrow: something was just updated (NT-5). */
export function UpdatedIcon() {
  return (
    <svg {...LINE}>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v4h-4" />
    </svg>
  );
}

/** A calendar page with a cross: the event is no longer on the schedule (NT-5). */
export function CalendarGoneIcon() {
  return (
    <svg {...LINE}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4M9.5 13.5l5 4M14.5 13.5l-5 4" />
    </svg>
  );
}

/** A cloud with a line through it: the app couldn't check (NT-6). */
export function CloudOffIcon() {
  return (
    <svg {...LINE}>
      <path d="M7 18h10a4 4 0 0 0 1.2-7.8A6 6 0 0 0 8.5 7.2M5.6 9.6A4.5 4.5 0 0 0 7 18" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

/** Notifications (NT-17, NT-30). */
export function BellIcon() {
  return (
    <svg {...LINE}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
    </svg>
  );
}

/** Notifications refused in the phone's settings (NT-18). */
export function BellOffIcon() {
  return (
    <svg {...LINE}>
      <path d="M8.7 3A6 6 0 0 1 18 8c0 3 .5 5 1.2 6.5M17 17H3s3-2 3-9c0-.8.2-1.6.4-2.3" />
      <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0M3 3l18 18" />
    </svg>
  );
}

/** A plus: Add events (NT-22). */
export function PlusIcon() {
  return (
    <svg {...LINE}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** A magnifier: Search events (NT-22). */
export function SearchIcon() {
  return (
    <svg {...LINE}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.4-4.4" />
    </svg>
  );
}

/**
 * Pause and Play, filled as the phone's own media controls draw them (SF Symbols' pause.fill and
 * play.fill, Material's pause and play_arrow), in place of text characters that each font draws
 * differently.
 */
export function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="4.5" width="4" height="15" rx="1.3" />
      <rect x="14" y="4.5" width="4" height="15" rx="1.3" />
    </svg>
  );
}

/** Play: its point a little right of centre, so it looks centred in a round button. */
export function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8.2 4.9c0-1 1.1-1.6 2-1.1l10 6.6c.8.5.8 1.7 0 2.2l-10 6.6c-.9.5-2-.1-2-1.1z" />
    </svg>
  );
}
