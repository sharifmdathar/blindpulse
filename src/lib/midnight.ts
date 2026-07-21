/**
 * Midnight.js SDK wrapper.
 * PUBLIC: This module initializes the provider and connects to Preprod.
 * PRIVATE: Circuit instances manage private witnesses internally.
 */

import type { MidnightProvider } from "@midnight-ntwrk/midnight-js-types";

let provider: MidnightProvider | null = null;

/** Initialize the Midnight.js provider for Preprod network */
export async function initProvider(): Promise<MidnightProvider> {
  if (provider) return provider;

  // TODO: initialize with real Midnight.js provider config
  // const proofServerUrl = process.env.NEXT_PUBLIC_PROOF_SERVER_URL
  //   ?? "http://localhost:6300";
  // provider = await createProvider({ network: "preprod", proofServerUrl });

  return provider as unknown as MidnightProvider;
}

/** Load compiled circuit from /managed directory */
export async function loadCircuit(name: string): Promise<Uint8Array> {
  // TODO: load compiled circuit binary from /managed/circuits/
  // const circuit = await fetch(`/managed/circuits/${name}.bin`).then(r => r.arrayBuffer());
  return new Uint8Array();
}

/** Get the current provider instance */
export function getProvider(): MidnightProvider | null {
  return provider;
}
