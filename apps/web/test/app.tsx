import { vi } from "vitest";
import type { Schedule } from "../src/schedule/schedule.ts";
import type { ScheduleSync } from "../src/schedule/use-schedule.ts";
import { fakeNetwork, golden, memoryStore } from "./schedule.ts";

// Shared by the tests split from App.test.tsx.

export const scrollTo = vi.fn();

/** Online with the golden schedule, nothing stored yet. */
export const online = (schedule: Schedule = golden): ScheduleSync => ({
  fetchFn: fakeNetwork(schedule).fetchFn,
  store: memoryStore(),
});

export const now = () => new Date("2026-10-13T12:00:00Z");
