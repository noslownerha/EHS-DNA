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

// Browser/runtime globals this app legitimately uses. Declared explicitly so
// no-undef (below) flags REAL undefined variables instead of every builtin.
const BROWSER_GLOBALS = Object.fromEntries([
  "window", "document", "navigator", "location", "history", "screen",
  "localStorage", "sessionStorage", "fetch", "Headers", "Request", "Response",
  "FormData", "Blob", "File", "FileReader", "URL", "URLSearchParams",
  "console", "alert", "confirm", "prompt",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval",
  "requestAnimationFrame", "cancelAnimationFrame",
  "Image", "Audio", "Event", "CustomEvent", "AbortController",
  "IntersectionObserver", "ResizeObserver", "MutationObserver",
  "SpeechRecognition", "webkitSpeechRecognition",
  "crypto", "btoa", "atob", "structuredClone", "queueMicrotask", "indexedDB",
  "performance", "Notification", "getComputedStyle", "matchMedia",
  "HTMLElement", "Node", "DOMParser", "XMLHttpRequest", "WebSocket", "EventSource",
  "process",
].map(g => [g, "readonly"]));

export default [
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: BROWSER_GLOBALS,
    },
    rules: {
      // The load-bearing rule: conditional/early-return hooks = build failure.
      "react-hooks/rules-of-hooks": "error",
      // Referencing a variable that doesn't exist in scope. Added after a real
      // production crash: a prop (onBack) was used inside a helper component
      // that never received it, throwing "onBack is not defined" and white-
      // screening two whole tabs. The build passed and the smoke suite passed
      // (it only exercises the server), so nothing caught it before a user did.
      // This is precisely the class of bug the lint gate exists for.
      "no-undef": "error",
      // Missing effect deps are a warning, not an error — many pre-existing
      // effects intentionally omit deps, and we don't want those to block builds.
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
