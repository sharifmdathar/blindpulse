"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { restoreSurveyFromRegistry } from "@/lib/survey-store";
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
    // Self-contained shared links: restore metadata from the public
    // registry when this browser has no local copy, so anyone opening a
    // shared results link sees real question text, not generic labels.
    let cancelled = false;
    restoreSurveyFromRegistry(surveyId).then((s) => {
      if (!cancelled) {
        setSurvey(s ?? null);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
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
    return (
      <div className="py-12 text-center text-moon-300/60">Loading…</div>
    );
  }

  if (!survey) {
    if (!meta) {
      return (
        <div className="py-12 text-center">
          <h1 className="mb-2 text-2xl font-semibold text-moon-50">
            Survey not found
          </h1>
          <p className="mb-6 text-moon-300">
            No survey with ID {surveyId} found.
          </p>
          <Link href="/dashboard" className="btn-primary">
            Go to Dashboard
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
        <div className="mb-6 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] p-3 text-sm text-amber-200">
          Question text and option labels live off-chain with the survey
          organizer, so aggregate results are shown with generic labels.
        </div>
        <ResultsDashboard surveyId={surveyId} questions={genericQuestions} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-moon-50">
        {survey.title}
      </h1>
      <ResultsDashboard surveyId={surveyId} questions={survey.questions} />
    </div>
  );
}
