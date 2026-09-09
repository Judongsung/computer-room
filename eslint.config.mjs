import babelParser from "@babel/eslint-parser";
import reactHooks from "eslint-plugin-react-hooks";
import dependencyBoundary from "./scripts/eslint/dependency-boundary.mjs";

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          babelrc: false,
          configFile: false,
          parserOpts: { plugins: ["typescript", "jsx"] },
        },
      },
    },
  },
  {
    files: ["src/{domain,application}/**/*.ts"],
    plugins: { architecture: { rules: { "dependency-boundary": dependencyBoundary } } },
    rules: { "architecture/dependency-boundary": "error" },
  },
  {
    files: ["src/client/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
];
