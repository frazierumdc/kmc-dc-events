// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

// WCAG 2.2 AA for the theme's colour pairs (NFR-2): 4.5:1 for text, 3:1 for the kinds'
// bars and dots. Colours are read from theme.css, light and dark.

const css = readFileSync(new URL("./theme.css", import.meta.url), "utf8");

function tokens(block: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const [, name, hex] of block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\b/gi))
    if (name && hex) found[name] = hex;
  return found;
}

// The light theme is the first :root block; the dark one is the media block after it,
// up to the first rule for one platform.
const darkStart = css.indexOf("@media (prefers-color-scheme");
const lightBlock = css.slice(css.indexOf(":root {"), darkStart);
const darkBlock = css.slice(darkStart, css.indexOf("\n[data-platform", darkStart));
const light = tokens(lightBlock);
const dark = { ...light, ...tokens(darkBlock) };

// Android's own tokens: its block, then its dark block.
const androidStart = css.indexOf('[data-platform="android"] {');
const androidBlock = css.slice(androidStart, css.indexOf("}", androidStart));
const androidDarkStart = css.indexOf("@media (prefers-color-scheme", androidStart);
const androidDarkBlock = css.slice(androidDarkStart, css.indexOf("}\n}", androidDarkStart));
const androidLight = { ...light, ...tokens(androidBlock) };
const androidDark = { ...dark, ...tokens(androidBlock), ...tokens(androidDarkBlock) };

function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT: [string, string][] = [
  ["text", "surface"],
  ["text", "bg"],
  ["muted", "surface"],
  ["muted", "bg"],
  ["accent", "surface"],
  ["accent", "bg"],
  ["accent", "accent-soft"],
  ["on-accent", "accent"],
  // "Schedule updated" (EV-19): its text, the grey lines and the old values, the action.
  ["notice-text", "notice-bg"],
  ["notice-muted", "notice-bg"],
  ["notice-action-text", "notice-action-bg"],
  // The update message's check on its badge (EV-21).
  ["badge-text", "badge-bg"],
  // The action sheet over the panel (EV-35).
  ["accent", "elevated"],
  ["muted", "elevated"],
  // The selected segment's name on the iPhone filter's thumb (EV-12).
  ["text", "thumb"],
  // On an event's tint (D45): its text, the grey second and "where" lines with their icons
  // (EV-11), links, and the panel's pill.
  ...(["class", "special", "prayer", "elsewhere"] as const).flatMap((kind): [string, string][] => [
    ["text", `${kind}-soft`],
    ["muted", `${kind}-soft`],
    ["accent", `${kind}-soft`],
    [`${kind}-text`, `${kind}-soft`],
  ]),
  // Another center's special event, slate (D67): its row's text and grey lines on its block.
  ["text", "elsewhere-block"],
  ["muted", "elsewhere-block"],
];

// Bars on their tint, and dots on the header and the filter.
const BARS: [string, string][] = (["class", "special", "prayer", "elsewhere"] as const).flatMap(
  (kind): [string, string][] => [
    [kind, `${kind}-soft`],
    [kind, "bg"],
    [kind, "surface"],
    [kind, "thumb"],
  ],
);
BARS.push(["elsewhere-bar", "elsewhere-block"]);
// The update message's badge against its card (EV-21).
BARS.push(["badge-bg", "notice-bg"]);

describe.each([
  ["light", light],
  ["dark", dark],
])("%s theme", (_, theme) => {
  test.each(TEXT)("text %s on %s is at least 4.5:1", (fg, bg) => {
    expect(ratio(theme[fg] ?? "", theme[bg] ?? "")).toBeGreaterThanOrEqual(4.5);
  });
  test.each(BARS)("the %s bar on %s is at least 3:1", (fg, bg) => {
    expect(ratio(theme[fg] ?? "", theme[bg] ?? "")).toBeGreaterThanOrEqual(3);
  });
});

// Android's snackbar: a text action straight on the surface.
describe.each([
  ["Android light", androidLight],
  ["Android dark", androidDark],
])("%s message", (_, theme) => {
  test.each([
    ["notice-text", "notice-bg"],
    ["notice-muted", "notice-bg"],
    ["notice-action-text", "notice-bg"],
    ["badge-text", "badge-bg"],
  ])("text %s on %s is at least 4.5:1", (fg, bg) => {
    expect(ratio(theme[fg] ?? "", theme[bg] ?? "")).toBeGreaterThanOrEqual(4.5);
  });
  test("the badge on the card is at least 3:1", () => {
    expect(ratio(theme["badge-bg"] ?? "", theme["notice-bg"] ?? "")).toBeGreaterThanOrEqual(3);
  });
});

test("Android's message colours are its own, light and dark", () => {
  expect(androidLight["notice-bg"]).not.toBe(light["notice-bg"]);
  expect(androidDark["notice-bg"]).not.toBe(androidLight["notice-bg"]);
});

test("every token used in a pair is defined in both themes", () => {
  for (const name of [...TEXT, ...BARS].flat()) {
    expect(light[name], `light --${name}`).toMatch(/^#/);
    expect(dark[name], `dark --${name}`).toMatch(/^#/);
  }
  expect(Object.keys(dark).length).toBe(Object.keys(light).length);
});

test("the dark theme is read from its own block, not the light one", () => {
  expect(dark.bg).not.toBe(light.bg);
  expect(dark.text).not.toBe(light.text);
});

test("the three kinds have three different colours in each theme (D45)", () => {
  for (const theme of [light, dark])
    expect(new Set([theme.class, theme.special, theme.prayer]).size).toBe(3);
});
