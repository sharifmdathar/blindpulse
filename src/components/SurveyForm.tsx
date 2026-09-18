"use client";

import { useState } from "react";
import { useSurvey } from "@/hooks/useSurvey";
import { validateResponses } from "@/lib/utils";
import { storeResponseLocally } from "@/lib/contract-api";

interface SurveyFormProps {
  surveyId: string;
  questionCount: number;
  questions: { index: number; text: string; options: string[] }[];
}

export default function SurveyForm({
  surveyId,
  questionCount,
  questions,
}: SurveyFormProps) {
  const { submitResponse, loading, error } = useSurvey();
  const [selections, setSelections] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  // A "Nullifier already spent" rejection means THIS wallet already voted in
  // THIS survey (the nullifier is deterministic per wallet per survey). That
  // is the anti-double-submit guarantee working — explain it as a friendly
  // notice, not a raw circuit error.
  const doubleVoted = /nullifier already spent/i.test(error ?? "");

  const answered = Object.keys(selections).length;

  const handleSelect = (qIndex: number, optionIndex: number) => {
    setSelections((prev) => ({ ...prev, [qIndex]: optionIndex }));
  };

  const handleSubmit = async () => {
    const responses = Array.from(
      { length: questionCount },
      (_, i) => selections[i] ?? 0,
    );

    if (!validateResponses(responses, questionCount)) return;

    // PRIVATE: the nullifier is derived per-wallet inside contract-api
    // (BLAKE2b of the coin public key, bound to this survey) and enters
    // the ZK circuit — it never appears in the public ledger, and neither
    // do the responses.
    const ok = await submitResponse(surveyId, responses);
    if (!ok) return; // error already surfaced by the hook — stay on the form
    storeResponseLocally(surveyId, responses);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="card mx-auto max-w-lg border-emerald-400/30 p-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/10 text-2xl shadow-glow-sm">
          ✓
        </div>
        <p className="text-lg font-medium text-moon-50">
          Your response has been submitted anonymously.
        </p>
        <p className="mt-2 text-sm text-moon-300">
          Your identity and individual answers remain in shadow. Only the
          aggregate is recorded on-chain.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-moon-50">Survey</h2>
        <span className="text-xs text-moon-300/70">
          {answered} of {questionCount} answered
        </span>
      </div>
      {/* progress bar */}
      <div className="h-1 w-full rounded-full bg-white/10">
        <div
          className="h-1 rounded-full bg-gradient-to-r from-glow to-moon-300 transition-all"
          style={{
            width: `${questionCount ? (answered / questionCount) * 100 : 0}%`,
          }}
        />
      </div>

      {questions.map((q) => {
        // With off-chain metadata: organizer-written option labels.
        // Without it (public on-chain fallback): generic options — the
        // circuit accepts any option index, so the flow still works.
        const options =
          q.options.length > 0
            ? q.options
            : Array.from({ length: 5 }, (_, oi) => `Option ${oi + 1}`);
        return (
          <div key={q.index} className="card p-4">
            <p className="mb-3 font-medium text-moon-50">{q.text}</p>
            <div className="space-y-2">
              {options.map((opt, oi) => {
                const selected = selections[q.index] === oi;
                return (
                  <label
                    key={oi}
                    className={`flex cursor-pointer items-center rounded-lg border px-3 py-2 text-sm transition-all ${
                      selected
                        ? "border-glow/70 bg-glow/10 text-moon-50 shadow-glow-sm"
                        : "border-white/10 bg-white/[0.02] text-moon-300 hover:border-glow/30 hover:bg-white/[0.05]"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${q.index}`}
                      checked={selected}
                      onChange={() => handleSelect(q.index, oi)}
                      className="mr-2 accent-[#8b7cff]"
                    />
                    {opt}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="btn-primary w-full"
      >
        {loading ? "Proving & submitting…" : "Submit Anonymous Response"}
      </button>

      {error && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            doubleVoted
              ? "border-amber-400/30 bg-amber-400/[0.07] text-amber-200"
              : "border-rose-400/30 bg-rose-400/[0.07] text-rose-300"
          }`}
        >
          {doubleVoted ? (
            <>
              <p className="font-medium">
                This wallet has already responded to this survey.
              </p>
              <p className="mt-1 text-amber-200/80">
                One anonymous response per wallet — your earlier submission is
                already counted in the aggregate. To respond again as a
                different participant, connect a different wallet account.
              </p>
            </>
          ) : (
            <p>{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
