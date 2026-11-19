import { expect, test } from "vitest";
import { readKindFilter, saveKindFilter } from "./kind-filter-store.ts";

const memory = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
};

test("the filter is remembered (EV-15)", () => {
  const store = memory();
  expect(readKindFilter(store)).toBe("all");
  saveKindFilter("prayer", store);
  expect(readKindFilter(store)).toBe("prayer");
});

test("a value the app doesn't offer, no storage or failing storage means All", () => {
  const store = memory();
  store.setItem("kmcdc.kindFilter", "Chanted Prayers");
  expect(readKindFilter(store)).toBe("all");
  expect(readKindFilter(null)).toBe("all");
  const broken = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  expect(readKindFilter(broken)).toBe("all");
  expect(() => {
    saveKindFilter("special", broken);
  }).not.toThrow();
});
