import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import ts from "typescript-eslint";
import next from "@next/eslint-plugin-next";
import hooks from "eslint-plugin-react-hooks";
import globals from "globals";
// Compose maintained plugins directly, avoiding incompatible legacy dependencies.
export default defineConfig([
  globalIgnores([
    ".release/**",
    ".ci-results/**",
    ".ci-evidence/**",
    ".next/**",
    ".next-e2e/**",
    ".next-validation/**",
    ".next-validation-clean/**",
    ".sites-runtime/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
  js.configs.recommended,
  ...ts.configs.recommended,
  next.configs["core-web-vitals"],
  hooks.configs.flat.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    // Synchronizing browser storage after hydration is an intentional effect.
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
]);
