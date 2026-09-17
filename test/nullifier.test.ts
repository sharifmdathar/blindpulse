// Nullifier derivation tests — the double-submit guarantee.
//
// The circuit already rejects a seen nullifier ("Nullifier already spent");
// these tests pin the client-side derivation properties that make that
// check meaningful: per-wallet uniqueness, per-survey binding, and
// determinism. See src/lib/nullifier.ts for the property documentation.

import { deriveNullifier, hexToBytes32 } from "../src/lib/nullifier";

const SURVEY_A = hexToBytes32(
  "92ef920564c1b67d8081f6eea8a880c7ac0904d601396ef87c16859b29ff8087",
);
const SURVEY_B = hexToBytes32(
  "c85d9e980809d76f7f0204be2730c752b0abfb5ae572c1fa038622c7a0ba7d4f",
);

function wallet(seed: number): Uint8Array {
  return new Uint8Array(32).fill(seed);
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("nullifier derivation", () => {
  test("is deterministic for the same wallet and survey", () => {
    const a1 = deriveNullifier(wallet(1), SURVEY_A);
    const a2 = deriveNullifier(wallet(1), SURVEY_A);
    expect(hex(a1)).toBe(hex(a2));
    expect(a1.length).toBe(32);
  });

  test("differs per wallet — two respondents never collide", () => {
    const alice = deriveNullifier(wallet(1), SURVEY_A);
    const bob = deriveNullifier(wallet(2), SURVEY_A);
    expect(hex(alice)).not.toBe(hex(bob));
  });

  test("is unlinkable across surveys for the same wallet", () => {
    const sameWalletSurveyA = deriveNullifier(wallet(1), SURVEY_A);
    const sameWalletSurveyB = deriveNullifier(wallet(1), SURVEY_B);
    expect(hex(sameWalletSurveyA)).not.toBe(hex(sameWalletSurveyB));
  });

  test("rejects malformed inputs instead of producing weak digests", () => {
    expect(() => deriveNullifier(new Uint8Array(31), SURVEY_A)).toThrow(
      /coin public key/,
    );
    expect(() => deriveNullifier(wallet(1), new Uint8Array(33))).toThrow(
      /survey id/,
    );
    expect(() => hexToBytes32("0x1234")).toThrow(/64 hex chars/);
  });
});
