"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { restoreSurveyFromRegistry } from "@/lib/survey-store";
import { getSurveyMetadata } from "@/lib/contract-api";
import SurveyForm from "@/components/SurveyForm";
import GoogleFormFallback from "@/components/GoogleFormFallback";
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
    return <div className="py-12 text-center text-gray-500">Loading...</div>;
  }

  if (!survey) {
    if (!meta) {
      return (
        <div className="py-12 text-center">
          <h1 className="mb-2 text-2xl font-semibold">Survey not found</h1>
          <p className="mb-4 text-gray-600">
            No survey with ID {surveyId} found. Create one first.
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
    if (!meta.surveyActive) {
      return (
        <div className="py-12 text-center">
          <h1 className="mb-2 text-2xl font-semibold">Survey closed</h1>
          <p className="mb-4 text-gray-600">
            This survey is no longer accepting responses.
          </p>
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
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
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
        <h1 className="mb-2 text-xl font-semibold">{survey.title}</h1>
        <p className="mb-6 text-sm text-gray-500">
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
        {survey.questions.length} question{" "}
        {survey.questions.length !== 1 ? "(s)" : ""}
      </p>
      {survey.googleFormUrl && <GoogleFormFallback url={survey.googleFormUrl} />}
      <SurveyForm
        surveyId={surveyId}
        questionCount={survey.questions.length}
        questions={survey.questions}
      />
    </div>
  );
}