import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*", "apps/web", "apps/functions", "apps/job"],
    passWithNoTests: true,
    // pnpm test:coverage. Line coverage of the source every package ships, tests and test
    // data left out; scripts/coverage-by-package.ts turns the summary into one row per package.
    coverage: {
      provider: "v8",
      include: [
        "packages/*/src/**/*.{ts,tsx}",
        "packages/publish/*.ts",
        "apps/*/src/**/*.{ts,tsx}",
      ],
      exclude: ["**/*.test.{ts,tsx}", "**/*.d.ts", "**/test-*.{ts,tsx}"],
      reporter: ["text-summary", "json-summary"],
      reportsDirectory: "coverage",
    },
  },
});
