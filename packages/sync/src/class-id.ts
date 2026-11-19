import { createHash } from "node:crypto";
import type { ClassId, WebsiteEvent } from "@kmcdc/domain";

/** Crockford base32: digits and capitals without I, L, O and U. */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * The class or program an event belongs to (D39; data-model.md, Class id): the same title
 * in the same city, or online, always gives the same id. Capitals, accents, punctuation
 * and spacing don't count.
 */
export function classId(event: Pick<WebsiteEvent, "title" | "location">): ClassId {
  const place = event.location?.online ? "online" : (event.location?.city ?? "");
  const key = `${words(event.title)}\n${words(place)}`;
  const digest = createHash("sha256").update(key).digest();
  let bits = digest.readBigUInt64BE(0) >> 4n; // the first 60 bits
  let id = "";
  for (let i = 0; i < 12; i++) {
    id = (CROCKFORD[Number(bits & 31n)] ?? "") + id;
    bits >>= 5n;
  }
  return `c_${id}`;
}

/** `Online: Silent Saturday — Café!` → `online silent saturday cafe`. */
function words(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
