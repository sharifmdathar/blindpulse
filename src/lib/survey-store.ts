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
  /** Optional wallet-free fallback: organizer-run Google Form (off-chain). */
  googleFormUrl?: string;
}

export function saveSurvey(survey: StoredSurvey): void {
  const all = getSurveys();
  all[survey.id] = survey;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function getSurvey(id: string): StoredSurvey | undefined {
  return getSurveys()[id];
}

/** Entry shape in the public registry file (public/survey-registry.json). */
export interface SurveyRegistryEntry {
  id: string;
  title?: string;
  questionCount?: number;
  questions?: SurveyQuestion[];
  createdAt?: number;
  status?: string;
  /** Optional wallet-free fallback: organizer-run Google Form (off-chain). */
  googleFormUrl?: string;
}

/** Top-level shape of the public registry file. */
export interface SurveyRegistry {
  network?: string;
  surveys: SurveyRegistryEntry[];
}

/**
 * Fetch and parse the public registry. Returns null when unavailable
 * (offline, 404, malformed) — callers must degrade gracefully.
 * PUBLIC: the registry holds only off-chain survey metadata by design.
 */
export async function fetchSurveyRegistry(): Promise<SurveyRegistry | null> {
  try {
    const res = await fetch("/survey-registry.json");
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.surveys)) return null;
    return data as SurveyRegistry;
  } catch {
    return null;
  }
}

/**
 * Apply one registry entry to local storage. Pure-ish: reads + writes
 * localStorage, never overwrites an existing entry, returns the stored
 * survey when a new entry was added, null otherwise.
 * PUBLIC: local metadata only — on-chain tallies are never touched.
 */
export function applyRegistryEntry(
  registry: SurveyRegistry | null,
  id: string,
): StoredSurvey | null {
  if (!registry || !Array.isArray(registry.surveys)) return null;
  if (getSurvey(id)) return null; // never clobber local edits
  const entry = registry.surveys.find((s) => s?.id === id);
  if (!entry) return null;
  const stored: StoredSurvey = {
    id,
    title: entry.title ?? `Survey ${id.slice(0, 10)}…`,
    questionCount: entry.questionCount ?? entry.questions?.length ?? 0,
    questions: Array.isArray(entry.questions) ? entry.questions : [],
    createdAt:
      typeof entry.createdAt === "number" ? entry.createdAt : Date.now(),
    ...(entry.googleFormUrl ? { googleFormUrl: entry.googleFormUrl } : {}),
  };
  saveSurvey(stored);
  return stored;
}

/**
 * Restore a survey's metadata from the public registry when this browser
 * lacks it — what makes shared /survey and /results links self-contained.
 * Returns the local entry when present (no-op), else the restored entry,
 * else null (unknown to the registry — pages fall back to generic labels).
 * PUBLIC: registry + local metadata only.
 */
export async function restoreSurveyFromRegistry(
  id: string,
): Promise<StoredSurvey | null> {
  const local = getSurvey(id);
  if (local) return local;
  return applyRegistryEntry(await fetchSurveyRegistry(), id);
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
