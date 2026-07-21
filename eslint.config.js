// Deliberately minimal ESLint config: it exists to catch ONE class of bug —
// React Rules of Hooks violations (hooks called conditionally or after an early
// return), which crash the whole screen at runtime with the white "Something went
// wrong" (minified React #310) and can't be caught by the server smoke suite.
//
// It intentionally does NOT enforce style/formatting/unused-vars across the
// existing codebase — that would bury the one signal that matters in noise.
// `npm run lint` runs this; `npm run build` runs it first (see package.json), so
// a hooks-order mistake fails the build instead of reaching a user's phone.
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // The load-bearing rule: conditional/early-return hooks = build failure.
      "react-hooks/rules-of-hooks": "error",
      // Missing effect deps are a warning, not an error — many pre-existing
      // effects intentionally omit deps, and we don't want those to block builds.
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
