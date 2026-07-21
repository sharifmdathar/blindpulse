/**
 * Lace Wallet integration via DApp Connector API.
 * PUBLIC: Wallet address (after user authorizes connection).
 * PRIVATE: Private keys and credentials remain in the wallet extension.
 *
 * Lace injects itself under `window.midnight` as a record of UUID -> InitialAPI.
 * Call connect("preprod") to get a ConnectedAPI for address/tx operations.
 */

import type { WalletState } from "./types";
import type { InitialAPI, ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";

const NETWORK_ID = "preprod";

let walletApi: ConnectedAPI | null = null;
let walletAddress: string | null = null;
let connected = false;

/** Find a Midnight-compatible wallet in the page context */
function findWallet(): InitialAPI | undefined {
  const midnight = (window as unknown as Record<string, unknown>).midnight as
    | Record<string, unknown>
    | undefined;

  if (!midnight) return undefined;

  for (const key of Object.getOwnPropertyNames(midnight)) {
    const entry = midnight[key] as InitialAPI | undefined;
    if (entry && typeof entry.connect === "function") {
      return entry;
    }
  }
  return undefined;
}

/** Request Lace wallet connection on Preprod network */
export async function connect(): Promise<string> {
  const api = findWallet();

  if (!api) {
    throw new Error(
      "Lace wallet not detected. Install the Lace extension and enable it on Preprod network.",
    );
  }

  walletApi = await api.connect(NETWORK_ID);
  const { unshieldedAddress } = await walletApi.getUnshieldedAddress();

  connected = true;
  walletAddress = unshieldedAddress;
  return walletAddress;
}

/** Disconnect and clean up session */
export async function disconnect(): Promise<void> {
  connected = false;
  walletAddress = null;
  walletApi = null;
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
