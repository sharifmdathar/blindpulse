"use client";

/**
 * React hook wrapping wallet.ts.
 * PUBLIC: Exposes wallet connection state and methods.
 * PRIVATE: Private keys remain in the Lace wallet extension.
 */

import { useState, useCallback, useEffect } from "react";
import type { WalletState } from "@/lib/types";
import * as wallet from "@/lib/wallet";

export interface UseWalletReturn {
  address: string | null;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  status: WalletState;
}

export function useWallet(): UseWalletReturn {
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<WalletState>("disconnected");

  const connect = useCallback(async () => {
    setStatus("connecting");
    try {
      const addr = await wallet.connect();
      setAddress(addr);
      setStatus("connected");
    } catch {
      setStatus("disconnected");
    }
  }, []);

  const disconnect = useCallback(() => {
    wallet.disconnect();
    setAddress(null);
    setStatus("disconnected");
  }, []);

  useEffect(() => {
    setAddress(wallet.getConnectedAddress());
    setStatus(wallet.getWalletState());
  }, []);

  return {
    address,
    isConnected: status === "connected",
    connect,
    disconnect,
    status,
  };
}
