/**
 * Type declarations for the ledger-v8 wasm shim.
 * The runtime shim itself is plain JS (bundled via webpack alias); only the
 * init entry point is consumed from TypeScript code.
 */
export function initLedgerRuntime(): Promise<void>;
