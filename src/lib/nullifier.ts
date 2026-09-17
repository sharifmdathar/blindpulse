/**
 * Nullifier derivation for anonymous, double-submit-safe participation.
 *
 *   nullifier = BLAKE2b-256(domain || coinPublicKey || surveyId)
 *
 * Properties (the privacy model, enforced by construction):
 * - ONE-WAY: preimage (wallet identity) is infeasible to recover from the
 *   on-chain digest.
 * - DETERMINISTIC PER (WALLET, SURVEY): the same wallet always produces the
 *   same nullifier for a given survey, so the contract's nullifier set
 *   rejects double-submission.
 * - UNLINKABLE ACROSS SURVEYS: the survey id is bound into the preimage, so
 *   the same wallet's participation in different surveys yields unrelated
 *   digests that cannot be correlated.
 * - DOMAIN-SEPARATED: the "blindpulse-nullifier-v1" prefix prevents replay
 *   of this hash in any other protocol or contract.
 *
 * PRIVATE: coinPublicKey — only ever a hash input, never transmitted.
 * PUBLIC: the 32-byte digest (disclosed on-chain by the circuit, by design).
 */

import { blake2b } from "@noble/hashes/blake2.js";

const NULLIFIER_DOMAIN = "blindpulse-nullifier-v1";

export function deriveNullifier(
  coinPublicKey: Uint8Array,
  surveyIdBytes: Uint8Array,
): Uint8Array {
  if (coinPublicKey.length !== 32) {
    throw new Error(
      `coin public key must be 32 bytes, received ${coinPublicKey.length}`,
    );
  }
  if (surveyIdBytes.length !== 32) {
    throw new Error(
      `survey id must be 32 bytes, received ${surveyIdBytes.length}`,
    );
  }
  const domain = new TextEncoder().encode(NULLIFIER_DOMAIN);
  const input = new Uint8Array(
    domain.length + coinPublicKey.length + surveyIdBytes.length,
  );
  input.set(domain, 0);
  input.set(coinPublicKey, domain.length);
  input.set(surveyIdBytes, domain.length + coinPublicKey.length);
  return blake2b(input, { dkLen: 32 });
}

export function hexToBytes32(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length !== 64) {
    throw new Error(`expected 64 hex chars, received: ${hex.slice(0, 70)}`);
  }
  return new Uint8Array(
    clean.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)),
  );
}
