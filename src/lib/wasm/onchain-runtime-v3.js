/**
 * Browser shim for @midnight-ntwrk/onchain-runtime-v3.
 *
 * The package's browser entry (`midnight_onchain_runtime_wasm.js`) statically
 * imports its .wasm binary, which webpack's bundled @webassemblyjs decoder
 * cannot parse (parseTypeSection error). This shim re-exports the same JS
 * glue (bg.js) but instantiates the wasm at RUNTIME from a served URL,
 * mirroring the package's own node/fs variant exactly:
 *
 *   imports["./midnight_onchain_runtime_wasm_bg.js"] = glue exports
 *
 * The module-scope `await` replicates webpack's original asyncWebAssembly
 * behaviour: importers (e.g. compact-runtime's `MAX_FIELD = maxField()` in
 * constants.js) are made async modules and only evaluate once the wasm is
 * instantiated and `__wbindgen_start()` has run.
 *
 * PRIVATE: this module touches no ledger state. It only bootstraps the
 * Compact runtime wasm used by circuit execution.
 */
import * as glue from "../../../node_modules/@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm_bg.js";
import { __wbg_set_wasm } from "../../../node_modules/@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm_bg.js";
export * from "../../../node_modules/@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm_bg.js";
import { loadWasmBytes } from "./loader";

const WASM_URL =
  "/midnight-runtime/onchain-runtime-v3/midnight_onchain_runtime_wasm_bg.wasm";
const NODE_REL_PATH =
  "@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm_bg.wasm";

async function instantiateOnchainRuntime() {
  const bytes = await loadWasmBytes(WASM_URL, NODE_REL_PATH);
  const imports = { "./midnight_onchain_runtime_wasm_bg.js": glue };
  const wasmModule = new WebAssembly.Module(bytes);
  const wasmInstance = new WebAssembly.Instance(wasmModule, imports);
  const wasm = wasmInstance.exports;
  __wbg_set_wasm(wasm);
  wasm.__wbindgen_start();
}

/**
 * Eager, idempotent runtime bootstrap: runs once at import time so
 * module-scope consumers (compact-runtime constants) see a live wasm.
 */
await instantiateOnchainRuntime();

/**
 * No-op kept for callers that explicitly await the runtime.
 * PUBLIC: no ledger data touched; bootstraps circuit execution runtime.
 */
export function initOnchainRuntime() {
  return Promise.resolve();
}
