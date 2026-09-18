/** @type {import('next').NextConfig} */
import path from "node:path";
import { fileURLToPath } from "node:url";

// ESM equivalent of CJS __dirname (webpack fallback block below uses it).
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  reactStrictMode: true,
  // Turbopack is the default bundler since Next 16. The same module-graph
  // workarounds that the webpack block applies below are expressed here as
  // resolveAlias entries (turbopack.resolveAlias replaces webpack aliases).
  turbopack: {
    resolveAlias: {
      // compact-runtime's exports map lists "default" before "types";
      // alias directly to the dist file so named re-exports like
      // ContractState/sampleSigningKey resolve without conditions-order
      // errors.
      "@midnight-ntwrk/compact-runtime": {
        browser: "./node_modules/@midnight-ntwrk/compact-runtime/dist/index.js",
        default: "./node_modules/@midnight-ntwrk/compact-runtime/dist/index.js",
      },
      // The wasm packages' browser entries statically import their .wasm
      // binaries, which cannot be bundled — route both bundler targets to
      // the runtime shims (JS glue + runtime instantiation from
      // /midnight-runtime/*).
      "@midnight-ntwrk/onchain-runtime-v3": {
        browser: "./src/lib/wasm/onchain-runtime-v3.js",
        default: "./src/lib/wasm/onchain-runtime-v3.js",
      },
      "@midnight-ntwrk/ledger-v8": {
        browser: "./src/lib/wasm/ledger-v8.js",
        default: "./src/lib/wasm/ledger-v8.js",
      },
      // isomorphic-ws: named-WebSocket shim for both bundle targets.
      "isomorphic-ws": {
        browser: "./src/lib/isomorphic-ws.js",
        default: "./src/lib/isomorphic-ws.js",
      },
    },
  },
  // Kept for `next build --webpack` fallback parity. Turbopack ignores it.
  webpack: (config) => {
    // @midnight-ntwrk/compact-runtime ships an exports map with "default"
    // before "types" — webpack's enhanced-resolve rejects that ordering
    // ("Default condition should be last one") and fails to trace named
    // re-exports like ContractState/sampleSigningKey. Alias directly to the
    // dist file to bypass the broken conditions map.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@midnight-ntwrk/compact-runtime": path.resolve(
        __dirname,
        "node_modules/@midnight-ntwrk/compact-runtime/dist/index.js",
      ),
      // The wasm packages' browser entries statically import their .wasm
      // binaries, which webpack's bundled @webassemblyjs decoder cannot parse
      // (parseTypeSection error). Alias to runtime shims that re-export the
      // JS glue (bg.js) and instantiate the wasm from /midnight-runtime/*.
      // Applied for both client and server so the node/fs variants (which
      // import snippets containing the "#self" specifier) never enter the
      // bundle graph.
      "@midnight-ntwrk/onchain-runtime-v3": path.resolve(
        __dirname,
        "src/lib/wasm/onchain-runtime-v3.js",
      ),
      "@midnight-ntwrk/ledger-v8": path.resolve(
        __dirname,
        "src/lib/wasm/ledger-v8.js",
      ),
      // The indexer public data provider imports { WebSocket } from
      // 'isomorphic-ws'. Its node entry is `module.exports = require('ws')`
      // (webpack cannot statically detect the named export in the server
      // bundle) and its browser entry only has a default export. Alias to a
      // shim exposing the native global WebSocket for both targets.
      "isomorphic-ws": path.resolve(__dirname, "src/lib/isomorphic-ws.js"),
    };
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      topLevelAwait: true,
    };
    config.output.webassemblyModuleFilename = "static/wasm/[modulehash].wasm";
    return config;
  },
};

export default nextConfig;
