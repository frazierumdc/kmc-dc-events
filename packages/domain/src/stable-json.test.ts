import { expect, test } from "vitest";
import { stableStringify } from "./stable-json.ts";

test("stable JSON sorts keys at every level", () => {
  expect(stableStringify({ b: 1, a: { d: [{ f: 1, e: 2 }], c: null } })).toBe(
    '{"a":{"c":null,"d":[{"e":2,"f":1}]},"b":1}',
  );
});
