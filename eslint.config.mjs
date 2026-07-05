// Flat ESLint config for the monorepo. Pragmatic baseline: typescript-eslint
// recommended (syntactic, not type-checked, so it stays fast in CI) with the
// noisy stylistic rules relaxed to match the existing codebase. TypeScript
// strict mode continues to carry type safety; this layer catches foot-guns.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "docs/**",
      "scripts/**",
      "tests/**",
      "**/*.mjs",
      "**/*.cjs",
      "**/*.js"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    rules: {
      // The codebase legitimately uses `request.auth!` after auth middleware and
      // metadata records typed as unknown; type safety is enforced by tsc strict.
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }
      ],
      "no-empty": ["error", { allowEmptyCatch: true }]
    }
  },
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off"
    }
  }
);
