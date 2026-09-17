/**
 * Off-chain survey store (localStorage).
 * Questions live here since the chain only stores aggregate tallies.
 * PUBLIC: Survey metadata and questions are off-chain by design.
 *          Only contract ID links on-chain tallies to off-chain questions.
 */

import type { SurveyQuestion } from "./types";

const STORAGE_KEY = "blindpulse_surveys";

export interface StoredSurvey {
  id: string;
  title: string;
  questionCount: number;
  questions: SurveyQuestion[];
  createdAt: number;
}

export function saveSurvey(survey: StoredSurvey): void {
  const all = getSurveys();
  all[survey.id] = survey;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function getSurvey(id: string): StoredSurvey | undefined {
  return getSurveys()[id];
}

/**
 * Remove one survey from the local registry.
 * PUBLIC: affects only this browser's off-chain metadata copy — on-chain
 * tallies are untouched and the survey can be re-added by address.
 */
export function removeSurvey(id: string): void {
  const all = getSurveys();
  delete all[id];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

/**
 * Remove every survey from the local registry.
 * PUBLIC: same scope as removeSurvey — local metadata only.
 */
export function clearSurveys(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getSurveys(): Record<string, StoredSurvey> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}
