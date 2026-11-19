import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    // One jsdom per worker, each file still in its own context: no test here needs a process
    // of its own (docs/refactor-log.md, refactor 11).
    pool: "vmThreads",
  },
});
