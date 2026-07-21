/**
 * Contract interaction layer.
 * PUBLIC: All exported functions interact with on-chain contract state.
 * PRIVATE: submitResponse builds a private witness (credential, responses, nullifier)
 *          that NEVER enters the public ledger — only the ZK circuit sees it.
 */

import type { Survey, SurveyResults } from "./types";

/** MAX_Q — must match contract constant */
const MAX_Q = 20;

/** Deploy a new survey contract (constructor call) */
export async function createSurvey(
  questionCount: number,
): Promise<Survey> {
  // TODO: call contract circuit constructor
  // const circuit = await import("../managed/contract/blindpulse");
  // const contract = await deploy(circuit, [organizer, questionCount]);
  return {
    id: "0x" + Math.random().toString(16).slice(2),
    questionCount,
    active: true,
    organizer: "", // set after wallet connect
    participantCount: 0,
  };
}

/**
 * Submit responses with ZK proof of eligibility.
 * PRIVATE: nullifier, responses — NEVER written to ledger directly.
 * PUBLIC: nullifier is disclosed (one-way hash, unlinkable),
 *         only aggregate tally updates hit the ledger.
 */
export async function submitResponse(
  _nullifier: Uint8Array, // PRIVATE WITNESS — disclosed as public unlinkable hash
  _responses: number[], // PRIVATE WITNESS — never on-chain
): Promise<void> {
  // Pad responses to fixed size Vector<20, Uint<8>>
  const padded = new Array(MAX_Q).fill(0);
  _responses.forEach((r, i) => {
    if (i < MAX_Q) padded[i] = r;
  });
  // TODO: build private witness, call circuit submitResponse
  // const witness = { nullifier: _nullifier, responses: padded };
  // await contract.submitResponse(witness);
  void padded;
}

/** Read public ledger state — aggregate tallies only */
export async function getResults(surveyId: string): Promise<SurveyResults> {
  // TODO: call contract.getResults() and parse
  void surveyId;
  return {
    tallies: {},
    totalParticipants: 0,
  };
}

/** Read public participant count */
export async function getParticipantCount(surveyId: string): Promise<number> {
  // TODO: read from ledger
  void surveyId;
  return 0;
}
