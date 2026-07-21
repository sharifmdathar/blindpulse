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
  // TODO: implement real Lace DApp Connector API call
  // const api = await window.cardano.enable();
  // const address = await api.getChangeAddress();
  connected = true;
  walletAddress =
    "addr_preprod1q..." + Math.random().toString(36).slice(2, 8);
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
