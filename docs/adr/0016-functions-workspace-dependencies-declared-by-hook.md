# 0016. Workspace packages are imported by name; the functions app declares them through a pnpm hook

- **Status:** Superseded by [0018](0018-functions-deploy-folder-separate-from-the-workspace-package.md) on 18 November 2026. Importing workspace packages by name, and the lint rule, still stand; the pnpm hook is gone
- **Decided:** 18 November 2026
- **Recorded:** Written on 18 November 2026 with refactor 2 ([refactor-log.md](../refactor-log.md)).
- **Source decisions:** None (new)

## Context

Twenty imports reached into another workspace package by relative path (`../../../packages/sync/src/copy-website.ts`): 11 in source and 9 in tests.
Four workspace dependencies were used without being declared: `apps/functions` on `domain`, `sync` and `cloud`, and `packages/cloud` on `domain`.
The dependency graph in the `package.json` files was therefore wrong, and the imports went past each package's public entry.

`packages/cloud` has no constraint: it can declare its dependency.
`apps/functions` has one.
Firebase uploads the `apps/functions` folder (the esbuild bundle and `package.json`), and the cloud builder runs npm on that `package.json`.
npm rejects the `workspace:` protocol in `dependencies` and in `devDependencies`, also when development dependencies are left out, so listing the workspace packages there would break every functions deploy.
The bundle already contains their code; only the Firebase SDKs need installing in the cloud.

## Options

| Option | Trade-off |
|---|---|
| Leave the relative imports in `apps/functions` | Nothing to explain; the graph stays wrong and the imports keep reaching into private files |
| List the workspace packages in `apps/functions/package.json` | The obvious place; the cloud build fails on `workspace:*` |
| Generate a second `package.json` for the upload at deploy time | Both manifests are honest; it changes the deploy, which cannot be tested from this copy |
| `paths` in the TypeScript config plus matching aliases for the bundler and the test runner | No package-manager feature needed; three places to keep equal, and pnpm still does not know the dependency |
| A pnpm `readPackage` hook (`.pnpmfile.cjs`) adds the three packages to the functions app's development dependencies, for pnpm only | The graph is true in pnpm and in the lockfile, and `package.json` stays as npm needs it; the declaration is in a less obvious file, and the hook file must be present wherever the lockfile is installed |

## Decision

- Every workspace package is imported by name (`@kmcdc/domain`), through its public entry or a declared sub-path such as `@kmcdc/domain/fixtures/*`.
- A lint rule (`no-restricted-imports` in `eslint.config.js`) rejects relative imports into another package.
- `packages/cloud` declares `@kmcdc/domain` in its `package.json`.
- `apps/functions` gets `@kmcdc/cloud`, `@kmcdc/domain` and `@kmcdc/sync` from the hook in `.pnpmfile.cjs`; its `package.json` is unchanged.
- The feed fixture shared by four packages' tests (`wix-events.json`) lives in `packages/domain/fixtures`, next to the feed's schema, so no test reaches into `packages/sync` and `packages/mailer` gains no dependency on `sync`.

## Consequences

- Relative cross-package imports: 20 to 0. Undeclared workspace dependencies: 4 to 0.
- The functions bundle contains the same modules as before; only their order changed.
- The job image's Dockerfile copies `.pnpmfile.cjs` with the lockfile, because the lockfile records the hook's checksum and a frozen install fails without the file.
- Anyone reading `apps/functions/package.json` alone will not see the workspace dependencies; the hook file and this record say why.
- If the deploy ever uploads a generated manifest, the hook can be replaced by ordinary entries in `package.json`.
