"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getSurvey } from "@/lib/survey-store";
import ResultsDashboard from "@/components/ResultsDashboard";
import type { StoredSurvey } from "@/lib/survey-store";

export default function ResultsPage() {
  const params = useParams();
  const surveyId = params.id as string;
  const [survey, setSurvey] = useState<StoredSurvey | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSurvey(getSurvey(surveyId) ?? null);
    setLoaded(true);
  }, [surveyId]);

  if (!loaded) {
    return <div className="py-12 text-center text-gray-500">Loading...</div>;
  }

  if (!survey) {
    return (
      <div className="py-12 text-center">
        <h1 className="mb-2 text-2xl font-semibold">Survey not found</h1>
        <p className="mb-4 text-gray-600">
          No survey with ID &quot;{surveyId}&quot; found.
        </p>
        <Link
          href="/"
          className="rounded-md bg-black px-4 py-2 text-sm text-white"
        >
          Home
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">{survey.title}</h1>
      <ResultsDashboard surveyId={surveyId} questions={survey.questions} />
    </div>
  );
}
