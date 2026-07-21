"use client";

/**
 * React hook for ZK circuit interaction.
 * PUBLIC: Proof generation and verification results.
 * PRIVATE: Private witness construction — all private data stays in this scope,
 *          never persisted to state or logs.
 */

import { useState, useCallback } from "react";

export interface UseCircuitReturn {
  loading: boolean;
  error: string | null;
  generateProof: (
    circuitName: string,
    privateInputs: Uint8Array,
    publicInputs: Uint8Array,
  ) => Promise<Uint8Array | null>;
  verifyProof: (circuitName: string, proof: Uint8Array) => Promise<boolean>;
}

export function useCircuit(): UseCircuitReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Generate a ZK proof using the proof server.
   * PRIVATE: privateInputs contain the respondent's credential and responses.
   *          These are sent to the proof server for circuit evaluation but
   *          NEVER written to the public ledger — only the proof is submitted on-chain.
   */
  const generateProof = useCallback(
    async (
      _circuitName: string,
      _privateInputs: Uint8Array,
      _publicInputs: Uint8Array,
    ): Promise<Uint8Array | null> => {
      setLoading(true);
      setError(null);
      try {
        // TODO: call proof server at NEXT_PUBLIC_PROOF_SERVER_URL
        // const response = await fetch(`${proofServerUrl}/prove`, {
        //   method: "POST",
        //   body: JSON.stringify({ circuitName, privateInputs, publicInputs }),
        // });
        // return new Uint8Array(await response.arrayBuffer());
        return new Uint8Array();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to generate proof",
        );
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /**
   * Verify a ZK proof.
   * PUBLIC: The proof is verified on-chain, but only the proof and
   *         public inputs are visible — private witnesses stay hidden.
   */
  const verifyProof = useCallback(
    async (_circuitName: string, _proof: Uint8Array): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        // TODO: verify proof via proof server or on-chain
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to verify proof");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { loading, error, generateProof, verifyProof };
}
