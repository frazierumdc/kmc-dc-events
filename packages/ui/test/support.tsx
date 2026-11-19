// Shared by the tests split from components.test.tsx.

export const APPLE = { label: "Apple Calendar", href: "https://example.org/x.ics", newView: false };

export const GOOGLE = {
  label: "Google Calendar",
  href: "https://calendar.google.com/x",
  newView: true,
};

export const APPLE_MAPS = {
  label: "Apple Maps",
  href: "https://maps.apple.com/directions?destination=x",
  newView: true,
};

export const GOOGLE_MAPS = {
  label: "Google Maps",
  href: "https://www.google.com/maps/dir/?api=1&destination=x",
  newView: true,
};

export const noop = () => undefined;
