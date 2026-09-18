"use client";

/**
 * Landing page — hero, live survey banner, privacy model, how-it-works.
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
      <div className="card mx-auto mb-10 max-w-xl animate-pulse p-4 text-center">
        <div className="mx-auto h-4 w-56 rounded bg-white/10" />
      </div>
    );
  }

  if (!live) return null;

  return (
    <Link
      href={`/survey/${live.entry.id}`}
      className="card card-hover mx-auto mb-10 block max-w-xl p-4 text-center"
    >
      <p className="text-sm font-medium text-moon-50">
        <span className="pill pill-live mr-2">● live</span>
        {live.entry.title ?? "A survey"} — {live.participants} participant
        {live.participants === 1 ? "" : "s"} so far
      </p>
      <p className="mt-1 text-xs text-moon-300/70">
        Anonymous · one response per wallet · takes under a minute
      </p>
    </Link>
  );
}

const PHASES = [
  {
    icon: "🌑",
    title: "New moon",
    body: "Your answers are born in shadow — private witnesses that never touch the ledger.",
  },
  {
    icon: "🌒",
    title: "Waxing",
    body: "Your wallet proves eligibility in ZK. Identity stays hidden; participation becomes provable.",
  },
  {
    icon: "🌓",
    title: "Quarter",
    body: "One-way nullifiers make double voting impossible without making voters traceable.",
  },
  {
    icon: "🌕",
    title: "Full moon",
    body: "Only the aggregate steps into the light: tallies and counts, verifiable by anyone.",
  },
];

function MoonPhases() {
  return (
    <section className="pt-12">
      <h2 className="mb-2 text-center text-2xl font-semibold text-moon-50">
        From shadow to light
      </h2>
      <p className="mb-8 text-center text-sm text-moon-300/70">
        At the new moon, the sky holds the moon entirely in shadow — present,
        but unseen. So it is with every respondent.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PHASES.map((p, i) => (
          <div key={p.title} className="card card-hover relative p-5">
            <span className="text-3xl">{p.icon}</span>
            <p className="mt-3 text-sm font-semibold text-moon-50">{p.title}</p>
            <p className="mt-1 text-sm text-moon-300">{p.body}</p>
            {i < PHASES.length - 1 && (
              <span className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-moon-300/40 lg:block">
                →
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="py-20 text-center">
        <p className="pill pill-warn mx-auto mb-6 inline-flex">
          🌑 live on Midnight Preprod
        </p>
        <h1 className="mx-auto mb-6 max-w-2xl text-5xl font-bold leading-tight tracking-tight">
          <span className="bg-moon-text bg-clip-text text-transparent">
            Anonymous Feedback.
          </span>
          <br />
          <span className="text-moon-300/80">Verifiable Participation.</span>
        </h1>
        <p className="mx-auto mb-10 max-w-xl text-moon-300">
          Create surveys where respondents prove eligibility via ZK proof
          without revealing their identity. Only aggregate tallies hit the
          public ledger.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/create" className="btn-primary">
            Create Survey
          </Link>
          <Link href="/dashboard" className="btn-ghost">
            View Dashboard
          </Link>
        </div>
      </section>

      {/* Live survey banner (only when the registry knows an active one) */}
      <LiveSurveyBanner />

      {/* Privacy model summary */}
      <PrivacyExplainer />

      {/* Moon-phase narrative */}
      <MoonPhases />
    </div>
  );
}
