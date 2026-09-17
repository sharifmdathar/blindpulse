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
      <div className="mx-auto max-w-lg rounded-lg border border-green-200 bg-green-50 p-8 text-center">
        <div className="mb-3 text-3xl">✓</div>
        <p className="text-lg font-medium text-green-800">
          Your response has been submitted anonymously.
        </p>
        <p className="mt-2 text-sm text-green-600">
          Your identity and individual answers remain private. Only aggregate
          tallies are recorded on-chain.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h2 className="text-xl font-semibold">Survey</h2>

      {questions.map((q) => {
        // With off-chain metadata: organizer-written option labels.
        // Without it (public on-chain fallback): generic options — the
        // circuit accepts any option index, so the flow still works.
        const options =
          q.options.length > 0
            ? q.options
            : Array.from({ length: 5 }, (_, oi) => `Option ${oi + 1}`);
        return (
          <div key={q.index} className="rounded-lg border p-4">
            <p className="mb-3 font-medium">{q.text}</p>
            <div className="space-y-2">
              {options.map((opt, oi) => (
                <label
                  key={oi}
                  className={`flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm ${
                    selections[q.index] === oi
                      ? "border-black bg-gray-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${q.index}`}
                    checked={selections[q.index] === oi}
                    onChange={() => handleSelect(q.index, oi)}
                    className="mr-2"
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        );
      })}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full rounded-md bg-black px-6 py-3 text-sm text-white hover:bg-gray-800 disabled:bg-gray-400"
      >
        {loading ? "Submitting..." : "Submit Anonymous Response"}
      </button>

      {error && (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            doubleVoted
              ? "border-amber-300 bg-amber-50 text-amber-800"
              : "border-red-200 bg-red-50 text-red-600"
          }`}
        >
          {doubleVoted ? (
            <>
              <p className="font-medium">
                This wallet has already responded to this survey.
              </p>
              <p className="mt-1">
                One anonymous response per wallet — your earlier submission is
                already counted in the aggregate. To respond again as a
                different participant, connect a different Lace account.
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
