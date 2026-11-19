/**
 * Which steps to show (IN-2): Safari on iOS 27 and later, on iOS 26, or with Share in its
 * bar (the Bottom or Top layout, or iOS 18 and earlier); another browser on iPhone; Chrome
 * or another browser on Android; or a computer.
 */
export type InstallGuide =
  "ios27" | "ios26" | "share-bar" | "ios-other" | "android" | "android-other" | "computer";

/** The steps a reader can pick by picture on iPhone (IN-4). */
export type SafariGuide = "ios27" | "ios26" | "share-bar";

export const SAFARI_LABEL: Record<SafariGuide, string> = {
  ios27: "Safari on iOS 27",
  ios26: "Safari on iOS 26",
  "share-bar": "Share in Safari’s bar",
};

export function isSafari(guide: InstallGuide): guide is SafariGuide {
  return guide === "ios27" || guide === "ios26" || guide === "share-bar";
}
