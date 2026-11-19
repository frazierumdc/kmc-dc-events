// The package.json of the folder Firebase uploads (apps/functions/deploy, ADR 0018).
//
// Firebase's cloud build runs npm on the uploaded folder's package.json, and npm does not
// know pnpm's "workspace:" protocol. So the upload gets a manifest of its own, made from this
// package's: the same name, module type, Node version and Firebase SDK ranges, and none of the
// workspace packages, whose code is already inside the bundle.

/** The parts of apps/functions/package.json the deploy manifest is made from. */
export interface SourceManifest {
  name: string;
  type?: string;
  engines?: Record<string, string>;
  dependencies?: Record<string, string>;
}

/** What the cloud needs to install and start the bundle, and nothing else. */
export interface DeployManifest {
  name: string;
  private: true;
  type: "module";
  main: string;
  engines: Record<string, string>;
  dependencies: Record<string, string>;
}

/** The bundle's file name inside the deploy folder. */
export const BUNDLE = "index.js";

const isWorkspace = (range: string) => range.startsWith("workspace:");

/** The packages the cloud installs: every dependency that isn't a workspace package, with its range as written. */
export function externalDependencies(source: SourceManifest): Record<string, string> {
  return Object.fromEntries(
    Object.entries(source.dependencies ?? {}).filter(([, range]) => !isWorkspace(range)),
  );
}

/** The deploy folder's manifest. Throws when the source can't give npm what it needs. */
export function deployManifest(source: SourceManifest): DeployManifest {
  if (source.type !== "module")
    throw new Error(`${source.name} must be "type": "module": the bundle is an ES module.`);
  if (!source.engines?.node)
    throw new Error(`${source.name} has no engines.node: the cloud needs the Node version.`);
  const dependencies = externalDependencies(source);
  if (Object.keys(dependencies).length === 0)
    throw new Error(`${source.name} lists no package for the cloud to install.`);
  return {
    name: source.name,
    private: true,
    type: "module",
    main: BUNDLE,
    engines: { ...source.engines },
    dependencies,
  };
}

/** The packages a build command leaves out of the bundle: its `--external:<name>` flags. */
export function externalFlags(buildCommand: string): string[] {
  return [...buildCommand.matchAll(/--external:(\S+)/g)].map((m) => m[1] ?? "");
}
