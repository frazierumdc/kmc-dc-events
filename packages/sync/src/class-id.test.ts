import { expect, test } from "vitest";
import { classId } from "./class-id.ts";

const at = (city: string | null) => ({
  online: false,
  name: null,
  address: null,
  city,
  geo: null,
});
const online = { ...at(null), online: true };

test("the same title in the same city gives the same id, in the documented form", () => {
  const id = classId({ title: "Monday Meditation Class", location: at("Washington") });
  expect(id).toMatch(/^c_[0-9A-HJKMNP-TV-Z]{12}$/);
  expect(classId({ title: "Monday Meditation Class", location: at("Washington") })).toBe(id);
});

test("capitals, accents, punctuation and spacing don't count", () => {
  const id = classId({ title: "Café Meditation: Part 1", location: at("Málaga") });
  expect(classId({ title: "  cafe meditation — part 1!", location: at("MALAGA") })).toBe(id);
});

test("another title, city, or online gives another id", () => {
  const ids = new Set([
    classId({ title: "Meditation Class", location: at("Washington") }),
    classId({ title: "Meditation Class", location: at("Richmond") }),
    classId({ title: "Meditation Class", location: online }),
    classId({ title: "Meditation Class 2", location: at("Washington") }),
    classId({ title: "Meditation Class", location: null }),
  ]);
  expect(ids.size).toBe(5);
});

test("a pinned value, so the id never changes by accident (favorites keep it)", () => {
  expect(classId({ title: "Monday Meditation Class", location: at("Washington") })).toBe(
    "c_BD70DGDE94GW",
  );
});
