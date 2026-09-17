"use client";

/**
 * Landing page — hero, live survey banner, and a how-it-works strip.
 *
 * The hero polls the public registry for the newest deployment and reads
 * its aggregate state from the ledger, so first-time visitors arriving
 * from a shared link immediately see that a real survey is live.
 *
 * PUBLIC: aggregate counts and off-chain survey metadata only.
 * PRIVATE: nothing — this page never touches a wallet.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import PrivacyExplainer from "@/components/PrivacyExplainer";
import {
  fetchSurveyRegistry,
  type SurveyRegistryEntry,
} from "@/lib/survey-store";
import { getSurveyMetadata } from "@/lib/contract-api";

type LiveSurvey = {
  entry: SurveyRegistryEntry;
  active: boolean;
  participants: number;
};

/** Newest registry entry with live on-chain state, or null. */
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
          if (!cancelled) {
            setLive({
              entry,
              active: true,
              participants: meta.participantCount,
            });
          }
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

function LiveSurveyBanner() {
  const live = useLiveSurvey();

  if (live === "loading") {
    return (
      <div className="mx-auto mb-10 max-w-xl animate-pulse rounded-lg border border-gray-100 bg-gray-50 p-4 text-center text-sm text-gray-400">
        Checking for live surveys…
      </div>
    );
  }

  if (!live) return null;

  return (
    <Link
      href={`/survey/${live.entry.id}`}
      className="mx-auto mb-10 block max-w-xl rounded-lg border border-green-200 bg-green-50 p-4 text-center transition-colors hover:bg-green-100"
    >
      <p className="text-sm font-medium text-green-800">
        {live.entry.title ?? "A survey"} is live —{" "}
        {live.participants} participant{live.participants === 1 ? "" : "s"} so
        far
      </p>
      <p className="mt-0.5 text-xs text-green-600">
        Anonymous · one response per wallet · takes under a minute
      </p>
    </Link>
  );
}

const STEPS = [
  {
    title: "1 · Deploy",
    body: "An organizer connects Lace and creates a survey. Questions stay off-chain; the chain gets only a tally skeleton.",
  },
  {
    title: "2 · Prove",
    body: "A respondent answers. Their wallet proves eligibility in ZK — identity and answers are witnesses, never transmitted.",
  },
  {
    title: "3 · Count",
    body: "The circuit rejects double votes via one-way nullifiers and discloses only aggregate tallies to the public ledger.",
  },
  {
    title: "4 · Verify",
    body: "Anyone reads the results from the indexer — no wallet, no login, no trust in the operator required.",
  },
];

function HowItWorks() {
  return (
    <section className="pt-8">
      <h2 className="mb-6 text-center text-xl font-semibold">How it works</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <div key={s.title} className="rounded-lg border p-4">
            <p className="mb-2 text-sm font-semibold text-gray-900">
              {s.title}
            </p>
            <p className="text-sm text-gray-600">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="py-16 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight">
          Anonymous Feedback.
          <br />
          <span className="text-gray-500">Verifiable Participation.</span>
        </h1>
        <p className="mx-auto mb-8 max-w-lg text-gray-600">
          Create surveys where respondents prove eligibility via ZK proof
          without revealing their identity. Only aggregate tallies hit the
          public ledger.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/create"
            className="rounded-md bg-black px-6 py-3 text-sm text-white hover:bg-gray-800"
          >
            Create Survey
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md border border-gray-300 px-6 py-3 text-sm text-gray-700 hover:bg-gray-50"
          >
            View Dashboard
          </Link>
        </div>
      </section>

      {/* Live survey banner (only when the registry knows an active one) */}
      <LiveSurveyBanner />

      {/* Privacy model summary */}
      <PrivacyExplainer />

      {/* How it works */}
      <HowItWorks />
    </div>
  );
}
