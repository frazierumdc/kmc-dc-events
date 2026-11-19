// node packages/publish/calendar-files.ts <schedule folder> <site address>
//
// Writes each event's calendar file beside a schedule: <folder>/calendar/{id}.ics, from
// <folder>/latest.json. The deploy runs it on every publish, after the schedule is in
// place (publish-site.yml); iPhone's Add to calendar opens these files (EV-35). Without a
// latest.json it writes nothing.

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { SnapshotV2 } from "@kmcdc/domain";
import { calendarFiles } from "./src/calendar.ts";

const [folder, origin] = process.argv.slice(2);
if (!folder || !origin) {
  console.error("Usage: node packages/publish/calendar-files.ts <schedule folder> <site address>");
  process.exit(2);
}
const latest = path.join(folder, "latest.json");
if (!existsSync(latest)) {
  console.log("No schedule; no calendar files written.");
  process.exit(0);
}
const snapshot = SnapshotV2.parse(JSON.parse(await readFile(latest, "utf8")));
const files = calendarFiles(snapshot, origin.replace(/\/+$/, ""));
await mkdir(path.join(folder, "calendar"), { recursive: true });
for (const [name, text] of files) await writeFile(path.join(folder, name), text);
console.log(`Wrote ${String(files.size)} calendar files for ${snapshot.version}.`);
