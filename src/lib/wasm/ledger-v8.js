/**
 * Browser shim for @midnight-ntwrk/ledger-v8.
 *
 * Same problem + fix as onchain-runtime-v3: the browser entry statically
 * imports .wasm, which webpack's decoder cannot parse. This shim re-exports
 * the JS glue (bg.js) and instantiates the wasm at runtime from a served URL.
 *
 * The wasm's import section requests the bg.js glue PLUS 24 wasm-bindgen
 * snippet modules (one accessor each, e.g. PreTranscript_). We register
 * equivalent JS objects under the exact import-section module names —
 * mirroring the package's node/fs variant, which builds the identical
 * imports map from its snippet files.
 *
 * PRIVATE: no ledger state touched here; bootstraps the ledger wasm used for
 * Transaction/ContractState encode+decode during contract interaction.
 */
import * as glue from "../../../node_modules/@midnight-ntwrk/ledger-v8/midnight_ledger_wasm_bg.js";
import { __wbg_set_wasm } from "../../../node_modules/@midnight-ntwrk/ledger-v8/midnight_ledger_wasm_bg.js";
export * from "../../../node_modules/@midnight-ntwrk/ledger-v8/midnight_ledger_wasm_bg.js";
import { loadWasmBytes } from "./loader";

const WASM_URL = "/midnight-runtime/ledger-v8/midnight_ledger_wasm_bg.wasm";
const NODE_REL_PATH = "@midnight-ntwrk/ledger-v8/midnight_ledger_wasm_bg.wasm";

/** Import-section module name for the glue namespace */
const GLUE_IMPORT = "./midnight_ledger_wasm_bg.js";
/** Import-section module names for the snippet accessors (dir prefix) */
const SNIPPET_PREFIX = "./snippets/midnight-ledger-wasm-9f71df61dc0427fb";

/**
 * Snippet accessors: wasm imports <name>_ from each inlineN.js; the function
 * returns the corresponding class from the bg.js glue namespace.
 */
const SNIPPETS = {
  "inline0.js": { PreTranscript_: () => glue.PreTranscript },
  "inline1.js": { UnshieldedOffer_: () => glue.UnshieldedOffer },
  "inline2.js": { ZswapInput_: () => glue.ZswapInput },
  "inline3.js": { ZswapTransient_: () => glue.ZswapTransient },
  "inline4.js": { ZswapOffer_: () => glue.ZswapOffer },
  "inline5.js": { ZswapOutput_: () => glue.ZswapOutput },
  "inline6.js": { PrePartitionContractCall_: () => glue.PrePartitionContractCall },
  "inline7.js": { DustSpend_: () => glue.DustSpend },
  "inline8.js": { DustActions_: () => glue.DustActions },
  "inline9.js": { DustRegistration_: () => glue.DustRegistration },
  "inline10.js": { NoBinding_: () => glue.NoBinding },
  "inline11.js": { SignatureErased_: () => glue.SignatureErased },
  "inline12.js": { PreBinding_: () => glue.PreBinding },
  "inline13.js": { SignatureEnabled_: () => glue.SignatureEnabled },
  "inline14.js": { Binding_: () => glue.Binding },
  "inline15.js": { Proof_: () => glue.Proof },
  "inline16.js": { PreProof_: () => glue.PreProof },
  "inline17.js": { Intent_: () => glue.Intent },
  "inline18.js": { ContractCall_: () => glue.ContractCall },
  "inline19.js": { ReplaceAuthority_: () => glue.ReplaceAuthority },
  "inline20.js": { MaintenanceUpdate_: () => glue.MaintenanceUpdate },
  "inline21.js": { VerifierKeyInsert_: () => glue.VerifierKeyInsert },
  "inline22.js": { VerifierKeyRemove_: () => glue.VerifierKeyRemove },
  "inline23.js": { ContractDeploy_: () => glue.ContractDeploy },
};

function buildImports() {
  const imports = { [GLUE_IMPORT]: glue };
  for (const [fileName, accessors] of Object.entries(SNIPPETS)) {
    imports[`${SNIPPET_PREFIX}/${fileName}`] = accessors;
  }
  return imports;
}

async function instantiateLedgerRuntime() {
  const bytes = await loadWasmBytes(WASM_URL, NODE_REL_PATH);
  const wasmModule = new WebAssembly.Module(bytes);
  const wasmInstance = new WebAssembly.Instance(wasmModule, buildImports());
  const wasm = wasmInstance.exports;
  __wbg_set_wasm(wasm);
  wasm.__wbindgen_start();
}

/**
 * Eager, idempotent runtime bootstrap: runs once at import time so
 * module-scope consumers see a live wasm (mirrors webpack's original
 * asyncWebAssembly import semantics).
 */
await instantiateLedgerRuntime();

/**
 * No-op kept for callers that explicitly await the runtime.
 * PUBLIC: no ledger data touched; bootstraps tx/state encode/decode runtime.
 */
export function initLedgerRuntime() {
  return Promise.resolve();
}
