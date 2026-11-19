// An event's picture as a small thumbnail on the app's own site (slice 1.13): the publish
// copies it from Wix's media server, so the app never loads anything from another site.
// Pure.

/** The thumbnail's size in pixels: the list's 84-point picture at 3× (EV-11), with a little to spare. */
export const THUMBNAIL_SIZE = 256;

/** FNV-1a, 64 bits, as hex: a short, stable name for a picture's address. */
function fnv1a64(text: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
}

/**
 * Where a picture's thumbnail is on the site; a new picture on the website, or a new size,
 * gets a new one.
 */
export const thumbnailPath = (picture: string): string =>
  `/v2/feed/pictures/${fnv1a64(picture)}-${String(THUMBNAIL_SIZE)}.jpg`;

/**
 * The picture at the thumbnail's size, as its image server makes it: from Wix's, cropped to a
 * square; from Squarespace's (another center's event, D67), 500 pixels wide, the list crops it.
 */
export const thumbnailSource = (picture: string): string =>
  new URL(picture).hostname === "images.squarespace-cdn.com"
    ? `${picture.split("?")[0] ?? picture}?format=500w`
    : `${picture.replace(/\/+$/, "")}/v1/fill/w_${String(THUMBNAIL_SIZE)},h_${String(THUMBNAIL_SIZE)},al_c,q_80/thumb.jpg`;

/** A featured event's picture for its story (EV-44): large, on the app's own site. */
export const storyPath = (picture: string): string =>
  `/v2/feed/pictures/${fnv1a64(picture)}-story.jpg`;

/** The story's picture as its image server makes it: whole, up to 1200 pixels. */
export const storySource = (picture: string): string =>
  new URL(picture).hostname === "images.squarespace-cdn.com"
    ? `${picture.split("?")[0] ?? picture}?format=1500w`
    : `${picture.replace(/\/+$/, "")}/v1/fit/w_1200,h_1200,q_80/story.jpg`;
