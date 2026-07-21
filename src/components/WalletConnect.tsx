"use client";

import { useWallet } from "@/hooks/useWallet";
import { truncateAddress } from "@/lib/utils";

export default function WalletConnect() {
  const { address, isConnected, connect, disconnect, status, error } =
    useWallet();

  if (status === "connecting") {
    return (
      <button
        disabled
        className="rounded-md bg-gray-400 px-4 py-2 text-sm text-white cursor-not-allowed"
      >
        Connecting...
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600 font-mono">
          {truncateAddress(address)}
        </span>
        <button
          onClick={disconnect}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={connect}
        className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
      >
        Connect Wallet
      </button>
      {error && (
        <p className="max-w-xs text-right text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
