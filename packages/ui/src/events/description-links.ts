/** A piece of a description: plain text, or an address to tap. */
export type DescriptionPart = string | { text: string; href: string };

// Web addresses run to the next space; email addresses end with a name like ".org".
const ADDRESS = /https?:\/\/[^\s<>"]+|[\w.%+-]+@[a-z\d.-]+\.[a-z]{2,}/gi;

/**
 * Splits a description into text and the web and email addresses in it (EV-33), so the
 * panel can make them tappable. Punctuation after an address, and a closing bracket it
 * didn't open, aren't part of it: "Heart Jewel (https://tharpa.com/…)." links only the
 * address.
 */
export function descriptionParts(text: string): DescriptionPart[] {
  const parts: DescriptionPart[] = [];
  let from = 0;
  for (const match of text.matchAll(ADDRESS)) {
    const address = trimEnd(match[0]);
    const start = match.index;
    if (start > from) parts.push(text.slice(from, start));
    parts.push({ text: address, href: address.includes("://") ? address : `mailto:${address}` });
    from = start + address.length;
  }
  if (from < text.length) parts.push(text.slice(from));
  return parts;
}

function trimEnd(address: string): string {
  let end = address;
  for (;;) {
    if (/[.,;:!?'"]$/.test(end)) end = end.slice(0, -1);
    else if (end.endsWith(")") && count(end, ")") > count(end, "(")) end = end.slice(0, -1);
    else return end;
  }
}

function count(text: string, char: string): number {
  return text.split(char).length - 1;
}
