// Multi-vote semantics: the nullifier derivation (src/lib/nullifier.ts)
// composed with the contract's submitResponse nullifier-set rules
// (contract/blindpulse.compact).
//
// These tests simulate the circuit's ledger transition exactly as written in
// the .compact source: assert surveyActive, reject a nullifier already in the
// spent set, then insert the nullifier and increment tallies + participant
// counter. The nullifiers come from the REAL deriveNullifier — no hand-picked
// byte arrays — so what is pinned here is the same end-to-end property the
// chain enforces:
//
//   - two wallets, one survey  -> two participants, two tallies
//   - one wallet, twice        -> second submit rejected, count stays 1
//   - one wallet, two surveys  -> both accepted and unlinkable
//
// The chain-level proof of the same behavior lives in the manual Preprod
// flow (see test/integration.test.ts); this suite pins the logic hermetically.

import { deriveNullifier, hexToBytes32 } from "../src/lib/nullifier";

const SURVEY_A = hexToBytes32(
  "92ef920564c1b67d8081f6eea8a880c7ac0904d601396ef87c16859b29ff8087",
);
const SURVEY_B = hexToBytes32(
  "c85d9e980809d76f7f0204be2730c752b0abfb5ae572c1fa038622c7a0ba7d4f",
);

const MAX_Q = 20;

function wallet(seed: number): Uint8Array {
  return new Uint8Array(32).fill(seed);
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- Mock ledger mirroring contract/blindpulse.compact -----------------
// (export ledger surveyActive/questionCount/tallies/participantCount/nullifiers)

function createMockLedger() {
  return {
    surveyActive: false,
    questionCount: 0,
    tallies: new Map<number, Map<number, number>>(),
    participantCount: 0,
    nullifiers: new Set<string>(),
  };
}

// Mirrors the constructor: activate, set questionCount, pre-create every
// (question, option) tally cell so submitResponse can increment without
// inserting witness-derived keys.
function simulateConstructor(
  ledger: ReturnType<typeof createMockLedger>,
  qCount: number,
) {
  ledger.surveyActive = true;
  ledger.questionCount = qCount;
  for (let q = 0; q < MAX_Q; q++) {
    ledger.tallies.set(q, new Map());
  }
}

// Mirrors the exported circuit submitResponse(nullifier, responses[20]):
// PRIVATE witnesses nullifier + responses; the only ledger effects are the
// nullifier-set insert and aggregate tally/counter increments. Returns null
// on rejection (matching the on-chain failure the form surfaces) or the
// updated public state.
function simulateSubmitResponse(
  ledger: ReturnType<typeof createMockLedger>,
  nullifier: Uint8Array,
  responses: number[],
): "ok" | "Nullifier already spent" | "Survey is not active" {
  if (!ledger.surveyActive) return "Survey is not active";

  const key = hex(nullifier);
  if (ledger.nullifiers.has(key)) return "Nullifier already spent";

  ledger.nullifiers.add(key);
  for (let q = 0; q < MAX_Q; q++) {
    if (q < ledger.questionCount) {
      const option = responses[q] ?? 0;
      const row = ledger.tallies.get(q)!;
      row.set(option, (row.get(option) ?? 0) + 1);
    }
  }
  ledger.participantCount += 1;
  return "ok";
}

function submit(
  ledger: ReturnType<typeof createMockLedger>,
  coinPublicKey: Uint8Array,
  surveyId: Uint8Array,
  responses: number[],
) {
  return simulateSubmitResponse(
    ledger,
    deriveNullifier(coinPublicKey, surveyId),
    responses,
  );
}

// --- Multi-vote ---------------------------------------------------------

describe("multi-vote (per-wallet per-survey nullifiers vs contract nullifier set)", () => {
  test("two wallets can each vote once — participants 2, distinct tallies", () => {
    const ledger = createMockLedger();
    simulateConstructor(ledger, 2);

    // Alice: q0 -> option 1, q1 -> option 0
    expect(
      submit(ledger, wallet(1), SURVEY_A, [1, 0, ...Array(18).fill(0)]),
    ).toBe("ok");
    // Bob: q0 -> option 0, q1 -> option 1
    expect(
      submit(ledger, wallet(2), SURVEY_A, [0, 1, ...Array(18).fill(0)]),
    ).toBe("ok");

    expect(ledger.participantCount).toBe(2);
    expect(ledger.nullifiers.size).toBe(2);
    // Distinct tallies accumulated per option
    expect(ledger.tallies.get(0)?.get(1)).toBe(1); // Alice q0
    expect(ledger.tallies.get(0)?.get(0)).toBe(1); // Bob q0
    expect(ledger.tallies.get(1)?.get(0)).toBe(1); // Alice q1
    expect(ledger.tallies.get(1)?.get(1)).toBe(1); // Bob q1
  });

  test("same wallet voting twice is rejected — count stays 1", () => {
    const ledger = createMockLedger();
    simulateConstructor(ledger, 2);

    expect(
      submit(ledger, wallet(1), SURVEY_A, [1, 1, ...Array(18).fill(0)]),
    ).toBe("ok");
    // Same wallet, same survey -> identical nullifier -> circuit rejects.
    // The raw on-chain failure message the form surfaces:
    expect(
      submit(ledger, wallet(1), SURVEY_A, [0, 0, ...Array(18).fill(0)]),
    ).toBe("Nullifier already spent");

    expect(ledger.participantCount).toBe(1);
    expect(ledger.nullifiers.size).toBe(1);
    // First vote's tallies are untouched by the rejected attempt
    expect(ledger.tallies.get(0)?.get(1)).toBe(1);
    expect(ledger.tallies.get(1)?.get(1)).toBe(1);
    expect(ledger.tallies.get(0)?.get(0)).toBeUndefined();
  });

  test("one wallet votes in two surveys — both count, digests unlinkable", () => {
    const ledgerA = createMockLedger();
    const ledgerB = createMockLedger();
    simulateConstructor(ledgerA, 1);
    simulateConstructor(ledgerB, 1);

    expect(
      submit(ledgerA, wallet(7), SURVEY_A, [0, ...Array(19).fill(0)]),
    ).toBe("ok");
    expect(
      submit(ledgerB, wallet(7), SURVEY_B, [1, ...Array(19).fill(0)]),
    ).toBe("ok");

    // Both surveys honestly count the same human once each
    expect(ledgerA.participantCount).toBe(1);
    expect(ledgerB.participantCount).toBe(1);

    // Cross-survey unlinkability: the two on-chain digests share nothing
    const nfA = hex(deriveNullifier(wallet(7), SURVEY_A));
    const nfB = hex(deriveNullifier(wallet(7), SURVEY_B));
    expect(nfA).not.toBe(nfB);
    // ...and neither digest reveals the wallet identity (all-ones key here,
    // but the digests must not be trivially derived from it either).
    expect(nfA).not.toMatch(/^(11)+$/);
  });

  test("multi-question votes accumulate independently per question", () => {
    const ledger = createMockLedger();
    simulateConstructor(ledger, 3);

    // Three wallets, three questions, varied options
    expect(
      submit(ledger, wallet(1), SURVEY_A, [2, 0, 1, ...Array(17).fill(0)]),
    ).toBe("ok");
    expect(
      submit(ledger, wallet(2), SURVEY_A, [2, 1, 1, ...Array(17).fill(0)]),
    ).toBe("ok");
    expect(
      submit(ledger, wallet(3), SURVEY_A, [1, 1, 0, ...Array(17).fill(0)]),
    ).toBe("ok");

    expect(ledger.participantCount).toBe(3);
    // q0: option 2 x2, option 1 x1
    expect(ledger.tallies.get(0)?.get(2)).toBe(2);
    expect(ledger.tallies.get(0)?.get(1)).toBe(1);
    // q1: option 1 x2, option 0 x1
    expect(ledger.tallies.get(1)?.get(1)).toBe(2);
    expect(ledger.tallies.get(1)?.get(0)).toBe(1);
    // q2: option 1 x2, option 0 x1
    expect(ledger.tallies.get(2)?.get(1)).toBe(2);
    expect(ledger.tallies.get(2)?.get(0)).toBe(1);
  });
});
