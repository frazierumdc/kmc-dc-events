import { expect, test } from "vitest";
import { descriptionParts } from "./description-links.ts";

test("web and email addresses become links; the text around them stays (EV-33)", () => {
  expect(
    descriptionParts(
      "It is explained in the book Heart Jewel (https://tharpa.com/us/heart-jewel-393.html) by the tradition's founder.",
    ),
  ).toEqual([
    "It is explained in the book Heart Jewel (",
    {
      text: "https://tharpa.com/us/heart-jewel-393.html",
      href: "https://tharpa.com/us/heart-jewel-393.html",
    },
    ") by the tradition's founder.",
  ]);
  expect(descriptionParts("contact office@example.org.")).toEqual([
    "contact ",
    { text: "office@example.org", href: "mailto:office@example.org" },
    ".",
  ]);
});

test("an address at the very start or end, and one with brackets of its own", () => {
  expect(descriptionParts("https://kadampafestivals.org/fall")).toEqual([
    { text: "https://kadampafestivals.org/fall", href: "https://kadampafestivals.org/fall" },
  ]);
  const wiki = "https://en.wikipedia.org/wiki/Bodhisattva_(vow)";
  expect(descriptionParts(`See ${wiki}, then`)).toEqual([
    "See ",
    { text: wiki, href: wiki },
    ", then",
  ]);
});

test("text with no address is one piece; empty text has none", () => {
  expect(descriptionParts("Everyone is welcome.\n\nNo booking needed.")).toEqual([
    "Everyone is welcome.\n\nNo booking needed.",
  ]);
  expect(descriptionParts("")).toEqual([]);
  expect(descriptionParts("javascript:alert(1) and ftp://x.org")).toEqual([
    "javascript:alert(1) and ftp://x.org",
  ]);
});
