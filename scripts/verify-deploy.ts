/**
 * Standing verifier: read the deployed BlindPulse contract's public state
 * from the Preprod indexer via the exact pipeline the DApp uses
 * (indexerPublicDataProvider -> getPublicStates -> managed ledger()).
 *
 * Usage:
 *   bun scripts/verify-deploy.ts
 *   CONTRACT_ADDRESS=<hex> bun scripts/verify-deploy.ts
 *
 * PUBLIC: reads only aggregate public state (tallies, counters, flags).
 * No private data ever flows through this script — mirrors the DApp's
 * read-only paths.
 */
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { getPublicStates } from "@midnight-ntwrk/midnight-js-contracts";
import {
  decodeContractAddress,
  type ContractAddress,
} from "@midnight-ntwrk/ledger-v8";
import { ledger, type Ledger } from "../managed/contract/index.js";

const ADDRESS =
  process.env.CONTRACT_ADDRESS ??
  "c85d9e980809d76f7f0204be2730c752b0abfb5ae572c1fa038622c7a0ba7d4f";

const INDEXER_URI = "https://indexer.preprod.midnight.network/api/v4/graphql";
const INDEXER_WS_URI =
  "wss://indexer.preprod.midnight.network/api/v4/graphql/ws";

function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(
    hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? [],
  );
}

async function main(): Promise<void> {
  setNetworkId("preprod");
  const address: ContractAddress = decodeContractAddress(hexToBytes(ADDRESS));

  const provider = indexerPublicDataProvider(INDEXER_URI, INDEXER_WS_URI);
  const { contractState } = await getPublicStates(provider, address);
  const state = ledger(contractState.data) as unknown as Ledger;

  const questionCount = Number(state.questionCount);
  const participantCount = Number(state.participantCount);

  console.log("=== BlindPulse on-chain state (Preprod) ===");
  console.log("contract:     ", ADDRESS);
  console.log("surveyActive: ", state.surveyActive);
  console.log("questionCount:", questionCount);
  console.log("participants: ", participantCount);
  // organizer is the coin public key recorded at deploy; closeSurvey
  // asserts the caller's (private) coin key against it. All zeros means a
  // pre-gate deploy where close could not be organizer-checked.
  const organizerHex = Array.from(state.organizer as unknown as Uint8Array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  console.log(
    "organizer:    ",
    organizerHex === "0".repeat(64)
      ? "(all zeros — pre-gate deploy)"
      : organizerHex,
  );

  const tallies: Record<number, Record<number, number>> = {};
  for (let qi = 0; qi < questionCount; qi++) {
    const row = state.tallies.lookup(BigInt(qi));
    tallies[qi] = {};
    for (let oi = 0; oi < 20; oi++) {
      if (row.member(BigInt(oi))) {
        tallies[qi][oi] = Number(row.lookup(BigInt(oi)).read());
      }
    }
  }
  console.log("tallies:      ", JSON.stringify(tallies));

  if (questionCount === 0 || !state.surveyActive) {
    console.log(
      "\nNOTE: questionCount is 0 — this was the orphaned deploy whose\n" +
        "metadata was never saved (UI stalled on Deploying). Create a fresh\n" +
        "survey at /create; this script will show its live counters.",
    );
  }
}

main().catch((err) => {
  console.error("verify-deploy failed:", err);
  process.exit(1);
});
