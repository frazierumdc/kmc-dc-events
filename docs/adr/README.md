# Architecture decision records

Short records of the decisions that shape this system: title, context, options, decision, consequences.

0001 to 0014 record decisions that were already made when this copy was created.
They are written up from the project's own decision log, which is not included here ([SCRUB.md](../../SCRUB.md)).
Where that log gives a reason, the ADR repeats it; where it records no alternatives or no date, the ADR says so and does not supply one.
0015 comes from the [architecture review](../architecture-review.md) and was accepted before the refactor started.
Later numbers are decisions made during the refactor ([refactor-log.md](../refactor-log.md)).

| ADR | Title | Status |
|---|---|---|
| [0001](0001-installable-web-app-no-app-stores.md) | An installable web app, not app-store apps | Accepted |
| [0002](0002-one-cloud-provider.md) | One cloud provider: Google Cloud and Firebase | Accepted |
| [0003](0003-website-is-the-single-source-of-truth.md) | The website is the single source of truth | Accepted |
| [0004](0004-one-adapter-knows-the-source.md) | One adapter knows the source | Accepted |
| [0005](0005-static-snapshot-files-no-server.md) | Static snapshot files, with no server or database until a feature needs one | Accepted |
| [0006](0006-fail-closed-publishing-without-review.md) | Publish without human review, and fail closed | Accepted |
| [0007](0007-ids-come-from-the-source.md) | Identifiers come from the source; nothing is stored to keep them | Accepted |
| [0008](0008-eastern-time-everywhere.md) | Eastern time for everything | Accepted |
| [0009](0009-typescript-react-pnpm-monorepo.md) | TypeScript everywhere, React, a pnpm monorepo, vertical slices | Accepted |
| [0010](0010-three-isolated-environments.md) | Three isolated environments, promoted by pull request | Accepted |
| [0011](0011-notifications-by-topic-no-accounts.md) | Notifications by topic, with no accounts | Accepted |
| [0012](0012-layered-schedule-delivery.md) | Layered schedule delivery instead of relying on push | Accepted |
| [0013](0013-secrets-in-the-secret-store-keyless-deploys.md) | Secrets in the cloud secret store, keyless deploys, every account a setting | Accepted |
| [0014](0014-pipeline-jobs-on-the-cloud-ci-on-github.md) | Pipeline jobs run on the cloud provider; CI and deploys stay on GitHub Actions | Accepted |
| [0015](0015-feature-folders-inside-app-and-ui.md) | Feature folders inside the web app and UI package; package boundaries kept | Accepted |
| [0016](0016-functions-workspace-dependencies-declared-by-hook.md) | Workspace packages are imported by name; the functions app declares them through a pnpm hook | Superseded by 0018 |
| [0017](0017-the-pipeline-runs-only-on-the-cloud.md) | The pipeline runs only on Google Cloud; the GitHub-workflow path is retired | Accepted |
| [0018](0018-functions-deploy-folder-separate-from-the-workspace-package.md) | The functions are deployed from a generated folder, not from the workspace package | Accepted |

## Decision numbers in code and docs

Code comments and the imported documents cite the source log's decision numbers (`D36`).
The ones behind these ADRs:

| Source number | ADR |
|---|---|
| D1 | [0001](0001-installable-web-app-no-app-stores.md) |
| D2 | [0002](0002-one-cloud-provider.md) |
| D3 | [0003](0003-website-is-the-single-source-of-truth.md) |
| D4 | [0004](0004-one-adapter-knows-the-source.md) |
| D8 | [0003](0003-website-is-the-single-source-of-truth.md) |
| D10 | [0008](0008-eastern-time-everywhere.md) |
| D11 | [0011](0011-notifications-by-topic-no-accounts.md) |
| D12 | [0009](0009-typescript-react-pnpm-monorepo.md) |
| D28 | [0012](0012-layered-schedule-delivery.md) |
| D36 | [0003](0003-website-is-the-single-source-of-truth.md) |
| D37 | [0004](0004-one-adapter-knows-the-source.md) |
| D38 | [0005](0005-static-snapshot-files-no-server.md), [0006](0006-fail-closed-publishing-without-review.md) |
| D39 | [0007](0007-ids-come-from-the-source.md) |
| D41 | [0005](0005-static-snapshot-files-no-server.md) |
| D42 | [0010](0010-three-isolated-environments.md) |
| D46 | [0003](0003-website-is-the-single-source-of-truth.md) |
| D52 | [0010](0010-three-isolated-environments.md) |
| D53 | [0010](0010-three-isolated-environments.md) |
| D54 | [0014](0014-pipeline-jobs-on-the-cloud-ci-on-github.md) |
| D57 | [0013](0013-secrets-in-the-secret-store-keyless-deploys.md) |
| D59 | [0012](0012-layered-schedule-delivery.md) |
| D60 | [0013](0013-secrets-in-the-secret-store-keyless-deploys.md) |
| D61 | [0013](0013-secrets-in-the-secret-store-keyless-deploys.md) |
| D63 | [0014](0014-pipeline-jobs-on-the-cloud-ci-on-github.md) |
| D64 | [0012](0012-layered-schedule-delivery.md) |
| D65 | [0011](0011-notifications-by-topic-no-accounts.md) |
| D66 | [0014](0014-pipeline-jobs-on-the-cloud-ci-on-github.md) |
| D67 | [0003](0003-website-is-the-single-source-of-truth.md) |
| D69 | [0011](0011-notifications-by-topic-no-accounts.md) |

Other numbers cited in comments (for example the look of the app, individual emails, the splash) are product decisions that have no ADR here.

## Format

Each file has: status, when it was decided, context, the options considered with their trade-offs, the decision, and its consequences.
New decisions get the next number; a decision that replaces another says so in both files.
