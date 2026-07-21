"use client";

import { useState } from "react";
import { useSurvey } from "@/hooks/useSurvey";

export default function SurveyCreator() {
  const { createSurvey, loading, error } = useSurvey();
  const [questionCount, setQuestionCount] = useState(1);
  const [deployedId, setDeployedId] = useState<string | null>(null);

  const handleCreate = async () => {
    const survey = await createSurvey(questionCount);
    if (survey) {
      setDeployedId(survey.id);
    }
  };

  return (
    <div className="mx-auto max-w-lg rounded-lg border p-6">
      <h2 className="mb-4 text-xl font-semibold">Create a Survey</h2>

      <label className="mb-2 block text-sm font-medium text-gray-700">
        Number of questions
      </label>
      <input
        type="number"
        min={1}
        max={20}
        value={questionCount}
        onChange={(e) => setQuestionCount(Number(e.target.value))}
        className="mb-4 w-full rounded-md border px-3 py-2"
      />

      <button
        onClick={handleCreate}
        disabled={loading}
        className="rounded-md bg-black px-6 py-2 text-sm text-white hover:bg-gray-800 disabled:bg-gray-400"
      >
        {loading ? "Deploying..." : "Deploy Survey Contract"}
      </button>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {deployedId && (
        <div className="mt-4 rounded-md bg-green-50 p-3">
          <p className="text-sm text-green-800">
            Survey deployed! Contract ID:{" "}
            <span className="font-mono">{deployedId}</span>
          </p>
        </div>
      )}
    </div>
  );
}
