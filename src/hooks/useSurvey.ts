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
    responses: number[],
  ) => Promise<boolean>;
  closeSurvey: (surveyId: string) => Promise<boolean>;
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
        setError(
          err instanceof Error ? err.message : "Failed to create survey",
        );
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const  submitResponse = useCallback(
    async (surveyId: string, responses: number[]): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        // PRIVATE: nullifier (derived per-wallet inside contract-api) and
        // responses are private witnesses. They enter the ZK circuit but
        // NEVER appear on the public ledger — only the one-way digest and
        // aggregate tallies are disclosed.
        await contract.submitResponse(surveyId, responses);
        return true;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to submit response",
        );
        return false;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /**
   * Close a survey on-chain. PUBLIC: surveyActive flips to false on the
   * ledger. PRIVATE: nothing — no witness data is involved.
   */
  const closeSurvey = useCallback(
    async (surveyId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        await contract.closeSurvey(surveyId);
        return true;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to close survey",
        );
        return false;
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

  return { loading, error, createSurvey, submitResponse, closeSurvey, getResults };
}
