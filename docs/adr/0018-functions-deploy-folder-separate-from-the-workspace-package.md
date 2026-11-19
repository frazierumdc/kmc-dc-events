# 0018. The functions are deployed from a generated folder, not from the workspace package

- **Status:** Accepted. Supersedes [0016](0016-functions-workspace-dependencies-declared-by-hook.md). The deploy itself is untested in this copy (see Consequences)
- **Decided:** 18 November 2026, by the owner, Sean Frazier
- **Recorded:** Written on 18 November 2026 with refactor 12 ([refactor-log.md](../refactor-log.md)).
- **Source decisions:** None (new)

## Context

[ADR 0016](0016-functions-workspace-dependencies-declared-by-hook.md) worked around a constraint: Firebase uploaded the workspace package folder itself (`functions.source` was `apps/functions`), and its cloud build runs npm on that folder's `package.json`.
So one file had to serve two package managers: pnpm, which needs the workspace packages declared as `workspace:*`, and npm, which rejects that protocol.
The workaround was a pnpm hook (`.pnpmfile.cjs`) that added the three workspace packages for pnpm only.
It kept the dependency graph true, but the declaration was in a file nobody looks in, the hook's checksum was part of the lockfile, and every place that installs the lockfile (the job image among them) had to carry the hook file.

The root cause is that the deploy artifact and the workspace package were the same folder.

## Options

| Option | Trade-off |
|---|---|
| Keep the hook (0016) | Works today and is proven by past deploys; the declaration stays hidden and the hook travels with the lockfile |
| Deploy from a generated folder: the bundle plus a `package.json` written for npm | Each manifest says the truth for its own reader, and the hook goes; the deploy's source folder changes, which cannot be tested from this copy |
| Vendor the workspace packages into the upload as local tarballs | npm installs them itself; a much larger upload and build for code the bundle already contains |

## Decision

- The functions build writes a self-contained deploy folder, `apps/functions/deploy/`: the esbuild bundle (`index.js`) and a generated `package.json` with only what the cloud needs: the name, `"type": "module"`, `main`, `engines`, and the dependencies that are not workspace packages (`firebase-admin`, `firebase-functions`), with their ranges copied from `apps/functions/package.json`.
- `firebase.json` points `functions.source` at that folder. The deploy workflow writes the functions' `.env` there, since Firebase reads it from the source folder; the build replaces only its own two files and leaves `.env` in place.
- `apps/functions/package.json` lists `@kmcdc/cloud`, `@kmcdc/domain` and `@kmcdc/sync` as ordinary `workspace:*` dependencies. `.pnpmfile.cjs` is deleted.
- The build stops if the packages the bundle leaves out are not exactly the ones the generated manifest installs.
- The deploy folder is build output and is not committed.
- What 0016 decided about imports stays: every workspace package is imported by name, and the lint rule that forbids relative imports into another package remains.

## Consequences

- Workspace dependencies are declared where anyone would look for them; no hook, and nothing extra travels with the lockfile. The job image no longer copies a hook file.
- The bundle is byte-for-byte the one built before, and each function's deployment description is unchanged.
- **The functions deploy is untested.** No deploy can be run from this copy, so the first deploy after this change is the test: that the Firebase tool accepts a source folder with no `node_modules` of its own (it finds the Firebase SDK in the folder above), reads `.env` from the new folder, and that the cloud build installs from the generated manifest. If it fails, reverting this change restores 0016 exactly.
- The deploy workflow's path filter now names all three workspace packages the bundle is built from; `packages/cloud` was missing.
