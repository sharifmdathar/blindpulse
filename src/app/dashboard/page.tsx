"use client";

/**
 * /dashboard — lists every survey this browser knows about, with live
 * on-chain status (active flag, participant count) pulled from the ledger.
 *
 * PUBLIC: reads only aggregate ledger state + off-chain survey metadata.
 * PRIVATE: nothing — no wallet needed to view this page.
 *
 * Survey discovery is intentionally off-chain: the chain stores aggregate
 * tallies under contract addresses, and there is no on-chain registry of
 * "surveys created by me", so the organizer's browser (localStorage) is the
 * source of the list. Anyone opening the dashboard on a machine that has
 * never seen a survey can still paste a contract address to add it.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSurveys, saveSurvey, type StoredSurvey } from "@/lib/survey-store";
import { getSurveyMetadata } from "@/lib/contract-api";

type ChainStatus = {
  loading: boolean;
  active?: boolean;
  participants?: number;
  live?: boolean; // found on-chain via indexer
};

const HEX32 = /^(0x)?[0-9a-fA-F]{64}$/;

function normalizeAddress(raw: string): string | null {
  const clean = raw.trim().replace(/^0x/, "");
  return HEX32.test(clean) ? clean.toLowerCase() : null;
}

/** One known survey row: off-chain title + live on-chain counters. */
function SurveyRow({ survey }: { survey: StoredSurvey }) {
  const [status, setStatus] = useState<ChainStatus>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    getSurveyMetadata(survey.id).then((meta) => {
      if (cancelled) return;
      if (!meta) {
        setStatus({ loading: false, live: false });
      } else {
        setStatus({
          loading: false,
          live: true,
          active: meta.surveyActive,
          participants: meta.participantCount,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [survey.id]);

  const badge = status.loading ? (
    <span className="text-xs text-gray-400">checking chain…</span>
  ) : status.live === false ? (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
      not found on-chain
    </span>
  ) : status.active ? (
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
      ongoing
    </span>
  ) : (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
      closed
    </span>
  );

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{survey.title}</p>
          {badge}
        </div>
        <p className="mt-0.5 truncate font-mono text-xs text-gray-400">
          {survey.id}
        </p>
        <p className="mt-1 text-sm text-gray-500">
          {status.loading
            ? "…"
            : status.live
              ? `${status.participants ?? 0} participant${(status.participants ?? 0) === 1 ? "" : "s"}`
              : "No on-chain state found for this address."}
          {" · "}
          {survey.questionCount} question
          {survey.questionCount !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="ml-4 flex shrink-0 gap-2">
        <Link
          href={`/results/${survey.id}`}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Results
        </Link>
        {status.active && (
          <Link
            href={`/survey/${survey.id}`}
            className="rounded-md bg-black px-3 py-1.5 text-sm text-white hover:bg-gray-800"
          >
            Take Survey
          </Link>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  // hydrate guards against SSR/localStorage mismatch on client-only render.
  const [surveys, setSurveys] = useState<Record<string, StoredSurvey> | null>(
    null,
  );
  const [adding, setAdding] = useState(false);
  const [paste, setPaste] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    setSurveys(getSurveys());
  }, []);

  const sorted = useMemo(() => {
    if (!surveys) return [];
    return Object.values(surveys).sort((a, b) => b.createdAt - a.createdAt);
  }, [surveys]);

  const addByAddress = () => {
    const id = normalizeAddress(paste);
    if (!id) {
      setAddError("Enter a 64-hex-char contract address.");
      return;
    }
    if (surveys && surveys[id]) {
      setAddError("That survey is already listed.");
      return;
    }
    saveSurvey({
      id,
      title: `Survey ${id.slice(0, 10)}…`,
      questionCount: 0,
      questions: [],
      createdAt: Date.now(),
    });
    setSurveys(getSurveys());
    setPaste("");
    setAddError(null);
    setAdding(false);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-gray-500">
            Ongoing surveys and their live aggregate counts.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setAdding((v) => !v)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            {adding ? "Cancel" : "Add by address"}
          </button>
          <Link
            href="/create"
            className="rounded-md bg-black px-3 py-1.5 text-sm text-white hover:bg-gray-800"
          >
            New Survey
          </Link>
        </div>
      </div>

      {adding && (
        <div className="mb-6 rounded-lg border p-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Contract address
          </label>
          <input
            type="text"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="9b6e0eed1f8a8f2a79ed2db9fe35570e1ad30ab8f8c358c44bc4b7e06ed7eeff"
            className="mb-2 w-full rounded-md border px-3 py-2 font-mono text-xs"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Adds the on-chain survey to this list (metadata shown as generic
              labels unless this browser has it).
            </p>
            <button
              onClick={addByAddress}
              disabled={!paste.trim()}
              className="rounded-md bg-black px-3 py-1.5 text-sm text-white hover:bg-gray-800 disabled:bg-gray-400"
            >
              Add
            </button>
          </div>
          {addError && <p className="mt-2 text-sm text-red-600">{addError}</p>}
        </div>
      )}

      {surveys === null ? (
        <div className="py-12 text-center text-gray-500">Loading…</div>
      ) : sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="mb-2 text-gray-600">No surveys yet.</p>
          <p className="text-sm text-gray-400">
            Deploy one from the{" "}
            <Link href="/create" className="underline hover:text-gray-600">
              create page
            </Link>{" "}
            — it will appear here with live on-chain status.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((s) => (
            <SurveyRow key={s.id} survey={s} />
          ))}
        </div>
      )}

      <p className="mt-8 text-center text-xs text-gray-400">
        This list lives in this browser only (survey metadata is off-chain by
        design). The chain itself holds aggregate tallies per contract address.
      </p>
    </div>
  );
}
