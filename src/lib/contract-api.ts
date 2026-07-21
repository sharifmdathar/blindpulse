/**
 * Contract interaction layer.
 * PUBLIC: All exported functions interact with on-chain contract state.
 * PRIVATE: submitResponse builds a private witness (credential, responses, nullifier)
 *          that NEVER enters the public ledger — only the ZK circuit sees it.
 */

import type { Survey, SurveyResults } from "./types";

/** Create a new survey (callable only by organizer) */
export async function createSurvey(
  questionCount: number,
): Promise<Survey> {
  // TODO: call contract circuit deploy
  // const contract = await deploy(compiledCircuit, { organizer, questionCount });
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
 * PRIVATE: credential, responses, nullifier — NEVER written to ledger.
 * PUBLIC: Only the aggregate tally updates hit the public ledger.
 */
export async function submitResponse(
  surveyId: string,
  _credential: Uint8Array, // PRIVATE WITNESS — never on-chain
  _responses: number[], // PRIVATE WITNESS — never on-chain
  _nullifier: Uint8Array, // PRIVATE WITNESS — only hash stored
): Promise<void> {
  // TODO: build private witness, call circuit submitResponse
  // const witness = { credential, responses, nullifier };
  // await contract.submitResponse(surveyId, witness);
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
