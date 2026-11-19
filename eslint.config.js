import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: [
      "**/dist/",
      "apps/functions/deploy/",
      "**/.builds/",
      "brand/images/",
      "docs/",
      "test-results/",
      "playwright-report/",
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: { allowDefaultProject: ["*.js", "*.ts"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      // No function over 20 (docs/refactor-log.md, refactors 8 and 10): the highest the code
      // has now. Lower it as the functions between 16 and 20 are split.
      complexity: ["error", 20],
      // Another workspace package is imported by name ("@kmcdc/domain"), through its public
      // entry, never by a relative path into its folder (docs/adr/0016, kept by 0018).
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex:
                "^(\\.\\./)+(packages/|apps/|(cloud|domain|mailer|sync|ui|web|job|functions)/(src|fixtures|golden)/)",
              message: "Import another workspace package by name, for example @kmcdc/domain.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/web/src/**", "packages/ui/src/**"],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
  { files: ["**/*.js", "**/*.cjs"], extends: [tseslint.configs.disableTypeChecked] },
  { files: ["apps/web/kill-switch/**"], languageOptions: { globals: globals.serviceworker } },
  {
    // Velo code, pasted into Wix as is: it drops fields with ...rest and ignores some errors.
    files: ["wix/**"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { caughtErrors: "none", ignoreRestSiblings: true },
      ],
    },
  },
);
