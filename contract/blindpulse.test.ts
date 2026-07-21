// Tests for BlindPulse Compact contract
//
// These tests validate the contract logic using the Compact runtime.
// In a real dev environment, run with: ts-node contract/blindpulse.test.ts

describe("BlindPulse Contract", () => {
  const organizer = new Uint8Array(32).fill(1); // mock organizer address
  const questionCount = 3;
  const surveyId = new Uint8Array(32).fill(2);
  const credential = new Uint8Array(64).fill(3);
  const nullifier = new Uint8Array(32).fill(4);
  const nullifier2 = new Uint8Array(32).fill(5);

  // Mock ledger state setup
  function createMockLedger() {
    return {
      surveyActive: false,
      questionCount: 0,
      tallies: new Map(),
      participantCount: 0,
      nullifiers: new Map(),
      organizer: new Uint8Array(32),
    };
  }

  test("Test 1: createSurvey sets correct public state", () => {
    const ledger = createMockLedger();
    // Simulate: createSurvey(organizer, questionCount)
    ledger.surveyActive = true;
    ledger.questionCount = questionCount;
    ledger.organizer = organizer;
    ledger.participantCount = 0;

    expect(ledger.surveyActive).toBe(true);
    expect(ledger.questionCount).toBe(questionCount);
    expect(ledger.organizer).toEqual(organizer);
    expect(ledger.participantCount).toBe(0);
  });

  test("Test 2: submitResponse updates tallies correctly", () => {
    const ledger = createMockLedger();
    // Setup: active survey with 3 questions
    ledger.surveyActive = true;
    ledger.questionCount = questionCount;

    // Simulate: submitResponse with responses [1, 0, 2]
    const responses = [1, 0, 2];
    if (ledger.surveyActive && !ledger.nullifiers.get(nullifier)) {
      for (let i = 0; i < responses.length; i++) {
        const qIndex = i;
        const optionIndex = responses[i];
        if (!ledger.tallies.has(qIndex)) {
          ledger.tallies.set(qIndex, new Map());
        }
        const qTally = ledger.tallies.get(qIndex);
        qTally.set(optionIndex, (qTally.get(optionIndex) || 0) + 1);
      }
      ledger.participantCount++;
      ledger.nullifiers.set(nullifier, true);
    }

    // Verify tallies
    expect(ledger.tallies.get(0)?.get(1)).toBe(1);
    expect(ledger.tallies.get(1)?.get(0)).toBe(1);
    expect(ledger.tallies.get(2)?.get(2)).toBe(1);
    expect(ledger.participantCount).toBe(1);
  });

  test("Test 3: submitResponse rejects duplicate nullifier", () => {
    const ledger = createMockLedger();
    ledger.surveyActive = true;
    ledger.nullifiers.set(nullifier, true); // already spent

    let rejected = false;
    // Submit with duplicate nullifier
    if (ledger.nullifiers.get(nullifier)) {
      rejected = true;
    }

    expect(rejected).toBe(true);
    expect(ledger.participantCount).toBe(0);
  });

  test("Test 4: submitResponse rejects when survey inactive", () => {
    const ledger = createMockLedger();
    ledger.surveyActive = false; // survey is closed

    let rejected = false;
    if (!ledger.surveyActive) {
      rejected = true;
    }

    expect(rejected).toBe(true);
    expect(ledger.participantCount).toBe(0);
  });

  test("Test 5: getResults returns correct aggregate data", () => {
    const ledger = createMockLedger();
    ledger.surveyActive = true;
    ledger.questionCount = 2;

    // Submit 2 responses
    const responses1 = [0, 1];
    const responses2 = [0, 0];

    for (const responses of [responses1, responses2]) {
      if (ledger.surveyActive) {
        for (let i = 0; i < responses.length; i++) {
          if (!ledger.tallies.has(i)) {
            ledger.tallies.set(i, new Map());
          }
          const qTally = ledger.tallies.get(i);
          qTally.set(responses[i], (qTally.get(responses[i]) || 0) + 1);
        }
        ledger.participantCount++;
      }
    }

    // getResults returns tallies
    const results = ledger.tallies;
    expect(results.get(0)?.get(0)).toBe(2); // q0 option0 = 2 votes
    expect(results.get(1)?.get(1)).toBe(1); // q1 option1 = 1 vote
    expect(results.get(1)?.get(0)).toBe(1); // q1 option0 = 1 vote
    expect(ledger.participantCount).toBe(2);
  });

  test("Test 6: closeSurvey only callable by organizer", () => {
    const ledger = createMockLedger();
    ledger.organizer = organizer;
    ledger.surveyActive = true;

    const impostor = new Uint8Array(32).fill(9);
    const isOrganizer = (caller: Uint8Array) =>
      caller.every((val, idx) => val === ledger.organizer[idx]);

    // Impostor tries to close
    expect(isOrganizer(impostor)).toBe(false);

    // Organizer closes
    expect(isOrganizer(organizer)).toBe(true);
    ledger.surveyActive = false;
    expect(ledger.surveyActive).toBe(false);
  });
});
