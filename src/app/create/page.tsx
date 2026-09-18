"use client";

import dynamic from "next/dynamic";
import { useWallet } from "@/hooks/useWallet";

// Client-only: prevents the Midnight/WASM contract from being
// evaluated during SSR.
const SurveyCreator = dynamic(() => import("@/components/SurveyCreator"), {
  ssr: false,
  loading: () => <p className="text-moon-300/60">Loading…</p>,
});

export default function CreateSurveyPage() {
  const { isConnected, connect, status } = useWallet();

  if (status === "connecting") {
    return (
      <div className="py-12 text-center text-moon-300/60">
        Connecting wallet…
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="py-12 text-center">
        <h1 className="mb-4 text-2xl font-semibold text-moon-50">
          Create a Survey
        </h1>
        <p className="mb-8 text-moon-300">
          Connect your wallet to deploy a survey contract.
        </p>
        <button onClick={connect} className="btn-primary px-6 py-3">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-moon-50">
        Create a Survey
      </h1>
      <SurveyCreator />
    </div>
  );
}
