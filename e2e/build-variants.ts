import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Global setup: builds the app three times for the service-worker tests (sw.spec.ts):
// two versions, to update from one to the other (C-11), and the kill switch.
export const BUILDS = fileURLToPath(new URL(".builds/", import.meta.url));
export const VARIANTS = {
  a: {},
  b: {},
  kill: { KILL_SWITCH: "1" },
} as const;
export type Variant = keyof typeof VARIANTS;

export default function buildVariants() {
  for (const [name, env] of Object.entries(VARIANTS)) {
    execFileSync(
      "pnpm",
      [
        "--filter",
        "@kmcdc/web",
        "exec",
        "vite",
        "build",
        "--outDir",
        `${BUILDS}${name}`,
        "--emptyOutDir",
      ],
      { env: { ...process.env, ...env, BUILD_ID: name }, stdio: "ignore" },
    );
  }
}
