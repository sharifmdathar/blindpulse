/**
 * Lace Wallet integration via DApp Connector API.
 * PUBLIC: Wallet address (after user authorizes connection).
 * PRIVATE: Private keys and credentials remain in the wallet extension.
 */

import type { WalletState } from "./types";

let walletAddress: string | null = null;
let connected = false;

/** Request Lace connection on Preprod network */
export async function connect(): Promise<string> {
  const cardano = (window as Record<string, unknown>).cardano as
    | { enable: () => Promise<{ getChangeAddress: () => Promise<string> }> }
    | undefined;

  if (!cardano) {
    throw new Error(
      "Lace wallet not detected. Install the Lace extension and enable it on Preprod network.",
    );
  }

  const api = await cardano.enable();
  const address = await api.getChangeAddress();
  connected = true;
  walletAddress = address;
  return walletAddress;
}

/** Disconnect and clean up session */
export async function disconnect(): Promise<void> {
  connected = false;
  walletAddress = null;
}

/** Get the connected wallet address (null if not connected) */
export function getConnectedAddress(): string | null {
  return walletAddress;
}

/** Check if wallet is currently connected */
export function isConnected(): boolean {
  return connected;
}

/** Get current wallet state */
export function getWalletState(): WalletState {
  if (connected) return "connected";
  if (walletAddress && !connected) return "connecting";
  return "disconnected";
}
