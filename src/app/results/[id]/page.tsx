"use client";

import { useParams } from "next/navigation";
import ResultsDashboard from "@/components/ResultsDashboard";

// Mock questions — in production these would be fetched from contract metadata
const MOCK_QUESTIONS = [
  {
    index: 0,
    text: "How satisfied are you?",
    options: ["Very", "Somewhat", "Neutral", "Not at all"],
  },
  {
    index: 1,
    text: "Would you recommend us?",
    options: ["Yes", "No", "Maybe"],
  },
];

export default function ResultsPage() {
  const params = useParams();
  const surveyId = params.id as string;

  return (
    <div>
      <ResultsDashboard surveyId={surveyId} questions={MOCK_QUESTIONS} />
    </div>
  );
}
