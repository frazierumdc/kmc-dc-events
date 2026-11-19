// node scripts/write-deploy-manifest.ts   (the last step of `pnpm --filter @kmcdc/functions build`)
//
// Writes deploy/package.json beside the bundle (deploy-manifest.ts says why). Stops the build
// when the packages the bundle leaves out aren't exactly the ones the manifest installs.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { deployManifest, externalFlags, type SourceManifest } from "./deploy-manifest.ts";

const root = path.resolve(import.meta.dirname, "..");
const source = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
) as SourceManifest & {
  scripts?: Record<string, string>;
};
const manifest = deployManifest(source);

const left = externalFlags(source.scripts?.build ?? "").sort();
const installed = Object.keys(manifest.dependencies).sort();
if (left.join() !== installed.join()) {
  console.error(
    `The bundle leaves out [${left.join(", ")}] but the cloud would install [${installed.join(", ")}].`,
  );
  process.exit(1);
}

await mkdir(path.join(root, "deploy"), { recursive: true });
await writeFile(path.join(root, "deploy/package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
