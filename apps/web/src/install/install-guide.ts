import type { InstallGuide } from "@kmcdc/ui";

/**
 * Which steps Settings shows for adding the app to the home screen (IN-2, IN-3). Only the
 * browser is read, never whether the app is installed (IN-1).
 *
 * On iPhone only Safari can add it. Safari's user agent hides the real iOS version (frozen
 * since Safari 26), but its own `Version/NN` follows iOS, and the version decides where
 * Share is: in the Page Menu (≡) on 27 and later, behind ⋯ on 26, in the bar before 26.
 * Chrome, Firefox, Edge and the browsers inside other apps add their own names, or leave
 * out `Version/` and `Safari/`. On Android, Chrome's menu does it; other browsers are sent
 * to Chrome. Anything else is a computer.
 */
export function installGuide(
  userAgent: string,
  platform: string,
  maxTouchPoints: number,
): InstallGuide {
  if (/android/i.test(userAgent)) {
    const other = /SamsungBrowser|Firefox|EdgA|OPR|UCBrowser|YaBrowser|; wv\)|FBAN|FBAV|Instagram/;
    return /Chrome\//.test(userAgent) && !other.test(userAgent) ? "android" : "android-other";
  }
  const apple =
    /iPhone|iPad|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
  if (!apple) return "computer";
  const other = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|Line\/|Snapchat|Twitter/;
  const safari = /Version\/(\d+)[.\d]* .*Safari\//.exec(userAgent);
  if (!safari?.[1] || other.test(userAgent)) return "ios-other";
  const version = Number(safari[1]);
  if (version >= 27) return "ios27";
  if (version === 26) return "ios26";
  return "share-bar";
}
