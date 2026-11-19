import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { checkData } from "./check-data.ts";

const DATA = path.resolve(import.meta.dirname, "../../../data");

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "data-check-"));
  await cp(path.join(DATA, "site.json"), path.join(dir, "site.json"));
  await cp(path.join(DATA, "pictures"), path.join(dir, "pictures"), { recursive: true });
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const write = (rel: string, value: unknown) =>
  writeFile(path.join(dir, rel), typeof value === "string" ? value : JSON.stringify(value));

test("data/ is valid", async () => {
  expect(await checkData(DATA)).toEqual({ files: 3, errors: [] });
});

test("site.json: missing, broken, or invalid with the field named", async () => {
  await rm(path.join(dir, "site.json"));
  expect((await checkData(dir)).errors).toEqual(["site.json: missing"]);
  await write("site.json", "{");
  expect((await checkData(dir)).errors).toEqual([expect.stringMatching(/^site\.json: /)]);
  const site: unknown = JSON.parse(await readFile(path.join(DATA, "site.json"), "utf8"));
  await write("site.json", { ...(site as object), homeCity: "" });
  expect((await checkData(dir)).errors).toEqual([expect.stringMatching(/^site\.json homeCity: /)]);
  await write("site.json", { ...(site as object), categoryKinds: { "Study Programs": "study" } });
  expect((await checkData(dir)).errors).toEqual([
    expect.stringMatching(/^site\.json categoryKinds\.Study Programs: /),
  ]);
});

test("anything else in data/ is a problem: the schedule is never kept there (D38)", async () => {
  await mkdir(path.join(dir, "events"));
  await write("series.json", {});
  expect((await checkData(dir)).errors).toEqual([
    "events: not a data file; data/ holds only site.json and pictures/",
    "series.json: not a data file; data/ holds only site.json and pictures/",
  ]);
});

test("pictures/ holds both pictures of each other center's event, as JPEG, and nothing else (D67)", async () => {
  const [thumbnail, story] = ["4cb0b7ffa1abe411-256.jpg", "4cb0b7ffa1abe411-story.jpg"];
  await rm(path.join(dir, "pictures", story));
  await write(`pictures/${thumbnail}`, "<html>not a picture</html>");
  await write("pictures/stray.jpg", "x");
  expect((await checkData(dir)).errors).toEqual([
    `pictures/${thumbnail}: not a JPEG`,
    `pictures/${story}: missing; example-center-2026-12-05-sample-retreat's picture is kept here (D67)`,
    "pictures/stray.jpg: no other center's event in site.json has this picture",
  ]);
});
