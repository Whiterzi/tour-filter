import js from "@eslint/js";
import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist/**", "dist-api/**", "tmp/**", "research/**", ".wrangler/**", ".sites-runtime/**", ".next/**", ".vinext/**", "outputs/**", "work/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": hooks },
    rules: { ...hooks.configs.recommended.rules, "@typescript-eslint/no-explicit-any": "off" },
  },
  {
    files: ["scripts/*.mjs"],
    rules: { "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }] },
  },
);
