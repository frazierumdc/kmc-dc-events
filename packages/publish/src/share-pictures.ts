// Draws each event's share picture (src/share-picture.ts): the calendar page, the kind,
// the name, the time and the place. 1200 × 630, the size link previews use. Text is drawn with Inter, shipped in @fontsource/inter, so
// every machine that publishes draws the same picture. Run by event-pages.ts on every
// publish; not part of the app.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import type { PictureContent } from "./share-picture.ts";

export const WIDTH = 1200;
export const HEIGHT = 630;
const SIDE = 72;
const TILE = 340;
const GAP = 64;

const require = createRequire(import.meta.url);
const font = (subset: string, weight: 500 | 600 | 700 | 800) => ({
  name: "Inter",
  weight,
  style: "normal" as const,
  data: readFileSync(
    require.resolve(`@fontsource/inter/files/inter-${subset}-${String(weight)}-normal.woff`),
  ),
});
const FONTS = (["latin", "latin-ext"] as const).flatMap((subset) =>
  ([500, 600, 700, 800] as const).map((weight) => font(subset, weight)),
);

/** The app's light colours (packages/ui/src/theme.css), so the picture matches the rows. */
const THEME = readFileSync(require.resolve("@kmcdc/ui/theme.css"), "utf8");
function token(name: string): string {
  const value = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`).exec(THEME)?.[1];
  if (!value) throw new Error(`theme.css has no --${name}`);
  return value;
}
const TEXT = token("text");
const MUTED = token("muted");
/** Bar and text colour per kind; an event with no kind is drawn in grey and black. */
const KIND_COLOURS = {
  class: { bar: token("class"), text: token("class-text") },
  special: { bar: token("special"), text: token("special-text") },
  prayer: { bar: token("prayer"), text: token("prayer-text") },
  none: { bar: MUTED, text: TEXT },
};

/** A satori element: what React would make, without React. */
interface Node {
  type: string;
  props: Record<string, unknown> & { style?: Record<string, unknown>; children?: unknown };
}
const h = (type: string, style: Record<string, unknown>, ...children: unknown[]): Node => ({
  type,
  props: { style, children: children.length === 1 ? children[0] : children },
});

// The app's line icons (packages/ui/src/icons.tsx): 24-unit box, 1.7 stroke.
const icon = (size: number, colour: string, paths: Node[], filled = false): Node => ({
  type: "svg",
  props: {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: filled ? colour : "none",
    stroke: filled ? "none" : colour,
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: { flexShrink: 0 },
    children: paths,
  },
});
const path = (d: string, extra: Record<string, unknown> = {}): Node => ({
  type: "path",
  props: { d, ...extra },
});
const CLOCK = [path("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"), path("M12 7.5V12l3 2")];
const PIN = [
  path(
    "M12 21.6s-7.3-6.2-7.3-11.6a7.3 7.3 0 0 1 14.6 0c0 5.4-7.3 11.6-7.3 11.6zM12 7.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z",
    { fillRule: "evenodd" },
  ),
];
const SCREEN = [
  path("M5 4h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"),
  path("M8.5 20.5h7M12 16.5v4"),
];

/** The picture as satori draws it (exported for tests). */
export function pictureTree(content: PictureContent): Node {
  const colours = KIND_COLOURS[content.kind ?? "none"];
  const tile = h(
    "div",
    {
      width: TILE,
      height: 380,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      borderRadius: 44,
      border: "3px solid rgba(60, 60, 67, 0.14)",
      boxShadow: "0 18px 40px rgba(0, 0, 0, 0.10)",
      backgroundColor: "#ffffff",
      overflow: "hidden",
    },
    h(
      "div",
      {
        display: "flex",
        justifyContent: "center",
        backgroundColor: colours.bar,
        color: "#ffffff",
        fontSize: content.month.length > 14 ? 26 : content.month.length > 8 ? 32 : 40,
        fontWeight: 700,
        letterSpacing: 3,
        padding: "22px 0 18px",
      },
      content.month,
    ),
    h(
      "div",
      {
        flexGrow: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: content.day.length > 4 ? 108 : content.day.length > 2 ? 120 : 190,
        fontWeight: 700,
        letterSpacing: content.day.length > 2 ? -4 : -6,
        lineHeight: 1,
        color: TEXT,
      },
      content.day,
    ),
    h(
      "div",
      {
        display: "flex",
        justifyContent: "center",
        fontSize: 38,
        fontWeight: 600,
        color: MUTED,
        paddingBottom: 30,
      },
      content.weekday,
    ),
  );
  const line = (colour: string, weight: number, glyph: Node, text: string) =>
    h(
      "div",
      { display: "flex", alignItems: "center", fontSize: 38, fontWeight: weight, color: colour },
      glyph,
      h("div", { display: "flex", flexShrink: 1, marginLeft: 16 }, text),
    );
  const place = content.place
    ? content.place.online
      ? line(MUTED, 500, icon(38, MUTED, SCREEN), content.place.name)
      : line(colours.text, 600, icon(38, colours.text, PIN, true), content.place.name)
    : null;
  const body = h(
    "div",
    {
      width: WIDTH - 2 * SIDE - TILE - GAP,
      display: "flex",
      flexDirection: "column",
      gap: 22,
    },
    ...[
      content.kindName &&
        h(
          "div",
          {
            display: "flex",
            alignItems: "center",
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 2.5,
            color: colours.text,
            textTransform: "uppercase",
          },
          h("div", {
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: colours.bar,
            marginRight: 14,
          }),
          content.kindName,
        ),
      h(
        "div",
        {
          display: "block",
          fontSize: content.title.length > 48 ? 54 : 62,
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: -1.2,
          color: TEXT,
          lineClamp: 3,
        },
        content.title,
      ),
      line(TEXT, 500, icon(38, MUTED, CLOCK), content.time),
      place,
    ].filter(Boolean),
  );
  return h(
    "div",
    {
      width: WIDTH,
      height: HEIGHT,
      display: "flex",
      alignItems: "center",
      gap: GAP,
      padding: `0 ${String(SIDE)}px`,
      backgroundColor: "#ffffff",
      fontFamily: "Inter",
    },
    tile,
    body,
  );
}

/** The picture as a PNG. */
export async function drawPicture(content: PictureContent): Promise<Buffer> {
  const svg = await satori(pictureTree(content) as never, {
    width: WIDTH,
    height: HEIGHT,
    fonts: FONTS,
  });
  return new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng();
}
