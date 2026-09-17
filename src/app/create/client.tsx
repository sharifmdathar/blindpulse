"use client";

import { useWallet } from "@/hooks/useWallet";
import SurveyCreator from "@/components/SurveyCreator";

export default function CreateSurveyClient() {
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
        <h1 className="mb-4 text-2xl font-semibold">Create a Survey</h1>
        <p className="mb-6 text-gray-600">
          Connect your wallet to deploy a survey contract.
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
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Create a Survey</h1>
      <SurveyCreator />
    </div>
  );
}
