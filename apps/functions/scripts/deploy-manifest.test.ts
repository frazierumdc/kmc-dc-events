import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  BUNDLE,
  deployManifest,
  externalDependencies,
  externalFlags,
  type SourceManifest,
} from "./deploy-manifest.ts";

// The manifest of the folder Firebase uploads (ADR 0018), made from this package's own.

const source = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as SourceManifest & { scripts: Record<string, string> };

test("the deploy manifest has no workspace package: npm in the cloud would refuse it", () => {
  const manifest = deployManifest(source);
  expect(JSON.stringify(manifest)).not.toContain("workspace:");
  expect(Object.keys(manifest.dependencies).filter((name) => name.startsWith("@kmcdc/"))).toEqual(
    [],
  );
});

test("it installs the Firebase SDKs, in exactly the ranges this package names", () => {
  const { dependencies } = deployManifest(source);
  expect(Object.keys(dependencies).sort()).toEqual(["firebase-admin", "firebase-functions"]);
  for (const [name, range] of Object.entries(dependencies))
    expect(range).toBe(source.dependencies?.[name]);
});

test("only what the cloud needs: name, module type, the bundle as main, the Node version", () => {
  const manifest = deployManifest(source);
  expect(manifest).toEqual({
    name: "@kmcdc/functions",
    private: true,
    type: "module",
    main: BUNDLE,
    engines: source.engines,
    dependencies: manifest.dependencies,
  });
  expect(Object.keys(manifest)).not.toContain("scripts");
  expect(Object.keys(manifest)).not.toContain("devDependencies");
});

test("this package does declare its workspace packages, as ordinary dependencies", () => {
  expect(source.dependencies).toMatchObject({
    "@kmcdc/cloud": "workspace:*",
    "@kmcdc/domain": "workspace:*",
    "@kmcdc/sync": "workspace:*",
  });
});

test("the bundle leaves out exactly the packages the manifest installs", () => {
  expect(externalFlags(source.scripts.build ?? "").sort()).toEqual(
    Object.keys(deployManifest(source).dependencies).sort(),
  );
});

test.each<[string, SourceManifest, Record<string, string>]>([
  ["none", { name: "a" }, {}],
  [
    "workspace ranges of every form are left out",
    {
      name: "a",
      dependencies: { x: "workspace:*", y: "workspace:^", z: "workspace:../z", k: "^1.2.3" },
    },
    { k: "^1.2.3" },
  ],
  [
    "a range is copied as written",
    { name: "a", dependencies: { k: "~1.2.3 || >=2" } },
    { k: "~1.2.3 || >=2" },
  ],
])("externalDependencies: %s", (_name, pkg, expected) => {
  expect(externalDependencies(pkg)).toEqual(expected);
});

test.each<[string, SourceManifest, string]>([
  [
    "not an ES module",
    { name: "a", engines: { node: "24" }, dependencies: { k: "1" } },
    '"type": "module"',
  ],
  ["no Node version", { name: "a", type: "module", dependencies: { k: "1" } }, "engines.node"],
  [
    "nothing to install",
    { name: "a", type: "module", engines: { node: "24" }, dependencies: { x: "workspace:*" } },
    "no package",
  ],
])("a source the cloud couldn't run stops the build: %s", (_name, pkg, message) => {
  expect(() => deployManifest(pkg)).toThrow(message);
});
