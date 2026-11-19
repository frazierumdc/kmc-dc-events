// node packages/publish/event-pages.ts <built site folder> <site address>
//
// Writes each event's own page beside the app, <folder>/e/{id}/index.html, from
// <folder>/index.html and the schedule in <folder>/v2/feed/latest.json, so a shared link
// previews as the event (src/event-pages.ts), and its share picture beside it,
// <folder>/e/{id}/share.png (share-pictures.ts), and each event picture's thumbnail,
// <folder>/v2/feed/pictures/ (slice 1.13), and each featured event's story picture beside
// them (EV-44). The deploy runs it on every publish, after
// the schedule is in place (publish-site.yml). Without a latest.json it writes nothing.

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { SnapshotV2 } from "@kmcdc/domain";
import {
  fetchStoryPicture,
  fetchThumbnail,
  storyFiles,
  thumbnailFiles,
} from "./src/schedule-files.ts";
import { drawPicture } from "./src/share-pictures.ts";
import { eventPages } from "./src/event-pages.ts";
import { pictureContent, picturePath } from "./src/share-picture.ts";

const [folder, origin] = process.argv.slice(2);
if (!folder || !origin) {
  console.error("Usage: node packages/publish/event-pages.ts <built site folder> <site address>");
  process.exit(2);
}
const latest = path.join(folder, "v2/feed/latest.json");
if (!existsSync(latest)) {
  console.log("No schedule; no event pages written.");
  process.exit(0);
}
const snapshot = SnapshotV2.parse(JSON.parse(await readFile(latest, "utf8")));
const html = await readFile(path.join(folder, "index.html"), "utf8");
const pages = eventPages(html, snapshot, origin.replace(/\/+$/, ""));
for (const [name, page] of pages) {
  await mkdir(path.dirname(path.join(folder, name)), { recursive: true });
  await writeFile(path.join(folder, name), page);
}
let pictures = 0;
for (const event of snapshot.events) {
  if (!pages.has(`e/${event.id}/index.html`)) continue;
  const picture = await drawPicture(pictureContent(event, snapshot.site));
  await writeFile(path.join(folder, picturePath(event.id)), picture);
  pictures += 1;
}
let thumbnails = 0;
for (const [file, content] of await thumbnailFiles(snapshot, null, fetchThumbnail)) {
  if (!(content instanceof Uint8Array)) continue;
  await mkdir(path.dirname(path.join(folder, file)), { recursive: true });
  await writeFile(path.join(folder, file), content);
  thumbnails += 1;
}
// The featured events' story pictures (EV-44): a deploy replaces the whole site, so they are
// written here as the thumbnails are, or a deploy would drop them until the next copy.
let stories = 0;
for (const [file, content] of await storyFiles(snapshot, null, fetchStoryPicture)) {
  if (!(content instanceof Uint8Array)) continue;
  await mkdir(path.dirname(path.join(folder, file)), { recursive: true });
  await writeFile(path.join(folder, file), content);
  stories += 1;
}
console.log(
  `Wrote ${String(pages.size)} event pages, ${String(pictures)} share pictures, ${String(thumbnails)} thumbnails and ${String(stories)} story pictures for ${snapshot.version}.`,
);
