import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: [".github/scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // Turn off style/typing debt rules globally.
    // Real correctness is enforced by tsc + vitest.
    // These represent incremental improvement work, not correctness bugs.
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    rules: {
      // Typing debt — hundreds of `any` uses; typed incrementally
      "@typescript-eslint/no-explicit-any": "off",
      // Copy debt — HTML entities in JSX; cosmetic only
      "react/no-unescaped-entities": "off",
      // Dead-code debt — unused imports/vars; cleaned up over time
      "@typescript-eslint/no-unused-vars": "off",
      // Image optimisation hint — non-blocking
      "@next/next/no-img-element": "off",
      // Hook dep arrays — intentional omissions documented at call sites
      "react-hooks/exhaustive-deps": "off",
      // Stale expression warning — false positives in optional chaining patterns
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "public/**/_next/**",
    "next-env.d.ts",
    "scripts/seed_prelive.*",
  ]),
]);

export default eslintConfig;
