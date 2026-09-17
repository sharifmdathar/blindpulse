"use client";

/**
 * /feedback — the feedback loop: BlindPulse surveying its own users
 * through itself. Renders the newest live survey from the public registry
 * (normally "App Feedback") as an anonymous, wallet-proofed form.
 *
 * PUBLIC: registry metadata + aggregate results only.
 * PRIVATE: the respondent's answers and coin key stay ZK witnesses.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/hooks/useWallet";
import {
  fetchSurveyRegistry,
  type SurveyRegistryEntry,
} from "@/lib/survey-store";
import { getSurveyMetadata } from "@/lib/contract-api";
import SurveyForm from "@/components/SurveyForm";
import GoogleFormFallback from "@/components/GoogleFormFallback";

type LiveSurvey = {
  entry: SurveyRegistryEntry;
  active: boolean;
};

/** Newest live registry entry, or null. */
function useLiveSurvey(): LiveSurvey | null | "loading" {
  const [live, setLive] = useState<LiveSurvey | null | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const registry = await fetchSurveyRegistry();
      const entries = (registry?.surveys ?? [])
        .filter((s) => s?.id && s.status !== "closed")
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      for (const entry of entries) {
        const meta = await getSurveyMetadata(entry.id);
        if (meta?.surveyActive) {
          if (!cancelled) setLive({ entry, active: true });
          return;
        }
      }
      if (!cancelled) setLive(null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return live;
}

export default function FeedbackPage() {
  const live = useLiveSurvey();
  const { isConnected, connect, status } = useWallet();

  if (live === "loading") {
    return (
      <div className="py-12 text-center text-gray-500">
        Looking for the live feedback survey…
      </div>
    );
  }

  if (!live) {
    return (
      <div className="py-12 text-center">
        <h1 className="mb-2 text-2xl font-semibold">No feedback survey live</h1>
        <p className="mb-6 text-gray-600">
          There is no active survey in the public registry right now. Check
          back soon, or deploy one yourself.
        </p>
        <Link
          href="/dashboard"
          className="rounded-md bg-black px-4 py-2 text-sm text-white"
        >
          Go to Dashboard
        </Link>
      </div>
    );
  }

  const id = live.entry.id;
  const questions = (live.entry.questions ?? []).map((q, i) => ({
    index: q?.index ?? i,
    text: q?.text ?? `Question ${i + 1}`,
    options: Array.isArray(q?.options) ? q.options : [],
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        This is BlindPulse eating its own cooking: the feedback survey runs
        <span className="font-medium"> on BlindPulse itself</span>. Your
        answers are ZK witnesses — we see the aggregate, never you.
      </div>

      <h1 className="mb-1 text-2xl font-semibold">
        {live.entry.title ?? "Feedback"}
      </h1>
      <p className="mb-6 text-sm text-gray-500">
        One anonymous response per wallet. Results are public on the ledger.
      </p>

      {live.entry.googleFormUrl && (
        <GoogleFormFallback url={live.entry.googleFormUrl} />
      )}

      {!isConnected ? (
        <div className="rounded-lg border p-6 text-center">
          <p className="mb-4 text-gray-600">
            Connect your Lace wallet to submit anonymously — your identity
            stays in shadow; only your answer is counted.
          </p>
          <button
            onClick={connect}
            disabled={status === "connecting"}
            className="rounded-md bg-black px-6 py-3 text-sm text-white hover:bg-gray-800 disabled:bg-gray-400"
          >
            {status === "connecting" ? "Connecting…" : "Connect Wallet"}
          </button>
        </div>
      ) : (
        <SurveyForm surveyId={id} questionCount={questions.length} questions={questions} />
      )}

      <p className="mt-8 text-center text-sm">
        <Link href={`/results/${id}`} className="text-gray-500 underline hover:text-gray-700">
          See the live aggregate results
        </Link>
      </p>
    </div>
  );
}
