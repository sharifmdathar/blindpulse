import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";

export let walletApi: ConnectedAPI | null = null;
export let compiledContract: unknown = null;

export async function initProviders(api: ConnectedAPI): Promise<void> {
  walletApi = api;
  compiledContract = await import("../../managed/contract/index.js");
}

export function getWalletApi(): ConnectedAPI | null {
  return walletApi;
}
