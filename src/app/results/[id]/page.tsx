"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getSurvey } from "@/lib/survey-store";
import { getSurveyMetadata } from "@/lib/contract-api";
import ResultsDashboard from "@/components/ResultsDashboard";
import type { StoredSurvey } from "@/lib/survey-store";

export default function ResultsPage() {
  const params = useParams();
  const surveyId = params.id as string;
  const [survey, setSurvey] = useState<StoredSurvey | null>(null);
  const [meta, setMeta] = useState<{
    questionCount: number;
    surveyActive: boolean;
    participantCount: number;
  } | null>(null);
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSurvey(getSurvey(surveyId) ?? null);
    setLoaded(true);
  }, [surveyId]);

  // PUBLIC read: works for any visitor — pulls aggregate metadata straight
  // from the ledger when this browser has no stored survey metadata.
  useEffect(() => {
    let cancelled = false;
    getSurveyMetadata(surveyId).then((m) => {
      if (!cancelled) {
        setMeta(m);
        setMetaLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [surveyId]);

  if (!loaded || !metaLoaded) {
    return <div className="py-12 text-center text-gray-500">Loading...</div>;
  }

  if (!survey) {
    if (!meta) {
      return (
        <div className="py-12 text-center">
          <h1 className="mb-2 text-2xl font-semibold">Survey not found</h1>
          <p className="mb-4 text-gray-600">
            No survey with ID {surveyId} found.
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
    // On-chain fallback: no off-chain metadata in this browser, so render
    // generic question labels instead of organizer-written text.
    const genericQuestions = Array.from(
      { length: meta.questionCount },
      (_, i) => ({
        index: i,
        text: `Question ${i + 1}`,
        options: [] as string[],
      }),
    );
    return (
      <div>
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Question text and option labels live off-chain with the survey
          organizer, so aggregate results are shown with generic labels.
        </div>
        <ResultsDashboard surveyId={surveyId} questions={genericQuestions} />
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