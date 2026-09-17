"use client";

import { useState, useEffect } from "react";
import { useSurvey } from "@/hooks/useSurvey";
import EligibilityBadge from "./EligibilityBadge";

interface ResultsDashboardProps {
  surveyId: string;
  questions: { index: number; text: string; options: string[] }[];
}

export default function ResultsDashboard({
  surveyId,
  questions,
}: ResultsDashboardProps) {
  const { getResults } = useSurvey();
  const [results, setResults] = useState<{
    tallies: Record<number, Record<number, number>>;
    totalParticipants: number;
  } | null>(null);

  useEffect(() => {
    getResults(surveyId).then((r) => {
      if (r) setResults(r);
    });
  }, [surveyId, getResults]);

  if (!results) {
    return (
      <div className="py-12 text-center text-gray-500">Loading results...</div>
    );
  }

  const maxVotes = Math.max(
    ...questions.map(
      (q) =>
        Math.max(
          ...Object.values(results.tallies[q.index] ?? {}).map(Number),
          0,
        ),
      1,
    ),
    1,
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Survey Results</h2>
        <EligibilityBadge />
      </div>

      <div className="mb-8 rounded-lg bg-gray-50 p-4 text-center">
        <p className="text-3xl font-bold">{results.totalParticipants}</p>
        <p className="text-sm text-gray-500">Total Participants</p>
      </div>

      <div className="space-y-8">
        {questions.map((q) => {
          const tallyRow = results.tallies[q.index] ?? {};
          // With off-chain metadata: label every declared option.
          // Without it (public on-chain fallback): derive one row per option
          // index that has received at least one vote.
          const rows =
            q.options.length > 0
              ? q.options.map((opt, oi) => ({ label: opt, oi }))
              : Object.keys(tallyRow)
                  .map(Number)
                  .sort((a, b) => a - b)
                  .map((oi) => ({ label: `Option ${oi + 1}`, oi }));
          return (
            <div key={q.index} className="rounded-lg border p-4">
              <p className="mb-4 font-medium">{q.text}</p>
              <div className="space-y-3">
                {rows.map(({ label, oi }) => {
                  const count = tallyRow[oi] ?? 0;
                  const pct =
                    results.totalParticipants > 0
                      ? Math.round((count / results.totalParticipants) * 100)
                      : 0;
                  return (
                    <div key={oi}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{label}</span>
                        <span className="text-gray-500">
                          {count} ({pct}%)
                        </span>
                      </div>
                      {/* Pure CSS bar — no charting library needed */}
                      <div className="h-6 w-full rounded bg-gray-200">
                        <div
                          className="h-6 rounded bg-black transition-all"
                          style={{
                            width: `${(count / maxVotes) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                {rows.length === 0 && (
                  <p className="text-sm text-gray-400">
                    No votes recorded yet.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-gray-400">
        Results are aggregate only. Individual responses remain private and are
        never stored on-chain.
      </p>
    </div>
  );
}
