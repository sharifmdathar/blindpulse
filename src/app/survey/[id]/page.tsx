"use client";

import { useParams } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import SurveyForm from "@/components/SurveyForm";

// Mock questions — in production these would be fetched from the contract
const MOCK_QUESTIONS = [
  { index: 0, text: "How satisfied are you?", options: ["Very", "Somewhat", "Neutral", "Not at all"] },
  { index: 1, text: "Would you recommend us?", options: ["Yes", "No", "Maybe"] },
];

export default function SurveyPage() {
  const params = useParams();
  const surveyId = params.id as string;
  const { isConnected, connect, status } = useWallet();

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
        <h1 className="mb-4 text-2xl font-semibold">Take Survey</h1>
        <p className="mb-6 text-gray-600">
          Connect your wallet to verify your eligibility and submit
          anonymously.
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
    <SurveyForm
      surveyId={surveyId}
      questionCount={MOCK_QUESTIONS.length}
      questions={MOCK_QUESTIONS}
    />
  );
}
