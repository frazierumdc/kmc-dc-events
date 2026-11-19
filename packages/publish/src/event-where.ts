import type { SnapshotV2Event } from "@kmcdc/domain";

/**
 * Where (EV-32): the place's name and address as the website has them; online events say
 * "Online". An address that only repeats the name is left out; one that starts with the
 * name ("1200 Canal St SW" at "1200 Canal St SW, Washington, …") shows only the rest.
 */
export function eventWhere(event: SnapshotV2Event): { online: boolean; lines: string[] } {
  const place = event.location;
  if (place?.online) return { online: true, lines: ["Online"] };
  const name = nonBlank(place?.name);
  let address = nonBlank(place?.address);
  if (name !== null && address?.toLowerCase().startsWith(`${name.toLowerCase()},`))
    address = nonBlank(address.slice(name.length + 1));
  const lines: string[] = [];
  for (const text of [name, address])
    if (text !== null && !lines.some((l) => sameWords(l, text))) lines.push(text);
  return { online: false, lines };
}

function nonBlank(text: string | null | undefined): string | null {
  const trimmed = text?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

/** True when `next` adds no words to `shown`: "1200 Canal St SW" and "1200 Canal St SW". */
function sameWords(shown: string, next: string): boolean {
  const words = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  return words(shown).includes(words(next));
}
