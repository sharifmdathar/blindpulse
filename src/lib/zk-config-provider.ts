/**
 * ZK artifact provider for compiled circuits served by the DApp.
 *
 * Replaces FetchZkConfigProvider, whose `cross-fetch` dependency fails inside
 * the webpack client bundle (its node/browser entry resolution breaks under
 * the bundler, surfacing as an opaque ZKConfigurationReadError on deploy).
 * This implementation uses the browser's native fetch and never bundles a
 * fetch polyfill.
 *
 * Artifact layout served by src/app/zk-artifacts/[...path]/route.ts:
 *   /zk-artifacts/keys/{circuitId}.prover
 *   /zk-artifacts/keys/{circuitId}.verifier
 *   /zk-artifacts/zkir/{circuitId}.bzkir
 *
 * PUBLIC: serves only compiled circuit artifacts. No private data flows here.
 */

import { createProverKey, createVerifierKey, createZKIR, ZKConfigProvider } from "@midnight-ntwrk/midnight-js-types";

const BASE_URL = "/zk-artifacts";

async function fetchArtifact(
  path: string,
  circuitId: string,
  kind: string,
): Promise<Uint8Array> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/${path}`);
  } catch (err) {
    throw new Error(
      `Network error fetching ${kind} for '${circuitId}' from ${BASE_URL}/${path}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
  if (!res.ok) {
    throw new Error(
      `Failed to fetch ${kind} for '${circuitId}' from ${BASE_URL}/${path}: ${res.status} ${res.statusText}`,
    );
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    throw new Error(
      `Expected ${kind} binary for '${circuitId}' at ${BASE_URL}/${path}, got text/html (artifact missing or SPA fallback)`,
    );
  }
  return new Uint8Array(await res.arrayBuffer());
}

class BrowserZkConfigProvider<K extends string> extends ZKConfigProvider<K> {
  async getProverKey(circuitId: K): Promise<ReturnType<typeof createProverKey>> {
    return createProverKey(
      await fetchArtifact(`keys/${circuitId}.prover`, circuitId, "prover key"),
    );
  }

  async getVerifierKey(
    circuitId: K,
  ): Promise<ReturnType<typeof createVerifierKey>> {
    return createVerifierKey(
      await fetchArtifact(
        `keys/${circuitId}.verifier`,
        circuitId,
        "verifier key",
      ),
    );
  }

  async getZKIR(circuitId: K): Promise<ReturnType<typeof createZKIR>> {
    return createZKIR(
      await fetchArtifact(`zkir/${circuitId}.bzkir`, circuitId, "ZKIR"),
    );
  }
}

/**
 * Build the ZK config provider used by both the proof provider (wallet
 * proving) and the deploy transaction (verifier-key embedding).
 * PUBLIC: circuit artifacts only; no witness data passes through.
 */
export function createZkConfigProvider<K extends string>(): ZKConfigProvider<K> {
  return new BrowserZkConfigProvider<K>();
}
