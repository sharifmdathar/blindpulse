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
      <div className="card mx-auto max-w-lg border-emerald-400/30 p-6">
        <p className="mb-2 text-lg font-semibold text-moon-50">
          Survey deployed!
        </p>
        <p className="mb-4 text-sm text-moon-300">
          Contract ID:{" "}
          <span className="font-mono text-xs text-moon-100">{deployedId}</span>
        </p>

        <div className="mb-4 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] p-3 text-xs text-amber-200">
          <p className="font-medium">One manual step to stay shareable:</p>
          <p className="mt-1">
            Click below and append the copied JSON to the <code>surveys</code>{" "}
            array in <code>public/survey-registry.json</code>, then commit.
            Until then, other browsers see generic labels on your survey pages.
          </p>
        </div>
        <div className="mb-4 flex gap-2">
          <button
            onClick={async () => {
              const entryJson = JSON.stringify(registryEntry, null, 2);
              try {
                await navigator.clipboard.writeText(entryJson);
                setCopiedRegistry(true);
                setTimeout(() => setCopiedRegistry(false), 2000);
              } catch {
                window.prompt("Copy this registry entry:", entryJson);
              }
            }}
            className="btn-mini"
          >
            {copiedRegistry ? "Copied ✓" : "Copy registry entry"}
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/survey/${deployedId}`} className="btn-primary">
            Take Survey
          </Link>
          <Link href={`/results/${deployedId}`} className="btn-ghost">
            View Results
          </Link>
          <button onClick={copyShareLink} className="btn-ghost">
            {copied ? "Copied ✓" : "Copy link"}
          </button>
        </div>
        <p className="mt-3 text-xs text-moon-300/70">
          Shared links are self-contained — anyone opening them gets the
          question text restored from the public registry automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="card p-6">
        <label className="mb-1 block text-sm font-medium text-moon-200">
          Survey title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Q4 Employee Feedback"
          className="input-dark mb-4"
        />

        <label className="mb-1 block text-sm font-medium text-moon-200">
          Number of questions (max 20)
        </label>
        <input
          type="number"
          min={1}
          max={20}
          value={questionCount}
          onChange={(e) => handleCountChange(Number(e.target.value))}
          className="input-dark mb-4"
        />

        <div className="space-y-4">
          {questions.map((q, qi) => (
            <div
              key={qi}
              className="rounded-lg border border-white/10 bg-white/[0.02] p-3"
            >
              <label className="mb-1 block text-xs font-medium text-moon-300">
                Question {qi + 1}
              </label>
              <input
                type="text"
                value={q.text}
                onChange={(e) => updateQuestion(qi, e.target.value)}
                placeholder="Write your question..."
                className="input-dark mb-2"
              />
              <div className="space-y-1">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex gap-1">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => updateOption(qi, oi, e.target.value)}
                      placeholder={`Option ${oi + 1}`}
                      className="input-dark"
                    />
                    {q.options.length > 2 && (
                      <button
                        onClick={() => removeOption(qi, oi)}
                        className="px-2 text-sm text-rose-300 hover:text-rose-200"
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
                className="mt-1 text-xs text-moon-300 hover:text-moon-100 disabled:text-moon-300/30"
              >
                + Add option{q.options.length >= 20 ? " (max 20)" : ""}
              </button>
            </div>
          ))}
        </div>

        <label className="mt-4 mb-1 block text-sm font-medium text-moon-200">
          Google Form fallback URL (optional)
        </label>
        <input
          type="url"
          value={googleFormUrl}
          onChange={(e) => setGoogleFormUrl(e.target.value)}
          placeholder="https://docs.google.com/forms/d/e/.../viewform"
          className="input-dark"
        />
        <p className="mt-1 mb-4 text-xs text-moon-300/70">
          Shown as a wallet-free fallback on the survey page. Responses go to
          the organizer off-chain — not part of the on-chain anonymous tally.
        </p>

        <button
          onClick={handleCreate}
          disabled={loading || !title.trim()}
          className="btn-primary mt-2 w-full"
        >
          {loading ? "Deploying…" : "Deploy Survey Contract"}
        </button>

        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      </div>
    </div>
  );
}
