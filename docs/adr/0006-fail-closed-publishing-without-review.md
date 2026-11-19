# 0006. Publish without human review, and fail closed

- **Status:** Accepted
- **Decided:** Date not recorded
- **Recorded:** Written up on 17 November 2026 from the project's decision log, for this copy of the repository.
- **Source decisions:** D38

## Context

An update job copies the website's events into the app.
Someone could review each copy before it is published, or the job could publish on its own.

## Options

| Option | Trade-off |
|---|---|
| A person approves each schedule change before it reaches phones | A second check; every change waits for a person, though the website is already the reviewed source |
| The job publishes whatever the website shows, and refuses only a broken transmission | No delay; well-formed but wrong data on the website is copied as it is |

## Decision

The update job publishes what the website shows, with no review, and only when something changed.
It publishes nothing, phones keep the last published schedule, and administrators are alerted (at most once a day) when the feed can't be read, is malformed (the envelope doesn't parse, or more than 10% of events can't be read), or is empty while 20 or more events are published.

## Consequences

- A website edit reaches phones without waiting for anyone.
- A broken feed can never empty the app.
- Refusing a broken transmission is not a correction: every readable answer is published as it is.
- Accepted: well-formed but incomplete data would be copied, and the next good run puts it right.
