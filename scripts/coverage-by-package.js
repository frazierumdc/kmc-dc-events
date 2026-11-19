// node scripts/coverage-by-package.js [coverage/coverage-summary.json]
//
// Line coverage per workspace package, from the summary `pnpm test:coverage` writes: one
// Markdown table, printed, and added to the run's summary page in GitHub Actions. It reports
// and never fails a run: no threshold is set (docs/refactor-log.md, refactor 10).

import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";

const file = process.argv[2] ?? "coverage/coverage-summary.json";
const summary = JSON.parse(readFileSync(file, "utf8"));
const root = path.resolve(import.meta.dirname, "..");

/** `packages/sync` or `apps/web` for a file's absolute path. */
const packageOf = (absolute) => path.relative(root, absolute).split(path.sep).slice(0, 2).join("/");
const percent = (covered, total) =>
  total === 0 ? "n/a" : `${((100 * covered) / total).toFixed(1)}%`;

const packages = new Map();
for (const [name, entry] of Object.entries(summary)) {
  if (name === "total") continue;
  const row = packages.get(packageOf(name)) ?? { files: 0, lines: 0, covered: 0 };
  row.files += 1;
  row.lines += entry.lines.total;
  row.covered += entry.lines.covered;
  packages.set(packageOf(name), row);
}

const lines = [
  "| Package | Source files | Lines | Covered | Line coverage |",
  "|---|---|---|---|---|",
  ...[...packages.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([name, r]) =>
        `| \`${name}\` | ${r.files} | ${r.lines} | ${r.covered} | ${percent(r.covered, r.lines)} |`,
    ),
  `| **All** | ${Object.keys(summary).length - 1} | ${summary.total.lines.total} | ${summary.total.lines.covered} | ${percent(summary.total.lines.covered, summary.total.lines.total)} |`,
];
const table = `${lines.join("\n")}\n`;
console.log(table);
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Line coverage\n\n${table}`);
