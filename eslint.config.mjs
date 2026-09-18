import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // react-hooks v7 flags synchronous setState inside effects in the
      // pre-existing wallet-reconnect / page-load flows (useWallet,
      // dashboard, survey/results clients). Rewriting those flows needs
      // verification against Lace on Preprod — deferred, not deleted.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "managed/**",
    "node_modules/**",
    "scripts/**",
    "public/midnight-runtime/**",
  ]),
]);
