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
        className="rounded-lg bg-night-600 px-4 py-2 text-sm text-moon-300 cursor-not-allowed"
      >
        Connecting...
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="pill pill-live">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="font-mono">{truncateAddress(address)}</span>
        </span>
        <button onClick={disconnect} className="btn-mini">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button onClick={connect} className="btn-primary px-4 py-2">
        Connect Wallet
      </button>
      {error && (
        <p className="max-w-xs text-right text-xs text-rose-300">{error}</p>
      )}
    </div>
  );
}
