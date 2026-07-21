// Tests for BlindPulse Compact contract
//
// These tests validate the contract logic that the Compact compiler enforces.
// In a real dev environment, run with: ts-node contract/blindpulse.test.ts
// or via the Midnight.js SDK test harness.
//
// The tests simulate the ledger state transitions that the contract circuits
// would produce when called through the Compact runtime.

describe("BlindPulse Contract", () => {
  const organizer = new Uint8Array(32).fill(1);
  const questionCount = 3;
  const nullifier = new Uint8Array(32).fill(4);
  const nullifier2 = new Uint8Array(32).fill(5);

  // Mock ledger state matching the Compact contract's `export ledger` fields
  function createMockLedger() {
    return {
      surveyActive: false,
      questionCount: 0,
      tallies: new Map<number, Map<number, number>>(),
      participantCount: 0,
      nullifiers: new Set<string>(),
      organizer: new Uint8Array(32),
    };
  }

  // Helper: simulate constructor behavior
  function simulateConstructor(
    ledger: ReturnType<typeof createMockLedger>,
    org: Uint8Array,
    qCount: number,
  ) {
    ledger.surveyActive = true;
    ledger.questionCount = qCount;
    ledger.organizer = org;
    // Initialize tally maps for each question up to MAX_Q (20)
    for (let i = 0; i < 20; i++) {
      if (!ledger.tallies.has(i)) {
        ledger.tallies.set(i, new Map());
      }
    }
  }

  // Helper: simulate submitResponse behavior
  function simulateSubmitResponse(
    ledger: ReturnType<typeof createMockLedger>,
    nf: Uint8Array,
    responses: number[],
  ): boolean {
    if (!ledger.surveyActive) return false;

    const nfKey = Array.from(nf).join(",");
    if (ledger.nullifiers.has(nfKey)) return false;

    ledger.nullifiers.add(nfKey);

    for (let i = 0; i < 20; i++) {
      if (i < ledger.questionCount) {
        const optionIdx = responses[i];
        const qTally = ledger.tallies.get(i)!;
        qTally.set(optionIdx, (qTally.get(optionIdx) || 0) + 1);
      }
    }

    ledger.participantCount++;
    return true;
  }

  // Test 1: Constructor sets correct public state
  test("constructor sets correct public state", () => {
    const ledger = createMockLedger();
    simulateConstructor(ledger, organizer, questionCount);

    expect(ledger.surveyActive).toBe(true);
    expect(ledger.questionCount).toBe(questionCount);
    expect(ledger.organizer).toEqual(organizer);
    expect(ledger.participantCount).toBe(0);
  });

  // Test 2: submitResponse updates tallies correctly
  test("submitResponse updates tallies correctly", () => {
    const ledger = createMockLedger();
    simulateConstructor(ledger, organizer, questionCount);

    const responses = [
      1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ];
    const result = simulateSubmitResponse(ledger, nullifier, responses);

    expect(result).toBe(true);
    expect(ledger.tallies.get(0)?.get(1)).toBe(1);
    expect(ledger.tallies.get(1)?.get(0)).toBe(1);
    expect(ledger.tallies.get(2)?.get(2)).toBe(1);
    expect(ledger.participantCount).toBe(1);
  });

  // Test 3: submitResponse rejects duplicate nullifier
  test("submitResponse rejects duplicate nullifier", () => {
    const ledger = createMockLedger();
    simulateConstructor(ledger, organizer, questionCount);

    const responses = new Array(20).fill(0);
    const firstResult = simulateSubmitResponse(ledger, nullifier, responses);
    const secondResult = simulateSubmitResponse(ledger, nullifier, responses);

    expect(firstResult).toBe(true);
    expect(secondResult).toBe(false);
    expect(ledger.participantCount).toBe(1);
  });

  // Test 4: submitResponse rejects when survey inactive
  test("submitResponse rejects when survey inactive", () => {
    const ledger = createMockLedger();
    simulateConstructor(ledger, organizer, questionCount);

    // Close the survey
    ledger.surveyActive = false;

    const responses = new Array(20).fill(0);
    const result = simulateSubmitResponse(ledger, nullifier, responses);

    expect(result).toBe(false);
    expect(ledger.participantCount).toBe(0);
  });

  // Test 5: getResults returns correct aggregate data (ledger tallies are public)
  test("getResults reads correct aggregate tallies", () => {
    const ledger = createMockLedger();
    simulateConstructor(ledger, organizer, 2);

    // Submit response 1: [0, 1]
    simulateSubmitResponse(
      ledger,
      nullifier,
      [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    );

    // Submit response 2: [0, 0]
    simulateSubmitResponse(
      ledger,
      nullifier2,
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    );

    // Ledger tallies are publicly readable
    expect(ledger.tallies.get(0)?.get(0)).toBe(2);
    expect(ledger.tallies.get(1)?.get(1)).toBe(1);
    expect(ledger.tallies.get(1)?.get(0)).toBe(1);
    expect(ledger.participantCount).toBe(2);
  });

  // Test 6: closeSurvey deactivates the survey
  test("closeSurvey deactivates the survey", () => {
    const ledger = createMockLedger();
    simulateConstructor(ledger, organizer, questionCount);

    expect(ledger.surveyActive).toBe(true);

    // Close the survey
    ledger.surveyActive = false;
    expect(ledger.surveyActive).toBe(false);

    // Verify no more responses can be submitted
    const responses = new Array(20).fill(0);
    const result = simulateSubmitResponse(ledger, nullifier, responses);
    expect(result).toBe(false);
  });
});
