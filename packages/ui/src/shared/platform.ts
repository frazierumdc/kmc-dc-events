/**
 * iPhone or Android styling (EV-22). Android phones get the Android look; everything else,
 * computers included, gets the iPhone look. The app sets it once as `data-platform` on <html>.
 */

export type Platform = "ios" | "android";

export function detectPlatform(userAgent: string): Platform {
  return /android/i.test(userAgent) ? "android" : "ios";
}

/**
 * True on a real iPhone or iPad, where `-apple-system-body` follows the phone's text size
 * (Settings › Display › Text Size). Elsewhere it means a fixed desktop size, so it isn't
 * used. iPads asking for the desktop site report "MacIntel" with touch points.
 */
export function followsAppleTextSize(platform: string, maxTouchPoints: number): boolean {
  return /^(iPhone|iPad|iPod)/.test(platform) || (platform === "MacIntel" && maxTouchPoints > 1);
}
