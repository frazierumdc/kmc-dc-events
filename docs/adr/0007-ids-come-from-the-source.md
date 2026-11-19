# 0007. Identifiers come from the source; nothing is stored to keep them

- **Status:** Accepted
- **Decided:** Date not recorded
- **Recorded:** Written up on 17 November 2026 from the project's decision log, for this copy of the repository.
- **Source decisions:** D39

## Context

Events need stable links (`/e/{id}`), and recurring classes need a stable identity so people can follow "every Monday class".

## Options

| Option | Trade-off |
|---|---|
| Keep a registry that assigns and remembers ids | Ids survive renames; state to store, back up and migrate |
| Use the source's own event id, and derive a class id from its normalized title and city | Nothing stored between runs; a rename or a delete-and-recreate gives a new id |

## Decision

An event's id is the source's own id.
A class or program id is derived from its title (ignoring capitals, accents and punctuation) and its city or "online".

## Consequences

- The same event or class always gets the same id, with no registry.
- Accepted: an event deleted and recreated gets a new link, and a renamed class becomes a new class, as on the website.
