// The privacy page's words (NFR-5, IN-9): one text for Settings' Privacy page and the
// stand-alone page at /privacy, so the two never differ. Approved by the owner.

export interface PrivacySection {
  title: string;
  text: string;
}

export const PRIVACY = {
  title: "Privacy",
  lead: "KMC DC Events collects no data about you.",
  leadMore: "There are no accounts, no sign-in, no ads, no tracking and no analytics.",
  sections: [
    {
      title: "What stays on your phone",
      text: "The app keeps a copy of the schedule so it works without a connection. It also remembers the filter you picked, the Safari steps you chose in Settings, your notification choices, and when the welcome screen last showed. None of this leaves your phone. Removing the app, or clearing this website’s data in your browser, deletes it.",
    },
    {
      title: "Notifications",
      text: "Notifications are off until you turn them on in Settings. Then the app reminds you of the events you follow before they start, and tells you if one is cancelled or its date or time changes. Google Firebase Cloud Messaging, which sends them, gives this phone an anonymous code and keeps which lists it joined: the events you chose. It has no name, email or account. Turning notifications off removes the code from every list.",
    },
    {
      title: "Where the app comes from",
      text: "The schedule is copied from example.org. The app is hosted by Google Firebase, whose servers, like any website’s, see your device’s internet address when the app loads. The center doesn’t receive or keep it.",
    },
    {
      title: "Leaving the app",
      text: "Register, Join online, Add to calendar and Share open the center’s website, your calendar or your phone’s share options, which have their own privacy terms.",
    },
    {
      title: "Emails from the center",
      text: "If you’re on one of the center’s email lists, your address is kept only in that list, a Google Group at example.org. The app reads the list only when it sends an email, and keeps no copy. To stop getting an email, contact the center.",
    },
  ] satisfies PrivacySection[],
  questions: "Questions",
  contact: "contact@example.org",
  updated: "Updated November 2026",
} as const;
