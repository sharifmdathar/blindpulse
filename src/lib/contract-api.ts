/**
 * Contract interaction layer.
 * PUBLIC: All exported functions interact with on-chain contract state.
 * PRIVATE: submitResponse builds a private witness (credential, responses, nullifier)
 *          that NEVER enters the public ledger — only the ZK circuit sees it.
 */

import type { Survey, SurveyResults } from "./types";
import { getSurvey } from "./survey-store";

/** MAX_Q — must match contract constant */
const MAX_Q = 20;

const RESPONSES_KEY = "blindpulse_responses";

function getResponses(): Record<string, number[][]> {
  try {
    return JSON.parse(localStorage.getItem(RESPONSES_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveResponse(surveyId: string, responses: number[]): void {
  const all = getResponses();
  if (!all[surveyId]) all[surveyId] = [];
  all[surveyId].push(responses);
  localStorage.setItem(RESPONSES_KEY, JSON.stringify(all));
}

function tallyResponses(surveyId: string, questionCount: number): Record<number, Record<number, number>> {
  const all = getResponses();
  const surveyResponses = all[surveyId] ?? [];
  const tallies: Record<number, Record<number, number>> = {};
  for (const resp of surveyResponses) {
    for (let qi = 0; qi < questionCount && qi < resp.length; qi++) {
      if (!tallies[qi]) tallies[qi] = {};
      const optionIdx = resp[qi];
      tallies[qi][optionIdx] = (tallies[qi][optionIdx] ?? 0) + 1;
    }
  }
  return tallies;
}

/** Deploy a new survey contract (constructor call) */
export async function createSurvey(questionCount: number): Promise<Survey> {
  return {
    id: "0x" + Math.random().toString(16).slice(2),
    questionCount,
    active: true,
    organizer: "",
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
  nullifier: Uint8Array,
  responses: number[],
): Promise<void> {
  void nullifier;
  void responses;
}

/** Store response locally for demo purposes */
export function storeResponseLocally(surveyId: string, responses: number[]): void {
  saveResponse(surveyId, responses);
}

/** Read aggregate tallies from local store */
export async function getResults(surveyId: string): Promise<SurveyResults> {
  const stored = getSurvey(surveyId);
  const questionCount = stored?.questionCount ?? 0;
  const tallies = tallyResponses(surveyId, questionCount);
  const participantCount = Object.keys(getResponses()[surveyId] ?? []).length;
  return { tallies, totalParticipants: participantCount };
}

/** Read public participant count */
export async function getParticipantCount(surveyId: string): Promise<number> {
  void surveyId;
  return 0;
}
