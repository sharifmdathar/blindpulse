/**
 * Shared wasm binary loader for the midnight runtime shims.
 *
 * Browser: fetches the wasm from the app-served `/midnight-runtime/...` route.
 * Node (SSR): reads the binary directly from node_modules so the server
 * never needs an HTTP round-trip.
 *
 * PUBLIC: none — internal to the wasm shim layer.
 */

const browserFetch = (wasmUrl) =>
  fetch(wasmUrl).then((res) => {
    if (!res.ok) {
      throw new Error(
        `BlindPulse: failed to fetch wasm at ${wasmUrl} (${res.status})`,
      );
    }
    return res.arrayBuffer();
  });

/**
 * Load the wasm bytes for a midnight runtime package.
 * @param {string} wasmUrl      absolute URL used in the browser
 * @param {string} nodeRelPath  path under node_modules/ used in Node
 * @returns {Promise<ArrayBuffer | Uint8Array>}
 */
export async function loadWasmBytes(wasmUrl, nodeRelPath) {
  if (typeof window !== "undefined") {
    return browserFetch(wasmUrl);
  }
  // Node/SSR fallback. process.getBuiltinModule avoids bundler resolution of
  // "node:fs" in the client bundle (this branch never runs in a browser).
  const fs = process.getBuiltinModule("fs");
  const nodePath = process.getBuiltinModule("path");
  const filePath = nodePath.join(process.cwd(), "node_modules", nodeRelPath);
  return fs.readFileSync(filePath);
}
