"use client";

/**
 * React hook for survey operations.
 * PUBLIC: All returned functions interact with on-chain contract.
 * PRIVATE: submitResponse builds private witness, never leaks to React state.
 */

import { useState, useCallback } from "react";
import type { Survey, SurveyResults } from "@/lib/types";
import * as contract from "@/lib/contract-api";

export interface UseSurveyReturn {
  loading: boolean;
  error: string | null;
  createSurvey: (questionCount: number) => Promise<Survey | null>;
  submitResponse: (
    surveyId: string,
    credential: Uint8Array,
    responses: number[],
    nullifier: Uint8Array,
  ) => Promise<void>;
  getResults: (surveyId: string) => Promise<SurveyResults | null>;
}

export function useSurvey(): UseSurveyReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSurvey = useCallback(
    async (questionCount: number): Promise<Survey | null> => {
      setLoading(true);
      setError(null);
      try {
        const survey = await contract.createSurvey(questionCount);
        return survey;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create survey");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const submitResponse = useCallback(
    async (
      surveyId: string,
      credential: Uint8Array,
      responses: number[],
      nullifier: Uint8Array,
    ): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        // PRIVATE: credential, responses, nullifier are private witnesses
        // They enter the ZK circuit but NEVER appear on the public ledger
        await contract.submitResponse(surveyId, credential, responses, nullifier);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to submit response",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const getResults = useCallback(
    async (surveyId: string): Promise<SurveyResults | null> => {
      setLoading(true);
      setError(null);
      try {
        const results = await contract.getResults(surveyId);
        return results;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to get results");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { loading, error, createSurvey, submitResponse, getResults };
}
