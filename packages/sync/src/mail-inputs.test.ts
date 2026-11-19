import { SnapshotV2Event, type SnapshotV2 } from "@kmcdc/domain";
import fixture from "@kmcdc/domain/fixtures/duplicates-2026-10-16.json" with { type: "json" };
import { expect, test } from "vitest";
import { mailInputs } from "./mail-inputs.ts";

// Which emails' inputs a copy hands over (AN-13, D51). Real events from the dev
// schedule of 16 Oct 2026: 10 listed twice and 1 clash.

const events = fixture.events.map((e) => SnapshotV2Event.parse(e));
const site = { name: "KMC DC" } as unknown as SnapshotV2["site"];
const schedule = (list: SnapshotV2Event[]) => ({ events: list, site }) as unknown as SnapshotV2;
const AT = "2026-10-17T08:07:40.000Z";
const once = events.filter((e) => e.title === "Monday Meditation Class").slice(0, 1);

test("Duplicate events after every copy that finds any", () => {
  const { duplicates } = mailInputs(schedule(events), AT);
  expect(duplicates?.duplicates.duplicates).toHaveLength(10);
  expect(duplicates?.duplicates.clashes).toHaveLength(1);
  expect(duplicates?.site).toBe(site);
  expect(duplicates?.copiedAt).toBe(AT);
  expect(mailInputs(schedule(once), AT).duplicates).toBeNull();
});
