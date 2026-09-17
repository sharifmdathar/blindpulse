"use client";

import { useState } from "react";
import { useSurvey } from "@/hooks/useSurvey";
import { saveSurvey, type StoredSurvey } from "@/lib/survey-store";
import type { SurveyQuestion } from "@/lib/types";
import Link from "next/link";

function emptyQuestion(index: number): SurveyQuestion {
  return { index, text: "", options: ["", ""] };
}

export default function SurveyCreator() {
  const { createSurvey, loading, error } = useSurvey();
  const [title, setTitle] = useState("");
  const [questionCount, setQuestionCount] = useState(1);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([
    emptyQuestion(0),
  ]);
  const [deployedId, setDeployedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedRegistry, setCopiedRegistry] = useState(false);
  const [googleFormUrl, setGoogleFormUrl] = useState("");
  const [savedSurvey, setSavedSurvey] = useState<StoredSurvey | null>(null);

  /**
   * Copy the respondent-facing share link (/survey/<id>) to the clipboard.
   * PUBLIC: the link contains only the public contract address.
   */
  const copyShareLink = async () => {
    if (!deployedId) return;
    const link = `${window.location.origin}/survey/${deployedId}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permissions / insecure context) — prompt lets
      // the organizer copy manually instead of failing silently.
      window.prompt("Copy the survey link:", link);
    }
  };

  const handleCountChange = (n: number) => {
    const clamped = Math.max(1, Math.min(20, n));
    setQuestionCount(clamped);
    setQuestions((prev) => {
      const next = [...prev];
      while (next.length < clamped) next.push(emptyQuestion(next.length));
      while (next.length > clamped) next.pop();
      return next;
    });
  };

  const updateQuestion = (i: number, text: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], text };
      return next;
    });
  };

  const updateOption = (qi: number, oi: number, val: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      const opts = [...next[qi].options];
      opts[oi] = val;
      next[qi] = { ...next[qi], options: opts };
      return next;
    });
  };

  const addOption = (qi: number) => {
    setQuestions((prev) => {
      const next = [...prev];
      // Circuit bound: MAX_OPTIONS = 20 pre-created tally cells per question.
      if (next[qi].options.length >= 20) return next;
      next[qi] = { ...next[qi], options: [...next[qi].options, ""] };
      return next;
    });
  };

  const removeOption = (qi: number, oi: number) => {
    setQuestions((prev) => {
      const next = [...prev];
      const opts = next[qi].options.filter((_, i) => i !== oi);
      next[qi] = { ...next[qi], options: opts.length ? opts : [""] };
      return next;
    });
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    const blank = questions.some(
      (q) => !q.text.trim() || q.options.some((o) => !o.trim()),
    );
    if (blank) return;

    const survey = await createSurvey(questionCount);
    if (survey) {
      const stored: StoredSurvey = {
        id: survey.id,
        title: title.trim(),
        questionCount,
        questions: questions.map((q) => ({
          ...q,
          text: q.text.trim(),
          options: q.options.map((o) => o.trim()),
        })),
        createdAt: Date.now(),
        ...(googleFormUrl.trim().startsWith("https://")
          ? { googleFormUrl: googleFormUrl.trim() }
          : {}),
      };
      saveSurvey(stored);
      setSavedSurvey(stored);
      setDeployedId(survey.id);
    }
  };

  if (deployedId && savedSurvey) {
    const registryEntry = {
      id: savedSurvey.id,
      title: savedSurvey.title,
      questionCount: savedSurvey.questionCount,
      questions: savedSurvey.questions,
      createdAt: savedSurvey.createdAt,
      status: "live",
      ...(savedSurvey.googleFormUrl
        ? { googleFormUrl: savedSurvey.googleFormUrl }
        : {}),
    };
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-green-200 bg-green-50 p-6">
        <p className="mb-2 text-lg font-semibold text-green-800">
          Survey deployed!
        </p>
        <p className="mb-4 text-sm text-green-700">
          Contract ID:{" "}
          <span className="font-mono text-xs">{deployedId}</span>
        </p>
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-medium">One manual step to stay shareable:</p>
          <p className="mt-1">
            Click below and append the copied JSON to the{" "}
            <code>surveys</code> array in{" "}
            <code>public/survey-registry.json</code>, then commit. Until then,
            other browsers see generic labels on your survey pages.
          </p>
        </div>
        <div className="mb-4 flex gap-2">
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  JSON.stringify(registryEntry, null, 2),
                );
                setCopiedRegistry(true);
                setTimeout(() => setCopiedRegistry(false), 2000);
              } catch {
                window.prompt("Copy this registry entry:", JSON.stringify(registryEntry, null, 2));
              }
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            {copiedRegistry ? "Copied ✓" : "Copy registry entry"}
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/survey/${deployedId}`}
            className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
          >
            Take Survey
          </Link>
          <Link
            href={`/results/${deployedId}`}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            View Results
          </Link>
          <button
            onClick={copyShareLink}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            {copied ? "Copied ✓" : "Copy link"}
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Shared links are self-contained — anyone opening them gets the
          question text restored from the public registry automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="rounded-lg border p-6">
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Survey title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Q4 Employee Feedback"
          className="mb-4 w-full rounded-md border px-3 py-2 text-sm"
        />

        <label className="mb-1 block text-sm font-medium text-gray-700">
          Number of questions (max 20)
        </label>
        <input
          type="number"
          min={1}
          max={20}
          value={questionCount}
          onChange={(e) => handleCountChange(Number(e.target.value))}
          className="mb-4 w-full rounded-md border px-3 py-2"
        />

        <div className="space-y-4">
          {questions.map((q, qi) => (
            <div key={qi} className="rounded-md border p-3">
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Question {qi + 1}
              </label>
              <input
                type="text"
                value={q.text}
                onChange={(e) => updateQuestion(qi, e.target.value)}
                placeholder="Write your question..."
                className="mb-2 w-full rounded-md border px-3 py-1.5 text-sm"
              />
              <div className="space-y-1">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex gap-1">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => updateOption(qi, oi, e.target.value)}
                      placeholder={`Option ${oi + 1}`}
                      className="w-full rounded-md border px-2 py-1 text-sm"
                    />
                    {q.options.length > 2 && (
                      <button
                        onClick={() => removeOption(qi, oi)}
                        className="px-2 text-sm text-red-500 hover:text-red-700"
                      >
                        x
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => addOption(qi)}
                disabled={q.options.length >= 20}
                className="mt-1 text-xs text-gray-500 hover:text-gray-700 disabled:text-gray-300"
              >
                + Add option{q.options.length >= 20 ? " (max 20)" : ""}
              </button>
            </div>
          ))}
        </div>

        <label className="mt-4 mb-1 block text-sm font-medium text-gray-700">
          Google Form fallback URL (optional)
        </label>
        <input
          type="url"
          value={googleFormUrl}
          onChange={(e) => setGoogleFormUrl(e.target.value)}
          placeholder="https://docs.google.com/forms/d/e/.../viewform"
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <p className="mt-1 mb-4 text-xs text-gray-500">
          Shown as a wallet-free fallback on the survey page. Responses go to
          the organizer off-chain — not part of the on-chain anonymous tally.
        </p>

        <button
          onClick={handleCreate}
          disabled={loading || !title.trim()}
          className="mt-2 w-full rounded-md bg-black px-6 py-2 text-sm text-white hover:bg-gray-800 disabled:bg-gray-400"
        >
          {loading ? "Deploying..." : "Deploy Survey Contract"}
        </button>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
