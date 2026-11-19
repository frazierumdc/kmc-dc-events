/**
 * Converts Wix rich content (`{ nodes: [...] }`) to plain text for `longDescription`:
 * paragraphs and headings become paragraphs separated by a blank line, list items become
 * "• " or "1. " lines, a link on words gets its address after them in brackets, and
 * everything else (images, videos, styling) is dropped. Walks `unknown` defensively because
 * Wix adds node types over time.
 */

export const LONG_DESCRIPTION_MAX = 4000;

/** @param max Longest text kept; the website adapter keeps all of it (D36). */
export function richTextToPlain(doc: unknown, max = LONG_DESCRIPTION_MAX): string {
  const blocks: string[] = [];
  collectBlocks(doc, blocks);
  return truncate(blocks.join("\n\n"), max);
}

function collectBlocks(node: unknown, blocks: string[]): void {
  for (const child of childrenOf(node)) {
    if (!isRecord(child)) continue;
    switch (child.type) {
      case "PARAGRAPH":
      case "HEADING": {
        const text = clean(inlineText(child));
        if (text) blocks.push(text);
        break;
      }
      case "BULLETED_LIST":
      case "ORDERED_LIST": {
        const lines = listLines(child);
        if (lines.length > 0) blocks.push(lines.join("\n"));
        break;
      }
      default:
        collectBlocks(child, blocks);
    }
  }
}

function listLines(list: Record<string, unknown>): string[] {
  const ordered = list.type === "ORDERED_LIST";
  const lines: string[] = [];
  let n = 0;
  for (const item of childrenOf(list)) {
    if (!isRecord(item)) continue;
    const text = clean(
      childrenOf(item)
        .filter((c) => isRecord(c) && c.type !== "BULLETED_LIST" && c.type !== "ORDERED_LIST")
        .map(inlineText)
        .join(" "),
    );
    if (text) lines.push(`${ordered ? `${String(++n)}.` : "•"} ${text}`);
    // Nested lists are flattened into the same list.
    for (const nested of childrenOf(item))
      if (isRecord(nested) && (nested.type === "BULLETED_LIST" || nested.type === "ORDERED_LIST"))
        lines.push(...listLines(nested));
  }
  return lines;
}

function inlineText(node: unknown): string {
  if (!isRecord(node)) return "";
  if (node.type === "TEXT") {
    const data = node.textData;
    return isRecord(data) && typeof data.text === "string" ? data.text : "";
  }
  // A link can span several pieces (bold, then plain); its address goes after the last one.
  const pieces = childrenOf(node);
  let out = "";
  let linked = "";
  pieces.forEach((piece, i) => {
    const text = inlineText(piece);
    out += text;
    const url = linkUrl(piece);
    if (url === null) return;
    linked += text;
    if (linkUrl(pieces[i + 1]) === url) return;
    out = withAddress(out, linked, url);
    linked = "";
  });
  return out;
}

/** The web or email address a piece of text links to, or null. */
function linkUrl(node: unknown): string | null {
  if (!isRecord(node) || !isRecord(node.textData)) return null;
  const decorations = node.textData.decorations;
  if (!Array.isArray(decorations)) return null;
  for (const d of decorations) {
    if (!isRecord(d) || d.type !== "LINK" || !isRecord(d.linkData)) continue;
    const link = d.linkData.link;
    const url = isRecord(link) && typeof link.url === "string" ? link.url.trim() : "";
    if (/^(https?:\/\/|mailto:)\S+$/i.test(url)) return url;
  }
  return null;
}

/**
 * Writes the address after the linked words, "Heart Jewel (https://tharpa.com/…)", unless
 * the words already are the address. An email link shows the address without `mailto:`.
 */
function withAddress(out: string, words: string, url: string): string {
  const address = url.replace(/^mailto:([^?]*).*$/i, "$1");
  if (sameAddress(words, address)) return out;
  const kept = out.trimEnd();
  return `${kept} (${address})${out.slice(kept.length)}`;
}

function sameAddress(a: string, b: string): boolean {
  const bare = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/^(https?:\/\/)?(www\.)?/, "")
      .replace(/\/$/, "");
  return bare(a) === bare(b);
}

/** Collapses runs of spaces within lines and trims each line. */
function clean(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t\u00a0]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Cuts at a word boundary and adds "…" when longer than `max`. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.search(/\s\S*$/);
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function childrenOf(node: unknown): unknown[] {
  return isRecord(node) && Array.isArray(node.nodes) ? node.nodes : [];
}
