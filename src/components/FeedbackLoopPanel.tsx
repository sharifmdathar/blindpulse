"use client";

/**
 * Feedback-loop progress panel for the dashboard: live on-chain
 * participant count for the active registry survey, against the Level 5
 * goal of 50 respondents.
 *
 * PUBLIC: aggregate ledger state + registry metadata only.
 * PRIVATE: nothing — no wallet needed to render this panel.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchSurveyRegistry,
  type SurveyRegistryEntry,
} from "@/lib/survey-store";
import { getSurveyMetadata } from "@/lib/contract-api";

const LEVEL5_GOAL = 50;

/** Newest live registry entry with on-chain participant count, or null. */
function useActiveSurvey() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "none" }
    | { status: "ready"; entry: SurveyRegistryEntry; participants: number }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const registry = await fetchSurveyRegistry();
      const entries = (registry?.surveys ?? [])
        .filter((s) => s?.id && s.status !== "closed")
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      for (const entry of entries) {
        const meta = await getSurveyMetadata(entry.id);
        if (meta?.surveyActive) {
          if (!cancelled) {
            setState({ status: "ready", entry, participants: meta.participantCount });
          }
          return;
        }
      }
      if (!cancelled) setState({ status: "none" });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export default function FeedbackLoopPanel() {
  const state = useActiveSurvey();

  if (state.status === "loading") {
    return (
      <div className="mb-6 animate-pulse rounded-lg border border-gray-100 bg-gray-50 p-4">
        <div className="h-4 w-40 rounded bg-gray-200" />
        <div className="mt-2 h-2 w-full rounded bg-gray-200" />
      </div>
    );
  }

  if (state.status === "none") {
    return (
      <div className="mb-6 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
        Feedback loop idle — no active survey in the registry. Deploy one to
        start collecting.
      </div>
    );
  }

  const { entry, participants } = state;
  const pct = Math.min(100, Math.round((participants / LEVEL5_GOAL) * 100));

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-800">
            Feedback loop · {entry.title ?? "Active survey"}
          </p>
          <p className="text-xs text-gray-500">
            {participants} of {LEVEL5_GOAL} respondents toward the Level 5
            goal ·{" "}
            <Link
              href={`/survey/${entry.id}`}
              className="underline hover:text-gray-700"
            >
              take the survey
            </Link>{" "}
            ·{" "}
            <Link
              href={`/results/${entry.id}`}
              className="underline hover:text-gray-700"
            >
              live results
            </Link>
          </p>
        </div>
        <p className="text-2xl font-bold text-gray-900">{participants}</p>
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-gray-200">
        <div
          className="h-2 rounded-full bg-black transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
