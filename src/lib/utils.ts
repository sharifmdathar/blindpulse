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
 * Generate a nullifier from a credential.
 * In production this uses a one-way hash so the nullifier is
 * computationally unlinkable from the credential.
 * PRIVATE: credential input, PUBLIC: nullifier output
 */
export function generateNullifier(credential: Uint8Array): Uint8Array {
  // TODO: replace with real hash (e.g. Blake2b) when circuit is compiled
  return credential.slice(0, 32);
}

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
