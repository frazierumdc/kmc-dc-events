import { expect, test } from "vitest";
import { richTextToPlain, truncate } from "./rich-text.ts";

const text = (t: string) => ({ type: "TEXT", textData: { text: t } });
const para = (...parts: string[]) => ({ type: "PARAGRAPH", nodes: parts.map(text) });
const item = (...nodes: unknown[]) => ({ type: "LIST_ITEM", nodes });

test("paragraphs and headings become paragraphs; empty ones and images are dropped", () => {
  const doc = {
    nodes: [
      { type: "HEADING", nodes: [text("Retreat")] },
      para("With ", "Teacher  Example"),
      para(),
      { type: "IMAGE", imageData: { src: "x" } },
      para("Everyone is welcome."),
    ],
  };
  expect(richTextToPlain(doc)).toBe("Retreat\n\nWith Teacher Example\n\nEveryone is welcome.");
});

test("bulleted and ordered lists, nested lists flattened", () => {
  const doc = {
    nodes: [
      { type: "BULLETED_LIST", nodes: [item(para("Tea")), item(para("Q&A"))] },
      {
        type: "ORDERED_LIST",
        nodes: [
          item(para("Arrive"), { type: "BULLETED_LIST", nodes: [item(para("Sign in"))] }),
          item(para("Meditate")),
        ],
      },
    ],
  };
  expect(richTextToPlain(doc)).toBe("• Tea\n• Q&A\n\n1. Arrive\n• Sign in\n2. Meditate");
});

test("node types it doesn't know are searched for text", () => {
  expect(richTextToPlain({ nodes: [{ type: "BLOCKQUOTE", nodes: [para("Quoted")] }] })).toBe(
    "Quoted",
  );
  expect(richTextToPlain(undefined)).toBe("");
  expect(richTextToPlain({ nodes: "nope" })).toBe("");
});

test("long text is cut at a word with an ellipsis", () => {
  expect(truncate("one two three", 9)).toBe("one two…");
  expect(truncate("short", 9)).toBe("short");
  const long = richTextToPlain({ nodes: [para("word ".repeat(1000))] });
  expect(long.length).toBeLessThanOrEqual(4000);
  expect(long).toMatch(/ word…$/);
});

// Link pieces as Wix sends them (8 October capture).
const linked = (t: string, url: string, ...more: string[]) => ({
  type: "TEXT",
  textData: {
    text: t,
    decorations: [
      ...more.map((type) => ({ type })),
      { type: "LINK", linkData: { link: { url, target: "BLANK" } } },
      { type: "UNDERLINE" },
    ],
  },
});
const linkPara = (...nodes: unknown[]) => ({ type: "PARAGRAPH", nodes });

test("a link on words gets its address after them in brackets", () => {
  const doc = {
    nodes: [
      linkPara(
        text("It is explained in the book "),
        linked("Heart Jewel", "https://tharpa.com/us/heart-jewel-393.html", "BOLD"),
        text(" by the tradition's founder. "),
      ),
    ],
  };
  expect(richTextToPlain(doc, Infinity)).toBe(
    "It is explained in the book Heart Jewel (https://tharpa.com/us/heart-jewel-393.html) by the tradition's founder.",
  );
});

test("a link whose words are its address is left as it is", () => {
  const doc = {
    nodes: [
      linkPara(
        text("and online at "),
        linked("https://kadampafestivals.org/fall", "https://kadampafestivals.org/fall", "BOLD"),
      ),
      linkPara(
        text("contact "),
        linked("office@example.org", "mailto:office@example.org"),
        text("."),
      ),
      linkPara(linked("kadampafestivals.org", "https://www.kadampafestivals.org/")),
    ],
  };
  expect(richTextToPlain(doc, Infinity)).toBe(
    "and online at https://kadampafestivals.org/fall\n\ncontact office@example.org.\n\nkadampafestivals.org",
  );
});

test("a link over several pieces gets its address once; a space after the words stays after it", () => {
  const url = "https://givebutter.com/c/auction";
  const doc = {
    nodes: [
      linkPara(linked("silent ", url, "BOLD"), linked("auction ", url), text("opens Friday")),
      linkPara(text("Write to "), linked("the office", "mailto:office@example.org?subject=Hi")),
    ],
  };
  expect(richTextToPlain(doc, Infinity)).toBe(
    `silent auction (${url}) opens Friday\n\nWrite to the office (office@example.org)`,
  );
});

test("links that aren't web or email addresses are dropped, keeping the words", () => {
  const doc = { nodes: [linkPara(linked("Section 2", "#anchor"), text(" below"))] };
  expect(richTextToPlain(doc, Infinity)).toBe("Section 2 below");
});
