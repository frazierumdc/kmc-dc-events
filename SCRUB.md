# What was removed from this copy

This repository is an independent copy of the KMC DC Events code with a fresh history.
Before the first commit, every value that identifies the center's own setup was removed or replaced by a placeholder.
This file lists the categories, not the values.

## Removed or replaced

| Category | Where it was | What is there now |
|---|---|---|
| Cloud project ids (all environments) | Scripts' usage comments, workflow comments, docs, tests, one default in code | `your-project-id`, `your-project-id-dev`, `your-project-id-test` |
| Hosting site addresses derived from project ids | Tests, comments | Derived from the placeholder project ids |
| The app's own public hostnames (all environments) | Build config, one allowed-origin pattern, docs, tests | `events.example.org`, `events.dev.example.org`, `events.test.example.org` |
| The center's website domain, where it is configuration or data | Feed addresses, site settings, allowed hosts, fixtures, snapshots, docs | `example.org`, `www.example.org` |
| Sending addresses | Tests, docs | `sender@example.org` and variants |
| Mailing-list and contact addresses | Site settings, fixtures, tests, the privacy text | `info@`, `office@`, `contact@example.org` and generic list names |
| Personal addresses and names of people with access | Tests, docs | Generic placeholders; the documents that named people are not included |
| Phone number | Site settings, fixtures, docs | A reserved fictional number (`202.555.0100`) |
| Source repository owner and name | Tests, snapshots, comments, docs | `example-org/events-app` |
| Billing, plan, budget and cost details | Infrastructure document | Document not included |
| Account ownership, access lists and account set-up history | Infrastructure document, runbooks, plan, decision log, backlog | Documents not included |
| Email set-up (sending accounts, list set-up, sign-in clients) | Email architecture and requirements documents | Documents not included; the mailer's code and its environment variables remain |
| Console links for each environment | Links document | Document not included |
| Links to private design artifacts | Requirements documents, working instructions | Links removed |
| AI assistant session instructions and settings | Repository root | Not included |
| Design mock-ups (images and their sources) | `docs/design/` | Not included |

No secret (key, token, password, refresh token) was found in the source tree: secrets were already supplied at run time from a secret store or the CI environment, never from a file.

## Documents not included

The source repository's plan, decision log, runbooks, console links, infrastructure page, email pages, backlog, a draft feature's pages and the mock-up gallery are not in this copy.
Remaining documents and code comments still cite them, and cite decision numbers (`D36`) and requirement ids (`EV-12`); those citations are kept as written.
The decisions that matter to the architecture are restated as ADRs in [docs/adr/](docs/adr/README.md), which also maps the decision numbers to ADRs.

## Kept, on purpose

- The center's name, as the app's name and in its text: the app is credited to the center it was built for.
- The public event data in the test fixtures (titles, times, descriptions, as published on the center's public website), with the website's domain replaced and people's names made up (see the publication pass below).
- The website platform's name (Wix) in code and docs: the adapter is specific to it.
- Generic environment names (`dev`, `test`, `prod`), service-account role names (`feed-reader@`, `mail-sender@`) and the cloud region.

## Publication pass (19 November 2026)

A second pass, after a pre-publication check of the tree, replaced what was public but about other people or other organisations, or was the center's artwork.
Behaviour is unchanged: the tests check the same things on made-up values.

| What | Where it was | What is there now |
|---|---|---|
| Another center's event poster (two picture files) | `data/pictures/` | A drawn placeholder ("Sample retreat"), the same sizes and format, named after the placeholder picture link |
| Another center's event: its title, guest teacher, biography, street address, page and picture links | `data/site.json` (`otherCenterEvents`, `allowedHosts`) and the tests that read it | A made-up event at "Example Meditation Center", a fictional teacher, an address that does not exist, an `example.org` page and a placeholder picture link. A real entry belongs in the deployment's own `data/site.json` and `data/pictures/` |
| Teachers' names in event descriptions and titles | The feed fixture, the schedule fixtures, the golden snapshot, tests and email snapshots | "Teacher A. Example" to "Teacher E. Example", "Guest Teacher G. Example"; page addresses that held a name changed to match |
| A book author's name | The feed fixture and three tests | "the tradition's founder"; the book's title and public link are kept |
| A long passage from a festival organiser's page, with its teacher's name | The feed fixture and the golden snapshot | Two short neutral sentences and a neutral summary; the festival's public link is kept |
| One paragraph of a prayer's description | The feed fixture | A neutral sentence of the same shape (text, then a link on words) |
| The center's logo and every image made from it | `brand/source/`, `brand/images/` | A placeholder mark (a calendar page, "Events app") at `brand/source/logo.png`, and the same set of images regenerated from it, same names, sizes and formats |
| Test addresses on a real domain that is someone else's | Two mailer tests | `example.org` |

The golden snapshot's text was changed in place (the same adapter output for the changed fixture); its shape, ids, times and version are as they were.

**The real logo is supplied at deploy time.** It is not in this repository: a deployment puts the center's picture at `brand/source/logo.png`, runs `pnpm --filter @kmcdc/brand generate` and builds ([brand/README.md](brand/README.md)).

Still as published on the center's public website: its own event titles and descriptions, its public address, its branch class's venue, and links to its event pictures.
The history before this pass still holds the replaced values; a public copy needs a fresh history.

## How configuration is supplied now

- Run-time settings and secrets come from environment variables or the deployment's secret store: [docs/configuration.md](docs/configuration.md) lists every one.
- A small number of deployment-specific constants remain in code as placeholders; the same page lists each with its file.
- With no configuration at all, install, lint, typecheck, unit tests, the data check, the build and the dev server all work, on fixtures.

## Final scan

Run on the tree of the first commit, excluding `node_modules`, build output and the lock file.

| Pattern | Result |
|---|---|
| The center's website and app domains | 0 matches |
| The source project ids and repository name | 0 matches |
| The source repository's owner names | 0 matches |
| Email addresses outside reserved example domains | 0 real addresses (remaining matches are made-up test addresses such as `a@gmail.com`, image file names such as `logo@2x.png`, and a `git@github.com:` remote in a test) |
| US phone numbers | 1 placeholder number only |
| API keys, tokens, private keys (`AIza…`, `ghp_…`, `ya29.…`, `-----BEGIN`, refresh tokens) | 0 real values (one obviously fake test key, `AIzaSyTest-key`, in the browser-test config) |
| Billing account id pattern | 0 matches |
| Private artifact links | 0 matches |
