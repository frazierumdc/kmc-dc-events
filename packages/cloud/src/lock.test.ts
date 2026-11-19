import { expect, test } from "vitest";
import { memoryBucket, WroteFirst, type Bucket } from "./bucket.ts";
import { takeLock } from "./lock.ts";

// The lock: one run at a time per project (D63), on a bucket in memory.

const LOCK = "update-schedule/lock.json";
const holder = (bucket: ReturnType<typeof memoryBucket>) =>
  (JSON.parse(bucket.files[LOCK]?.text ?? "{}") as { holder?: string }).holder;

test("a free lock is taken and released", async () => {
  const bucket = memoryBucket();
  const release = await takeLock({ bucket, name: LOCK, holder: "run-1" });
  expect(holder(bucket)).toBe("run-1");
  await release();
  expect(bucket.files[LOCK]).toBeUndefined();
});

test("a run that finds the lock waits for the other run to finish", async () => {
  const bucket = memoryBucket();
  let clock = Date.parse("2026-11-12T04:07:00Z");
  const first = await takeLock({ bucket, name: LOCK, holder: "run-1", now: () => clock });
  const log: string[] = [];
  let sleeps = 0;
  const second = await takeLock({
    bucket,
    name: LOCK,
    holder: "run-2",
    now: () => clock,
    log: (l) => log.push(l),
    sleep: async () => {
      clock += 5_000;
      sleeps++;
      if (sleeps === 3) await first();
    },
  });
  expect(sleeps).toBe(3);
  expect(log).toEqual(["Waiting for another run (run-1) to finish."]);
  expect(holder(bucket)).toBe("run-2");
  await second();
});

test("a lock left by a run that died is taken over once it is stale", async () => {
  const bucket = memoryBucket({
    [LOCK]: {
      text: JSON.stringify({ holder: "dead", at: "2026-11-12T03:00:00Z" }),
      generation: "4",
    },
  });
  const log: string[] = [];
  const release = await takeLock({
    bucket,
    name: LOCK,
    holder: "run-3",
    now: () => Date.parse("2026-11-12T04:07:00Z"),
    log: (l) => log.push(l),
  });
  expect(log[0]).toContain("Taking over a lock left by dead");
  expect(holder(bucket)).toBe("run-3");
  await release();
});

test("a run gives up after waiting too long, and never works without the lock", async () => {
  const bucket = memoryBucket();
  let clock = Date.parse("2026-11-12T04:07:00Z");
  await takeLock({ bucket, name: LOCK, holder: "slow", now: () => clock });
  await expect(
    takeLock({
      bucket,
      name: LOCK,
      holder: "run-4",
      now: () => clock,
      waitMs: 60_000,
      sleep: () => {
        clock += 30_000;
        return Promise.resolve();
      },
    }),
  ).rejects.toThrow("gave up waiting");
});

test("releasing a lock a later run took over leaves that run's lock", async () => {
  const bucket = memoryBucket();
  let clock = Date.parse("2026-11-12T04:00:00Z");
  const first = await takeLock({ bucket, name: LOCK, holder: "run-1", now: () => clock });
  clock += 30 * 60_000;
  await takeLock({ bucket, name: LOCK, holder: "run-2", now: () => clock });
  await first();
  expect(holder(bucket)).toBe("run-2");
});

test("two runs that both find the lock free: the one that writes second waits for the first", async () => {
  const inner = memoryBucket();
  let clock = Date.parse("2026-11-12T04:07:00Z");
  let raced = false;
  // The other run writes its lock between this run's read and its write, once.
  const bucket: Bucket = {
    ...inner,
    async write(name, text, generation) {
      if (!raced) {
        raced = true;
        await inner.write(
          name,
          JSON.stringify({ holder: "run-1", at: new Date(clock).toISOString() }),
          "0",
        );
      }
      return inner.write(name, text, generation);
    },
  };
  const log: string[] = [];
  const release = await takeLock({
    bucket,
    name: LOCK,
    holder: "run-2",
    now: () => clock,
    log: (l) => log.push(l),
    sleep: async () => {
      clock += 5_000;
      // run-1 finishes while run-2 waits.
      await inner.remove(LOCK, inner.files[LOCK]?.generation ?? "0");
    },
  });
  expect(log).toEqual(["Waiting for another run (run-1) to finish."]);
  expect(holder(inner)).toBe("run-2");
  await release();
  expect(inner.files[LOCK]).toBeUndefined();
});

const DAMAGED = "not json";

test("a damaged lock file that is young: the run waits, as for any lock", async () => {
  let clock = Date.parse("2026-11-12T04:07:00Z");
  const bucket = memoryBucket({
    [LOCK]: { text: DAMAGED, generation: "7", updated: "2026-11-12T04:05:00Z" },
  });
  const log: string[] = [];
  let sleeps = 0;
  const release = await takeLock({
    bucket,
    name: LOCK,
    holder: "run-5",
    now: () => clock,
    log: (l) => log.push(l),
    sleep: async () => {
      clock += 5_000;
      sleeps++;
      // The run that wrote it finishes and removes it.
      if (sleeps === 2) await bucket.remove(LOCK, "7");
    },
  });
  expect(sleeps).toBe(2);
  expect(log).toEqual(["Waiting for another run (unknown) to finish."]);
  expect(holder(bucket)).toBe("run-5");
  await release();
});

test("a damaged lock file that is old is taken over like a stale lock, with a warning naming the file", async () => {
  const bucket = memoryBucket({
    [LOCK]: { text: DAMAGED, generation: "7", updated: "2026-11-12T03:40:00Z" },
  });
  const log: string[] = [];
  const release = await takeLock({
    bucket,
    name: LOCK,
    holder: "run-5",
    now: () => Date.parse("2026-11-12T04:07:00Z"),
    log: (l) => log.push(l),
  });
  expect(log).toEqual([
    "Warning: the lock file update-schedule/lock.json can't be read; taking it over, as it was last written at 2026-11-12T03:40:00Z.",
  ]);
  expect(holder(bucket)).toBe("run-5");
  await release();
  expect(bucket.files[LOCK]).toBeUndefined();
});

test("a damaged lock exactly at the stale limit is taken over; a moment younger still waits", async () => {
  const written = Date.parse("2026-11-12T04:00:00Z");
  const damaged = () =>
    memoryBucket({
      [LOCK]: { text: "{}", generation: "7", updated: new Date(written).toISOString() },
    });
  const taken = await takeLock({
    bucket: damaged(),
    name: LOCK,
    holder: "run-5",
    staleMs: 60_000,
    now: () => written + 60_000,
  });
  await taken();
  let clock = written + 59_999;
  await expect(
    takeLock({
      bucket: damaged(),
      name: LOCK,
      holder: "run-5",
      staleMs: 60_000,
      waitMs: 0,
      now: () => clock,
      sleep: () => {
        clock += 1;
        return Promise.resolve();
      },
    }),
  ).rejects.toThrow("gave up waiting");
});

test("a damaged lock whose file says nothing of when it was written is never assumed stale", async () => {
  const bucket = memoryBucket({ [LOCK]: { text: DAMAGED, generation: "7" } });
  let clock = Date.parse("2026-11-12T04:07:00Z");
  await expect(
    takeLock({
      bucket,
      name: LOCK,
      holder: "run-5",
      now: () => clock,
      waitMs: 60_000,
      sleep: () => {
        clock += 30_000;
        return Promise.resolve();
      },
    }),
  ).rejects.toThrow(
    "Another run (unknown) still holds update-schedule/lock.json; gave up waiting.",
  );
  expect(bucket.files[LOCK]?.text).toBe(DAMAGED);
});

test("a bucket that fails for another reason stops the run: the lock is never assumed", async () => {
  const bucket: Bucket = {
    ...memoryBucket(),
    write: () => Promise.reject(new Error("Could not write (503)")),
  };
  await expect(takeLock({ bucket, name: LOCK, holder: "run-6" })).rejects.toThrow("503");
});

test("the bucket in memory keeps Cloud Storage's rule for versions", async () => {
  const bucket = memoryBucket();
  const first = await bucket.write("a.json", "1", "0");
  await expect(bucket.write("a.json", "2", "0")).rejects.toBeInstanceOf(WroteFirst);
  const second = await bucket.write("a.json", "2", first);
  await expect(bucket.remove("a.json", first)).rejects.toBeInstanceOf(WroteFirst);
  await bucket.remove("a.json", second);
  await bucket.remove("a.json", second);
  expect(await bucket.read("a.json")).toBeNull();
});
