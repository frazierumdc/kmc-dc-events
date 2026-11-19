/**
 * The environments that aren't the real app, each with a label across the bottom of its logo
 * so it is easy to tell apart on a phone: green DEV, blue TEST (D53). Prod has none.
 */
export const BANDS = {
  dev: { label: "DEV", fill: "#0b6e4f" },
  test: { label: "TEST", fill: "#1d5fb4" },
} as const;
export type Band = keyof typeof BANDS;
