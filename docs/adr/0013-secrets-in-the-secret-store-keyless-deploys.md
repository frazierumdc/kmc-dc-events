# 0013. Secrets in the cloud secret store, keyless deploys, every account a setting

- **Status:** Accepted
- **Decided:** 6 to 7 November 2026
- **Recorded:** Written up on 17 November 2026 from the project's decision log, for this copy of the repository.
- **Source decisions:** D57, D60, D61

## Context

The pipeline holds a feed token and a mail sign-in, and CI deploys to the cloud.
Each environment has its own accounts.

## Options

| Option | Trade-off |
|---|---|
| Secrets as CI secrets or in a local `.env` file | Simple; copies outside the cloud project, no read log, a long-lived deploy key to rotate |
| Each environment's secrets in its own project's secret store, read by a dedicated identity; CI signs in with short-lived, branch-bound tokens | More setup per environment; no stored keys, every read logged, rotation is a new version |

## Decision

- Each environment's secrets live in its own project's Secret Manager.
- Each job has its own identity that can read only its own secrets: the identity that reads the website cannot send email, and the feed token and the mail sign-in are never in the same job.
- GitHub Actions signs in to the cloud with Workload Identity Federation, bound to the branch and the workflow, so there are no long-lived deploy keys.
- No account, project or address is named in code: each is a setting of the environment.

## Consequences

- A leaked development or test secret can't reach production.
- Pointing a deployment at different accounts is a change of settings, not of code.
- A developer machine needs no `.env` file.
- In practice a few deployment-specific constants remained in code ([configuration.md](../configuration.md)); the architecture review proposes moving them behind one configuration module.
