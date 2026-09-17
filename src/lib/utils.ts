/**
 * PUBLIC: Utility functions.
 * No private data handled here — these are display helpers.
 */

/** Truncate a wallet address for display: 0x1234...5678 */
export function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * NOTE: the nullifier is no longer generated here. It is derived per-wallet
 * inside src/lib/midnight.ts (buildNullifier): BLAKE2b-256 over a
 * domain-separated preimage of the wallet's coin public key and the survey
 * id — deterministic per wallet per survey, one-way, unlinkable.
 */

/** Validate that responses array matches question count */
export function validateResponses(
  responses: number[],
  questionCount: number,
): boolean {
  return (
    responses.length === questionCount &&
    responses.every((r) => r >= 0 && Number.isInteger(r))
  );
}
