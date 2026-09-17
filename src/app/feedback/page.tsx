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
import NewcomerHints from "@/components/NewcomerHints";

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
      <div className="py-12 text-center text-moon-300/60">
        Looking for the live feedback survey…
      </div>
    );
  }

  if (!live) {
    return (
      <div className="py-12 text-center">
        <h1 className="mb-2 text-2xl font-semibold text-moon-50">
          No feedback survey live
        </h1>
        <p className="mb-6 text-moon-300">
          There is no active survey in the public registry right now. Check
          back soon, or deploy one yourself.
        </p>
        <Link href="/dashboard" className="btn-primary">
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
      <div className="card mb-6 p-4 text-sm text-moon-300">
        This is BlindPulse eating its own cooking: the feedback survey runs
        <span className="font-medium text-moon-100"> on BlindPulse itself</span>. Your
        answers are ZK witnesses — we see the aggregate, never you.
      </div>

      <h1 className="mb-1 text-2xl font-semibold text-moon-50">
        {live.entry.title ?? "Feedback"}
      </h1>
      <p className="mb-6 text-sm text-moon-300/70">
        One anonymous response per wallet. Results are public on the ledger.
      </p>

      {live.entry.googleFormUrl && (
        <GoogleFormFallback url={live.entry.googleFormUrl} />
      )}

      {!isConnected ? (
        <div>
          <NewcomerHints />
          <div className="card p-6 text-center">
            <p className="mb-4 text-moon-300">
              Connect your wallet to submit anonymously — your identity
              stays in shadow; only your answer is counted.
            </p>
            <button
              onClick={connect}
              disabled={status === "connecting"}
              className="btn-primary px-6 py-3"
            >
              {status === "connecting" ? "Connecting…" : "Connect Wallet"}
            </button>
          </div>
        </div>
      ) : (
        <SurveyForm surveyId={id} questionCount={questions.length} questions={questions} />
      )}

      <p className="mt-8 text-center text-sm">
        <Link
          href={`/results/${id}`}
          className="text-moon-300 underline hover:text-moon-100"
        >
          See the live aggregate results
        </Link>
      </p>
    </div>
  );
}
