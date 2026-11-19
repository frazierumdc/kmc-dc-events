# 0002. One cloud provider: Google Cloud and Firebase

- **Status:** Accepted
- **Decided:** Date not recorded (an early decision)
- **Recorded:** Written up on 17 November 2026 from the project's decision log, for this copy of the repository.
- **Source decisions:** D2

## Context

The system needs static hosting, a few timers and functions, a secret store, container jobs, push messaging and a mail API.
A small organization has to be able to run it after hand-over.

## Options

The decision log records the choice and its reason, not a comparison of providers.
It rules out adding a second provider.

## Decision

Google Cloud and Firebase only.

## Consequences

- One set of accounts, permissions and skills to maintain.
- The free tiers cover this app's volume.
- Later choices stay inside the provider: Cloud Run jobs, Secret Manager, Cloud Messaging, the Realtime Database for the live record.
- Accepted: the system is tied to one provider. The parts most exposed to that are kept behind small modules (`packages/cloud`, the hosting publish).
