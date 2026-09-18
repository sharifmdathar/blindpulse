"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { restoreSurveyFromRegistry } from "@/lib/survey-store";
import { getSurveyMetadata } from "@/lib/contract-api";
import SurveyForm from "@/components/SurveyForm";
import GoogleFormFallback from "@/components/GoogleFormFallback";
import NewcomerHints from "@/components/NewcomerHints";
import type { StoredSurvey } from "@/lib/survey-store";
import Link from "next/link";

export default function SurveyPage() {
  const params = useParams();
  const surveyId = params.id as string;
  const { isConnected, connect, status } = useWallet();
  const [survey, setSurvey] = useState<StoredSurvey | null>(null);
  const [meta, setMeta] = useState<{
    questionCount: number;
    surveyActive: boolean;
    participantCount: number;
  } | null>(null);
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Self-contained shared links: use this browser's copy when present,
    // otherwise restore metadata from the public registry so respondents
    // opening someone else's link see real question text, not generic labels.
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

  // PUBLIC read: pulls survey metadata straight from the ledger so
  // respondents opening a shared link (no localStorage entry) can still
  // take the survey.
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
    return <div className="py-12 text-center text-moon-300/60">Loading…</div>;
  }

  if (!survey) {
    if (!meta) {
      return (
        <div className="py-12 text-center">
          <h1 className="mb-2 text-2xl font-semibold text-moon-50">
            Survey not found
          </h1>
          <p className="mb-6 text-moon-300">
            No survey with ID {surveyId} found. Create one first.
          </p>
          <Link href="/create" className="btn-primary">
            Create Survey
          </Link>
        </div>
      );
    }
    if (!meta.surveyActive) {
      return (
        <div className="py-12 text-center">
          <h1 className="mb-2 text-2xl font-semibold text-moon-50">
            Survey closed
          </h1>
          <p className="mb-6 text-moon-300">
            This survey is no longer accepting responses.
          </p>
          <Link href={`/results/${surveyId}`} className="btn-ghost">
            View Results
          </Link>
        </div>
      );
    }
    // On-chain fallback: render generic labels for each on-chain question.
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
          organizer, so questions are shown with generic labels.
        </div>
        <SurveyForm
          surveyId={surveyId}
          questionCount={meta.questionCount}
          questions={genericQuestions}
        />
      </div>
    );
  }

  if (survey.googleFormUrl) {
    return (
      <div>
        <h1 className="mb-2 text-xl font-semibold text-moon-50">
          {survey.title}
        </h1>
        <p className="mb-6 text-sm text-moon-300/70">
          {survey.questions.length} question{" "}
          {survey.questions.length !== 1 ? "(s)" : ""}
        </p>
        <GoogleFormFallback url={survey.googleFormUrl} />
        <SurveyForm
          surveyId={surveyId}
          questionCount={survey.questions.length}
          questions={survey.questions}
        />
      </div>
    );
  }

  if (status === "connecting") {
    return (
      <div className="py-12 text-center text-moon-300/60">
        Connecting wallet…
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="py-12">
        <h1 className="mb-2 text-center text-2xl font-semibold text-moon-50">
          {survey.title}
        </h1>
        <div className="mx-auto max-w-lg">
          <NewcomerHints />
          <div className="card p-6 text-center">
            <p className="mb-4 text-moon-300">
              Connect your wallet to verify your eligibility and submit
              anonymously.
            </p>
            <button onClick={connect} className="btn-primary px-6 py-3">
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold text-moon-50">
        {survey.title}
      </h1>
      <p className="mb-6 text-sm text-moon-300/70">
        {survey.questions.length} question{" "}
        {survey.questions.length !== 1 ? "(s)" : ""}
      </p>
      {survey.googleFormUrl && (
        <GoogleFormFallback url={survey.googleFormUrl} />
      )}
      <SurveyForm
        surveyId={surveyId}
        questionCount={survey.questions.length}
        questions={survey.questions}
      />
    </div>
  );
}
