"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { getSurvey } from "@/lib/survey-store";
import SurveyForm from "@/components/SurveyForm";
import type { StoredSurvey } from "@/lib/survey-store";
import Link from "next/link";

export default function SurveyPage() {
  const params = useParams();
  const surveyId = params.id as string;
  const { isConnected, connect, status } = useWallet();
  const [survey, setSurvey] = useState<StoredSurvey | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const s = getSurvey(surveyId);
    setSurvey(s ?? null);
    setLoaded(true);
  }, [surveyId]);

  if (!loaded) {
    return (
      <div className="py-12 text-center text-gray-500">Loading...</div>
    );
  }

  if (!survey) {
    return (
      <div className="py-12 text-center">
        <h1 className="mb-2 text-2xl font-semibold">Survey not found</h1>
        <p className="mb-4 text-gray-600">
          No survey with ID &quot;{surveyId}&quot; found. Create one first.
        </p>
        <Link
          href="/create"
          className="rounded-md bg-black px-4 py-2 text-sm text-white"
        >
          Create Survey
        </Link>
      </div>
    );
  }

  if (status === "connecting") {
    return (
      <div className="py-12 text-center text-gray-500">
        Connecting wallet...
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="py-12 text-center">
        <h1 className="mb-2 text-2xl font-semibold">{survey.title}</h1>
        <p className="mb-6 text-gray-600">
          Connect your wallet to verify your eligibility and submit anonymously.
        </p>
        <button
          onClick={connect}
          className="rounded-md bg-black px-6 py-3 text-sm text-white hover:bg-gray-800"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">{survey.title}</h1>
      <p className="mb-6 text-sm text-gray-500">
        {survey.questions.length} question{survey.questions.length !== 1 ? "s" : ""}
      </p>
      <SurveyForm
        surveyId={surveyId}
        questionCount={survey.questions.length}
        questions={survey.questions}
      />
    </div>
  );
}
